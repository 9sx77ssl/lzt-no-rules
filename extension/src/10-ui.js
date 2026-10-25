/* Native DOM templates, CSS and overlays. All visual primitives are copied
 * from the forum's Svelte Chatbox; custom CSS is limited to states the native
 * UI does not expose (connection errors, toasts, unread badge). */
const DEFAULT_AVATAR = 'https://lolz.team/styles/default/xenforo/avatars/avatar_s.png';

const NR_ICONS = {
  reply:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20.7914 12.6072C21.0355 12.398 21.1575 12.2933 21.2023 12.1688C21.2415 12.0596 21.2415 11.94 21.2023 11.8308C21.1575 11.7063 21.0355 11.6016 20.7914 11.3924L12.3206 4.13178C11.9004 3.77158 11.6903 3.59148 11.5124 3.58707C11.3578 3.58323 11.2101 3.65115 11.1124 3.77103C11 3.90897 11 4.18571 11 4.73918V9.03444C8.86532 9.40789 6.91159 10.4896 5.45971 12.1137C3.87682 13.8843 3.00123 16.1757 3 18.5508V19.1628C4.04934 17.8987 5.35951 16.8763 6.84076 16.1657C8.1467 15.5392 9.55842 15.1681 11 15.0703V19.2604C11 19.8139 11 20.0906 11.1124 20.2286C11.2101 20.3485 11.3578 20.4164 11.5124 20.4125C11.6903 20.4081 11.9004 20.228 12.3206 19.8678L20.7914 12.6072Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  replyBar:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.6627 3.13951C13.3696 2.77988 12.9266 2.57612 12.4628 2.58762C12.0562 2.59771 11.7491 2.80148 11.5945 2.91154C11.4297 3.02886 11.242 3.18975 11.0559 3.34931C11.0468 3.35713 11.0377 3.36495 11.0286 3.37276L2.53823 10.6502C2.43379 10.7396 2.31247 10.8436 2.21475 10.9431C2.10412 11.0558 1.94933 11.2348 1.85662 11.4929C1.73886 11.8208 1.73886 12.1793 1.85662 12.5072C1.94933 12.7653 2.10412 12.9443 2.21475 13.057C2.31247 13.1565 2.43379 13.2604 2.53823 13.3499L11.056 20.6508C11.242 20.8104 11.4297 20.9712 11.5945 21.0886C11.7491 21.1986 12.0562 21.4024 12.4628 21.4125C12.9266 21.424 13.3696 21.2202 13.6627 20.8606C13.9197 20.5453 13.9648 20.1795 13.9819 19.9905C14.0001 19.789 14 19.5418 14 19.2967L14 16.1964C14.9422 16.3593 15.86 16.6518 16.7267 17.0676C18.078 17.7158 19.2733 18.6485 20.2306 19.8017C20.4997 20.1259 20.9432 20.2467 21.3395 20.1036C21.7359 19.9605 22 19.5844 22 19.163V18.551C21.9986 15.9303 21.0325 13.4013 19.2858 11.4474C17.8734 9.86748 16.0306 8.75275 14 8.22857V4.73942C14 4.72743 14 4.71542 14 4.7034C14 4.45828 14.0001 4.2111 13.9819 4.00958C13.9648 3.82055 13.9197 3.45479 13.6627 3.13951Z"/></svg>',
  mention:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12ZM16 12V13.5C16 14.8807 17.1193 16 18.5 16C19.8807 16 21 14.8807 21 13.5V12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C13.8286 21 15.5264 20.4519 16.9291 19.5052" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M7.5 3H14.6C16.8402 3 17.9603 3 18.816 3.43597C19.5686 3.81947 20.1805 4.43139 20.564 5.18404C21 6.03969 21 7.15979 21 9.4V16.5M6.2 21H14.3C15.4201 21 15.9802 21 16.408 20.782C16.7843 20.5903 17.0903 20.2843 17.282 19.908C17.5 19.4802 17.5 18.9201 17.5 17.8V9.7C17.5 8.57989 17.5 8.01984 17.282 7.59202C17.0903 7.21569 16.7843 6.90973 16.408 6.71799C15.9802 6.5 15.4201 6.5 14.3 6.5H6.2C5.0799 6.5 4.51984 6.5 4.09202 6.71799C3.71569 6.90973 3.40973 7.21569 3.21799 7.59202C3 8.01984 3 8.57989 3 9.7V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.0799 21 6.2 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M11 4.00023H6.8C5.11984 4.00023 4.27976 4.00023 3.63803 4.32721C3.07354 4.61483 2.6146 5.07377 2.32698 5.63826C2 6.27999 2 7.12007 2 8.80023V17.2002C2 18.8804 2 19.7205 2.32698 20.3622C2.6146 20.9267 3.07354 21.3856 3.63803 21.6732C4.27976 22.0002 5.11984 22.0002 6.8 22.0002H15.2C16.8802 22.0002 17.7202 22.0002 18.362 21.6732C18.9265 21.3856 19.3854 20.9267 19.673 20.3622C20 19.7205 20 18.8804 20 17.2002V13.0002M7.99997 16.0002H9.67452C10.1637 16.0002 10.4083 16.0002 10.6385 15.945C10.8425 15.896 11.0376 15.8152 11.2166 15.7055C11.4184 15.5818 11.5914 15.4089 11.9373 15.063L21.5 5.50023C22.3284 4.6718 22.3284 3.32865 21.5 2.50023C20.6716 1.6718 19.3284 1.6718 18.5 2.50022L8.93723 12.063C8.59133 12.4089 8.41838 12.5818 8.29469 12.7837C8.18504 12.9626 8.10423 13.1577 8.05523 13.3618C7.99997 13.5919 7.99997 13.8365 7.99997 14.3257V16.0002Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  delete:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 3H15M3 6H21M19 6L18.2987 16.5193C18.1935 18.0975 18.1409 18.8867 17.8 19.485C17.4999 20.0118 17.0472 20.4353 16.5017 20.6997C15.882 21 15.0911 21 13.5093 21H10.4907C8.90891 21 8.11803 21 7.49834 20.6997C6.95276 20.4353 6.50009 20.0118 6.19998 19.485C5.85911 18.8867 5.8065 18.0975 5.70129 16.5193L5 6M10 10.5V15.5M14 10.5V15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2"/></svg>',
  link:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  select:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-6 1-3 6L5 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  retry:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 11a8 8 0 1 0-2.3 6.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v7h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const NR_ONLINE_ICONS = [
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lztng-yzgsen"><path d="M16.73 2C14.86 2 13.21 2.80925 12 4.31214C10.79 2.80925 9.14 2 7.27 2C3.86 2 1 5.00578 1 8.5896C1 8.82081 1 9.05202 1 9.28329C1.44 14.7167 6.94 19.2254 10.13 21.422C10.68 21.7688 11.34 22 12 22C12.66 22 13.32 21.7688 13.87 21.422C17.06 19.2254 22.56 14.7167 23 9.39882C23 9.16765 23 8.93641 23 8.7052C23 5.00578 20.14 2 16.73 2ZM20.8 9.05202C20.47 13.6764 14.97 17.8381 12.66 19.3411C12.22 19.5722 11.78 19.5722 11.34 19.3411C9.03 17.7226 3.64 13.5607 3.2 8.93641C3.2 8.93641 3.2 8.7052 3.2 8.5896C3.2 6.27746 5.07 4.31214 7.27 4.31214C8.92 4.31214 10.35 5.3526 11.01 6.85549C11.12 7.31792 11.56 7.54913 12 7.54913C12.44 7.54913 12.88 7.31792 12.99 6.85549C13.65 5.3526 15.08 4.31214 16.73 4.31214C18.93 4.31214 20.8 6.27746 20.8 8.5896C20.8 8.7052 20.8 8.93641 20.8 9.05202Z"></path></svg>',
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lztng-yzgsen"><path d="M3 21C2.4 21 2 20.6 2 20V11C2 10.4 2.4 10 3 10C3.6 10 4 10.4 4 11V20C4 20.6 3.6 21 3 21Z"></path><path d="M16.2759 22H8.0396C6.37272 22 5 20.6 5 18.9V10.5C5 9.4 5.39221 8.4 6.07857 7.5L10.0006 3C10.5889 2.4 11.4714 2 12.4519 2C13.5305 2 14.4129 2.5 15.0013 3.3C15.5896 4.2 15.7857 5.2 15.4915 6.2L14.9032 8.1H19.0214C20.0019 8.1 20.8843 8.5 21.3746 9.3C21.9629 10.1 22.159 11.1 21.8649 12L19.8058 19.1C19.3155 20.9 17.9428 22 16.2759 22ZM7.64739 8.9C7.25518 9.4 7.05908 9.9 7.05908 10.5V18.9C7.05908 19.5 7.54934 20 8.13765 20H16.374C17.1584 20 17.8447 19.5 18.0408 18.7L20.0019 11.6C20.0999 11.3 20.0019 10.9 19.8058 10.6C19.6097 10.3 19.3155 10.2 19.0214 10.2H13.5305C13.2363 10.2 12.9422 10 12.7461 9.8C12.55 9.6 12.55 9.2 12.648 8.9L13.7266 5.6C13.8246 5.2 13.8246 4.8 13.5305 4.5C13.1383 3.9 12.1578 3.8 11.6675 4.4L7.64739 8.9Z"></path></svg>',
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lztng-yzgsen"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 5.66667C1 3.11438 3.11438 1 5.66667 1H18.3333C20.8856 1 23 3.11438 23 5.66667V13.7778C23 16.3301 20.8856 18.4444 18.3333 18.4444H10.1111C9.07144 18.4444 8.17945 18.7265 7.48889 19.2444L7.47706 19.2532L2.58817 22.8087C2.28399 23.03 1.88139 23.0618 1.54622 22.8911C1.21105 22.7204 1 22.3761 1 22V5.66667ZM3 20.0362L6.29505 17.6398C7.38113 16.8276 8.70899 16.4444 10.1111 16.4444H18.3333C19.781 16.4444 21 15.2255 21 13.7778V5.66667C21 4.21895 19.781 3 18.3333 3H5.66667C4.21895 3 3 4.21895 3 5.66667V20.0362Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M6.00006 7C6.00006 6.44772 6.44777 6 7.00006 6H17.0001C17.5524 6 18.0001 6.44772 18.0001 7C18.0001 7.55228 17.5524 8 17.0001 8H7.00006C6.44777 8 6.00006 7.55228 6.00006 7Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M6.00006 11.9999C6.00006 11.4476 6.44777 10.9999 7.00006 10.9999H12.0001C12.5524 10.9999 13.0001 11.4476 13.0001 11.9999C13.0001 12.5522 12.5524 12.9999 12.0001 12.9999H7.00006C6.44777 12.9999 6.00006 12.5522 6.00006 11.9999Z"></path></svg>',
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lztng-yzgsen"><path d="M16.597 1H7.40298C5.67909 1 4.29999 2.33333 4.29999 3.88889V10.2222C4.29999 13.8889 7.17312 17 10.8507 17.5555V20.7778H7.40298C6.71342 20.7778 6.25372 21.2222 6.25372 21.8889C6.25372 22.5556 6.71342 23 7.40298 23H16.597C17.2866 23 17.7463 22.5556 17.7463 21.8889C17.7463 21.2222 17.2866 20.7778 16.597 20.7778H13.1493V17.5555C16.8269 17 19.7 14 19.7 10.2222V3.88889C19.7 2.33333 18.3209 1 16.597 1ZM17.4014 10.2222C17.4014 13.1111 14.988 15.4444 12 15.4444C9.01193 15.4444 6.59849 13.1111 6.59849 10.2222V3.88889C6.59849 3.55555 6.94328 3.22222 7.40298 3.22222H16.597C16.9417 3.22222 17.4014 3.55555 17.4014 3.88889V10.2222Z"></path><path d="M2.1 2.09999C1.44 2.09999 1 2.55713 1 3.24285V9.75708C1 10.4428 1.44 10.9 2.1 10.9C2.76 10.9 3.2 10.4428 3.2 9.75708V3.24285C3.2 2.67142 2.76 2.09999 2.1 2.09999Z"></path><path d="M21.9 2.09999C21.24 2.09999 20.8 2.55713 20.8 3.24285V9.75708C20.8 10.4428 21.24 10.9 21.9 10.9C22.56 10.9 23 10.4428 23 9.75708V3.24285C23 2.67142 22.56 2.09999 21.9 2.09999Z"></path></svg>',
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="lztng-yzgsen"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.43593 4.71009C5.43593 2.66106 7.09699 1 9.14603 1C10.2935 1 11.3193 1.52098 11.9999 2.33931C12.6805 1.52098 13.7064 1 14.8539 1C16.9029 1 18.564 2.66106 18.564 4.71009C18.564 5.44563 18.3499 6.13117 17.9807 6.70784H18.8493C20.5832 6.70784 21.9887 8.11336 21.9887 9.84715V12.1303C21.9887 13.0483 21.3695 13.8216 20.526 14.0555C20.6905 16.1407 20.5951 18.2396 20.2415 20.3036C20.0303 21.5361 19.0293 22.4803 17.7865 22.6191L16.7426 22.7358C13.5906 23.0881 10.4093 23.0881 7.25728 22.7358L6.21335 22.6191C4.97062 22.4803 3.96961 21.5361 3.75842 20.3036C3.40473 18.2396 3.30947 16.1407 3.47393 14.0555C2.63042 13.8216 2.01123 13.0483 2.01123 12.1303V9.84715C2.01123 8.11336 3.41675 6.70784 5.15054 6.70784H6.01917C5.64998 6.13117 5.43593 5.44563 5.43593 4.71009ZM11.1438 4.71009C11.1438 3.60677 10.2494 2.71235 9.14603 2.71235C8.0427 2.71235 7.14828 3.60677 7.14828 4.71009C7.14828 5.81342 8.0427 6.70784 9.14603 6.70784C10.2494 6.70784 11.1438 5.81342 11.1438 4.71009ZM14.8539 6.70784C15.9572 6.70784 16.8516 5.81342 16.8516 4.71009C16.8516 3.60677 15.9572 2.71235 14.8539 2.71235C13.7505 2.71235 12.8561 3.60677 12.8561 4.71009C12.8561 5.81342 13.7505 6.70784 14.8539 6.70784ZM3.72358 9.84715C3.72358 9.05905 4.36245 8.42019 5.15054 8.42019H11.1438V12.4157H4.00897C3.85136 12.4157 3.72358 12.2879 3.72358 12.1303V9.84715ZM12.8561 14.128H18.814C18.9741 16.0922 18.8869 18.0699 18.5537 20.0144C18.4714 20.495 18.081 20.8633 17.5964 20.9174L16.5524 21.0341C15.3237 21.1714 14.0904 21.253 12.8561 21.2788V14.128ZM12.8561 12.4157H19.9909C20.1486 12.4157 20.2763 12.2879 20.2763 12.1303V9.84715C20.2763 9.05905 19.6375 8.42019 18.8493 8.42019H12.8561V12.4157ZM11.1438 14.128V21.2788C9.90951 21.253 8.67618 21.1714 7.44748 21.0341L6.40355 20.9174C5.91891 20.8633 5.52854 20.495 5.44617 20.0144C5.11296 18.0699 5.02581 16.0922 5.18596 14.128H11.1438Z"></path></svg>',
];

const NR_CSS = `
#no-rules-messages.nr-hidden { display: none !important; }
#no-rules-messages .nr-loading-top {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  color: var(--mutedTextColor, #8c8c8c);
  font-size: 12px;
}
#no-rules-messages .nr-loading-top i { margin-right: 6px; }
#no-rules-messages .nr-message-pending { opacity: .7; }
#no-rules-messages .nr-message-pending.nr-failed { opacity: 1; }
#no-rules-messages .nr-failed .chat2-message-block { box-shadow: 0 0 0 1px inset #ff6a708f; }
#no-rules-messages .nr-retry {
  color: #ff8b8f;
  cursor: pointer;
  margin-left: 8px;
  font-size: 12px;
  white-space: nowrap;
}
#no-rules-messages .nr-retry:hover { text-decoration: underline; }
#no-rules-messages .nr-highlight .chat2-message-block { box-shadow: 0 0 0 2px var(--primaryMedium, #2f8a5d); transition: box-shadow .2s ease; }
#no-rules-messages .nr-swipe { transform: translateX(8px); transition: transform .12s ease; }

#no-rules-reply .chat2-replying-text {
  display: block;
  max-height: 140px;
  overflow: auto;
  min-width: 0;
}
#no-rules-reply .chat2-replying-text img {
  max-height: 80px;
  width: auto;
  max-width: 100%;
}
#no-rules-reply .chat2-replying-text .unfurlContainer,
#no-rules-reply .chat2-replying-text .unfurl-renderer,
#no-rules-reply .chat2-replying-text .embed-link,
#no-rules-reply .chat2-replying-text .internalNodeLink {
  max-width: 100%;
}


/* Native video messages need the same text/date layout before and after the
   XenForo video player is mounted, otherwise the message jumps horizontally. */
#no-rules-messages .chat2-message-text:has(video) {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
#no-rules-messages .chat2-message-text:has(video) .chat2-message-text-inner {
  flex: none;
  max-width: 100%;
}
#no-rules-messages .chat2-message-text:has(video) .chat2-message-date {
  align-self: flex-end;
  margin-left: 0;
}
#no-rules-messages .chat2-message-text-inner > p > video {
  display: block;
  width: min(100%, 426px) !important;
  max-width: 100%;
  height: auto !important;
  max-height: 240px;
  object-fit: contain;
  border-radius: 8px;
  background: #000;
}
#no-rules-reply .chat2-replying-text video,
.reply-message video {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 120px;
  border-radius: 8px;
  background: #000;
}
#no-rules-editing .chat2-replying-text video { max-height: 120px; }

/* Native unfurl renderer CSS lives inside the Tiptap lazy chunk. After a
   reload there may be no unfurl node in the composer, so the old messages
   would lose their forum/media card styling. Copy the native rules here. */
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-renderer {
  display: inline-block;
  vertical-align: middle;
  max-width: 100%;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-wrapper {
  position: relative;
  display: flex;
  background-color: #ffffff14;
  box-shadow: 0 0 0 1px inset #ffffff14;
  padding: 2px 6px;
  color: var(--contentText);
  font-weight: 700;
  border-radius: 8px;
  overflow: hidden;
  max-width: 100%;
  min-width: 0;
  width: fit-content !important;
  margin: 2px 0;
  transition: all 0.1s ease-in-out;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-wrapper:hover {
  background-color: #ffffff24;
  text-decoration: none;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-content .unfurlMarketTitle {
  line-height: 20px;
  color: var(--contentText);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-price {
  padding: 0 4px;
  height: 20px;
  line-height: 20px;
  border-radius: 4px;
  background-color: #ffffff1a;
  color: var(--contentText);
  text-wrap: nowrap;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-review-icon {
  height: 20px;
  width: 20px;
  background-size: 100% 100%;
  flex-shrink: 0;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .forum-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-radius: 8px;
  background-color: #ffffff14;
  box-shadow: 0 0 0 1px inset #ffffff1f;
  color: var(--contentText);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  width: fit-content !important;
  margin: 2px 0;
  line-height: 24px;
  transition: all 0.1s ease-in-out;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .forum-wrapper:hover {
  text-decoration: none;
  background-color: #ffffff24;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .forum-icon {
  font-family: 'lztIcons';
  display: flex;
  align-items: center;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .forum-title {
  font-weight: 700;
  color: var(--contentText);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:is(#no-rules-messages, #no-rules-reply, #no-rules-editing, .reply-message) .unfurl-renderer a {
  border: 1px solid transparent;
}

.nr-room-unread {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin-left: 6px;
  border-radius: 9px;
  background: #ff6a70;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
}
.nr-room-unread[hidden] { display: none !important; }

/* Native message-actions CSS is a lazily injected Svelte chunk; copy it so the
   menu is identical in the full chat and in the floating widget. */
.message-actions.${HASH.menu} { width: 230px; height: auto; }
.menu.${HASH.menu} {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;
  background-color: var(--contentBackground);
  border: 1px solid var(--primary);
  border-radius: 10px;
  padding: 8px;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 0 5px 26px 0 rgb(0 0 0 / 0.32);
}
.menu.${HASH.menu} .action.${HASH.menu} {
  width: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
}
.menu.${HASH.menu} .action.${HASH.menu}:hover {
  background-color: var(--primaryDarker);
  border-radius: 4px;
}
.menu.${HASH.menu} .action.${HASH.menu}:active { color: var(--textCtrlBackground); }
.menu.${HASH.menu} .action.${HASH.menu} .Svg-Icon.${HASH.menu} {
  display: flex;
  align-items: center;
  justify-content: center;
}
.menu.${HASH.menu} .action.${HASH.menu} .Svg-Icon.${HASH.menu} svg.${HASH.menu} {
  width: 20px;
  height: 20px;
  color: var(--mutedTextColorStill);
}
.menu.${HASH.menu} .action.${HASH.menu}:hover .Svg-Icon.${HASH.menu} svg.${HASH.menu} {
  color: var(--primaryLighter);
}
.message-actions.${HASH.menu}[data-popper-reference-hidden] {
  visibility: hidden !important;
  pointer-events: none !important;
}

/* Spinner/bounce styles are also a lazy chunk; typing must work in the widget. */
.lztui-spinner-wrapper.${HASH.spinner} { display: inline-block; }
.lztui-spinner-full.lztui-spinner-wrapper.${HASH.spinner} { display: flex; align-items: center; }
.lztui-spinner.${HASH.spinner} { display: flex; align-items: center; justify-content: center; }
.lztui-spinner-bounce.${HASH.spinner} {
  animation: sk-bouncedelay 1.4s infinite ease-in-out both;
  background-color: #454545;
  border-radius: 100%;
  display: inline-block;
  transform-origin: center bottom;
}
.lztui-spinner-small.${HASH.spinner} .lztui-spinner-bounce.${HASH.spinner} {
  width: 6px;
  height: 6px;
  margin: 0 2px;
}
.lztui-spinner-bounce1.${HASH.spinner} { animation-delay: -0.32s; }
.lztui-spinner-bounce2.${HASH.spinner} { animation-delay: -0.16s; }
@keyframes sk-bouncedelay {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Native online-users modal CSS is a lazily injected chunk. */
.not-users.${HASH.online} { padding: 16px 20px; }
.user-stats-block.${HASH.online} { display: flex; flex-direction: column; gap: 12px; }
.user-stats-block.${HASH.online} .row.${HASH.online} {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px 16px;
}
.user-abour-container.${HASH.online} { display: flex; flex-direction: row; gap: 16px; }
.user-abour-container.${HASH.online} img.${HASH.online} {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.top-user-item.${HASH.online} {
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 16px 20px;
  justify-content: space-between;
}
.top-user-item.${HASH.online}:not(:last-child) { border-bottom: 1px solid var(--primary); }
.user-stats-block.${HASH.online} .row.${HASH.online} .counter.${HASH.online} .count.${HASH.online} { font-weight: bold; }
.user-stats-block.${HASH.online} .row.${HASH.online} .counter.${HASH.online} {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.user-stats-block.${HASH.online} .row.${HASH.online} .counter.${HASH.online} .svg-icon.${HASH.online} svg.${HASH.online} {
  width: 22px;
  height: 22px;
  fill: #8c8c8c;
}
.user-stats-block.${HASH.online} .row.${HASH.online} .counter.${HASH.online} .svg-icon.${HASH.online} { display: flex; }
@media (max-width: 420px) {
  .top-user-item.${HASH.online} { flex-direction: column; align-items: flex-start; }
}
`;

function classOf(element, fallback = '') {
  const value = element?.getAttribute?.('class');
  return value || fallback;
}

function pickHash(element, fallback) {
  if (!element || !element.classList) return fallback;
  for (const className of element.classList) {
    if (className.startsWith('lztng-')) return className;
  }
  return fallback;
}

function stripClassNames(className, names) {
  const blocked = new Set(names);
  return String(className || '')
    .split(/\s+/)
    .filter((value) => value && !blocked.has(value))
    .join(' ');
}

function injectStyles() {
  if (document.getElementById('no-rules-styles')) return;
  const style = document.createElement('style');
  style.id = 'no-rules-styles';
  style.textContent = NR_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function captureTemplates() {
  const nativeMessages = getChatMessages();
  const nativeGroup = nativeMessages?.querySelector('.chat2-message-group');
  const nativeMessage = nativeGroup?.querySelector('.chat2-message') || nativeMessages?.querySelector('.chat2-message');
  const nativeBlock = nativeMessage?.querySelector('.chat2-message-block');
  const nativeHeader = nativeMessage?.querySelector('.chat2-message-header');
  const nativeUsername = nativeMessage?.querySelector('.chat2-message-username');
  const nativePoster = nativeUsername?.querySelector('a.username') || nativeUsername?.querySelector('a');
  const nativeGroupContent = nativeGroup?.querySelector('.chat2-message-group-content');
  const nativeAvatar = nativeGroup?.querySelector('.chat2-group-avatar');
  const nativeAvatarImg = nativeAvatar?.querySelector('img');
  const nativeText = nativeMessage?.querySelector('.chat2-message-text');
  const nativeInner = nativeMessage?.querySelector('.chat2-message-text-inner');
  const nativeDate = nativeMessage?.querySelector('.chat2-message-date');
  const nativeDay = nativeMessages?.querySelector('.chat2-day-separator');
  const nativeSocket = getChatRoot()?.querySelector('.chat2-socket-state');
  const nativeSocketInner = nativeSocket?.querySelector('div');
  const nativeFooter = document.querySelector('.chat2-footer');

  HASH.message = pickHash(nativeMessage, HASH.message);
  HASH.footer = pickHash(nativeFooter || nativeGroup, HASH.footer);
  HASH.username = pickHash(nativePoster, HASH.username);
  HASH.date = pickHash(nativeDate, HASH.date);
  HASH.socket = pickHash(nativeSocketInner, HASH.socket);

  const fallback = !nativeMessage;

  state.templates = {
    fallback,
    messages: classOf(
      nativeMessages,
      `chat2-messages lztng-content-background ${HASH.footer}`,
    ),
    group: classOf(nativeGroup, `chat2-message-group ${HASH.footer}`),
    groupContent: classOf(nativeGroupContent, `chat2-message-group-content ${HASH.footer}`),
    avatar: stripClassNames(
      classOf(nativeAvatar, `chat2-group-avatar ${HASH.footer}`),
      [],
    ).replace(/\bAv\d+s\b/g, '').trim() || `chat2-group-avatar ${HASH.footer}`,
    avatarImg: classOf(nativeAvatarImg, HASH.footer),
    tag: `chat2-tag ${HASH.footer}`,
    messageBase: stripClassNames(
      classOf(
        nativeMessage,
        `chat2-message chat2-message-general ${HASH.message}`,
      ),
      ['chat2-message-general', 'chat2-message-fromSelf', 'chat2-message-tagged'],
    ).trim(),
    block: classOf(
      nativeBlock,
      `chat2-message-block lztng-primary-darker ${HASH.message}`,
    ),
    header: classOf(nativeHeader, `chat2-message-header ${HASH.message}`),
    usernameWrap: classOf(nativeUsername, 'chat2-message-username'),
    poster: stripClassNames(
      classOf(nativePoster, `username poster ${HASH.username}`),
      ['highlight'],
    ).trim(),
    text: classOf(nativeText, `chat2-message-text ${HASH.message}`),
    inner: classOf(nativeInner, `chat2-message-text-inner ${HASH.message}`),
    date: classOf(nativeDate, `chat2-message-date ${HASH.date} chat2-message-date-muted`),
    day: classOf(nativeDay, `chat2-day-separator ${HASH.footer}`),
    socket: classOf(nativeSocket, `chat2-socket-state ${HASH.footer}`),
    socketInner: classOf(nativeSocketInner, HASH.socket),
    footer: classOf(nativeFooter, HASH.footer),
    typing: `chat2-typingDetails ${HASH.typing}`,
    typingUsers: `chat2-typingUsers ${HASH.typing}`,
    paused: `chat2-paused ${HASH.paused}`,
    pausedButton: `chat2-paused-button ${HASH.paused}`,
    pausedText: `chat2-paused-text ${HASH.paused}`,
    pausedIcon: `chat2-paused-icon ${HASH.paused}`,
    menu: `message-actions ${HASH.menu}`,
    menuList: `menu ${HASH.menu}`,
    menuAction: `action ${HASH.menu}`,
    menuIcon: `Svg-Icon ${HASH.menu}`,
  };

  if (!state.templates.messageBase) {
    state.templates.messageBase = `chat2-message ${HASH.message}`;
  }
  if (!state.templates.block) {
    state.templates.block = `chat2-message-block lztng-primary-darker ${HASH.message}`;
  }
  if (!state.templates.poster) {
    state.templates.poster = `username poster ${HASH.username}`;
  }
  if (!state.templates.date) {
    state.templates.date = `chat2-message-date ${HASH.date} chat2-message-date-muted`;
  }
}

function ensureMessagesContainer() {
  const nativeMessages = getChatMessages();
  const chatRoot = getChatRoot();
  if (!chatRoot && !nativeMessages) return false;
  if (nativeMessages?.isConnected) state.nativeMessagesEl = nativeMessages;

  if (!state.templates || state.templates.fallback) {
    captureTemplates();
  }

  let container = document.getElementById('no-rules-messages');
  if (!container || !container.isConnected) {
    container = document.createElement('div');
    container.id = 'no-rules-messages';
    container.className = `${state.templates?.messages || `chat2-messages lztng-content-background ${HASH.footer}`} nr-hidden`;
    container.setAttribute('role', 'log');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-relevant', 'additions');
    if (nativeMessages?.isConnected) {
      nativeMessages.after(container);
    } else {
      const footer = chatRoot?.querySelector('.chat2-footer');
      if (footer) footer.before(container);
      else chatRoot?.append(container);
    }
    els.messages = container;
    installMessageListeners(container);
    renderMessages({ forceBottom: true });
  } else {
    if (!container.classList.contains('chat2-messages')) {
      container.classList.add('chat2-messages', 'lztng-content-background', HASH.footer);
    }
    if (nativeMessages?.isConnected && container.previousElementSibling !== nativeMessages) {
      nativeMessages.after(container);
    }
  }
  els.messages = container;
  attachScrollListener();
  return true;
}

function ensureRoomLink() {
  const sideMenu = document.querySelector('.side-menu');
  if (!sideMenu) {
    state.roomLink = null;
    return false;
  }
  const nativeLinks = [
    ...sideMenu.querySelectorAll('.goto-room:not([data-no-rules])'),
  ];
  if (!nativeLinks.length) return false;

  let link = sideMenu.querySelector('.goto-room[data-no-rules]');
  if (!link || !link.isConnected) {
    link = nativeLinks[0].cloneNode(true);
    link.dataset.noRules = '1';
    link.removeAttribute('target');
    link.classList.remove('active');
    link.href = '#no-rules';
    link.setAttribute('title', `${BUILD.roomTitle} — приватная комната`);
    const title = link.querySelector('.roomTitle');
    if (title) title.textContent = BUILD.roomTitle;
    else link.append(Object.assign(document.createElement('span'), { className: 'roomTitle', textContent: BUILD.roomTitle }));
    const online = link.querySelector('.roomOnline');
    if (online) online.innerHTML = `<i class="fas fa-user"></i> ${Number(state.online) || 0}`;
    const unread = document.createElement('span');
    unread.className = 'nr-room-unread';
    unread.hidden = true;
    link.appendChild(unread);
    nativeLinks[nativeLinks.length - 1].after(link);
  }

  state.roomLink = link;
  const title = link.querySelector('.roomTitle');
  if (title && title.textContent !== BUILD.roomTitle) title.textContent = BUILD.roomTitle;
  const online = link.querySelector('.roomOnline');
  if (online) {
    const markup = `<i class="fas fa-user"></i> ${Number(state.online) || 0}`;
    if (online.innerHTML.trim() !== markup) online.innerHTML = markup;
  }
  let unread = link.querySelector('.nr-room-unread');
  if (!unread) {
    unread = document.createElement('span');
    unread.className = 'nr-room-unread';
    link.appendChild(unread);
  }
  const unreadText = state.unread > 99 ? '99+' : String(state.unread);
  if (unread.hidden !== state.unread <= 0) unread.hidden = state.unread <= 0;
  if (unread.textContent !== unreadText) unread.textContent = unreadText;

  const lastNative = nativeLinks[nativeLinks.length - 1];
  if (lastNative && link.compareDocumentPosition(lastNative) & Node.DOCUMENT_POSITION_PRECEDING) {
    lastNative.after(link);
  }

  if (state.active) {
    link.classList.add('active');
    for (const nativeLink of nativeLinks) nativeLink.classList.remove('active');
  } else {
    link.classList.remove('active');
  }
  return true;
}

function hideNativeForRoom() {
  const nativeMessages = getChatMessages();
  if (!nativeMessages) return;
  state.nativeMessagesEl = nativeMessages;
  const candidates = [
    nativeMessages,
    ...document.querySelectorAll(
      '.chat2-prevmessages-loading, .chat2-messages-loading, .chat2-paused:not(#no-rules-paused)',
    ),
  ];
  for (const element of candidates) {
    if (!element || !element.isConnected) continue;
    if (state.hiddenNative.some((entry) => entry.element === element)) {
      if (element.style.display !== 'none') element.style.display = 'none';
      continue;
    }
    state.hiddenNative.push({ element, display: element.style.display });
    element.style.display = 'none';
  }
}

function showNativeForRoom() {
  for (const entry of state.hiddenNative) {
    if (entry.element?.isConnected) entry.element.style.display = entry.display;
  }
  state.hiddenNative = [];
}

function ensureSocketIndicator() {
  if (!state.active) return;
  const roomTitle = getChatRoot()?.querySelector('.room-title');
  if (!roomTitle) return;
  const nativeSocket = roomTitle.querySelector('.chat2-socket-state');
  let socket = roomTitle.querySelector('#no-rules-socket');
  if (!socket) {
    socket = document.createElement('div');
    socket.id = 'no-rules-socket';
    socket.dataset.nrSocket = '1';
    socket.className = state.templates?.socket || `chat2-socket-state ${HASH.footer}`;
    socket.innerHTML = `<div class="${state.templates?.socketInner || HASH.socket}"><span class="socket-disconnected ${HASH.socket}"></span></div>`;
    const titleSpan = roomTitle.querySelector(':scope > span:not(.chat2-socket-state):not(#no-rules-socket)');
    if (titleSpan) titleSpan.after(socket);
    else roomTitle.prepend(socket);
  }
  if (nativeSocket) nativeSocket.style.display = 'none';
  els.socket = socket;
  updateSocketIndicator();
}

function updateSocketIndicator() {
  const socket = els.socket;
  if (!socket) return;
  const span = socket.querySelector('span');
  if (!span) return;
  const status =
    state.wsState === 'connected'
      ? 'connected'
      : state.wsState === 'connecting'
        ? 'connecting'
        : 'disconnected';
  span.className = `socket-${status} ${HASH.socket}`;
  socket.setAttribute(
    'title',
    status === 'connected'
      ? 'Подключено'
      : status === 'connecting'
        ? 'Подключение…'
        : 'Нет соединения',
  );
}

function updateHeader() {
  const root = getChatRoot();
  const roomTitle = root?.querySelector('.room-title');
  const roomOnline = root?.querySelector('.roomTitleBlock > .roomOnline');
  if (!roomTitle) return;
  const titleSpan = roomTitle.querySelector(
    ':scope > span:not(.chat2-socket-state):not(#no-rules-socket)',
  );

  if (state.active) {
    if (titleSpan && !state.nativeTitle) state.nativeTitle = titleSpan.textContent || '';
    if (roomOnline && !state.nativeOnline) state.nativeOnline = roomOnline.textContent || '';
    if (titleSpan && titleSpan.textContent !== BUILD.roomTitle) titleSpan.textContent = BUILD.roomTitle;
    if (roomOnline) {
      const text = `Онлайн: ${Number(state.online) || 0}`;
      if (roomOnline.textContent !== text) roomOnline.textContent = text;
    }
    ensureSocketIndicator();
  } else {
    if (titleSpan && titleSpan.textContent === BUILD.roomTitle && state.nativeTitle) {
      titleSpan.textContent = state.nativeTitle;
    }
    if (roomOnline && /^Онлайн:/.test(roomOnline.textContent || '') && state.nativeOnline) {
      const restored = state.nativeOnline;
      if (roomOnline.textContent !== restored && state.nativeOnline) roomOnline.textContent = restored;
    }
    const socket = roomTitle.querySelector('#no-rules-socket');
    if (socket) socket.remove();
    const nativeSocket = roomTitle.querySelector('.chat2-socket-state');
    if (nativeSocket) nativeSocket.style.display = '';
    els.socket = null;
  }
}

function updateRoomLinkActive() {
  if (!state.roomLink?.isConnected) return;
  if (state.active) {
    state.roomLink.classList.add('active');
    for (const link of document.querySelectorAll('.side-menu .goto-room:not([data-no-rules])')) {
      link.classList.remove('active');
    }
  } else {
    state.roomLink.classList.remove('active');
  }
}

function updateUnreadBadge() {
  if (!state.roomLink?.isConnected) return;
  const badge = state.roomLink.querySelector('.nr-room-unread');
  if (!badge) return;
  const unreadText = state.unread > 99 ? '99+' : String(state.unread);
  if (badge.hidden !== state.unread <= 0) badge.hidden = state.unread <= 0;
  if (badge.textContent !== unreadText) badge.textContent = unreadText;
}

function updateOnline() {
  const onlineText = `Онлайн: ${Number(state.online) || 0}`;
  const roomOnline = getChatRoot()?.querySelector('.roomTitleBlock > .roomOnline');
  if (state.active && roomOnline && roomOnline.textContent !== onlineText) {
    roomOnline.textContent = onlineText;
  }
  if (state.roomLink?.isConnected) {
    const linkOnline = state.roomLink.querySelector('.roomOnline');
    if (linkOnline) {
      const markup = `<i class="fas fa-user"></i> ${Number(state.online) || 0}`;
      if (linkOnline.innerHTML.trim() !== markup) linkOnline.innerHTML = markup;
    }
  }
}

function closeOnlineModal() {
  document.getElementById('no-rules-online-overlay')?.remove();
  document.getElementById('no-rules-online-backdrop')?.remove();
  document.removeEventListener('keydown', onOnlineModalKeydown, true);
}

function onOnlineModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeOnlineModal();
  }
}

