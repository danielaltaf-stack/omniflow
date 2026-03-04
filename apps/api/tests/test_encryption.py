"""
OmniFlow — Encryption tests.

Validates AES-256-GCM with HKDF-SHA256 key derivation:
  round-trip, nonce uniqueness, corrupted data, AAD, empty plaintext.
"""

from __future__ import annotations

import pytest
from cryptography.exceptions import InvalidTag

from app.core.encryption import decrypt, encrypt


# ═══════════════════════════════════════════════════════════════════
#  ROUND-TRIP
# ═══════════════════════════════════════════════════════════════════


def test_encrypt_decrypt_roundtrip():
    """Encrypt then decrypt should return original plaintext."""
    plaintext = b"Hello, OmniFlow!"
    blob = encrypt(plaintext)
    assert decrypt(blob) == plaintext


def test_encrypt_produces_minimum_size():
    """
    Encrypted blob = 12 (nonce) + len(plaintext) + 16 (GCM tag).
    """
    plaintext = b"test data 1234"
    blob = encrypt(plaintext)
    expected_min = 12 + len(plaintext) + 16
    assert len(blob) >= expected_min


def test_encrypt_nonce_uniqueness():
    """Two encryptions of the same plaintext should produce different blobs."""
    plaintext = b"same input"
    blob1 = encrypt(plaintext)
    blob2 = encrypt(plaintext)
    assert blob1 != blob2
    # But both decrypt to the same value
    assert decrypt(blob1) == decrypt(blob2) == plaintext


# ═══════════════════════════════════════════════════════════════════
#  CORRUPTED DATA
# ═══════════════════════════════════════════════════════════════════


def test_decrypt_corrupted_blob():
    """Flipping a bit in the ciphertext should raise InvalidTag."""
    plaintext = b"sensitive data"
    blob = bytearray(encrypt(plaintext))
    # Flip one bit in the ciphertext (after the 12-byte nonce)
    blob[15] ^= 0x01
    with pytest.raises(InvalidTag):
        decrypt(bytes(blob))


def test_decrypt_truncated_nonce():
    """A blob shorter than 12 bytes (nonce) should raise an error."""
    with pytest.raises(Exception):
        decrypt(b"short")


# ═══════════════════════════════════════════════════════════════════
#  AAD (Additional Authenticated Data)
# ═══════════════════════════════════════════════════════════════════


def test_aad_roundtrip():
    """Encrypt/decrypt with matching AAD should succeed."""
    plaintext = b"protected payload"
    aad = b"user:12345"
    blob = encrypt(plaintext, aad=aad)
    assert decrypt(blob, aad=aad) == plaintext


def test_aad_mismatch():
    """Decrypt with wrong AAD should raise InvalidTag."""
    plaintext = b"protected payload"
    blob = encrypt(plaintext, aad=b"correct-aad")
    with pytest.raises(InvalidTag):
        decrypt(blob, aad=b"wrong-aad")


# ═══════════════════════════════════════════════════════════════════
#  EDGE CASES
# ═══════════════════════════════════════════════════════════════════


def test_empty_plaintext():
    """Encrypting and decrypting an empty bytes object should work."""
    blob = encrypt(b"")
    assert decrypt(blob) == b""
