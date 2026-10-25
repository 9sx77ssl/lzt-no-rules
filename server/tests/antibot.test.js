import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractChallenge, solveChallenge } from '../src/antibot.js';

test('solves the captured challenge example', () => {
  const html = `main("416a4f14478426e1702f514c374cbff9","e9df592a0909bfa5fcff1ce7958e5981","5d10aa76f4aed1bdf3dbb302e8863d52")`;
  const challenge = extractChallenge(html);
  assert.deepEqual(challenge, {
    ciphertext: '416a4f14478426e1702f514c374cbff9',
    key: 'e9df592a0909bfa5fcff1ce7958e5981',
    iv: '5d10aa76f4aed1bdf3dbb302e8863d52',
  });
  assert.equal(solveChallenge(html), 'db320578848fa6b3a696de5bf7ce0900');
});

test('returns null for pages without a challenge', () => {
  assert.equal(solveChallenge('<html>ok</html>'), null);
});