function openOnlineModal() {
  closeOnlineModal();
  const modal = document.createElement('div');
  modal.id = 'no-rules-online-overlay';
  modal.className = 'modal fade in';
  modal.dataset.zIndex = '10007';
  modal.style.zIndex = '10007';
  modal.tabIndex = -1;
  modal.innerHTML = `<div class="xenOverlay" style="top: 10%;"><a class="close OverlayCloser"></a><div class="sectionMain"><h2 class="heading h1">Сейчас сидят в чате</h2><div class="helper"><div class="top-users-container"><div class="top-users-block"></div></div></div></div></div>`;

  const block = modal.querySelector('.top-users-block');
  const users = [...(state.onlineUsers || [])].sort((a, b) =>
    String(a.username || '').localeCompare(String(b.username || ''), 'ru'),
  );
  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = `not-users ${HASH.online}`;
    empty.textContent = 'В комнате пока никого нет';
    block.appendChild(empty);
  } else {
    for (const user of users) {
      const item = document.createElement('div');
      item.className = `top-user-item ${HASH.online}`;
      const profile = document.createElement('div');
      profile.className = `user-abour-container ${HASH.online}`;
      const img = document.createElement('img');
      img.className = HASH.online;
      img.loading = 'lazy';
      img.alt = user.username || '';
      img.src = user.avatar || DEFAULT_AVATAR;
      img.addEventListener('error', () => {
        if (img.src !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR;
      });
      const stats = document.createElement('div');
      stats.className = `user-stats-block ${HASH.online}`;
      const usernameStatus = document.createElement('div');
      usernameStatus.className = 'username-status';
      const link = document.createElement('a');
      link.className = `username poster ${HASH.username}`;
      link.href = user.profileUrl || `https://lolz.team/members/${user.id}/`;
      let html = user.usernameHtml || `<span class="styleUserNickname">${escapeHtml(user.username || 'unknown')}</span>`;
      html = sanitizeUsernameHtml(html);
      link.innerHTML = html || `<span class="styleUserNickname">${escapeHtml(user.username || 'unknown')}</span>`;
      usernameStatus.appendChild(link);
      stats.appendChild(usernameStatus);
      const row = document.createElement('div');
      row.className = `row ${HASH.online}`;
      const values = [
        user.stats?.likes,
        user.stats?.likes2,
        user.stats?.messages,
        user.stats?.trophies,
        user.stats?.contests,
      ];
      values.forEach((value, index) => {
        const counter = document.createElement('div');
        counter.className = `counter ${HASH.online}`;
        const icon = document.createElement('span');
        icon.className = `svg-icon ${HASH.online}`;
        icon.innerHTML = NR_ONLINE_ICONS[index];
        const count = document.createElement('span');
        count.className = `count ${HASH.online}`;
        count.textContent = Number(value || 0).toLocaleString('ru-RU');
        counter.appendChild(icon);
        counter.appendChild(count);
        row.appendChild(counter);
      });
      stats.appendChild(row);
      profile.appendChild(img);
      profile.appendChild(stats);
      item.appendChild(profile);
      block.appendChild(item);
    }
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'no-rules-online-backdrop';
  backdrop.className = 'modal-backdrop fade in';
  backdrop.style.zIndex = '10006';
  const close = (event) => {
    event.preventDefault();
    closeOnlineModal();
  };
  modal.querySelector('.OverlayCloser')?.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  document.addEventListener('keydown', onOnlineModalKeydown, true);
  setTimeout(() => modal.querySelector('.OverlayCloser')?.focus(), 0);
}

function updatePaused() {
  let paused = document.getElementById('no-rules-paused');
  const shouldShow = state.active && state.unread > 0 && !isNearBottom();
  if (!paused) {
    paused = document.createElement('div');
    paused.id = 'no-rules-paused';
    paused.className = state.templates?.paused || `chat2-paused ${HASH.paused}`;
    paused.hidden = true;
    paused.innerHTML = `<button type="button" class="${state.templates?.pausedButton || `chat2-paused-button ${HASH.paused}`}"><div class="${state.templates?.pausedText || `chat2-paused-text ${HASH.paused}`}"><span></span></div><div class="${state.templates?.pausedIcon || `chat2-paused-icon ${HASH.paused}`}"><i class="fas fa-angle-double-down"></i></div></button>`;
    paused.addEventListener('click', (event) => {
      event.preventDefault();
      state.unread = 0;
      updateUnreadBadge();
      updatePaused();
      scrollToBottom('smooth');
    });
    const host = getChatRoot() || document.body;
    host.appendChild(paused);
  }
  const text = paused.querySelector('.chat2-paused-text span');
  const nextText = `Новых сообщений: ${state.unread}`;
  if (text && text.textContent !== nextText) text.textContent = nextText;
  if (paused.hidden !== !shouldShow) paused.hidden = !shouldShow;
}

function updateConnectionError() {
  const existing = document.getElementById('no-rules-error');
  if (!state.active || !state.connectionError) {
    existing?.remove();
    return;
  }
  const inputBox = getChatRoot()?.querySelector('.chat2-footer .chat2-inputBox');
  if (!inputBox) {
    existing?.remove();
    return;
  }
  let error = existing;
  if (!error) {
    error = document.createElement('div');
    error.id = 'no-rules-error';
    error.className = `chat2-error ${HASH.footer}`;
    error.setAttribute('role', 'alert');
    error.title = 'Нажмите, чтобы повторить подключение';
    error.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.authFailedPermanently = false;
      state.connectionError = '';
      updateConnectionError();
      connectNoRules({ forceToken: true, userInitiated: true });
    });
    inputBox.appendChild(error);
  }
  if (error.textContent !== state.connectionError) error.textContent = state.connectionError;
}

