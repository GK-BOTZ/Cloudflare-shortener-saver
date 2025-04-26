const SECRET_KEY = 'hyW50pRdFpXB4Rw2fxAv7i9K6QpyNIzG'

async function encrypt(text) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(SECRET_KEY),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    )
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(text)
    )
    const bytes = new Uint8Array(iv.byteLength + encrypted.byteLength)
    bytes.set(iv, 0)
    bytes.set(new Uint8Array(encrypted), iv.byteLength)
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

async function decrypt(base64) {
    const bin = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const data = bytes.slice(12)
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(SECRET_KEY),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    )
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(decrypted)
}

function renderSplash() {
    return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Short GK</title>
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        background: #111;
        color: #fff;
        font-family: sans-serif;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .text {
        font-size: 5vw;
        position: relative;
        animation: fadeIn 2s ease-in-out infinite alternate;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.8) rotate(-5deg); }
        to   { opacity: 1; transform: scale(1.2) rotate(5deg); }
      }
    </style>
</head>
<body>
  <div class="text">Short GK</div>
</body>
</html>`,
        {
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        }
    )
}

export default {
    async fetch(request) {
        const url = new URL(request.url)
        const key = url.pathname.slice(1)
        if (!key) {
            // No path → show animated splash
            return renderSplash()
        }
        try {
            const target = await decrypt(key)
            if (!/^https?:\/\//.test(target)) {
                return new Response('Invalid URL', { status: 400 })
            }
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': target,
                    'Cache-Control': 'no-store'
                }
            })
        } catch {
            return new Response('Bad Request', { status: 400 })
        }
    }
}
