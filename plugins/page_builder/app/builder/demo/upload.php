<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $uploadDir = __DIR__ . '/themes/';
    $maxFileSize = 10 * 1024 * 1024; // 10 MB

    // Check if the file exceeds the size limit
    if ($_FILES['file']['size'] > $maxFileSize) {
        echo json_encode(['status' => 'error', 'message' => 'The uploaded file exceeds the maximum allowed size of 10 MB.']);
        exit;
    }

    $zipFile = $_FILES['file']['tmp_name'];
    $zipName = pathinfo($_FILES['file']['name'], PATHINFO_FILENAME);
    $extractPath = $uploadDir . $zipName;

    // Check if the file was uploaded
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'The uploaded file exceeds the upload_max_filesize directive in php.ini.',
            UPLOAD_ERR_FORM_SIZE => 'The uploaded file exceeds the MAX_FILE_SIZE directive specified in the HTML form.',
            UPLOAD_ERR_PARTIAL => 'The uploaded file was only partially uploaded.',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder.',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.',
            UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload.',
        ];
        $errorCode = $_FILES['file']['error'];
        $errorMessage = $errorMessages[$errorCode] ?? 'Unknown upload error.';
        echo json_encode(['status' => 'error', 'message' => $errorMessage]);
        exit;
    }

    // Ensure the themes directory exists
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Check if the uploaded file is a valid ZIP file
    $zip = new ZipArchive();
    if ($zip->open($zipFile) === true) {
        // Extract the ZIP file to the target directory
        if (!is_dir($extractPath)) {
            mkdir($extractPath, 0755, true);
        }
        $zip->extractTo($extractPath);
        $zip->close();

        echo json_encode(['status' => 'success', 'message' => 'File uploaded and extracted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to open the ZIP file.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