function enforceActiveUI() {
  if (!state.initialized) return;
  const nativeMessages = getChatMessages();
  if (state.active) {
    ensureMessagesContainer();
    ensureRoomLink();

    const container = document.getElementById('no-rules-messages');
    hideNativeForRoom();
    if (container) {
      container.classList.remove('nr-hidden');
      container.style.display = '';
    }
    if (nativeMessages) nativeMessages.style.display = 'none';
    if (state.replyTo && !document.getElementById('no-rules-reply')) renderReplyBar();
    if (state.editing && !document.getElementById('no-rules-editing')) renderEditBar();
    updateHeader();
    updateRoomLinkActive();
    updateUnreadBadge();
    updatePaused();
    updateConnectionError();
    muteEditorVideos();
  } else {
    // While No Rules is inactive the native Svelte app owns this subtree and
    // re-renders it on every room switch. Keep our node out of its way instead
    // of hiding and repeatedly re-inserting it.
    document.getElementById('no-rules-messages')?.remove();
    els.messages = null;
    showNativeForRoom();
    if (nativeMessages) nativeMessages.style.display = '';
    ensureRoomLink();
    updateHeader();
    updateRoomLinkActive();
    updatePaused();
    updateConnectionError();
    muteEditorVideos();
  }
}

function scheduleEnforceUI() {
  if (state.enforceTimer) return;
  state.enforceTimer = setTimeout(() => {
    state.enforceTimer = null;
    enforceActiveUI();
  }, 100);
}

