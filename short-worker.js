addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

const ENCRYPT_WORKER_BASE = 'https://short.gkbotz.workers.dev'
const shortenersList = [
    { domain: 'linkcents.com',   apiKey: '7d36dcbb8d07110d2691ceab1825eef2bc4c002b' },
    { domain: 'arolinks.com',     apiKey: '858dc03a78bfdbab21239e0f0c83d54282b91fc7' },
    { domain: 'linkshortify.com', apiKey: 'a77fbdbf8066126f4da2300228df51f3ab662254' }
]

async function handleRequest(request) {
    const { searchParams } = new URL(request.url)
    const longUrl = searchParams.get('url')
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

    // forward the shortened URL to your encrypt worker
    const encRes = await fetch(`${ENCRYPT_WORKER_BASE}/encrypt?url=${encodeURIComponent(short)}`)
    if (encRes.ok) {
        const encryptedLink = await encRes.text()
        return new Response(encryptedLink, { status: 200 })
    }

    // fallback: return plain short URL if encrypt fails
    return new Response(short, { status: 200 })
}}
