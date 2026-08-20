<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $htmlContent = $_POST['html'] ?? '';

    // Set headers to force download of index.html
    header('Content-Type: text/html');
    header('Content-Disposition: attachment; filename="index.html"');
    header('Content-Length: ' . strlen($htmlContent));

    echo $htmlContent;
    exit;
}
http_response_code(405);
echo json_encode(['error' => 'Invalid request method.']);