function attachScrollListener() {
  const scroll = getScrollElement();
  if (!scroll || state.scrollEl === scroll) return;
  if (state.scrollEl && state.scrollHandler) {
    state.scrollEl.removeEventListener('scroll', state.scrollHandler);
  }
  state.scrollEl = scroll;
  state.scrollHandler = () => {
    if (!state.active) return;
    if (isNearBottom()) {
      if (state.unread > 0) {
        state.unread = 0;
        updateUnreadBadge();
        updatePaused();
      }
    } else {
      updatePaused();
    }
    if (scroll.scrollTop < 80 && state.historyHasMore && !state.historyLoading) {
      requestOlderMessages();
    }
  };
  scroll.addEventListener('scroll', state.scrollHandler, { passive: true });
}

function createAvatar(user) {
  const avatar = document.createElement('div');
  avatar.className = `chat2-group-avatar Av${Number(user?.id) || 0}s ${HASH.footer}`;
  avatar.setAttribute('role', 'button');
  avatar.tabIndex = 0;
  avatar.dataset.userId = String(user?.id || '');
  avatar.setAttribute('aria-label', `Ответить ${user?.username || ''}`);
  const img = document.createElement('img');
  img.className = state.templates?.avatarImg || HASH.footer;
  img.loading = 'lazy';
  img.alt = `avatar ${user?.username || ''}`;
  img.src = user?.avatar || DEFAULT_AVATAR;
  img.addEventListener('error', () => {
    if (img.src !== DEFAULT_AVATAR) img.src = DEFAULT_AVATAR;
  });
  avatar.appendChild(img);
  const tag = document.createElement('div');
  tag.className = state.templates?.tag || `chat2-tag ${HASH.footer}`;
  avatar.appendChild(tag);
  return avatar;
}

