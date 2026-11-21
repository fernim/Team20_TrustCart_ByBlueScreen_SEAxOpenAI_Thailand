from fastapi import HTTPException, Request


REVIEWER_ACCESS_RESPONSES = {
    403: {"description": "This deployment requires the separate reviewer login"},
}


def require_demo_reviewer(request: Request) -> None:
    """Apply the hosted demo gate's role decision to reviewer operations."""
    if not getattr(request.state, "demo_reviewer_access", True):
        raise HTTPException(403, "Sign in with the separate reviewer login")


def allows_browser_write(request: Request) -> bool:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return True
    site = request.headers.get("sec-fetch-site")
    if site in {"same-site", "cross-site"}:
        return False
    if site == "same-origin":
        return True
    origin = request.headers.get("origin")
    return origin is None or origin == f"{request.url.scheme}://{request.url.netloc}"
