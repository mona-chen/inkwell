<?php
    // Load .env file if it exists
    function loadEnv($path) {
        if (!file_exists($path)) {
            return;
        }
        
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue; // Skip comments
            }
            
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            
            // Remove quotes if present
            if (preg_match('/^"(.*)"$/', $value, $matches)) {
                $value = $matches[1];
            } elseif (preg_match("/^'(.*)'$/", $value, $matches)) {
                $value = $matches[1];
            }
            
            $_ENV[$name] = $value;
            putenv("$name=$value");
        }
    }
    
    // Load .env file from parent directory
    loadEnv(__DIR__ . '/.env');
    
    // if env APP_MODE is carousel, then include the carousel.php file else include the default.php file
    $appMode = $_ENV['APP_MODE'] ?? getenv('APP_MODE') ?? 'default';
    
    if ($appMode === 'carousel') {
        include 'carousel.php';
    } else {
        include 'default.php';
    }
?>