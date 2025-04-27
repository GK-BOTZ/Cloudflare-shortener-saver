const SECRET_KEY       = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet'
const REDIRECT_DELAY_MS = 50

async function decryptToken(token) {
  const bin   = atob(token.replace(/-/g,'+').replace(/_/g,'/'))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  const iv    = bytes.slice(0,12)
  const data  = bytes.slice(12)
  const key   = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET_KEY),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const dec   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(dec)
}

class HeadInjector {
  constructor(path) { this.path = path }
  element(element) {
    element.append(
      `<script>
         setTimeout(()=>{
           window.location.href = ${JSON.stringify(this.path + '?go=1')}
         }, ${REDIRECT_DELAY_MS});
       </script>`,
      { html: true }
    )
  }
}

class AnchorRewriter {
  constructor(path) { this.path = path }
  element(element) {
    element.setAttribute('href', this.path + '?go=1')
  }
}

function renderLanding() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Short GK</title>
  <style>
    body { margin:0; font-family:Arial,sans-serif; color:#333; }
    header { background:#007acc; color:#fff; padding:2rem 1rem; text-align:center; }
    header h1 { margin:0; font-size:3rem; }
    nav a { color:#fff; margin:0 1rem; text-decoration:none; font-weight:bold; }
    .hero { padding:4rem 1rem; text-align:center; }
    .hero h2 { font-size:2rem; margin-bottom:1rem; }
    .hero p { max-width:600px; margin:0 auto 2rem; line-height:1.5; }
    .btn { display:inline-block; padding:0.75rem 1.5rem; background:#007acc; color:#fff; text-decoration:none; border-radius:4px; }
    .features { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:1rem; padding:2rem 1rem; }
    .feature { background:#f5f5f5; padding:1.5rem; border-radius:6px; text-align:center; }
    footer { background:#222; color:#aaa; text-align:center; padding:1rem; }
    footer a { color:#007acc; text-decoration:none; }
  </style>
</head>
<body>
  <header>
    <h1>Short GK</h1>
    <nav>
      <a href="https://t.me/GKBotz" target="_blank">Telegram Channel</a>
    </nav>
  </header>
  <section class="hero">
    <h2>Secure & Invisible URL Shortener</h2>
    <p>Short GK makes your links untraceable, fast, and secure. No one can see where your users go — ultimate privacy at the edge.</p>
    <a class="btn" href="#get-started">Get Started</a>
  </section>
  <section id="get-started" class="features">
    <div class="feature">
      <h3>End-to-End Encryption</h3>
      <p>Your URLs are AES-GCM encrypted. Only our edge Worker can decrypt them.</p>
    </div>
    <div class="feature">
      <h3>5-Second Preview</h3>
      <p>Mirror any page for up to 5 seconds, then redirect—no leaks in HTML or scripts.</p>
    </div>
    <div class="feature">
      <h3>Edge-Powered Speed</h3>
      <p>Hosted on Cloudflare Workers. Redirects in under 50ms worldwide.</p>
    </div>
    <div class="feature">
      <h3>Simple API</h3>
      <p>Generate encrypted links with one function. Integrates with Python, Node.js, or any stack.</p>
    </div>
  </section>
  <footer>
    &copy; ${new Date().getFullYear()} Short GK • <a href="https://t.me/GKBotz" target="_blank">GKBotz on Telegram</a>
  </footer>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  })
}

export default {
  async fetch(request) {
    const url   = new URL(request.url)
    const path  = url.pathname
    const token = path.slice(1)

    if (!token) {
      return renderLanding()
    }

    if (url.searchParams.has('go')) {
      let target
      try {
        target = await decryptToken(token)
        if (!/^https?:\/\//.test(target)) throw new Error()
      } catch {
        return new Response('Bad Request', { status: 400 })
      }
      return new Response(null, {
        status: 302,
        headers: { 'Location': target, 'Cache-Control': 'no-store' }
      })
    }

    let target
    try {
      target = await decryptToken(token)
      if (!/^https?:\/\//.test(target)) throw new Error()
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const res = await fetch(target, {
      headers: { 'User-Agent': request.headers.get('User-Agent') || '' }
    })
    const ct  = res.headers.get('Content-Type') || ''

    if (ct.includes('text/html')) {
      return new HTMLRewriter()
        .on('head', new HeadInjector(path))
        .on('a',    new AnchorRewriter(path))
        .transform(res)
    }

    const headers = new Headers(res.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    })
  }
}