function createDaySeparator(label) {
  const day = document.createElement('div');
  day.className = state.templates?.day || `chat2-day-separator ${HASH.footer}`;
  day.textContent = label;
  return day;
}

function messageRenderKey(message, showHeader) {
  return JSON.stringify([
    message.id,
    message.html,
    message.text,
    message.createdAt,
    message.editedAt || null,
    Boolean(message.deleted),
    Boolean(message.pending),
    Boolean(message.failed),
    Boolean(message.queued),
    showHeader,
    message.user?.id,
    message.user?.username,
    message.user?.usernameHtml,
    message.reply?.id || null,
    message.reply?.text || '',
    message.reply?.html || '',
    Boolean(message.reply?.deleted),
    messageMentionsMe(message),
  ]);
}

function createGroup(messages, { dayLabel = null, tagged = false, renderMessage = null } = {}) {
  const first = messages[0];
  const group = document.createElement('div');
  group.className = state.templates?.group || `chat2-message-group ${HASH.footer}`;
  group.dataset.userId = String(first.user.id);
  group.appendChild(createAvatar(first.user));

  const content = document.createElement('div');
  content.className = state.templates?.groupContent || `chat2-message-group-content ${HASH.footer}`;
  if (dayLabel) content.appendChild(createDaySeparator(dayLabel));

  messages.forEach((message, index) => {
    content.appendChild(
      renderMessage
        ? renderMessage(message, index === 0)
        : createMessageElement(message, { showHeader: index === 0 }),
    );
  });
  group.appendChild(content);
  return group;
}

