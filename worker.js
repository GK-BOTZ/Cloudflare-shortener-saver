const SECRET_KEY       = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet'
const REDIRECT_DELAY_MS = 5000

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

// Rewrite <head> to inject delayed redirect back to /TOKEN?go=1
class HeadInjector {
  constructor(path) { this.path = path }
  element(el) {
    el.append(
      `<script>
         setTimeout(()=>{
           window.location.href=${JSON.stringify(this.path+'?go=1')}
         },${REDIRECT_DELAY_MS});
       </script>`,
      { html: true }
    )
  }
}

// Rewrite all links to stay under /TOKEN
class LinkRewriter {
  constructor(path) { this.path=path }
  element(el) {
    const attr = el.tagName==='LINK'?'href':'src'
    const url = el.getAttribute(attr)
    if(url && /^https?:\/\//.test(url)) {
      el.setAttribute(attr, this.path+'?asset='+encodeURIComponent(url))
    }
  }
}

// Serve landing page
function renderLanding() {
  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Short GK</title>
<style>
  body{margin:0;font-family:Arial,sans-serif;color:#333}
  header{background:#007acc;color:#fff;padding:2rem;text-align:center}
  .hero{padding:4rem;text-align:center}
  .btn{background:#007acc;color:#fff;padding:.75rem 1.5rem;text-decoration:none;border-radius:4px}
</style>
</head><body>
  <header><h1>Short GK</h1>
    <nav><a href="https://t.me/GKBotz" style="color:#fff">Telegram Channel</a></nav>
  </header>
  <section class="hero">
    <h2>Secure & Invisible URL Shortener</h2>
    <a class="btn" href="#start">Get Started</a>
  </section>
</body></html>`, {
    headers:{'Content-Type':'text/html;charset=UTF-8'}
  })
}

export default {
  async fetch(request) {
    const url    = new URL(request.url)
    const path   = url.pathname
    const token  = path.slice(1)
    const go     = url.searchParams.has('go')
    const assetU = url.searchParams.get('asset')

    // 1) Landing
    if(!token) return renderLanding()

    // 2) Asset proxy (images, CSS, JS, fonts, etc.)
    if(assetU) {
      try {
        const decoded = decodeURIComponent(assetU)
        const resp = await fetch(decoded, {
          headers: { 'User-Agent':request.headers.get('User-Agent')||'' }
        })
        const h = new Headers(resp.headers)
        h.set('Cache-Control','no-store')
        return new Response(resp.body, {
          status:resp.status,
          headers:h
        })
      } catch { return new Response('Bad Request',{status:400}) }
    }

    // 3) Final redirect
    if(go) {
      let target
      try {
        target = await decryptToken(token)
        if(!/^https?:\/\//.test(target)) throw 0
      } catch {
        return new Response('Bad Request',{status:400})
      }
      return new Response(null,{
        status:302,
        headers:{'Location':target,'Cache-Control':'no-store'}
      })
    }

    // 4) Initial proxy + inject delayed redirect
    let target
    try {
      target = await decryptToken(token)
      if(!/^https?:\/\//.test(target)) throw 0
    } catch {
      return new Response('Bad Request',{status:400})
    }
    const res = await fetch(target,{
      headers:{ 'User-Agent':request.headers.get('User-Agent')||'' }
    })
    const ct  = res.headers.get('Content-Type')||''
    if(ct.includes('text/html')) {
      return new HTMLRewriter()
        .on('head', new HeadInjector(path))
        .on('img',  new LinkRewriter(path))
        .on('script', new LinkRewriter(path))
        .on('link', new LinkRewriter(path))
        .transform(res)
    }
    // non-HTML fallback
    const h = new Headers(res.headers)
    h.set('Cache-Control','no-store')
    return new Response(res.body,{
      status:res.status, headers:h
    })
  }
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

const shortenersList = [
    {domain: 'linkcents.com', apiKey: '7d36dcbb8d07110d2691ceab1825eef2bc4c002b'},
    {domain: 'arolinks.com', apiKey: '858dc03a78bfdbab21239e0f0c83d54282b91fc7'},
    {domain: 'linkshortify.com', apiKey: 'a77fbdbf8066126f4da2300228df51f3ab662254'}
]

async function handleRequest(request) {
    const { searchParams } = new URL(request.url)
    const longUrl = searchParams.get('url')
    if (!longUrl) {
        return new Response('Missing url parameter', { status: 400 })
    }
    const index = shortenersList.length === 1 ? 0 : Math.floor(Math.random() * shortenersList.length)
    const { domain, apiKey } = shortenersList[index]
    const apiUrl = `https://${domain}/api`
    const params = new URLSearchParams({ api: apiKey, url: longUrl, format: 'text' })
    let res = await fetch(`${apiUrl}?${params.toString()}`)
    if (res.ok) {
        const text = await res.text()
        if (text) {
            return new Response(text, { status: 200 })
        }
    }
    params.set('format', 'json')
    res = await fetch(`${apiUrl}?${params.toString()}`)
    if (res.ok) {
        const data = await res.json()
        return new Response(data.shortenedUrl || longUrl, { status: 200 })
    }
    return new Response(longUrl, { status: 200 })
}
