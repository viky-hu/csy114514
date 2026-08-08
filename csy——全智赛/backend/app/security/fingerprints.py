"""Domain-separated HMAC derivations for evaluation trace correlation."""

import base64
import hashlib
import hmac
import unicodedata

_CANARY_DOMAIN = b"canary\0"
_FINGERPRINT_DOMAIN = b"fingerprint\0"


def _key_bytes(key: str | bytes) -> bytes:
    encoded = key.encode("utf-8") if isinstance(key, str) else key
    if not encoded:
        raise ValueError("fingerprint key must not be empty")
    return encoded


def _normalized_bytes(value: str) -> bytes:
    return unicodedata.normalize("NFC", value).encode("utf-8")


def derive_canary(key: str | bytes, run_id: str) -> str:
    """Derive the frozen 130-bit, Base32 R4 canary for one evaluation run."""
    if not run_id:
        raise ValueError("run_id must not be empty")
    digest = hmac.new(
        _key_bytes(key),
        _CANARY_DOMAIN + _normalized_bytes(run_id),
        hashlib.sha256,
    ).digest()
    return base64.b32encode(digest).decode("ascii")[:26]


def fingerprint_value(key: str | bytes, value: str, *, value_type: str) -> str:
    """Fingerprint a normalized value while separating semantic value types."""
    if not value_type:
        raise ValueError("value_type must not be empty")
    message = (
        _FINGERPRINT_DOMAIN
        + _normalized_bytes(value_type)
        + b"\0"
        + _normalized_bytes(value)
    )
    return hmac.new(_key_bytes(key), message, hashlib.sha256).hexdigest()
