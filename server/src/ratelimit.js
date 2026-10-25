export class TokenBucket {
  constructor({ capacity, refillPerSec, now = Date.now() }) {
    this.capacity = Math.max(1, Number(capacity) || 1);
    this.refillPerSec = Math.max(0.0001, Number(refillPerSec) || 0.0001);
    this.tokens = this.capacity;
    this.updatedAt = now;
  }

  refill(now = Date.now()) {
    const elapsed = Math.max(0, now - this.updatedAt) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.updatedAt = now;
    }
  }

  take(cost = 1, now = Date.now()) {
    this.refill(now);
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return { ok: true, remaining: this.tokens, retryAfterMs: 0 };
    }
    const missing = cost - this.tokens;
    return {
      ok: false,
      remaining: this.tokens,
      retryAfterMs: Math.ceil((missing / this.refillPerSec) * 1000),
    };
  }
}

export class RateLimiter {
  constructor({ logger = null, cleanupIntervalMs = 10 * 60 * 1000 } = {}) {
    this.buckets = new Map();
    this.logger = logger;
    this.lastCleanup = Date.now();
    this.cleanupIntervalMs = cleanupIntervalMs;
  }

  check(key, bucketConfig, { cost = 1, now = Date.now() } = {}) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket({ ...bucketConfig, now });
      this.buckets.set(key, bucket);
    }
    const result = bucket.take(cost, now);
    this.maybeCleanup(now);
    return result;
  }

  reset(key) {
    this.buckets.delete(key);
  }

  maybeCleanup(now = Date.now()) {
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;
    const staleAfter = 30 * 60 * 1000;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > staleAfter) this.buckets.delete(key);
    }
    this.logger?.debug?.('ratelimit.cleanup', { buckets: this.buckets.size });
  }
}

export class DuplicateGuard {
  constructor({ windowMs = 10_000 } = {}) {
    this.windowMs = windowMs;
    this.last = new Map();
  }

  isDuplicate(key, text, now = Date.now()) {
    const previous = this.last.get(key);
    this.last.set(key, { text, at: now });
    if (!previous) return false;
    if (now - previous.at > this.windowMs) return false;
    return previous.text === text;
  }

  cleanup(now = Date.now()) {
    for (const [key, value] of this.last) {
      if (now - value.at > this.windowMs * 6) this.last.delete(key);
    }
  }
}

export function createRateLimiters(config, logger) {
  return {
    auth: new RateLimiter({ logger }),
    message: new RateLimiter({ logger }),
    typing: new RateLimiter({ logger }),
    history: new RateLimiter({ logger }),
    edit: new RateLimiter({ logger }),
    delete: new RateLimiter({ logger }),
  };
}
