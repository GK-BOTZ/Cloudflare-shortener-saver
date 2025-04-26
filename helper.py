import random
import string

def generate_secret_key():
    chars = string.ascii_letters + string.digits
    key = ''.join(random.choice(chars) for _ in range(32))
    return key

print(generate_secret_key())
