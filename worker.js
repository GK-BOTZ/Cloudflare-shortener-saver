const SECRET_KEY    = 'hyW50pRdFpXB4Rw2fxAv7i9K6QpyNIzG'
const REDIRECT_DELAY_MS = 500

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

export default {
  async fetch(request) {
    const url   = new URL(request.url)
    const path  = url.pathname
    const token = path.slice(1)
    if (!token) return new Response('Invalid Request', { status: 400 })

    // Step 2: if ?go=1, decrypt and redirect immediately
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

    // Step 1: proxy the real page and inject delayed redirect to short URL
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
