from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.utils.dependencies import get_current_user, get_current_active_user


def sanitize_audit_values(value):
    if isinstance(value, dict):
        return {k: sanitize_audit_values(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_audit_values(v) for v in value]
    from decimal import Decimal
    from enum import Enum
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, Enum):
        return value.value
    return value


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_refresh_token",
    "get_current_user",
    "get_current_active_user",
    "sanitize_audit_values",
]
