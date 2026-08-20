<?php

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $themeUrl = $_POST['themeUrl'];
    $dir = $_POST['dir'] ?? 'default';
    $htmlContent = $_POST['html'] ?? '';
    $type = $_POST['type'] ?? 'html'; // html|zip

    $filename = str_replace('/', '_', $dir);

    //
    $htmlContent = str_replace($themeUrl . '/', '', $htmlContent);

    $themeDir = __DIR__ . "/themes/$dir";
    $indexFile = "$themeDir/index.html";
    $zipFile = __DIR__ . "/$filename.zip";

    // Ensure the theme directory exists
    if (!is_dir($themeDir)) {
        http_response_code(400);
        echo json_encode(['error' => 'Theme directory does not exist.']);
        exit;
    }

    // Write the HTML content to index.html
    if (file_put_contents($indexFile, $htmlContent) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to write index.html.']);
        exit;
    }

    // Create a zip archive of the theme directory
    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($themeDir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = substr($filePath, strlen($themeDir) + 1);

                // Exclude widgets folder and specific files
                if ($type !== 'bundle') {
                    if (
                        strpos($relativePath, 'widgets/') === 0 ||
                        preg_match('/\.template\.html$/', $relativePath) ||
                        in_array($relativePath, ['store.json', 'thumb.png', 'thumb.svg', 'index.json'])
                    ) {
                        continue;
                    }
                }

                $zip->addFile($filePath, $relativePath);
            }
        }

        $zip->close();
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create zip archive.']);
        exit;
    }

    // Serve the zip file for download
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . basename($zipFile) . '"');
    header('Content-Length: ' . filesize($zipFile));
    readfile($zipFile);

    // Clean up the zip file after download
    unlink($zipFile);
    exit;
}
http_response_code(405);
echo json_encode(['error' => 'Invalid request method.']);
