"""Seeded roles with opaque server sessions; no credentials are stored in source."""

import hashlib
import os
import secrets
import time
from contextlib import closing
from typing import Optional
from urllib.parse import urlsplit, quote
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from . import database as store
from . import marketplace_auth
from .connected_store import transaction
from .demo_access import allows_browser_write

router = APIRouter(prefix="/v1/auth", tags=["Accounts"])
COOKIE = "trustcart_session"
VERIFIED_SESSION_PREFIX = "verified."
LOGIN_PASSWORD_ENV = {
    "buyer": "TRUSTCART_BUYER_PASSWORD",
    "seller1": "TRUSTCART_SELLER1_PASSWORD",
    "seller2": "TRUSTCART_SELLER2_PASSWORD",
    "reviewer": "TRUSTCART_REVIEWER_PASSWORD",
}


def requires_role_passwords():
    return bool(os.environ.get(marketplace_auth.CLIENT_CONFIG_ENV, "").strip())


def principal(request):
    return getattr(request.state, "user", None)


def require(request, role=None):
    user = principal(request)
    if not user:
        raise HTTPException(401, "Sign in required")
    if role and user["role"] != role:
        raise HTTPException(403, "This role cannot perform this action")
    return user


async def access_guard(request, call_next):
    request.state.user = None
    path = request.url.path
    scheme, _, bearer_token = request.headers.get("authorization", "").partition(" ")
    bearer = scheme.lower() == "bearer"
    token_request = path == marketplace_auth.TOKEN_PATH and request.method == "POST"
    if bearer or token_request:
        if COOKIE in request.cookies or (bearer and token_request):
            return marketplace_auth.oauth_error("invalid_request", 400)
        if not allows_browser_write(request):
            return marketplace_auth.oauth_error("invalid_request", 403)
        if bearer:
            request.state.user, failure = marketplace_auth.bearer_principal(request, bearer_token)
            if failure is not None:
                return failure
        response = await call_next(request)
        return set_response_headers(response, path)

    token = request.cookies.get(COOKIE)
    if token and (not requires_role_passwords() or token.startswith(VERIFIED_SESSION_PREFIX)):
        with closing(store.connect(request.app.state.database)) as connection:
            row = connection.execute(
                "SELECT account_id,csrf,expires_at FROM tc_sessions WHERE id=?",
                (hashlib.sha256(token.encode()).hexdigest(),),
            ).fetchone()
            if row and row[2] > time.time():
                account = connection.execute(
                    "SELECT role,shop_id FROM tc_accounts WHERE id=?", (row[0],)
                ).fetchone()
                if account:
                    request.state.user = dict(
                        id=row[0],
                        role=account[0],
                        shop_id=account[1],
                        csrf_token=row[1],
                    )
    public_read = request.method in ("GET", "HEAD") and (
        path in ("/", "/login", "/v1/auth/me", "/version")
        or path.startswith(("/static/", "/products/", "/v1/catalog/"))
    )
    login = path == "/v1/auth/login" and request.method == "POST"
    if not public_read and not login:
        user = principal(request)
        if not user:
            if path in (
                "/seller",
                "/reviewer",
                "/workspace",
                "/agency",
            ) or path.startswith("/agency/"):
                destination = "/login"
                if path == "/agency" or path.startswith("/agency/"):
                    destination += "?next=" + quote(
                        path + ("?" + request.url.query if request.url.query else ""),
                        safe="",
                    )
                return RedirectResponse(destination, status_code=303)
            return JSONResponse({"detail": "Sign in required"}, status_code=401)
        role = (
            "seller"
            if path == "/seller" or path.startswith("/v1/seller/")
            else (
                "reviewer"
                if path
                in (
                    "/reviewer",
                    "/workspace",
                    "/docs",
                    "/redoc",
                    "/openapi.json",
                    "/agency",
                )
                or path.startswith(("/v1/reviewer/", "/demo/", "/agency/"))
                else None
            )
        )
        # The old API is a reviewer-only diagnostic surface. It cannot grant storefront badges.
        if path.startswith("/v1/") and not path.startswith(
            ("/v1/auth/", "/v1/seller/", "/v1/reviewer/", "/v1/documents/")
        ):
            role = "reviewer"
        if role and user["role"] != role:
            return JSONResponse(
                {"detail": "This role cannot access this resource"}, status_code=403
            )
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and urlsplit(origin).netloc != request.url.netloc:
            return JSONResponse(
                {"detail": "Cross-origin writes are not allowed"}, status_code=403
            )
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse(
                {"detail": "Cross-site writes are not allowed"}, status_code=403
            )
        if not login and not secrets.compare_digest(
            request.headers.get("x-csrf-token", ""),
            (principal(request) or {}).get("csrf_token", "!"),
        ):
            return JSONResponse({"detail": "Invalid CSRF token"}, status_code=403)
    response = await call_next(request)
    return set_response_headers(response, path)


def set_response_headers(response, path):
    if not path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


class Login(BaseModel):
    username: str = Field(max_length=80)
    password: Optional[str] = Field(default=None, max_length=500)


@router.post("/login")
def login(payload: Login, request: Request, response: Response):
    password_env = LOGIN_PASSWORD_ENV.get(payload.username)
    if password_env is None:
        raise HTTPException(401, "Unknown demo account")
    token = secrets.token_urlsafe(32)
    if requires_role_passwords():
        expected = os.environ.get(password_env)
        if not expected or not secrets.compare_digest((payload.password or "").encode(), expected.encode()):
            raise HTTPException(401, "Invalid account or password")
        # The marker is included in the stored digest and distinguishes verified sessions.
        token = VERIFIED_SESSION_PREFIX + token
    csrf = secrets.token_urlsafe(32)
    with transaction(request.app.state.database) as connection:
        old = request.cookies.get(COOKIE)
        if old:
            connection.execute(
                "DELETE FROM tc_sessions WHERE id=?",
                (hashlib.sha256(old.encode()).hexdigest(),),
            )
        row = connection.execute(
            "SELECT role,shop_id FROM tc_accounts WHERE id=?", (payload.username,)
        ).fetchone()
        connection.execute(
            "INSERT INTO tc_sessions VALUES (?,?,?,?)",
            (
                hashlib.sha256(token.encode()).hexdigest(),
                payload.username,
                csrf,
                time.time() + 8 * 3600,
            ),
        )
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=8 * 3600,
        path="/",
    )
    return dict(id=payload.username, role=row[0], shop_id=row[1], csrf_token=csrf)


@router.get("/me")
def me(request: Request):
    return principal(request) or {"role": "guest", "csrf_token": None}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE, "")
    with transaction(request.app.state.database) as connection:
        connection.execute(
            "DELETE FROM tc_sessions WHERE id=?",
            (hashlib.sha256(token.encode()).hexdigest(),),
        )
    response.delete_cookie(COOKIE, path="/")
    return {"signed_out": True}
