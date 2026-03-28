"""CorePass authentication: challenge store, JWT utilities, FastAPI dependency."""
import base64
import io
import logging
import time
import uuid
from typing import Optional

import qrcode
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Settings (injected lazily to avoid circular imports)
# ---------------------------------------------------------------------------

def _settings():
    from app.config import settings
    return settings


# ---------------------------------------------------------------------------
# Challenge store (in-memory, TTL 5 minutes)
# ---------------------------------------------------------------------------

_challenges: dict[str, dict] = {}
CHALLENGE_TTL = 300  # seconds


def _purge_expired():
    now = time.time()
    expired = [k for k, v in _challenges.items() if v["expires_at"] < now]
    for k in expired:
        del _challenges[k]


def create_challenge() -> dict:
    """Generate a new login challenge and return display data."""
    _purge_expired()
    s = _settings()

    challenge_id = str(uuid.uuid4())
    base_url = s.corepass_base_url.rstrip("/")
    callback_url = f"{base_url}/auth/callback"

    # corepass: URI — CorePass app opens this to authenticate
    login_uri = f"corepass:login/?session={challenge_id}&reply={callback_url}"
    # Mobile deep-link variant (same content, different presentation)
    mobile_uri = login_uri

    # Generate QR code as base64 PNG
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=6, border=2)
    qr.add_data(login_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    _challenges[challenge_id] = {
        "status": "pending",
        "core_id": None,
        "expires_at": time.time() + CHALLENGE_TTL,
        "token": None,
    }

    return {
        "challengeId": challenge_id,
        "loginUri": login_uri,
        "mobileUri": mobile_uri,
        "qrDataUrl": qr_data_url,
    }


def receive_callback(session: str, core_id: str) -> bool:
    """Called when CorePass app posts back. Returns True if challenge was found."""
    challenge = _challenges.get(session)
    if not challenge:
        logger.warning("callback for unknown session %s", session)
        return False
    if challenge["expires_at"] < time.time():
        logger.warning("callback for expired session %s", session)
        return False

    token = create_jwt(core_id)
    challenge["status"] = "authenticated"
    challenge["core_id"] = core_id
    challenge["token"] = token
    logger.info("CorePass login: session=%s core_id=%s", session, core_id)
    return True


def get_challenge_status(challenge_id: str) -> dict:
    _purge_expired()
    challenge = _challenges.get(challenge_id)
    if not challenge:
        return {"status": "expired"}
    if challenge["expires_at"] < time.time():
        return {"status": "expired"}
    result: dict = {"status": challenge["status"]}
    if challenge["status"] == "authenticated":
        result["token"] = challenge["token"]
        result["coreId"] = challenge["core_id"]
    return result


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"
JWT_EXPIRE_SECONDS = 60 * 60 * 24 * 7  # 7 days


def create_jwt(core_id: str) -> str:
    s = _settings()
    payload = {
        "sub": core_id,
        "exp": int(time.time()) + JWT_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=ALGORITHM)


def verify_jwt(token: str) -> str:
    """Verify token and return core_id (sub), or raise 401."""
    s = _settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[ALGORITHM])
        core_id: Optional[str] = payload.get("sub")
        if not core_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return core_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_jwt(credentials.credentials)
