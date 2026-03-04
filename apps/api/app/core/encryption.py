"""
OmniFlow — AES-256-GCM encryption for bank credentials.

Key derivation uses HKDF-SHA256 (RFC 5869) instead of naive padding.
"""

import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import get_settings

# Static salt derived once — deterministic across restarts
_HKDF_SALT = hashlib.sha256(b"omniflow-static-salt").digest()[:16]
_HKDF_INFO = b"omniflow-aes256-gcm-v2"


def _get_server_key() -> bytes:
    """Derive a 32-byte AES key from ENCRYPTION_KEY via HKDF-SHA256."""
    settings = get_settings()
    raw = settings.ENCRYPTION_KEY.encode("utf-8")
    hkdf = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=_HKDF_SALT,
        info=_HKDF_INFO,
    )
    return hkdf.derive(raw)


def encrypt(plaintext: bytes, aad: bytes | None = None) -> bytes:
    """Server-side AES-256-GCM encrypt. Returns nonce + ciphertext + tag."""
    key = _get_server_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
    return nonce + ciphertext


def decrypt(blob: bytes, aad: bytes | None = None) -> bytes:
    """Server-side AES-256-GCM decrypt. blob = nonce (12) + ciphertext + tag."""
    key = _get_server_key()
    nonce = blob[:12]
    ciphertext = blob[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, aad)
