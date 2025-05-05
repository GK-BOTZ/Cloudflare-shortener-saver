addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Configuration
const SECRET_KEY = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet';
const REDIRECT_DELAY_MS = 5000;

// Import AES-GCM key for encryption/decryption
async function importKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET_KEY),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt the URL token
async function encryptToken(plain) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importKey();
    const data = new TextEncoder().encode(plain);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const buf = new Uint8Array(iv.byteLength + cipher.byteLength);
    buf.set(iv, 0);
    buf.set(new Uint8Array(cipher), iv.length);
    return btoa(String.fromCharCode(...buf))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    throw new Error('Encryption failed');
  }
}

// Decrypt the URL token
async function decryptToken(token) {
  try {
    const bin = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const key = await importKey();
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch {
    throw new Error('Decryption failed');
  }
}

// Inject meta refresh tag for redirection
class HeadInjector {
  constructor(path) {
    this.path = path;
  }
  element(el) {
    el.append(
      `<meta http-equiv="refresh" content="${REDIRECT_DELAY_MS / 1000};url=${this.path}?go=1">`,
      { html: true }
    );
  }
}

// Rewrite asset URLs
class LinkRewriter {
  constructor(path) {
    this.path = path;
  }
  element(el) {
    const attr = el.tagName === 'LINK' ? 'href' : 'src';
    const url = el.getAttribute(attr);
    if (url && /^https?:\/\//.test(url)) {
      el.setAttribute(attr, `${this.path}?asset=${encodeURIComponent(url)}`);
    }
  }
}

// Render the landing page
function renderLanding() {
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>Short GK</title><style>
      body { margin: 0; font-family: Arial, sans-serif; color: #333; }
      header { background: #007acc; color: #fff; padding: 2rem; text-align: center; }
      .hero { padding: 4rem; text-align: center; }
      .btn { background: #007acc; color: #fff; padding: .75rem 1.5rem; text-decoration: none; border-radius: 4px; }
      .btn:hover { background: #005fa3; }
    </style></head><body>
      <header><h1>Short GK</h1><nav><a href="https://t.me/GKBotz" style="color:#fff">Telegram Channel</a></nav></header>
      <section class="hero"><h2>Secure & Invisible URL Shortener</h2><a class="btn" href="#start">Get Started</a></section>
    </body></html>
  `;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

// Handle incoming requests
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = url.origin;
  const goFlag = url.searchParams.has('go');
  const assetU = url.searchParams.get('asset');

  // 1) Encrypt endpoint: /encrypt?url=LONG
  if (path === '/encrypt' && url.searchParams.has('url')) {
    const longUrl = url.searchParams.get('url');
    if (!longUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }
    try {
      new URL(longUrl); // Validate URL
      const token = await encryptToken(longUrl);
      return new Response(`${origin}/${token}`, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return new Response('Invalid URL or encryption error', { status: 400 });
    }
  }

  // 2) Landing page when no token
  const token = path.slice(1);
  if (!token) {
    return renderLanding();
  }

  // 3) Asset proxy
  if (assetU) {
    try {
      const decoded = decodeURIComponent(assetU);
      new URL(decoded); // Validate asset URL
      const resp = await fetch(decoded, {
        headers: { 'User-Agent': request.headers.get('User-Agent') || '' },
      });
      const h = new Headers(resp.headers);
      h.set('Cache-Control', 'no-store');
      return new Response(resp.body, { status: resp.status, headers: h });
    } catch {
      return new Response('Invalid asset URL', { status: 400 });
    }
  }

  // 4) Final redirect if go=1
  if (goFlag) {
    try {
      const target = await decryptToken(token);
      new URL(target); // Validate target URL
      return new Response(null, {
        status: 302,
        headers: { 'Location': target, 'Cache-Control': 'no-store' },
      });
    } catch {
      return new Response('Invalid or corrupted token', { status: 400 });
    }
  }

  // 5) Initial proxy + delayed redirect injection
  let target;
  try {
    target = await decryptToken(token);
    new URL(target); // Validate target URL
  } catch {
    return new Response('Invalid or corrupted token', { status: 400 });
  }

  const res = await fetch(target, {
    headers: { 'User-Agent': request.headers.get('User-Agent') || '' },
  });
  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('text/html') && res.status === 200) {
    return new HTMLRewriter()
      .on('head', new HeadInjector(path))
      .on('img', new LinkRewriter(path))
      .on('script', new LinkRewriter(path))
      .on('link', new LinkRewriter(path))
      .transform(res);
  } else {
    const h = new Headers(res.headers);
    h.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers: h });
  }
}
