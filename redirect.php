<?php
header('Content-Type: text/html');

// Set the secret key (must match the one used in `encrypt.php`)
$SECRET_KEY = 'csCFNLEU4hG4OglLkqi5S82gTGQ3Onet';

function decrypt($encrypted, $key) {
    // Decode the base64 string
    $data = base64_decode($encrypted);

    // Extract the IV, tag, and cipher text
    $iv = substr($data, 0, 12);
    $tag = substr($data, 12, 16);
    $cipher = substr($data, 28);

    // Decrypt the data
    $decrypted = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

    return $decrypted;
}

if (isset($_GET['token'])) {
    $token = $_GET['token'];

    // Try to decrypt the URL
    $url = decrypt($token, $SECRET_KEY);
    if ($url) {
        // Redirect to the original URL
        header('Location: ' . $url);
        exit;
    } else {
        echo '<h1>Invalid or corrupted token</h1>';
    }
} else {
    echo '<h1>Missing token</h1>';
}
?>
