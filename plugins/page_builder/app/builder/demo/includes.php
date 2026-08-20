<?php

// Path to the themes directory (relative to this script)
$themeBasePath = './themes/';

function loadThemes($themeType)
{
    global $themeBasePath;

    // Build the path to the specific theme directory
    $themePath = $themeBasePath . $themeType . '/';

    // Scan the themes directory for all theme folders (ignore . and ..)
    $themeDirs = array_filter(scandir($themePath), function ($item) use ($themePath) {
        return is_dir($themePath . $item) && $item !== '.' && $item !== '..';
    });

    // Build an array of all themes with their metadata
    $allThemes = [];
    foreach ($themeDirs as $themeDir) {
        $themeDir = $themeType . '/' . $themeDir;

        $themeInfo = loadThemeFromDirName($themeDir, $themeBasePath);
        if ($themeInfo) {
            $allThemes[] = $themeInfo;
        }
    }

    return $allThemes;
}

function loadThemeFromDirName($themeDir)
{
    global $themeBasePath;

    // Build the path to the specific theme directory
    $indexFile = $themeBasePath . $themeDir . '/index.json';
    $thumbEx = null;
    // Find the thumbnail extension (png or svg)
    foreach (['png', 'svg'] as $ex) {
        if (file_exists($themeBasePath . $themeDir . '/thumb.' . $ex)) {
            $thumbEx = $ex;
            break;
        }
    }

    // If index.json exists, read it and merge with theme info
    if (file_exists($indexFile)) {
        $indexContent = json_decode(file_get_contents($indexFile), true);
        $themeInfo = array_merge([
            'name' => $themeDir,
            'dir' => $themeDir,
            'thumbnail' => $thumbEx ? './themes/' . $themeDir . '/thumb.' . $thumbEx : null,
            'url' => '/?theme=' . $themeDir,
            'themeUrl' => (isset($_SERVER["REQUEST_SCHEME"]) ? $_SERVER["REQUEST_SCHEME"] : "http") . "://" . $_SERVER["HTTP_HOST"] . "/themes/" . $themeDir,
            'json' => file_get_contents($themeBasePath . $themeDir . '/store.json'),
        ], $indexContent);

        // Default theme not included in the list
        return $themeInfo;
    } else {
        return false;
    }
}