import base64
import os
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

SECRET_KEY = b'your-32-characters-secret-key'

def encrypt_url(url):
    iv = get_random_bytes(12)
    cipher = AES.new(SECRET_KEY, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(url.encode())
    encrypted = iv + ciphertext
    b64_encoded = base64.urlsafe_b64encode(encrypted).decode().rstrip('=')
    return b64_encoded
