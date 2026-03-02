"""
Flexa – Rate Limiting

Uses slowapi (Starlette-compatible wrapper around limits).
Import `limiter` in main.py to register it with the app,
and use @limiter.limit("N/period") on individual route handlers.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Key function: limit by client IP address.
# Swap for a user-ID based function if per-account limits are preferred.
limiter = Limiter(key_func=get_remote_address)
