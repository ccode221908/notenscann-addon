"""CorePass authentication endpoints."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.auth import (
    create_challenge,
    get_challenge_status,
    get_current_user,
    receive_callback,
    verify_jwt,
)
from fastapi import Depends

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/challenge")
def challenge():
    """Create a new login challenge. Returns QR code + URIs."""
    return create_challenge()


class CallbackPayload(BaseModel):
    session: str
    coreID: str
    signature: str | None = None


@router.post("/callback")
def callback(payload: CallbackPayload):
    """Endpoint called by CorePass app after QR scan."""
    ok = receive_callback(payload.session, payload.coreID)
    if not ok:
        raise HTTPException(status_code=400, detail="Unknown or expired session")
    return {"ok": True}


@router.get("/challenge/{challenge_id}")
def poll_challenge(challenge_id: str):
    """Poll challenge status. Returns token when authenticated."""
    return get_challenge_status(challenge_id)


@router.get("/session")
def session(core_id: str = Depends(get_current_user)):
    """Check current session validity."""
    return {"authenticated": True, "coreId": core_id}


@router.post("/logout")
def logout():
    """Client-side logout — token is discarded by the frontend."""
    return {"ok": True}
