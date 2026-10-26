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

test('enforces the hard 512-character message limit', () => {
  const accepted = sanitizer.sanitizeMessage(`<p>${'a'.repeat(512)}</p>`);
  assert.equal(accepted.text.length, 512);
  assert.throws(
    () => sanitizer.sanitizeMessage(`<p>${'a'.repeat(513)}</p>`),
    (error) => error instanceof MessageError && error.code === 'too_long',
  );
  // Code points, not UTF-16 units: 512 emoji fit, 513 do not.
  assert.doesNotThrow(() => sanitizer.sanitizeMessage(`<p>${'😀'.repeat(512)}</p>`));
  assert.throws(
    () => sanitizer.sanitizeMessage(`<p>${'😀'.repeat(513)}</p>`),
    (/** @type {any} */ error) => error.code === 'too_long',
  );
  // An environment value cannot raise the hard ceiling.
  const capped = createSanitizer({ maxMessageText: 10_000 });
  assert.throws(
    () => capped.sanitizeMessage(`<p>${'a'.repeat(513)}</p>`),
    (/** @type {any} */ error) => error.code === 'too_long',
  );
});

test('keeps native mentions and avatar images from nztcdn', () => {
  const html =
    '<p>hi <a href="https://lolz.team/members/434343/" class="notranslate username mention" contenteditable="false" translate="no" data-user="434343, mention_user"><img alt="avatar" loading="lazy" class="avatar" src="https://nztcdn.com/avatar/s/1/434343.webp"><span style="color:#ff0076" class="styleUserNickname">mention_user</span></a></p>';
  const result = sanitizer.sanitizeMessage(html);
  assert.equal(result.meta.mentions, 1);
  assert.match(result.html, /class="notranslate username mention"/);
  assert.match(result.html, /data-user="434343, mention_user"/);
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
    (/** @type {any} */ error) => error.code === 'too_many_images',
  );
});

test('keeps safe username svg icons and strips scripts', () => {
  const meta = extractUsernameMeta(
    '<span style="color: #949494;" class="styleUserNickname">test_user</span><span class="uniqUsernameIcon--custom"><svg viewBox="0 0 24 24" onload="alert(1)"><path d="M5 12h14" fill="#fff" onclick="alert(2)"></path><script>alert(1)</script><foreignObject></foreignObject></svg></span>',
    'fallback',
  );
  assert.equal(meta.username, 'test_user');
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

test('keeps rendered BBCode blocks, styles and spoiler controls', () => {
  const html =
    '<div class="bbCodeBlock bbCodeQuote" data-author="root"><aside><blockquote class="quoteContainer"><div class="quote">text</div><div class="quoteExpand">open</div></blockquote></aside></div>' +
    '<div class="ToggleTriggerAnchor bbCodeSpoilerContainer" style="text-align:left"><button type="button" class="button bbCodeSpoilerButton ToggleTrigger Tooltip JsOnly" title="spoiler" data-target="> .SpoilerTarget"><span>Спойлер</span></button><div class="SpoilerTarget bbCodeSpoilerText nr-spoiler-hidden">hidden</div></div>' +
    '<p><span style="color:red;font-size:26px">red</span></p><ul><li>one</li></ul>';
  const result = sanitizer.sanitizeMessage(html);
  assert.match(result.html, /bbCodeQuote/);
  assert.match(result.html, /data-author="root"/);
  assert.match(result.html, /bbCodeSpoilerButton/);
  assert.match(result.html, /nr-spoiler-hidden/);
  assert.match(result.html, /font-size:26px/);
  assert.match(result.html, /<ul><li>one<\/li><\/ul>/);
});


test('keeps dragged image inside href-less editor anchor and clamps dimensions', () => {
  const sanitizer = createSanitizer({ allowExternalImages: false });
  const result = sanitizer.sanitizeMessage(
    '<p><a target="_blank"><img src="https://nztcdn.com/files/a.webp" width="99999" height="40"></a></p>',
  );
  assert.match(result.html, /<img[^>]+width="5000"/);
  assert.match(result.html, /<img[^>]+height="40"/);
  assert.equal(result.meta.images, 1);
});


test('strips unsafe URL attributes, tooltip HTML and SVG animation', () => {
  const result = sanitizer.sanitizeMessage(
    '<p><a href="https://lolz.team/x" data-href="https://lolz.team/misc/lightbox" data-proxy-href="javascript:alert(2)" data-tippy-content="<img src=x onerror=alert(3)>">x</a></p>' +
      '<p><video src="https://nztcdn.com/files/a.mp4" poster="https://evil.example/p.jpg"></video></p>' +
      '<p><svg viewBox="0 0 10 10"><animate attributeName="href" values="javascript:alert(1)"></animate><path d="M0 0"></path></svg></p>',
  );
  assert.doesNotMatch(result.html, /javascript:|data-tippy-content|evil\.example|<animate/i);
  assert.match(result.html, /data-href="https:\/\/lolz\.team\/misc\/lightbox"/);
});



test('removes CSS url() payloads and unsafe spoiler targets', () => {
  const result = sanitizer.sanitizeMessage(
    '<p><span style="background:linear-gradient(red,url(https://evil.example/x));color:red">x</span></p>' +
      '<p><button class="bbCodeSpoilerButton ToggleTrigger" data-target="body">bad</button></p>',
  );
  assert.doesNotMatch(result.html, /url\(|evil\.example|data-target="body"/i);
});
