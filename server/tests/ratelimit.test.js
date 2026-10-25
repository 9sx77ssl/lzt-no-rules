import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DuplicateGuard, RateLimiter, TokenBucket } from '../src/ratelimit.js';

test('token bucket supports burst and refill', () => {
  const bucket = new TokenBucket({ capacity: 3, refillPerSec: 1, now: 0 });
  assert.equal(bucket.take(1, 0).ok, true);
  assert.equal(bucket.take(1, 0).ok, true);
  assert.equal(bucket.take(1, 0).ok, true);
  assert.equal(bucket.take(1, 0).ok, false);
  assert.equal(bucket.take(1, 1000).ok, true);
  assert.equal(bucket.take(1, 1000).ok, false);
  assert.equal(bucket.take(1, 2000).ok, true);
});

test('rate limiter returns retry delay', () => {
  const limiter = new RateLimiter();
  const config = { capacity: 1, refillPerSec: 0.5 };
  assert.equal(limiter.check('user', config, { now: 0 }).ok, true);
  const limited = limiter.check('user', config, { now: 0 });
  assert.equal(limited.ok, false);
  assert.equal(limited.retryAfterMs, 2000);
  assert.equal(limiter.check('user', config, { now: 2000 }).ok, true);
});

test('duplicate guard detects identical text within the window', () => {
  const guard = new DuplicateGuard({ windowMs: 1000 });
  assert.equal(guard.isDuplicate('u1', 'hello', 0), false);
  assert.equal(guard.isDuplicate('u1', 'hello', 500), true);
  assert.equal(guard.isDuplicate('u1', 'hello', 1501), false);
  assert.equal(guard.isDuplicate('u2', 'hello', 1501), false);
});