const MARKET_CATEGORIES = new Map([
  ['telegram', 'Telegram'],
  ['steam', 'Steam'],
  ['discord', 'Discord'],
  ['market', 'Market'],
  ['vkontakte', 'ВКонтакте'],
  ['vk', 'ВКонтакте'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['instagram', 'Instagram'],
  ['twitter', 'Twitter'],
  ['github', 'GitHub'],
  ['twitch', 'Twitch'],
  ['spotify', 'Spotify'],
  ['soundcloud', 'SoundCloud'],
  ['apple', 'Apple'],
  ['google', 'Google'],
]);

const FORUM_TITLE_CACHE = new Map();

function slugTitle(value) {
  const known = { contests: 'Розыгрыши' };
  const slug = String(value || '').toLowerCase();
  if (known[slug]) return known[slug];
  const text = decodeURIComponent(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Раздел форума';
}

function marketCardFor(href) {
  let url;
  try {
    url = new URL(href, location.origin);
  } catch {
    return null;
  }
  if (url.hostname !== 'lzt.market') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  let category = '';
  let title = '';
  if (!parts.length) {
    category = 'market';
    title = 'Market';
  } else if (parts.length === 1 && MARKET_CATEGORIES.has(parts[0])) {
    category = parts[0];
    title = MARKET_CATEGORIES.get(parts[0]);
  } else if (parts[0] === 'user' && parts[2] === 'items') {
    title = 'Товары пользователя';
  } else {
    return null;
  }
  const card = document.createElement('div');
  card.className = `unfurlContainer shorted marketItem${category ? ` category--${category}` : ''}`;
  const text = document.createElement('div');
  text.className = 'text';
  const icon = document.createElement('span');
  icon.className = 'SvgIcon';
  const categoryIcon = document.createElement('span');
  categoryIcon.className = `categoryIcon ${category} Tooltip`;
  icon.appendChild(categoryIcon);
  const label = document.createElement('span');
  label.className = 'title';
  label.textContent = title;
  text.appendChild(icon);
  text.appendChild(label);
  const link = document.createElement('a');
  link.className = 'LinkClicker';
  link.href = href;
  card.appendChild(text);
  card.appendChild(link);
  return card;
}


function mediaCardFor(href) {
  let url;
  try {
    url = new URL(href, location.origin);
  } catch {
    return null;
  }
  const site = mediaServiceForUrl(url.href);
  if (!site) return null;
  let mediaId = url.href;
  if (site === 'youtube') mediaId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop() || url.href;
  const card = document.createElement('span');
  card.className = 'embed-link';
  card.dataset.url = url.href;
  card.dataset.mediaId = mediaId;
  card.dataset.siteId = site;
  const wrapper = document.createElement('span');
  wrapper.className = 'embed-link-wrapper';
  const icon = document.createElement('span');
  icon.className = `mini_unfurl_icon ${site} embed-icon`;
  const link = document.createElement('a');
  link.className = 'internal-link';
  link.href = url.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer nofollow';
  link.setAttribute('ignore-opener', 'true');
  link.setAttribute('data-ignore-popover', 'true');
  link.textContent = UNFURL_LABELS[site] || site;
  const visit = document.createElement('span');
  visit.className = 'visit-icon';
  wrapper.append(icon, link, visit);
  card.appendChild(wrapper);
  return card;
}

function forumCardFor(href) {
  let url;
  try {
    url = new URL(href, location.origin);
  } catch {
    return null;
  }
  if (!/(^|\.)(lolz\.(team|live|guru)|zelenka\.guru)$/.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/forums\/([^/]+)\/?$/);
  if (!match) return null;
  const card = document.createElement('span');
  card.className = 'internalNodeLink short';
  const clicker = document.createElement('a');
  clicker.className = 'internalLinkClicker';
  clicker.href = href;
  const label = document.createElement('a');
  label.className = 'internalLink internalNodeLink';
  label.href = href;
  label.textContent = slugTitle(match[1]);
  card.dataset.nrForumUrl = href;
  card.appendChild(clicker);
  card.appendChild(label);
  return card;
}

function applyMentionHighlights(root) {
  for (const mention of root.querySelectorAll('a.mention')) {
    const userId = Number(String(mention.dataset.user || '').split(',')[0]);
    mention.classList.toggle('highlight', Boolean(state.user?.id) && userId === state.user.id);
  }
}

function enhanceUnfurls(html) {
  const pre = document.createElement('template');
  pre.innerHTML = sanitizeClientHtml(html);
  // Tiptap can persist an autolink mark as <a>text</a> without href.
  for (const anchor of [...pre.content.querySelectorAll('a:not([href])')]) {
    if (anchor.closest('.mention, .unfurlContainer, .internalNodeLink, .node-unfurl, .node-media, .unfurl-renderer, .embed-link, .LbTrigger')) continue;
    const text = (anchor.textContent || '').trim();
    if (/^https?:\/\//i.test(text)) anchor.replaceWith(document.createTextNode(text));
  }
  const template = document.createElement('template');
  template.innerHTML = linkifyHtml(pre.innerHTML);
  for (const anchor of [...template.content.querySelectorAll('a[href]')]) {
    if (
      anchor.closest(
        '.unfurlContainer, .internalNodeLink, .node-unfurl, .node-media, .unfurl-renderer, .embed-link',
      )
    )
      continue;
    if (anchor.className.includes('LbTrigger')) continue;
    const href = anchor.getAttribute('href') || '';
    if (!href) continue;
    const card = mediaCardFor(href) || marketCardFor(href) || forumCardFor(href);
    if (card) anchor.replaceWith(card);
  }
  return template.innerHTML;
}

function hydrateForumTitles(root) {
  for (const card of root.querySelectorAll('[data-nr-forum-url]')) {
    const href = card.dataset.nrForumUrl;
    const label = card.querySelector('a.internalLink');
    if (!href || !label) continue;
    const cached = FORUM_TITLE_CACHE.get(href);
    if (cached) {
      label.textContent = cached;
      continue;
    }
    fetch(href, { credentials: 'include', headers: { Accept: 'text/html' } })
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!text) return;
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const title = (doc.querySelector('h1.p-title-value')?.textContent || doc.title || '')
          .split(/\s*[|—–]\s*/)[0]
          .trim();
        if (!title) return;
        FORUM_TITLE_CACHE.set(href, title);
        label.textContent = title;
      })
      .catch(() => {});
  }
}


function prepareMessageVideos(root) {
  if (!root) return;
  for (const video of root.querySelectorAll('video')) {
    if (video.closest('[data-lzt-video-player]')) continue;
    video.setAttribute('playsinline', '');
    video.preload = 'metadata';
    if (!video.getAttribute('poster')) {
      const src = video.getAttribute('src') || video.querySelector('source')?.src || '';
      if (/^https:\/\/nztcdn\.com\/files\//i.test(src)) {
        video.setAttribute('poster', src.replace(/\.[^./?]+(?:\?.*)?$/, '.webp'));
      }
    }
  }
}

function activateNativeContent(root) {
  if (!root) return;
  const videos = [...root.querySelectorAll('video')];
  if (!videos.some((video) => !video.closest('[data-lzt-video-player]'))) return;
  const xf = PAGE_WINDOW?.XenForo || window.XenForo;
  if (!xf || typeof xf.activate !== 'function') return;
  try {
    xf.activate(root);
  } catch (error) {
    console.debug('[NoRules:video] native activate failed', error);
  }
}

function prepareReplyVideos(root) {
  if (!root) return;
  for (const video of root.querySelectorAll('video')) {
    if (video.closest('[data-lzt-video-player]')) continue;
    video.controls = true;
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.preload = 'metadata';
    if (!video.getAttribute('poster')) {
      const src = video.getAttribute('src') || video.querySelector('source')?.src || '';
      if (/^https:\/\/nztcdn\.com\/files\//i.test(src)) {
        video.setAttribute('poster', src.replace(/\.[^./?]+(?:\?.*)?$/, '.webp'));
      }
    }
  }
}

function muteEditorVideos() {
  const editor = getEditorElement();
  if (!editor) return;
  for (const video of editor.querySelectorAll('video')) {
    if (!video.muted) video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
  }
}

