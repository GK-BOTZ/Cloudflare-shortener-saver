<?php
header('Content-Type: application/json');

// Set the secret key (use the same as in JS)
$SECRET_KEY = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet';

// Encrypt function using AES-GCM
function encrypt($plaintext, $key) {
    $iv = random_bytes(12);  // Initialization vector (12 bytes for AES-GCM)
    $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

    if ($cipher === false) {
        return null;  // Encryption failed
    }

    // Concatenate IV, cipher text and tag
    $encrypted = base64_encode($iv . $tag . $cipher);
    return $encrypted;
}

// Handle the incoming URL parameter
if (isset($_GET['url'])) {
    $url = $_GET['url'];

    // Check if it's a valid URL
    if (filter_var($url, FILTER_VALIDATE_URL)) {
        $encrypted = encrypt($url, $SECRET_KEY);
        if ($encrypted) {
            // Return the encrypted URL as JSON
            echo json_encode(['encrypted_url' => 'https://yourdomain.com/redirect.php?token=' . $encrypted]);
        } else {
            echo json_encode(['error' => 'Encryption failed']);
        }
    } else {
        echo json_encode(['error' => 'Invalid URL']);
    }
} else {
    echo json_encode(['error' => 'Missing URL parameter']);
}
?>
