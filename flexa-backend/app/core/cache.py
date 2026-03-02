"""
Flexa – Redis Cache Utilities

Provides async get / set / delete with automatic JSON serialisation.
Fails silently when Redis is unavailable so the app stays functional.

TTLs:
  dashboard      → 60 s  (light background data; let it expire naturally)
  daily_summary  → 30 s  (invalidated on every meal write / delete)

Cache keys:
  dashboard:{user_id}
  daily_summary:{user_id}:{YYYY-MM-DD}
"""

import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_redis = None   # module-level singleton


async def get_redis():
    """Lazily create and return the shared async Redis client."""
    global _redis
    if _redis is not None:
        return _redis
    try:
        from redis.asyncio import Redis
        from app.core.config import settings
        client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        await client.ping()
        _redis = client
        logger.info("✅ Redis connected: %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis unavailable — caching disabled. (%s)", exc)
        _redis = None
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    """Return deserialised value or None on miss / error."""
    r = await get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.debug("cache_get(%s) error: %s", key, exc)
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    """Serialise value and store with TTL seconds expiry."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.debug("cache_set(%s) error: %s", key, exc)


async def cache_delete(key: str) -> None:
    """Delete a single cache key (no-op on miss / error)."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception as exc:
        logger.debug("cache_delete(%s) error: %s", key, exc)


async def close_redis() -> None:
    """Close the Redis connection gracefully on app shutdown."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed.")
