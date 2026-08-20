<?php
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
        $themeBasePath = (
                    isset($_SERVER["REQUEST_SCHEME"]) ?
                        $_SERVER["REQUEST_SCHEME"] :
                            "http") . "://" . $_SERVER["HTTP_HOST"];
        $uploadDir = __DIR__ . '/uploads/';
        $uploadUrl = $themeBasePath . '/uploads/';
        $file = $_FILES['file'];
        $fileName = basename($file['name']);
        $targetFilePath = $uploadDir . $fileName;

        // Ensure the uploads directory exists
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Move the uploaded file to the target directory
        if (move_uploaded_file($file['tmp_name'], $targetFilePath)) {
            echo json_encode(['url' => $uploadUrl . $fileName]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to upload file.']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid request.']);
    }
?>
