<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $theme = $_POST['dir'] ?? null;
    $themeDir = __DIR__ . '/themes/' . $theme;

    // Validate theme
    if (!$theme) {
        echo json_encode(['status' => 'error', 'message' => 'Theme is missing']);
        exit;
    }

    // Validate HTML and data
    if (!$_POST['html'] && !$_POST['data']) {
        echo json_encode(['status' => 'error', 'message' => 'HTML or data is missing']);
        exit;
    }

    // Ensure the theme directory exists
    if (!is_dir($themeDir)) {
        mkdir($themeDir, 0755, true);
    }

    // Save HTML data
    if ($_POST['html']) {
        $data = $_POST['html'] ?? null;

        if (!$theme || !$data) {
            echo json_encode(['status' => 'error', 'message' => 'Theme or data is missing']);
            exit;
        }

        $storeFile = $themeDir . '/store.html';

        // Save the data to the store.html file
        file_put_contents($storeFile, $data);
    }

    // Save JSON data
    if ($_POST['data']) {
        $data = $_POST['data'] ?? null;

        if (!$theme || !$data) {
            echo json_encode(['status' => 'error', 'message' => 'Theme or data is missing']);
            exit;
        }

        $storeFile = $themeDir . '/store.json';

        // Save the data to the store.json file
        file_put_contents($storeFile, $data);
    }

    echo json_encode(['status' => 'success']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}
?>
