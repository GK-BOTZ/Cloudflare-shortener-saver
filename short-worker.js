addEventListener('fetch', event => { event.respondWith(handleRequest(event.request)) })

const SECRET_KEY        = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet' 
const shortenersList = [ { domain: 'linkcents.com',   apiKey: '7d36dcbb8d07110d2691ceab1825eef2bc4c002b' }, { domain: 'arolinks.com',    apiKey: '858dc03a78bfdbab21239e0f0c83d54282b91fc7' }, { domain: 'linkshortify.com',apiKey: 'a77fbdbf8066126f4da2300228df51f3ab662254' } ] 
const ENCRYPT_BASE = 'https://encrypt.gkbotz.workers.dev'

async function importKey() { return crypto.subtle.importKey( 'raw', new TextEncoder().encode(SECRET_KEY), { name: 'AES-GCM' }, false, ['encrypt'] ) }

async function encryptToken(plain) { 
    const iv   = crypto.getRandomValues(new Uint8Array(12)) 
    const key  = await importKey() const data = new TextEncoder().encode(plain) 
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data) 
    const buf = new Uint8Array(iv.byteLength + cipher.byteLength) buf.set(iv, 0) buf.set(new Uint8Array(cipher), iv.byteLength) 
    const token = btoa(String.fromCharCode(...buf)) .replace(/+/g, '-') .replace(///g, '_') .replace(/=+$/, '') return token }

function renderLanding() { return new Response(`<!DOCTYPE html>

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
    </style>
</head>
<body>
    <div class="container">
        <h1>URL Shortener</h1>
        <form id="shorten-form">
            <input type="url" id="url-input" placeholder="Enter URL to shorten" required />
            <button type="submit">Shorten</button>
        </form>
        <div id="result" style="margin-top:1rem;"></div>
    </div>
    <script>
        document.getElementById('shorten-form').addEventListener('submit', async function(e) {
            e.preventDefault()
            const url = document.getElementById('url-input').value
            const resp = await fetch('?url=' + encodeURIComponent(url))
            const short = await resp.text()
            document.getElementById('result').innerHTML = '<p>Encrypted URL: <a href="' + short + '" target="_blank">' + short + '</a></p>'
        })
    </script>
</body>
</html>`, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    })
}async function handleRequest(request) { 
        const url = new URL(request.url) 
        const path = url.pathname
        const longUrl = url.searchParams.get('url')

if (path === '/' && !longUrl) {
    return renderLanding()
}

if (!longUrl) {
    return new Response('Missing url parameter', { status: 400 })
}

const index = shortenersList.length === 1
    ? 0
    : Math.floor(Math.random() * shortenersList.length)
const { domain, apiKey } = shortenersList[index]
const apiUrl = `https://${domain}/api`
const params = new URLSearchParams({ api: apiKey, url: longUrl, format: 'text' })

let res = await fetch(`${apiUrl}?${params.toString()}`)
let short = ''
if (res.ok) {
    short = await res.text() || ''
}
if (!short) {
    params.set('format', 'json')
    res = await fetch(`${apiUrl}?${params.toString()}`)
    if (res.ok) {
        const data = await res.json()
        short = data.shortenedUrl || ''
    }
}
if (!short) {
    short = longUrl
}

const token = await encryptToken(short)
const encoded = encodeURIComponent(token)
const encryptedUrl = `${ENCRYPT_BASE}/${encoded}`
return new Response(encryptedUrl, { status: 200 })

}

