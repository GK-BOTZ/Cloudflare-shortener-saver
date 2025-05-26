export default {
  async fetch(request) {
    const { searchParams, pathname } = new URL(request.url)
    const url = searchParams.get('url')
    const site = searchParams.get('site')
    const api = searchParams.get('api')

    // Base URL - Show HTML form
    if (!url) {
      return new Response(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Encrypt URL</title>
          <style>
            body {
              font-family: sans-serif;
              background: #f2f2f2;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            h1 { color: #333; }
            form {
              background: #fff;
              padding: 20px 30px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              display: flex;
              flex-direction: column;
              gap: 10px;
              width: 300px;
            }
            input[type="text"] {
              padding: 10px;
              border: 1px solid #ccc;
              border-radius: 5px;
            }
            button {
              background: #0070f3;
              color: #fff;
              padding: 10px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            }
            button:hover {
              background: #005ec2;
            }
          </style>
        </head>
        <body>
          <h1>Encrypt a URL</h1>
          <form method="get" action="/">
            <input type="text" name="url" placeholder="Target URL" required>
            <input type="text" name="site" placeholder="Custom shortener (optional)">
            <input type="text" name="api" placeholder="API key (if site used)">
            <button type="submit">Encrypt</button>
          </form>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Error if only site or api is provided
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

    // Proxy request to PHP encrypt API
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
