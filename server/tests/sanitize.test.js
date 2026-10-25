import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSanitizer, MessageError, extractUsernameMeta } from '../src/sanitize.js';

const sanitizer = createSanitizer({ allowExternalImages: false });

test('sanitizes simple formatting and extracts text', () => {
  const result = sanitizer.sanitizeMessage('<p>hello <strong>world</strong></p>');
  assert.equal(result.text, 'hello world');
  assert.match(result.html, /<strong>world<\/strong>/);
});

test('removes scripts, event handlers and javascript URLs', () => {
  const result = sanitizer.sanitizeMessage(
    '<p onclick="alert(1)">hi <script>alert(2)</script><a href="javascript:alert(3)">x</a></p>',
    { clientId: 'test-client-1' },
  );
  assert.doesNotMatch(result.html, /script|onclick|javascript:/i);
  assert.equal(result.text, 'hi x');
});

test('rejects empty messages', () => {
  assert.throws(() => sanitizer.sanitizeMessage('<p></p>'), (error) => {
    assert.ok(error instanceof MessageError);
    assert.equal(error.code, 'empty');
    return true;
  });
});

test('keeps native mentions and avatar images from nztcdn', () => {
  const html =
    '<p>hi <a href="https://lolz.team/members/2524284/" class="notranslate username mention" contenteditable="false" translate="no" data-user="2524284, doppler"><img alt="avatar" loading="lazy" class="avatar" src="https://nztcdn.com/avatar/s/1/2524284.webp"><span style="color:#ff0076" class="styleUserNickname">doppler</span></a></p>';
  const result = sanitizer.sanitizeMessage(html);
  assert.equal(result.meta.mentions, 1);
  assert.match(result.html, /class="notranslate username mention"/);
  assert.match(result.html, /data-user="2524284, doppler"/);
  assert.match(result.html, /style="color:#ff0076"/);
});

test('drops external images when not explicitly allowed', () => {
  const result = sanitizer.sanitizeMessage(
    '<p>look <img src="https://evil.example/tracker.gif" class="bbCodeImage" alt="[img]"></p>',
  );
  assert.doesNotMatch(result.html, /evil\.example/);
  assert.equal(result.meta.images, 0);
  assert.equal(result.text, 'look');
});

test('accepts forum cdn images and counts them', () => {
  const result = sanitizer.sanitizeMessage(
    '<p><a href="https://nztcdn.com/files/a.webp" class="LbTrigger"><img src="https://nztcdn.com/files/a.webp" class="bbCodeImage LbImage" alt="[img]"></a></p>',
  );
  assert.equal(result.meta.images, 1);
  assert.match(result.html, /nztcdn\.com/);
});

test('enforces image limits', () => {
  const images = Array.from(
    { length: 5 },
    (_, index) =>
      `<img src="https://nztcdn.com/files/${index}.webp" class="bbCodeImage" alt="[img]">`,
  ).join('');
  assert.throws(
    () => sanitizer.sanitizeMessage(`<p>${images}</p>`),
    (error) => error.code === 'too_many_images',
  );
});

test('keeps safe username svg icons and strips scripts', () => {
  const meta = extractUsernameMeta(
    '<span style="color: #949494;" class="styleUserNickname">yolo</span><span class="uniqUsernameIcon--custom"><svg viewBox="0 0 24 24" onload="alert(1)"><path d="M5 12h14" fill="#fff" onclick="alert(2)"></path><script>alert(1)</script><foreignObject></foreignObject></svg></span>',
    'fallback',
  );
  assert.equal(meta.username, 'yolo');
  assert.equal(meta.color, '#949494');
  assert.match(meta.usernameHtml, /style="color:#949494"/);
  assert.match(meta.usernameHtml, /uniqUsernameIcon--custom/);
  assert.match(meta.usernameHtml, /<svg viewBox="0 0 24 24">/);
  assert.match(meta.usernameHtml, /M5 12h14/);
  assert.doesNotMatch(meta.usernameHtml, /script|onload|onclick|foreignObject/i);
});

test('a normal plain image message survives', () => {
  const result = sanitizer.sanitizeMessage(
    '<p><a href="https://nztcdn.com/files/a.webp" class="LbTrigger" data-href="https://lolz.team/misc/lightbox"><img src="https://nztcdn.com/files/a.webp" class="bbCodeImage LbImage" alt="[IMG]" title="[IMG]" loading="lazy"></a></p>',
  );
  assert.ok(result.text.includes('[IMG]'));
  assert.ok(result.html.includes('LbTrigger'));
});