function createMessageElement(message, { showHeader = true } = {}) {
  const wrapper = document.createElement('div');
  wrapper.dataset.messageId = String(message.id);
  wrapper.dataset.nrMessage = '1';
  wrapper.className = state.templates?.messageBase || `chat2-message ${HASH.message}`;
  wrapper.classList.add(...messageStyleClass(message).split(/\s+/).filter(Boolean));
  if (message.pending) wrapper.classList.add('nr-message-pending', 'chat2-message-pending');
  if (message.failed) wrapper.classList.add('nr-failed');
  if (message.deleting) wrapper.classList.add('nr-message-deleting');
  if (message.deleted) wrapper.classList.add('nr-message-deleted');

  const block = document.createElement('div');
  block.className = state.templates?.block || `chat2-message-block lztng-primary-darker ${HASH.message}`;
  wrapper.appendChild(block);

  if (showHeader) {
    const header = document.createElement('div');
    header.className = state.templates?.header || `chat2-message-header ${HASH.message}`;
    const usernameWrap = document.createElement('div');
    usernameWrap.className = state.templates?.usernameWrap || 'chat2-message-username';
    const anchor = document.createElement('a');
    anchor.className = state.templates?.poster || `username poster ${HASH.username}`;
    anchor.href = message.user.profileUrl || `https://lolz.team/members/${message.user.id}/`;
    let usernameHtml = message.user.usernameHtml ||
      `<span class="styleUserNickname">${escapeHtml(message.user.username || 'unknown')}</span>`;
    usernameHtml = sanitizeUsernameHtml(usernameHtml);
    if (!usernameHtml) {
      usernameHtml = `<span class="styleUserNickname">${escapeHtml(message.user.username || 'unknown')}</span>`;
    }
    anchor.innerHTML = usernameHtml;
    usernameWrap.appendChild(anchor);
    header.appendChild(usernameWrap);
    block.appendChild(header);
  }

  if (message.reply) {
    const reply = document.createElement('div');
    reply.className = `reply-message ${HASH.message}`;
    if (message.reply.user?.id && message.reply.user.id === state.user?.id) {
      reply.classList.add('reply-message-your');
    }
    reply.dataset.replyTo = String(message.reply.id);
    const label = document.createElement('span');
    label.className = `chat2-reply-text-label username ${HASH.message}`;
    let replyUsernameHtml = message.reply.user?.usernameHtml ||
      `<span class="styleUserNickname">${escapeHtml(message.reply.user?.username || 'unknown')}</span>`;
    replyUsernameHtml = sanitizeUsernameHtml(replyUsernameHtml);
    if (!replyUsernameHtml) {
      replyUsernameHtml = `<span class="styleUserNickname">${escapeHtml(message.reply.user?.username || 'unknown')}</span>`;
    }
    label.innerHTML = replyUsernameHtml;
    const text = document.createElement('span');
    text.className = `chat2-reply-text ${HASH.message}`;
    if (state.deletedIds.has(Number(message.reply.id)) || message.reply.deleted) {
      text.textContent = 'Сообщение удалено';
    } else if (message.reply.html) {
      text.innerHTML = enhanceUnfurls(message.reply.html);
      applyMentionHighlights(text);
      hydrateForumTitles(text);
      prepareReplyVideos(text);
    } else {
      const paragraph = document.createElement('p');
      paragraph.textContent = message.reply.text || '[сообщение]';
      text.appendChild(paragraph);
    }
    reply.appendChild(label);
    reply.appendChild(document.createTextNode(' '));
    reply.appendChild(text);
    block.appendChild(reply);
  }

  const text = document.createElement('div');
  text.className = state.templates?.text || `chat2-message-text ${HASH.message}`;
  const inner = document.createElement('span');
  inner.className = state.templates?.inner || `chat2-message-text-inner ${HASH.message}`;
  if (message.deleted) {
    const deleted = document.createElement('span');
    deleted.className = 'muted';
    deleted.textContent = 'Сообщение удалено';
    inner.appendChild(deleted);
  } else {
    const html = enhanceUnfurls(message.html || '');
    if (html) {
      inner.innerHTML = html;
      applyMentionHighlights(inner);
      hydrateForumTitles(inner);
    } else {
      inner.textContent = message.text || '';
    }
  }
  text.appendChild(inner);

  const date = document.createElement('span');
  date.className = state.templates?.date || `chat2-message-date ${HASH.date} chat2-message-date-muted`;
  const createdAt = new Date(message.createdAt || Date.now());
  date.textContent = formatTime(createdAt);
  date.title = formatFullDate(createdAt);
  text.appendChild(date);

  if (message.failed) {
    const retry = document.createElement('span');
    retry.className = 'nr-retry';
    retry.dataset.nrRetry = message.clientId || '';
    retry.textContent = 'Повторить';
    retry.title = 'Повторить отправку';
    text.appendChild(retry);
  }

  block.appendChild(text);
  return wrapper;
}

function installMessageListeners(container) {
  if (container.dataset.nrListeners === '1') return;
  container.dataset.nrListeners = '1';

  container.addEventListener('contextmenu', (event) => {
    const wrapper = event.target.closest?.('[data-nr-message]');
    if (!wrapper) return;
    const message = findMessageByElement(wrapper);
    if (!message) return;
    event.preventDefault();
    event.stopPropagation();
    openMessageMenu(message, event.clientX, event.clientY, event.target);
  });

  container.addEventListener('dblclick', (event) => {
    if (!state.active) return;
    if (event.target.closest?.('a, button, .nr-retry, .reply-message')) return;
    if (!window.getSelection()?.isCollapsed) return;
    const wrapper = event.target.closest?.('[data-nr-message]');
    if (!wrapper) return;
    const message = findMessageByElement(wrapper);
    if (!message || message.deleted || message.pending) return;
    event.preventDefault();
    startReply(message);
  });

  container.addEventListener('click', (event) => {
    const retry = event.target.closest?.('.nr-retry');
    if (retry) {
      event.preventDefault();
      event.stopPropagation();
      retryPending(retry.dataset.nrRetry);
      return;
    }
    const reply = event.target.closest?.('.reply-message');
    if (reply) {
      event.preventDefault();
      event.stopPropagation();
      scrollToMessage(Number(reply.dataset.replyTo));
      return;
    }
    const avatar = event.target.closest?.('.chat2-group-avatar');
    if (avatar) {
      event.preventDefault();
      event.stopPropagation();
      const group = avatar.closest('.chat2-message-group');
      const wrappers = group ? [...group.querySelectorAll('[data-nr-message]')] : [];
      const wrapper = wrappers.at(-1);
      const message = wrapper ? findMessageByElement(wrapper) : null;
      if (message && !message.deleted && !message.pending) startReply(message);
    }
  });

  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const avatar = event.target.closest?.('.chat2-group-avatar');
    if (!avatar) return;
    event.preventDefault();
    const group = avatar.closest('.chat2-message-group');
    const wrappers = group ? [...group.querySelectorAll('[data-nr-message]')] : [];
    const wrapper = wrappers.at(-1);
    const message = wrapper ? findMessageByElement(wrapper) : null;
    if (message && !message.deleted && !message.pending) startReply(message);
  });

  if (IS_TOUCH) {
    installTouchGestures(container);
  }
}

function findMessageByElement(element) {
  const id = element?.dataset?.messageId;
  if (!id) return null;
  if (state.messages.has(Number(id))) return state.messages.get(Number(id));
  for (const pending of state.pending.values()) {
    if (String(pending.id) === String(id)) return pending;
  }
  return null;
}

function installTouchGestures(container) {
  let gesture = null;

  const clearLongPress = () => {
    if (gesture?.longPressTimer) clearTimeout(gesture.longPressTimer);
    if (gesture) gesture.longPressTimer = null;
  };

  container.addEventListener(
    'touchstart',
    (event) => {
      if (!state.active || event.touches.length !== 1) return;
      const wrapper = event.target.closest?.('[data-nr-message]');
      if (!wrapper) return;
      if (event.target.closest?.('a, button, .reply-message, .nr-retry')) return;
      const touch = event.touches[0];
      const message = findMessageByElement(wrapper);
      if (!message || message.deleted) return;
      gesture = {
        wrapper,
        message,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        longPressTimer: null,
        openedMenu: false,
      };
      clearLongPress();
      gesture.longPressTimer = setTimeout(() => {
        if (!gesture) return;
        gesture.openedMenu = true;
        openMessageMenu(message, gesture.lastX, gesture.lastY);
      }, 520);
    },
    { passive: true },
  );

  container.addEventListener(
    'touchmove',
    (event) => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture.lastX = touch.clientX;
      gesture.lastY = touch.clientY;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearLongPress();
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        if (event.cancelable) event.preventDefault();
        const offset = clamp(dx, -10, 90);
        gesture.wrapper.style.transform = `translateX(${offset}px)`;
        gesture.wrapper.classList.add('nr-swipe');
      }
    },
    { passive: false },
  );

  const finish = (event) => {
    if (!gesture) return;
    clearLongPress();
    const wrapper = gesture.wrapper;
    const dx = gesture.lastX - gesture.startX;
    const dy = gesture.lastY - gesture.startY;
    const openedMenu = gesture.openedMenu;
    const message = gesture.message;
    wrapper.style.transform = '';
    wrapper.classList.remove('nr-swipe');
    gesture = null;
    if (!openedMenu && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (event?.cancelable) event.preventDefault();
      if (message && !message.deleted && !message.pending) startReply(message);
    }
  };

  container.addEventListener('touchend', finish, { passive: false });
  container.addEventListener('touchcancel', finish, { passive: true });
}

