import { createDecipheriv } from 'node:crypto';

const CHALLENGE_RE =
  /main\(\s*["']([0-9a-f]{32})["']\s*,\s*["']([0-9a-f]{32})["']\s*,\s*["']([0-9a-f]{32})["']\s*\)/i;

/**
 * The forum's bot challenge calls:
 *   main(ciphertextHex, keyHex, ivHex)
 * and decrypts with slowAES in CBC mode using zero padding.
 *
 * The resulting 16 bytes (including trailing 0x00 bytes) are hex-encoded into
 * the `__x` cookie. We intentionally keep the trailing zeroes: that is exactly
 * what the in-page script does.
 */
export function extractChallenge(html) {
  const match = CHALLENGE_RE.exec(String(html ?? ''));
  if (!match) return null;
  return {
    ciphertext: match[1],
    key: match[2],
    iv: match[3],
  };
}

export function decryptChallenge({ ciphertext, key, iv }) {
  const decipher = createDecipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAutoPadding(false);
  const cipher = Buffer.from(ciphertext, 'hex');
  if (cipher.length === 0 || cipher.length % 16 !== 0) return null;
  const out = Buffer.concat([decipher.update(cipher), decipher.final()]);
  return out.toString('hex');
}

export function solveChallenge(html) {
  const challenge = extractChallenge(html);
  if (!challenge) return null;
  return decryptChallenge(challenge);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  set(name, value) {
    if (!name) return;
    if (value === '' || value == null) this.cookies.delete(name);
    else this.cookies.set(name, String(value));
  }

  setFromSetCookie(header) {
    if (!header) return;
    const first = String(header).split(';', 1)[0];
    const index = first.indexOf('=');
    if (index <= 0) return;
    const name = first.slice(0, index).trim();
    const value = first.slice(index + 1).trim();
    this.set(name, value);
  }

  get(name) {
    return this.cookies.get(name) ?? null;
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

export class AntibotClient {
  /** @param {{fetchImpl?: typeof fetch, userAgent?: string, logger?: any}} [options] */
  constructor({ fetchImpl = globalThis.fetch, userAgent = undefined, logger = null } = {}) {
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.jar = new CookieJar();
    this.userAgent =
      userAgent ||
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  }

  getCookie(name) {
    return this.jar.get(name);
  }

  cookieHeader() {
    return this.jar.header();
  }

  async postFingerprint(baseUrl) {
    const body = `false|1920x1080|Mesa|`;
    try {
      await this.fetchImpl(new URL('/_dfh/browser', baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'user-agent': this.userAgent,
          cookie: this.jar.header(),
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      this.logger?.debug?.('antibot.fingerprint_failed', { error: error?.name || 'network' });
    }
  }

  async fetch(url, options = {}, { retryOnChallenge = true } = {}) {
    let currentUrl = new URL(url);
    let method = options.method || 'GET';
    let body = options.body;
    let attempts = 0;

    for (let redirects = 0; redirects < 6; redirects += 1) {
      const headers = new Headers(options.headers || {});
      headers.set('user-agent', this.userAgent);
      headers.set('accept', headers.get('accept') || 'text/html,application/json;q=0.9,*/*;q=0.8');
      const cookie = this.jar.header();
      if (cookie) headers.set('cookie', cookie);

      let response;
      try {
        response = await this.fetchImpl(currentUrl, {
          ...options,
          method,
          body,
          headers,
          redirect: 'manual',
          signal: options.signal || AbortSignal.timeout(15_000),
        });
      } catch (error) {
        throw Object.assign(new Error(`Antibot request failed: ${error?.message || error}`), {
          cause: error,
        });
      }

      const setCookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean);
      for (const setCookie of setCookies) this.jar.setFromSetCookie(setCookie);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return { response, text: await response.text(), url: currentUrl };
        currentUrl = new URL(location, currentUrl);
        if (response.status === 303) {
          method = 'GET';
          body = undefined;
        }
        continue;
      }

      const text = await response.text();
      if (retryOnChallenge && attempts < 2 && text.includes('main(')) {
        const value = solveChallenge(text);
        if (value) {
          this.jar.set('__x', value);
          attempts += 1;
          this.logger?.info?.('antibot.challenge_solved');
          await this.postFingerprint(currentUrl);
          continue;
        }
      }

      return { response, text, url: currentUrl };
    }

    throw new Error('Antibot request exceeded redirect limit');
  }
}
