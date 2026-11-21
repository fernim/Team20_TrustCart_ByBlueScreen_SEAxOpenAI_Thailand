import base64
import binascii
import hashlib
import json
import os
import re
import secrets
from contextlib import closing
from dataclasses import dataclass
from time import time
from typing import Literal, Optional
from urllib.parse import unquote_plus

from fastapi import APIRouter, Depends, Form, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security.http import HTTPAuthorizationCredentials, HTTPBase
from pydantic import BaseModel

from . import database as store
from .connected_store import transaction


TOKEN_PATH = "/oauth/token"
TOKEN_LIFETIME = 15 * 60
CLIENT_CONFIG_ENV = "TRUSTCART_MARKETPLACE_CLIENTS"
READ = "seller:read"
WRITE = "seller:write"
SCOPES = {READ, WRITE}
TOKEN_HEADERS = {"Cache-Control": "no-store", "Pragma": "no-cache"}
CLIENT_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}")
RESOURCE_ID = r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
SELLER_PRODUCTS = r"/v1/seller/products"
SELLER_PRODUCT = rf"{SELLER_PRODUCTS}/{RESOURCE_ID}"
SELLER_SUBMISSION = rf"/v1/seller/submissions/{RESOURCE_ID}"
OPERATIONS = {
    "GET": (READ, (
        SELLER_PRODUCTS, SELLER_PRODUCT, rf"{SELLER_PRODUCT}/history",
        SELLER_SUBMISSION, rf"/v1/documents/{RESOURCE_ID}",
    )),
    "POST": (WRITE, (
        SELLER_PRODUCTS, rf"{SELLER_PRODUCT}/submissions", rf"{SELLER_SUBMISSION}/(?:documents|run)",
    )),
    "PUT": (WRITE, (SELLER_PRODUCT,)),
}

router = APIRouter(tags=["Marketplace OAuth"])
client_basic = HTTPBase(scheme="basic", scheme_name="MarketplaceClient", auto_error=False)


@dataclass(frozen=True)
class MarketplaceClient:
    secret: str
    shop_id: str
    scopes: frozenset[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    scope: str


def configured_clients() -> dict[str, MarketplaceClient]:
    try:
        raw = json.loads(os.environ.get(CLIENT_CONFIG_ENV, "{}"))
    except ValueError:
        return {}
    if not isinstance(raw, dict):
        return {}
    clients = {}
    for client_id, config in raw.items():
        if not CLIENT_ID.fullmatch(client_id) or not isinstance(config, dict):
            return {}
        secret, shop_id, scopes = (config.get(key) for key in ("secret", "shop_id", "scopes"))
        if not isinstance(secret, str) or not secret or not isinstance(shop_id, str) or not shop_id:
            return {}
        if not isinstance(scopes, list) or not scopes or any(
            not isinstance(scope, str) or scope not in SCOPES for scope in scopes
        ):
            return {}
        clients[client_id] = MarketplaceClient(secret, shop_id, frozenset(scopes))
    return clients


def oauth_error(code: str, status: int, challenge: Optional[str] = None) -> JSONResponse:
    headers = {**TOKEN_HEADERS, **({"WWW-Authenticate": challenge} if challenge else {})}
    return JSONResponse({"error": code}, status_code=status, headers=headers)


def basic_client(credentials):
    if credentials is None or credentials.scheme.lower() != "basic":
        return "", ""
    try:
        decoded = base64.b64decode(credentials.credentials, validate=True).decode("utf-8")
        client_id, delimiter, secret = decoded.partition(":")
        if delimiter:
            return unquote_plus(client_id, errors="strict"), unquote_plus(secret, errors="strict")
    except (binascii.Error, UnicodeError, ValueError):
        pass
    return "", ""


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post(TOKEN_PATH, response_model=TokenResponse)
async def issue_token(
    request: Request,
    response: Response,
    grant_type: Optional[str] = Form(None),
    scope: Optional[str] = Form(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(client_basic),
):
    """Exchange configured marketplace client credentials for a short-lived seller token."""
    clients = configured_clients()
    if not clients:
        return oauth_error("temporarily_unavailable", 503)
    if request.headers.get("content-type", "").partition(";")[0].strip().lower() != "application/x-www-form-urlencoded":
        return oauth_error("invalid_request", 400)
    form = await request.form()
    if (
        not grant_type
        or any(len(form.getlist(name)) > 1 for name in ("grant_type", "scope"))
        or {"client_id", "client_secret"} & form.keys()
    ):
        return oauth_error("invalid_request", 400)
    client_id, secret = basic_client(credentials)
    client = clients.get(client_id)
    unauthorized = 'Basic realm="TrustCart Marketplace"'
    if not client or not secrets.compare_digest(secret.encode(), client.secret.encode()):
        return oauth_error("invalid_client", 401, unauthorized)
    if grant_type != "client_credentials":
        return oauth_error("unsupported_grant_type", 400)
    selected = client.scopes if scope is None else frozenset(scope.split())
    if not selected or not selected <= client.scopes:
        return oauth_error("invalid_scope", 400)

    token = secrets.token_urlsafe(32)
    granted = " ".join(sorted(selected))
    now = int(time())
    with transaction(request.app.state.database) as connection:
        if not connection.execute("SELECT 1 FROM tc_shops WHERE id=?", (client.shop_id,)).fetchone():
            return oauth_error("invalid_client", 401, unauthorized)
        connection.execute("DELETE FROM tc_marketplace_tokens WHERE expires_at<=?", (now,))
        connection.execute(
            "INSERT INTO tc_marketplace_tokens VALUES (?,?,?,?,?)",
            (token_hash(token), client_id, client.shop_id, granted, now + TOKEN_LIFETIME),
        )
    response.headers.update(TOKEN_HEADERS)
    return TokenResponse(access_token=token, token_type="Bearer", expires_in=TOKEN_LIFETIME, scope=granted)


def bearer_principal(request: Request, token: str):
    clients = configured_clients()
    if not clients or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        return None, oauth_error("invalid_token", 401, 'Bearer error="invalid_token"')
    with closing(store.connect(request.app.state.database)) as connection:
        saved = connection.execute(
            "SELECT client_id, shop_id, scope FROM tc_marketplace_tokens WHERE id=? AND expires_at>?",
            (token_hash(token), int(time())),
        ).fetchone()
    client = clients.get(saved[0]) if saved else None
    if not client or client.shop_id != saved[1]:
        return None, oauth_error("invalid_token", 401, 'Bearer error="invalid_token"')
    granted = set(saved[2].split())
    if not granted <= client.scopes:
        return None, oauth_error("invalid_token", 401, 'Bearer error="invalid_token"')
    required, patterns = OPERATIONS.get(request.method, (None, ()))
    if not any(re.fullmatch(pattern, request.url.path) for pattern in patterns):
        return None, oauth_error("insufficient_scope", 403, 'Bearer error="insufficient_scope"')
    if required not in granted:
        return None, oauth_error("insufficient_scope", 403, f'Bearer error="insufficient_scope", scope="{required}"')
    return {"id": f"marketplace:{saved[0]}", "role": "seller", "shop_id": saved[1]}, None
