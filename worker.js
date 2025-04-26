const SECRET_KEY = 'your-32-characters-secret-key'

async function encrypt(text) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET_KEY), { name: 'AES-GCM' }, false, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text))
    const encryptedBytes = new Uint8Array(encrypted)
    const result = new Uint8Array(iv.length + encryptedBytes.length)
    result.set(iv)
    result.set(encryptedBytes, iv.length)
    return btoa(String.fromCharCode(...result)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function decrypt(base64) {
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const data = bytes.slice(12)
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET_KEY), { name: 'AES-GCM' }, false, ['decrypt'])
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(decrypted)
}

export default {
    async fetch(request) {
        const { pathname } = new URL(request.url)
        const encrypted = pathname.slice(1)
        if (!encrypted) return new Response('Invalid Request', { status: 400 })
        try {
            const url = await decrypt(encrypted)
            if (!url.startsWith('http://') && !url.startsWith('https://')) return new Response('Invalid URL', { status: 400 })
            return new Response(null, { status: 302, headers: { 'Location': url, 'Cache-Control': 'no-store' } })
        } catch {
            return new Response('Bad Request', { status: 400 })
        }
    }
}
