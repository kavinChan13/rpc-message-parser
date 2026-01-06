"""
Reverse Proxy Middleware for handling URL prefix stripping.

This middleware allows the application to be deployed behind a reverse proxy
at a sub-path (e.g., /rpc-parser/) by stripping the prefix from incoming requests.
"""

import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class PrefixStripMiddleware(BaseHTTPMiddleware):
    """Middleware that strips a configured prefix from the request path.

    This enables deploying the application under a sub-path when behind a
    reverse proxy (nginx, Traefik, etc.).

    Order of precedence for prefix detection:
    1. X-Forwarded-Prefix header from the incoming request (set by proxy)
    2. prefix argument passed when adding the middleware
    3. Environment variables: PREFIX or API_PREFIX or BASE_PATH

    When a prefix is found and the request path starts with it, the middleware
    updates request.scope['path'] and request.scope['raw_path'] and sets
    request.scope['root_path'] to the prefix so downstream routing behaves as if
    the app is mounted at that prefix.

    Example nginx configuration:
        location /rpc-parser/ {
            proxy_pass http://127.0.0.1:8000/;
            proxy_set_header X-Forwarded-Prefix /rpc-parser;
        }

    Example usage:
        app.add_middleware(PrefixStripMiddleware, prefix="/rpc-parser")
    """

    def __init__(self, app, prefix: str | None = None):
        super().__init__(app)
        # Get prefix from argument or environment variables
        self.prefix = (
            prefix
            or os.environ.get("PREFIX")
            or os.environ.get("API_PREFIX")
            or os.environ.get("BASE_PATH")
            or ""
        )

    async def dispatch(self, request: Request, call_next):
        # Extract prefix from X-Forwarded-Prefix header first (if present)
        # This allows the reverse proxy to dynamically set the prefix
        headers = {}
        for key, value in request.scope.get("headers", []):
            try:
                headers[key.decode().lower()] = value.decode()
            except (UnicodeDecodeError, AttributeError):
                pass

        prefix = headers.get("x-forwarded-prefix") or self.prefix

        if prefix:
            # Normalize prefix: ensure leading slash, no trailing slash
            if not prefix.startswith("/"):
                prefix = "/" + prefix
            prefix = prefix.rstrip("/")

            path = request.scope.get("path", "")

            if path.startswith(prefix):
                # Strip the prefix from path
                new_path = path[len(prefix):] or "/"
                request.scope["path"] = new_path

                # Update raw_path (bytes) if present
                raw = request.scope.get("raw_path")
                if raw is not None:
                    try:
                        raw_decoded = raw.decode()
                        if raw_decoded.startswith(prefix):
                            new_raw = raw_decoded[len(prefix):] or "/"
                            request.scope["raw_path"] = new_raw.encode()
                    except (UnicodeDecodeError, AttributeError):
                        # Leave raw_path untouched if any issue
                        pass

                # Set root_path so url_for and other helpers know the mount point
                request.scope["root_path"] = prefix

        response = await call_next(request)
        return response

