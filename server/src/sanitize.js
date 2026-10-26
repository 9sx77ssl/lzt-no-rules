import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

export class MessageError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'MessageError';
    this.code = code;
    this.details = details;
  }
}

const FORUM_HOSTS = [
  'lolz.team',
  'lolz.live',
  'lolz.guru',
  'zelenka.guru',
  'api.lolz.team',
  'api.lolz.live',
  'api.lolz.guru',
];

const MEDIA_HOSTS = ['nztcdn.com', ...FORUM_HOSTS];

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{3,20})$/i;

const USERNAME_STYLE_PROPS = new Map([
  ['color', COLOR_RE],
  ['-webkit-text-fill-color', COLOR_RE],
  [
    'background',
    /^(#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|(linear|radial)-gradient\([^<>{};]{1,300}\))$/i,
  ],
  ['background-image', /^((linear|radial)-gradient\([^<>{};]{1,300}\)|none)$/i],
  ['background-clip', /^(text|border-box|padding-box|content-box)$/i],
  ['-webkit-background-clip', /^(text|border-box|padding-box|content-box)$/i],
  ['text-shadow', /^[0-9a-z#.,%()\s-]{1,200}$/i],
  ['font-weight', /^(normal|bold|bolder|lighter|[1-9]00)$/i],
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hostAllowed(hostname, allowlist) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function isAllowedMediaUrl(value, { allowExternalImages = false } = {}) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (allowExternalImages) return true;
  return hostAllowed(url.hostname, MEDIA_HOSTS);
}

export function extractText(html) {
  const $ = cheerio.load(String(html ?? ''), null, false);
  $('a.mention, span.mention').each((_, element) => {
    const name = $(element).find('.styleUserNickname').text().trim() ||
      ($(element).attr('data-user') || '').split(',').slice(1).join(',').trim();
    if (name) $(element).replaceWith(`@${name}`);
  });
  $('img.avatar').remove();
  $('img').each((_, element) => {
    const alt = $(element).attr('alt') || $(element).attr('title') || '';
    $(element).replaceWith(alt ? alt : '[изображение]');
  });
  $('video').each((_, element) => {
    $(element).replaceWith('[видео]');
  });
  $('br').replaceWith('\n');
  $('p, div, li, blockquote, pre').each((_, element) => {
    $(element).append('\n');
  });
  return $.root()
    .text()
    .replaceAll('\u00a0', ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function normalizeColor(value) {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (!COLOR_RE.test(color)) return null;
  if (/url\s*\(|expression\s*\(|javascript:/i.test(color)) return null;
  return color;
}

export function sanitizeUsernameStyle(value) {
  const declarations = [];
  for (const part of String(value || '').split(';')) {
    const declaration = part.trim();
    if (!declaration) continue;
    const separator = declaration.indexOf(':');
    if (separator <= 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();
    const pattern = USERNAME_STYLE_PROPS.get(property);
    if (!pattern || !pattern.test(rawValue)) continue;
    if (/url\s*\(|expression\s*\(|javascript:|@import|[<>{}]/i.test(rawValue)) continue;
    declarations.push(`${property}:${rawValue}`);
  }
  return declarations.join(';');
}

function colorFromStyle(style) {
  const match = String(style || '').match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  return match ? normalizeColor(match[1]) : null;
}

const USERNAME_SVG_TAGS = [
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'title',
  'desc',
  'metadata',
  'animate',
  'animateTransform',
];

const USERNAME_SVG_ATTRIBUTES = {
  svg: [
    'viewBox',
    'width',
    'height',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'preserveAspectRatio',
    'xmlns',
    'role',
  ],
  g: ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform', 'opacity'],
  path: [
    'd',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'fill-rule',
    'clip-rule',
    'transform',
    'opacity',
  ],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap', 'opacity'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'],
  polygon: ['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'],
  defs: [],
  linearGradient: ['x1', 'y1', 'x2', 'y2', 'gradientUnits'],
  radialGradient: ['cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
  stop: ['offset', 'stop-color', 'stop-opacity'],
  clipPath: ['clipPathUnits'],
  title: [],
  desc: [],
  metadata: [],
  animate: [
    'attributeName',
    'values',
    'from',
    'to',
    'by',
    'dur',
    'begin',
    'repeatCount',
    'keySplines',
    'calcMode',
    'type',
    'fill',
  ],
  animateTransform: [
    'attributeName',
    'type',
    'values',
    'from',
    'to',
    'by',
    'dur',
    'begin',
    'repeatCount',
    'keySplines',
    'calcMode',
  ],
};

const SAFE_ANIMATED_ATTRIBUTES = new Set([
  'transform',
  'stroke',
  'fill',
  'opacity',
  'r',
  'stroke-width',
  'stroke-dasharray',
  'd',
  'cx',
  'cy',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'offset',
  'stop-color',
  'stop-opacity',
]);

function sanitizeUsernameIcon(svgHtml) {
  if (!svgHtml) return '';
  let clean = sanitizeHtml(String(svgHtml).slice(0, 6_000), {
    allowedTags: USERNAME_SVG_TAGS,
    allowedAttributes: USERNAME_SVG_ATTRIBUTES,
    parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
    disallowedTagsMode: 'discard',
  });
  if (!/^<svg[\s>]/i.test(clean.trim())) return '';
  const $ = cheerio.load(clean, null, false);
  $('animate, animateTransform').each((_, element) => {
    const name = $(element).attr('attributeName');
    if (!SAFE_ANIMATED_ATTRIBUTES.has(String(name || ''))) $(element).remove();
  });
  $('script, style, foreignObject, use, image').remove();
  clean = $.html();
  return clean.length <= 6_000 ? clean : '';
}

/**
 * Extract a safe username representation from the forum API's username_html,
 * keeping the native colour/gradient and the small custom SVG badge that the
 * forum renders next to the nickname. SVG is restricted to static geometry and
 * a small allowlist of safe animated attributes; scripts, styles, external
 * references and event handlers are impossible.
 */
export function extractUsernameMeta(usernameHtml, fallbackUsername = '') {
  const raw = typeof usernameHtml === 'string' ? usernameHtml : '';
  let username = String(fallbackUsername || '').trim();
  let style = '';
  let nickClass = '';
  let iconHtml = '';

  if (raw) {
    const $ = cheerio.load(raw, null, false);
    const nick = $('.styleUserNickname').first();
    if (nick.length) {
      const text = nick.text().trim();
      if (text) username = text;
      style = sanitizeUsernameStyle(nick.attr('style') || '');
      nickClass = String(nick.attr('class') || '')
        .split(/\s+/)
        .filter((value) => value === 'styleUserNickname' || /^style\d+$/.test(value))
        .join(' ');
    } else {
      const text = $.root().text().trim();
      if (text) username = text;
    }
    const icon = $('.uniqUsernameIcon--custom').first();
    if (icon.length) {
      const svg = icon.find('svg').first();
      if (svg.length) {
        const safeSvg = sanitizeUsernameIcon($.html(svg));
        if (safeSvg) {
          iconHtml = `<span class="uniqUsernameIcon--custom">${safeSvg}</span>`;
        }
      }
    }
  }

  if (!username) username = 'unknown';
  username = username.slice(0, 64);
  const color = colorFromStyle(style);
  const classes = nickClass || 'styleUserNickname';
  const nickHtml = style
    ? `<span class="${classes}" style="${escapeHtml(style)}">${escapeHtml(username)}</span>`
    : `<span class="${classes}">${escapeHtml(username)}</span>`;
  return {
    username,
    color,
    usernameStyle: style,
    usernameHtml: `${nickHtml}${iconHtml}`,
  };
}

const SAFE_MESSAGE_CLASSES = new Set([
  'mceSmilie',
  'mceSmilieLarge',
  'big',
  'bbCodeImage',
  'LbImage',
  'avatar',
  'LbTrigger',
  'internalLink',
  'externalLink',
  'ProxyLink',
  'internalNodeLink',
  'internalLinkClicker',
  'LinkClicker',
  'short',
  'unfurlContainer',
  'unfurlLink',
  'unfurlImage',
  'unfurl-renderer',
  'unfurl-wrapper',
  'unfurl-content',
  'unfurlMarketTitle',
  'unfurl-link-loading',
  'node-unfurl',
  'node-media',
  'svelte-renderer',
  'embed-link',
  'embed-link-wrapper',
  'mini_unfurl_icon',
  'embed-icon',
  'internal-link',
  'visit-icon',
  'forum-wrapper',
  'forum-icon',
  'forum-title',
  'market-wrapper',
  'market-icon',
  'market-title',
  'link-unfurl-loading-widget',
  'spinner-mask',
  'loading-logo',
  'ProseMirror-widget',
  'shorted',
  'marketItem',
  'price',
  'Value',
  'text',
  'telegram',
  'steam',
  'discord',
  'market',
  'vkontakte',
  'vk',
  'youtube',
  'tiktok',
  'instagram',
  'twitter',
  'github',
  'twitch',
  'spotify',
  'soundcloud',
  'apple',
  'google',
  'epicgames',
  'riot',
  'minecraft',
  'valorant',
  'fortnite',
  'SvgIcon',
  'categoryIcon',
  'title',
  'videoContainer',
  'videoWrapper',
  'spoiler',
  'bbCodeSpoiler',
  'Tooltip',
  'KWMOver',
  'styleUserNickname',
  'uniqUsernameIcon--custom',
  'username',
  'mention',
  'highlight',
  'alertAction',
  'notranslate',
  'bbCodeBlock',
  'bbCodeQuote',
  'quoteContainer',
  'quote',
  'quoteExpand',
  'quoteAuthor',
  'ToggleTriggerAnchor',
  'bbCodeSpoilerContainer',
  'bbCodeSpoilerButton',
  'ToggleTrigger',
  'JsOnly',
  'SpoilerTitle',
  'arrowWidget',
  'SpoilerTarget',
  'bbCodeSpoilerText',
  'content--align--left',
  'content--align--center',
  'content--align--right',
  'button',
  'primary',
  'bbCodeCode',
  'bbCodePrice',
  'CensorSpoiler',
  'nr-spoiler-hidden',
  'bbCodePlain',
  'userBanner',
  'nodeInfo',
]);

const SAFE_MESSAGE_CLASS_RE = /^(?:node\d+|category--[a-z0-9_-]+|Av\d+s|lztng-[a-z0-9-]+|fa[a-z0-9-]*|style\d+)$/i;

function sanitizeMessageClasses(html) {
  const $ = cheerio.load(String(html ?? ''), null, false);
  $('*').each((_, element) => {
    const raw = $(element).attr('class');
    if (!raw) return;
    const safe = raw
      .split(/\s+/)
      .filter((value) => SAFE_MESSAGE_CLASSES.has(value) || SAFE_MESSAGE_CLASS_RE.test(value));
    if (safe.length) $(element).attr('class', safe.join(' '));
    else $(element).removeAttr('class');
  });
  return $.html();
}

export function createSanitizer(options = {}) {
  const allowExternalImages = options.allowExternalImages === true;
  const maxHtml = options.maxMessageHtml ?? 12_000;
  const maxText = options.maxMessageText ?? 2_000;
  const maxImages = options.maxImagesPerMessage ?? 4;
  const maxLinks = options.maxLinksPerMessage ?? 5;
  const maxMentions = options.maxMentionsPerMessage ?? 8;
  const maxNewlines = options.maxNewlinesPerMessage ?? 30;

  const allowedTags = [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'code',
    'pre',
    'blockquote',
    'aside',
    'ul',
    'ol',
    'li',
    'hr',
    'sub',
    'sup',
    'a',
    'img',
    'span',
    'div',
    'abbr',
    'video',
    'source',
    'button',
    ...USERNAME_SVG_TAGS,
  ];

  const allowedAttributes = {
    a: [
      'href',
      'class',
      'title',
      'target',
      'rel',
      'style',
      'data-user',
      'data-user-id',
      'data-href',
      'data-proxy-href',
      'data-fancybox',
      'data-ignore-popover',
      'ignore-opener',
      'contenteditable',
      'translate',
    ],
    img: [
      'src',
      'alt',
      'title',
      'class',
      'loading',
      'width',
      'height',
      'data-url',
      'data-fallback-src',
    ],
    abbr: ['title', 'class', 'data-tippy-content', 'data-cachedtitle'],
    span: [
      'class',
      'style',
      'data-user',
      'data-cachedtitle',
      'data-url',
      'data-node-view-wrapper',
      'data-title',
      'data-type',
      'data-media-id',
      'data-site-id',
      'data-extra',
      'contenteditable',
      'role',
      'aria-busy',
      'aria-hidden',
      'data-price-amount',
      'data-price-currency',
    ],
    p: ['class'],
    blockquote: ['class'],
    div: ['class', 'style', 'data-href', 'data-author'],
    button: ['type', 'class', 'title', 'data-target'],
    code: ['class', 'data-lang'],
    pre: ['class'],
    video: ['src', 'poster', 'controls', 'preload', 'class', 'width', 'height', 'muted', 'loop', 'playsinline'],
    source: ['src', 'type'],
    ...USERNAME_SVG_ATTRIBUTES,
  };

  const allowedStyles = {
    span: {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]{1,80}\)$/i, /^hsla?\([^)]{1,80}\)$/i, /^[a-z]{3,20}$/i],
      '-webkit-text-fill-color': [
        /^#[0-9a-f]{3,8}$/i,
        /^rgba?\([^)]{1,80}\)$/i,
        /^hsla?\([^)]{1,80}\)$/i,
        /^[a-z]{3,20}$/i,
      ],
      background: [
        /^#[0-9a-f]{3,8}$/i,
        /^rgba?\([^)]{1,80}\)$/i,
        /^hsla?\([^)]{1,80}\)$/i,
        /^(linear|radial)-gradient\([^<>{};]{1,300}\)$/i,
      ],
      'background-image': [/^(linear|radial)-gradient\([^<>{};]{1,300}\)$/i, /^none$/i],
      'background-clip': [/^(text|border-box|padding-box|content-box)$/i],
      '-webkit-background-clip': [/^(text|border-box|padding-box|content-box)$/i],
      'text-shadow': [/^[0-9a-z#.,%()\s-]{1,200}$/i],
      'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
      'white-space': [/^(normal|nowrap|pre|pre-wrap)$/i],
      'font-size': [/^(?:9|10|12|15|18|22|26)px$/i],
      'text-decoration': [/^(?:underline|line-through|none)$/i],
    },
    div: {
      'text-align': [/^(?:left|center|right)$/i],
    },
  };
  allowedStyles.a = allowedStyles.span;

  function sanitizeMessage(rawHtml, { clientId = null } = {}) {
    if (typeof rawHtml !== 'string') {
      throw new MessageError('invalid', 'Сообщение имеет неверный формат');
    }
    rawHtml = sanitizeMessageClasses(rawHtml);
    if (rawHtml.length > maxHtml * 2) {
      throw new MessageError('too_long', 'Сообщение слишком длинное');
    }

    const sanitized = sanitizeHtml(rawHtml, {
      allowedTags,
      allowedAttributes,
      allowedStyles,
      parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: {
        img: ['https'],
        video: ['https'],
        source: ['https'],
      },
      allowProtocolRelative: false,
      disallowedTagsMode: 'discard',
      transformTags: {
        a: (tagName, attribs) => {
          const out = { ...attribs };
          const href = String(out.href || '');
          const classes = String(out.class || '');
          const isLightbox = /(^|\s)LbTrigger(\s|$)/.test(classes);
          if (/^https?:/i.test(href) && !isLightbox) {
            out.target = '_blank';
            out.rel = 'noopener noreferrer nofollow';
          } else {
            delete out.target;
            delete out.rel;
          }
          return { tagName, attribs: out };
        },
        img: (tagName, attribs) => {
          const next = { ...attribs, loading: attribs.loading || 'lazy' };
          for (const key of ['width', 'height']) {
            const value = Number(next[key]);
            if (Number.isInteger(value) && value > 0) {
              next[key] = String(Math.min(value, 5000));
            } else {
              delete next[key];
            }
          }
          return { tagName, attribs: next };
        },
      },
      exclusiveFilter: (frame) => {
        if (frame.tag === 'img' || frame.tag === 'video' || frame.tag === 'source') {
          return !isAllowedMediaUrl(frame.attribs.src, { allowExternalImages });
        }
        // An editor drag can leave an <a> without href around an image. Do
        // not drop the whole subtree (sanitize-html would lose the image and
        // make the message look empty); keep the image and let the harmless
        // anchor remain.
        if (frame.tag === 'a' && !frame.attribs.href) return false;
        return false;
      },
    });

    if (sanitized.length > maxHtml) {
      throw new MessageError('too_long', 'Сообщение слишком длинное');
    }

    const $ = cheerio.load(sanitized, null, false);
    const imageCount = $('img').not('.mceSmilie, .mceSmilieLarge, .avatar').length;
    const linkCount = $('a[href]').not('.mention').length;
    const mentionCount = $('a.mention, span.mention, a.username.mention').length;
    const text = extractText(sanitized);

    if (text.length > maxText) {
      throw new MessageError('too_long', 'Сообщение слишком длинное');
    }
    if (imageCount > maxImages) {
      throw new MessageError('too_many_images', `Не более ${maxImages} изображений в сообщении`);
    }
    if (linkCount > maxLinks) {
      throw new MessageError('too_many_links', `Не более ${maxLinks} ссылок в сообщении`);
    }
    if (mentionCount > maxMentions) {
      throw new MessageError('too_many_mentions', `Не более ${maxMentions} упоминаний в сообщении`);
    }
    if ((text.match(/\n/g) || []).length > maxNewlines) {
      throw new MessageError('too_many_newlines', 'Слишком много переносов строк');
    }
    if (!text && imageCount === 0 && $('video').length === 0) {
      throw new MessageError('empty', 'Сообщение пустое');
    }

    return {
      html: sanitized,
      text,
      clientId,
      meta: {
        images: imageCount,
        links: linkCount,
        mentions: mentionCount,
        hasMedia: imageCount > 0 || $('video').length > 0,
      },
    };
  }

  function sanitizeUsername(usernameHtml, fallbackUsername) {
    return extractUsernameMeta(usernameHtml, fallbackUsername);
  }

  return {
    sanitizeMessage,
    sanitizeUsername,
    extractText,
    isAllowedMediaUrl: (value) => isAllowedMediaUrl(value, { allowExternalImages }),
  };
}