function openMessageMenu(message, x, y, target = null) {
  closeMenu();
  if (!message) return;

  const menu = document.createElement('div');
  menu.className = `message-actions ${HASH.menu}`;
  menu.dataset.nrMenu = '1';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  const list = document.createElement('ul');
  list.className = `menu ${HASH.menu}`;
  menu.appendChild(list);

  const add = (icon, label, handler, options = {}) => {
    const item = document.createElement('li');
    item.className = `action ${HASH.menu}`;
    if (options.disabled) item.setAttribute('aria-disabled', 'true');
    const iconWrap = document.createElement('span');
    iconWrap.className = `Svg-Icon ${HASH.menu}`;
    iconWrap.innerHTML = icon;
    iconWrap.querySelector('svg')?.classList.add(HASH.menu);
    item.appendChild(iconWrap);
    item.appendChild(document.createTextNode(` ${label}`));
    if (!options.disabled) {
      item.addEventListener('pointerdown', (event) => event.stopPropagation());
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        handler();
      });
    }
    list.appendChild(item);
  };

  if (message.pending) {
    if (message.failed) {
      add(NR_ICONS.retry, 'Повторить отправку', () => retryPending(message.clientId));
    }
    add(NR_ICONS.delete, 'Отменить сообщение', () => removePending(message.clientId));
  } else if (!message.deleted) {
    add(NR_ICONS.reply, 'Ответить', () => startReply(message));
    add(NR_ICONS.mention, 'Упомянуть', () => mentionMessage(message));
    add(NR_ICONS.copy, 'Скопировать текст', () =>
      copyText(message.raw || htmlToBbcode(message.html || message.text || '')),
    );
    if (message.user?.id === state.user?.id) {
      add(NR_ICONS.edit, 'Редактировать', () => startEdit(message));
      add(NR_ICONS.delete, 'Удалить', () => deleteMessage(message));
    }
    const media =
      target instanceof HTMLImageElement || target instanceof HTMLVideoElement
        ? target.currentSrc || target.src
        : '';
    if (media) {
      add(NR_ICONS.external, 'Открыть медиа', () => window.open(media, '_blank', 'noopener'));
      add(NR_ICONS.link, 'Скопировать медиа', () => copyText(media));
    }
    if (IS_TOUCH) {
      add(NR_ICONS.select, 'Выделить текст', () => selectMessageText(message));
    }
  }

  if (!list.children.length) return;
  menu.addEventListener('pointerdown', (event) => event.stopPropagation());
  document.body.appendChild(menu);
  positionMenu(menu, x, y);
  state.menuEl = menu;

  setTimeout(() => {
    document.addEventListener('pointerdown', closeMenuFromOutside, true);
    document.addEventListener('keydown', onMenuKeydown, true);
    window.addEventListener('resize', closeMenu, { passive: true });
    window.addEventListener('scroll', closeMenu, true);
  }, 0);
}

function closeMenuFromOutside(event) {
  const menu = state.menuEl;
  if (!menu) return;
  if (event?.type === 'pointerdown' && menu.contains(event.target)) return;
  closeMenu();
}

function onMenuKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
  }
}

function positionMenu(menu, x, y) {
  const rect = menu.getBoundingClientRect();
  const padding = 8;
  let left = Number(x) || padding;
  let top = Number(y) || padding;
  if (left + rect.width > window.innerWidth - padding) left = window.innerWidth - rect.width - padding;
  if (top + rect.height > window.innerHeight - padding) top = Number(y) - rect.height - 6;
  left = clamp(left, padding, Math.max(padding, window.innerWidth - rect.width - padding));
  top = clamp(top, padding, Math.max(padding, window.innerHeight - rect.height - padding));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeMenu() {
  const menu = state.menuEl;
  state.menuEl = null;
  if (menu) menu.remove();
  document.removeEventListener('pointerdown', closeMenuFromOutside, true);
  document.removeEventListener('keydown', onMenuKeydown, true);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
}

function showSystemMessage(text) {
  try {
    console.debug(`[NoRules:system] ${String(text)}`);
  } catch {
    // ignore
  }
}

function mediaServiceForUrl(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) return 'soundcloud';
    if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube';
    if (host.endsWith('tiktok.com')) return 'tiktok';
    if (host.endsWith('spotify.com')) return 'spotify';
    if (host.endsWith('twitch.tv')) return 'twitch';
    if (host.endsWith('vimeo.com')) return 'vimeo';
    if (host.endsWith('coub.com')) return 'coub';
    return '';
  } catch {
    return '';
  }
}

function absoluteForumUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, location.origin).toString();
  } catch {
    return raw;
  }
}

function htmlToBbcode(html) {
  const template = document.createElement('template');
  template.innerHTML = linkifyHtml(sanitizeClientHtml(html));
  const render = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node;
    const tag = element.tagName.toLowerCase();
    if (element.classList?.contains('node-media') || element.classList?.contains('embed-link')) {
      const url = element.getAttribute('data-url') || element.querySelector('a[href]')?.getAttribute('href') || '';
      const site = element.getAttribute('data-site-id') || '';
      return url ? `[MEDIA=${site || 'media'}]${url}[/MEDIA]` : '';
    }
    if (element.classList?.contains('node-unfurl') || element.classList?.contains('unfurl-renderer')) {
      const forum = element.querySelector('a.forum-wrapper');
      const link = element.querySelector('a.unfurl-wrapper, a[href]');
      const href = absoluteForumUrl(forum?.getAttribute('href') || link?.getAttribute('href'));
      if (href) {
        return forum
          ? `[UNFURL="${href}"]${href}[/UNFURL]`
          : `[unfurl="${href}"]${href}[/unfurl]`;
      }
    }
    if (tag === 'br') return '\n';
    if (tag === 'img') {
      const alt = element.getAttribute('alt') || '';
      if (element.classList.contains('mceSmilie') && alt) return alt;
      if (element.classList.contains('avatar')) return '';
      const src = element.getAttribute('src') || '';
      return src ? `[IMG]${src}[/IMG]` : '';
    }
    if (tag === 'abbr') return element.textContent || '';
    if (tag === 'video') {
      const src = element.getAttribute('src') || element.querySelector('source')?.getAttribute('src') || '';
      return src ? `[VIDEO]${src}[/VIDEO]` : '';
    }
    if (tag === 'a' && element.classList.contains('mention')) {
      const userId = Number(String(element.dataset.user || '').split(',')[0]);
      const name = element.querySelector('.styleUserNickname')?.textContent?.trim() || '';
      return userId && name ? `[USER=${userId}]@${name}[/USER]` : (name ? `@${name}` : '');
    }
    if (tag === 'a') {
      const href = absoluteForumUrl(element.getAttribute('href'));
      if (!href) return [...element.childNodes].map(render).join('');
      const text = [...element.childNodes].map(render).join('').trim();
      if (!text || text === href) return `[unfurl="${href}"]${href}[/unfurl]`;
      return `[URL=${href}]${text}[/URL]`;
    }
    if (element.classList.contains('unfurlContainer')) {
      const link = element.querySelector('a.LinkClicker, a[href]');
      const href = absoluteForumUrl(link?.getAttribute('href'));
      if (href) return `[unfurl="${href}"]${href}[/unfurl]`;
    }
    if (element.classList.contains('internalNodeLink')) {
      const link = element.querySelector('a.internalLinkClicker, a[href]');
      const href = absoluteForumUrl(link?.getAttribute('href'));
      if (href) return `[UNFURL="${href}"]${href}[/UNFURL]`;
    }
    const inner = [...element.childNodes].map(render).join('');
    if (tag === 'strong' || tag === 'b') return `[B]${inner}[/B]`;
    if (tag === 'em' || tag === 'i') return `[I]${inner}[/I]`;
    if (tag === 'u') return `[U]${inner}[/U]`;
    if (tag === 's' || tag === 'del') return `[S]${inner}[/S]`;
    if (tag === 'code' || tag === 'pre') return `[CODE]${inner}[/CODE]`;
    if (tag === 'blockquote') return `[QUOTE]${inner}[/QUOTE]`;
    if (tag === 'p' || tag === 'div' || tag === 'li' || tag === 'tr') return `${inner}\n`;
    return inner;
  };
  return [...template.content.childNodes]
    .map(render)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function copyText(text) {
  const value = String(text || '');
  if (!value) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  } catch {
    showToast('Не удалось скопировать', 'error');
  }
}

function selectMessageText(message) {
  const wrapper = document.querySelector(`#no-rules-messages [data-message-id="${message.id}"] .chat2-message-text-inner`);
  if (!wrapper) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(range);
}

function firstMediaUrl(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeClientHtml(html);
  const image = template.content.querySelector('img');
  if (image?.src) return image.src;
  const video = template.content.querySelector('video');
  if (video?.src) return video.src;
  const link = template.content.querySelector('a.LbTrigger');
  if (link?.href) return link.href;
  return '';
}

function scrollToMessage(id) {
  const targetId = Number(id);
  if (!targetId) return;
  let element = document.querySelector(
    `#no-rules-messages [data-message-id="${targetId}"]`,
  );
  if (!element) {
    if (state.historyHasMore && !state.historyLoading) {
      requestOlderMessages();
      setTimeout(() => {
        element = document.querySelector(
          `#no-rules-messages [data-message-id="${targetId}"]`,
        );
        if (element) highlightElement(element);
      }, 900);
    } else {
      showToast('Сообщение находится в более старой истории', 'info');
    }
    return;
  }
  highlightElement(element);
}

function highlightElement(element) {
  element.classList.add('nr-highlight');
  const block = element.querySelector('.chat2-message-block') || element;
  block.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => element.classList.remove('nr-highlight'), 1600);
}
