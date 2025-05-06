addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Configuration
const SECRET_KEY = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet';
const ENCRYPT_BASE = 'https://encrypt.gkbotz.workers.dev';
const shortenersList = [
 // { domain: 'linkcents.com', apiKey: '7d36dcbb8d07110d2691ceab1825eef2bc4c002b' },
  { domain: 'arolinks.com', apiKey: '858dc03a78bfdbab21239e0f0c83d54282b91fc7' },
  { domain: 'bharatlinks.com', apiKey: '71d7f6b1acf8956acf02d6a582de8ba30261fdd4' }
];

// Import AES-GCM key for encryption
async function importKey() {
  const rawKey = new TextEncoder().encode(SECRET_KEY);
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
}

// Encrypt the URL token
async function encryptToken(plain) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importKey();
    const data = new TextEncoder().encode(plain);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    const cipherArray = new Uint8Array(cipherBuffer);
    const combined = new Uint8Array(iv.length + cipherArray.length);
    combined.set(iv, 0);
    combined.set(cipherArray, iv.length);
    const token = btoa(String.fromCharCode(...combined))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return token;
  } catch (e) {
    throw new Error('Encryption failed');
  }
}

// Render the landing page
function renderLanding() {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>URL Shortener</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 5rem auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; }
        form { display: flex; gap: 0.5rem; }
        input[type="url"] { flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
        button { padding: 0.5rem 1rem; background: #007acc; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005fa3; }
        #result a { word-break: break-all; }
        .error { color: red; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>URL Shortener</h1>
        <form id="shorten-form">
          <input type="url" id="url-input" placeholder="Enter URL to shorten (http:// or https://)" required />
          <button type="submit">Shorten</button>
        </form>
        <div id="result" style="margin-top:1rem;"></div>
      </div>
      <script>
        const form = document.getElementById('shorten-form');
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const urlInput = document.getElementById('url-input').value;
          const resultDiv = document.getElementById('result');
          try {
            const response = await fetch('?url=' + encodeURIComponent(urlInput));
            if (!response.ok) throw new Error(await response.text());
            const short = await response.text();
            resultDiv.innerHTML = \`<p>Shortened URL: <a href="\${short}" target="_blank">\${short}</a></p>\`;
          } catch (e) {
            resultDiv.innerHTML = \`<p class="error">Error: \${e.message}</p>\`;
          }
        });
      </script>
    </body>
    </html>
  `;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

// Handle incoming requests
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const longUrl = url.searchParams.get('url');

  // Serve landing page if no URL parameter is provided
  if (path === '/' && !longUrl) {
    return renderLanding();
  }

  // Validate URL parameter
  if (!longUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // Validate input URL
  let validatedUrl;
  try {
    validatedUrl = new URL(longUrl);
    if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs are supported');
    }
  } catch {
    return new Response('Invalid URL: Must be a valid HTTP/HTTPS URL', { status: 400 });
  }

  // Try each shortener until success
  let short = '';
  for (const { domain, apiKey } of shortenersList) {
    const apiUrl = `https://${domain}/api`;
    const params = new URLSearchParams({ api: apiKey, url: longUrl, format: 'text' });
    try {
      const res = await fetch(`${apiUrl}?${params}`, { timeout: 5000 });
      if (res.ok) {
        short = await res.text();
        if (short && /^https?:\/\//.test(short)) break; // Ensure valid shortened URL
      }
    } catch {
      continue; // Move to next shortener on failure
    }
  }

  // Fallback to original URL if all shorteners fail
  if (!short) {
    short = longUrl;
  }

  // Encrypt and return the shortened URL
  try {
    const token = await encryptToken(short);
    const encoded = encodeURIComponent(token);
    const encryptedUrl = `${ENCRYPT_BASE}/${encoded}`;
    return new Response(encryptedUrl, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('Failed to generate shortened URL', { status: 500 });
  }
}
