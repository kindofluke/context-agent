"""HMAC signature verification middleware for FastAPI."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import time

from fastapi.responses import JSONResponse
from starlette.requests import Request

logger = logging.getLogger(__name__)


async def verify_request_signature(request: Request, call_next):
    """
    Middleware to verify HMAC signatures on /agent endpoint requests.
    Requires SESSION_SECRET environment variable to be set.

    Headers expected:
    - x-signature: Base64-encoded HMAC-SHA256 signature of request body
    - x-timestamp: (optional) Unix timestamp in milliseconds for replay protection
    """
    # Only verify /agent endpoint
    if request.url.path != "/agent":
        return await call_next(request)

    # Get secret from environment
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        logger.error("Signature verification enabled but SESSION_SECRET env var not set")
        return JSONResponse(
            {"error": "Server configuration error: SESSION_SECRET not configured"},
            status_code=500
        )

    # Get signature from headers
    signature_header = request.headers.get("x-signature")
    timestamp_header = request.headers.get("x-timestamp")

    if not signature_header:
        logger.warning("Missing x-signature header on /agent request")
        return JSONResponse(
            {"error": "Missing signature"},
            status_code=401
        )

    # Read request body
    body = await request.body()
    body_str = body.decode("utf-8")

    # Compute expected signature using HMAC-SHA256
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        body_str.encode("utf-8"),
        hashlib.sha256
    ).digest()
    expected_sig_b64 = base64.b64encode(expected_sig).decode("utf-8")

    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(signature_header, expected_sig_b64):
        logger.warning("Invalid signature on /agent request")
        return JSONResponse(
            {"error": "Invalid signature"},
            status_code=401
        )

    # Optional: Check timestamp to prevent replay attacks
    if timestamp_header:
        try:
            req_time = int(timestamp_header)
            now = int(time.time() * 1000)
            # Reject requests older than 5 minutes
            if abs(now - req_time) > 300000:
                logger.warning("Request timestamp too old: %s", timestamp_header)
                return JSONResponse(
                    {"error": "Request timestamp too old"},
                    status_code=401
                )
        except ValueError:
            logger.warning("Invalid timestamp header: %s", timestamp_header)

    logger.info("Request signature verified successfully")

    # Need to reconstruct request with body since we consumed it
    async def receive():
        return {"type": "http.request", "body": body}

    request._receive = receive
    return await call_next(request)
