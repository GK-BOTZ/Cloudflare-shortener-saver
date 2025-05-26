export default {
  async fetch(request) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const site = searchParams.get('site')
    const api = searchParams.get('api')

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url param' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate site/api combos
    if (site && !api) {
      return new Response(JSON.stringify({ error: 'api is missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (api && !site) {
      return new Response(JSON.stringify({ error: 'site is missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build encrypt.php request URL
    const proxyUrl = new URL('http://gkbotz.ct.ws/short/encrypt.php')
    proxyUrl.searchParams.set('url', url)
    if (site && api) {
      proxyUrl.searchParams.set('site', site)
      proxyUrl.searchParams.set('api', api)
    }

    try {
      const encryptRes = await fetch(proxyUrl.toString())
      const body = await encryptRes.text()
      return new Response(body, {
        status: encryptRes.status,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to contact encrypt.php' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
