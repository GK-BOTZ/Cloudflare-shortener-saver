const SECRET_KEY = 'hyW50pRdFpXB4Rw2fxAv7i9K6QpyNIzG'
const REDIRECT_DELAY_MS = 5000

async function decryptToken(token) {
  const bin = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
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

class RedirectInjector {
  constructor(target) {
    this.target = target
  }
  element(element) {
    if (element.tagName === 'head') {
      element.append(`
        <script>
          setTimeout(() => {
            window.location.replace(${JSON.stringify(this.target)})
          }, ${REDIRECT_DELAY_MS});
        </script>
      `, { html: true })
    }
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const token = url.pathname.slice(1)
    if (!token) return new Response('Invalid Request', { status: 400 })

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

    const contentType = res.headers.get('Content-Type') || ''
    // If HTML, inject redirect script
    if (contentType.includes('text/html')) {
      return new HTMLRewriter()
        .on('head', new RedirectInjector(target))
        .transform(res)
    }
    // Otherwise proxy as-is
    const headers = new Headers(res.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    })
  }
}
