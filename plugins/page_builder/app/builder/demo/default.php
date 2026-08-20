<?php
include_once('includes.php');

// Get the current theme name from the URL, default to 'Default'
$currentThemeName = $_GET["theme"] ?? 'standard/Y1_a_1_Column_Layout';
$currentTheme = loadThemeFromDirName($currentThemeName);

// Build the absolute base path to the themes directory (for use in JS, asset loading, etc.)
$themeUrl = (
    isset($_SERVER["REQUEST_SCHEME"]) ? $_SERVER["REQUEST_SCHEME"] : "http"
) . "://" . $_SERVER["HTTP_HOST"] . rtrim(dirname($_SERVER["REQUEST_URI"]), '/\\') . "/themes/" . $currentThemeName;

// Get theme by type
$allThemes = loadThemes('standard');
// $allThemes = array_merge($allThemes, loadThemes('extended'));

// Check if theme is carousel
$isCarousel = str_contains($currentTheme["name"], 'Carousel') ? true : false;
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Builder</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-SgOJa3DmI69IUzQ2PVdRZhwQ+dy64/BUtbMJw1MZ8t5HZApcHrRKUc4W0kG879m7" crossorigin="anonymous">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <script src="tinymce/tinymce.min.js" referrerpolicy="origin"></script>

    <link href="dist/builder.css" rel="stylesheet" />
    <script src="dist/builder.js"></script>

    <?php if ($isCarousel) { ?>
        <!-- HTML2Canvas -->
        <script src="html2canvas/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <?php } ?>

    <link href="demo.css" rel="stylesheet" />
</head>

<body>
    <!-- Loading Overlay -->
    <div id="page-loader-overlay">
        <div class="loader"></div>
    </div>

    <script>
        // Loader overlay logic
        window.addEventListener('load', () => {
            const loader = document.getElementById('page-loader-overlay');
            loader.classList.add('fade-out');
            document.body.classList.remove('loading');
        });

        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('loading');
        });
    </script>

    <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom" style="z-index: 10;">
        <div class="container-fluid">
            <a class="navbar-brand" href="#">
                <!-- <svg xmlns="http://www.w3.org/2000/svg" id="Layer_2" viewBox="0 0 184.42 136.09">
                    <g id="Layer_1-2">
                        <path d="M146.62,63.6c-9.29-2.35-16.37-9.69-20.29-19.62l-8.43,31.19-44.3-52.99H30.85L0,136.09h50.68l14.32-52.99,44.3,52.99h42.75l21.66-79.97c-8.16,6.8-17.84,9.83-27.09,7.48Z" style="fill:#335fa0;" />
                        <path d="M151.16,1.97c5.31-1.86,11.01-2.41,17.1-1.63,6.1.77,11.48,2.72,16.16,5.85-3.07,1.08-5.77,3.38-8.1,6.91s-2.7,7.6-1.08,12.2c2.07,5.89,1.76,11.63-.91,17.2-2.68,5.57-6.96,9.4-12.86,11.47-5.89,2.07-11.63,1.76-17.2-.91s-9.4-6.96-11.47-12.86c-2.73-7.78-2.3-15.41,1.3-22.9,3.6-7.49,9.28-12.59,17.07-15.33Z" style="fill:#d88f28;" />
                    </g>
                </svg> -->
                <img src="builderjs_color_logo.png" alt="" width="30">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" style="justify-content: space-between" id="navbarNav">
                <div class="d-flex align-items-center">
                    <span class="mb-0 py-2 px-3 rounded-3 fw-bold shadow-sm" style="background-color: #0000000a;">
                        <span class="d-flex align-items-center">
                            <span><?php echo $currentTheme['title']; ?></span>
                            <span class="material-symbols-rounded ms-1">
                                brush
                            </span>
                        </span>
                    </span>
                    <span class="mx-3">
                        /
                    </span>
                    <button id="selectTheme" onclick="changeThemePopup.show();" type="button" class="btn btn-warning border me-2" type="submit">
                        <span class="d-flex align-items-center">
                            <span class="material-symbols-rounded me-1">refresh</span>
                            <span>Change Theme</span>
                        </span>
                    </button>
                </div>
                <div class="d-flex align-items-center">
                    <div class="btn-group border bg-light" role="group" aria-label="Basic example">
                        <button id="desktopModeButton" onclick="switchToDesktopMode()" type="button" class="btn btn-light active d-flex align-items-center builder-mode-button">
                            <span class="material-symbols-rounded">desktop_windows</span>
                        </button>
                        <button id="tabletModeButton" onclick="switchToTabletMode()" type="button" class="btn btn-light d-flex align-items-center builder-mode-button">
                            <span class="material-symbols-rounded">tablet</span>
                        </button>
                        <button id="mobileModeButton" onclick="switchToMobileMode()" type="button" class="btn btn-light d-flex align-items-center builder-mode-button">
                            <span class="material-symbols-rounded">smartphone</span>
                        </button>
                    </div>

                </div>
                <div class="d-flex align-items-center">
                    <?php if ($isCarousel) { ?>
                        <button id="runSampleCodeButton" onclick="downloadPDF(this)" type="button" class="btn btn-outline-primary me-2" type="submit">
                            <span class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-2">picture_as_pdf</span>
                                <span>Download PDF</span>
                            </span>
                        </button>
                    <?php } ?>
                    <!-- <button id="runSampleCodeButton" onclick="runSampleCode()" type="button" class="btn btn-light" type="submit">Add sample Blocks</button> -->
                    <button id="runSampleCodeButton" onclick="clearPage()" type="button" class="btn btn-outline-danger me-2" type="submit">
                        <span class="d-flex align-items-center">
                            <span class="material-symbols-rounded me-2">clear_all</span>
                            <span>Clear</span>
                        </span>
                    </button>
                    <button id="loadFromStoreButton" onclick="window.location = '<?php echo $currentTheme["url"] ?>'" type="button" class="btn btn-outline-primary me-2" type="submit">
                        <span class="d-flex align-items-center">
                            <span class="material-symbols-rounded me-2">refresh</span>
                            <span>Reset</span>
                        </span>
                    </button>
                    <span class="mx-3">
                        |
                    </span>
                    <button id="saveToStoreButton" onclick="saveToStore()" type="button" class="btn btn-primary me-2" type="submit">
                        <span class="d-flex align-items-center">
                            <span class="material-symbols-rounded me-2">save</span>
                            <span>Save</span>
                        </span>
                    </button>
                    <button title="Download the source file (.zip extension). This is intended for developers who want to continue working on the theme’s source code."
                        id="downloadBundle" onclick="exportBundle(this)" type="button" class="btn btn-outline-primary me-2" type="submit">
                        <span class="d-flex align-items-center">
                            <span class="material-symbols-rounded me-2">download</span>
                            <span>Download bundle</span>
                        </span>
                    </button>
                    <div class="dropdown me-2">
                        <button class="btn btn-outline-primary dropdown-toggle d-flex align-items-center" type="button" id="exportDropdownButton" data-bs-toggle="dropdown" aria-expanded="false">
                            <span class="material-symbols-rounded me-2">downloading</span>
                            <span>Export</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="exportDropdownButton" style="width:400px;">
                            <li>
                                <a id="exportButtonHTML" class="dropdown-item" href="#" onclick="exportThemeHTML(this); return false;">
                                    <label class="d-block fw-semibold">Option 1: HTML with Absolute Links</label>
                                    <span class="mb-0 small text-muted d-block" style="white-space: normal;">
                                        Download a standalone HTML file with absolute URLs to all assets. Ideal for quick copy-paste usage or running directly in the browser without additional setup.
                                    </span>
                                </a>
                                <a id="exportButtonZip" class="dropdown-item" href="#" onclick="exportThemeZip(this); return false;">
                                    <label class="d-block fw-semibold">Option 2: HTML with Assets (ZIP Package)</label>
                                    <span class="mb-0 small text-muted d-block" style="white-space: normal;">
                                        Download a .zip package containing the full HTML file and all associated assets. Perfect for hosting on a web server or running as a self-contained project.
                                    </span>
                                </a>
                            </li>
                            <!-- Add more export options here if needed -->
                        </ul>
                    </div>
                    <span class="mx-3">
                        |
                    </span>
                    <button id="toggleButton" onclick="toggleDesignMode()" type="button" class="btn btn-light border" type="submit">
                        <span class="d-flex align-items-center">
                            <span class="material-symbols-rounded">visibility_off</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <div class="d-flex">

        <div class="content-wrapper mx-4 my-5 d-flex justify-content-center">
            <div class="spin-loader">
            </div>
            <div id="MainContainer" class="content-container">
            </div>
        </div>
        <div class="builder-sidebar">
            <div data-smenu-container="themes" style="display:none;">
                <div class="builder-sidebar-tabs px-3 py-2 rounded-0 d-flex bg-light border-bottom">
                    <div class="tab-item active">
                        <span class="material-symbols-rounded">auto_awesome_mosaic</span>
                        <!-- <span>Widgets</span> -->
                    </div>
                    <div class="tab-item"
                        data-bs-toggle="tooltip" data-bs-placement="top"
                        data-bs-custom-class="custom-tooltip"
                        data-bs-title="Coming soon!">
                        <span class="material-symbols-rounded">interests</span>
                        <!-- <span>Settings</span> -->
                        <span class="material-symbols-rounded small text-danger">info</span>
                    </div>

                </div>
                <div class="themes-panel bg-white">
                    <div class="settings-header d-flex align-items-center py-2 px-3 mb-2">
                        <h6 class="text-start me-auto mb-0 fw-bold text-nowrap">
                            Themes
                        </h6>
                        <div>
                            <button data-control="remove-element" class="btn btn-light p-1 d-flex align-items-center">
                                <span class="material-symbols-rounded">delete</span>
                            </button>
                        </div>
                    </div>
                    <div class="theme-box">
                        <div class="themes-header mx-3">
                            <div class="d-flex align-items-center justify-content-between">
                                <span class="fw-semibold small text-nowrap">All themes</span>
                                <span class="d-block mx-3 w-100" style="height:1px;background-color:rgb(206, 212, 218);"></span>
                                <span class="d-flex align-items-center"><span class="material-symbols-rounded">keyboard_arrow_down</span></span>
                            </div>
                            <div class="theme-header w-100 mb-4">
                                <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-0">🎨 Introducing the Theme Builder! ✨ Click on any of the items below to preview and apply different themes to your page. <br> Easily customize the look and feel of your site — more powerful theme features coming soon! 🚀🎉</div>
                            </div>
                            <div class="theme-items row">
                                <?php foreach ($allThemes as $theme) : ?>
                                    <div class="col-6 mb-4">
                                        <a href="<?php echo $theme['url']; ?>" class="theme-item shadow-sm" draggable="true">
                                            <!-- <div class="d-flex"> -->
                                            <div class="theme-thumb">
                                                <img width="100%" src="<?= $theme['thumbnail'] ?>" alt="">
                                            </div>
                                            <div class="p-2 text-dark">
                                                <label for="" class="fw-semibold theme-label"><?= $theme['title'] ?></label>
                                                <p class="mb-0 theme-desc"><?= $theme['description'] ?></p>
                                            </div>
                                            <!-- </div> -->
                                        </a>
                                    </div>
                                <?php endforeach; ?>
                                <div class="col-6 mb-4">
                                    <div onclick="smenu.openTab(document.querySelector('[data-smenu=import]'));" class="theme-item shadow-sm" draggable="true">
                                        <!-- <div class="d-flex"> -->
                                        <div class="theme-thumb">
                                            <svg xmlns="http://www.w3.org/2000/svg" id="Layer_2" viewBox="0 0 596 769">
                                                <g id="Layer_1-2">
                                                    <rect width="596" height="769" style="fill:#f8f9fa;" />
                                                    <path d="M254.75,464.46v-105.79c0-4.85,1.71-8.97,5.14-12.35,3.43-3.38,7.56-5.07,12.41-5.07h105.66c4.81,0,8.92,1.71,12.35,5.14,3.42,3.42,5.14,7.54,5.14,12.35v68.08c0,2.39-.47,4.67-1.42,6.84-.94,2.17-2.2,4.04-3.77,5.6l-37.51,37.51c-1.57,1.57-3.44,2.82-5.6,3.77-2.17.94-4.45,1.42-6.84,1.42h-68.08c-4.81,0-8.92-1.71-12.35-5.14-3.42-3.42-5.14-7.54-5.14-12.35ZM200.91,326.06c-.94-4.84-.02-9.22,2.78-13.12,2.8-3.91,6.62-6.3,11.48-7.19l104.1-18.34c4.8-.94,9.13,0,12.99,2.82,3.86,2.82,6.3,6.64,7.33,11.44l1.48,9.01c.35,1.8.04,3.24-.91,4.32-.95,1.08-2.08,1.7-3.38,1.88-1.32.22-2.58,0-3.79-.67-1.2-.67-2.03-1.9-2.48-3.68l-1.89-9.99c-.28-1.53-1.11-2.74-2.5-3.64-1.39-.9-2.91-1.21-4.58-.94l-104.46,18.54c-1.94.28-3.4,1.18-4.37,2.71-.97,1.53-1.32,3.26-1.04,5.2l19.77,112.22c.26,1.4,0,2.73-.79,3.99-.79,1.26-1.92,2.08-3.39,2.49-1.47.4-2.86.13-4.16-.82-1.3-.95-2.09-2.2-2.35-3.74l-19.83-112.49ZM265.58,358.74v105.72c0,1.94.62,3.54,1.87,4.79,1.25,1.25,2.85,1.87,4.79,1.87h69.1l43.29-43.29v-69.1c0-1.94-.62-3.54-1.87-4.79-1.25-1.25-2.85-1.87-4.79-1.87h-105.72c-1.94,0-3.54.62-4.79,1.87-1.25,1.25-1.87,2.85-1.87,4.79ZM319.69,417.01v27.06c0,1.53.52,2.82,1.56,3.86,1.04,1.04,2.33,1.56,3.86,1.56s2.82-.52,3.85-1.56,1.55-2.32,1.55-3.86v-27.06h27.06c1.53,0,2.82-.52,3.86-1.56s1.56-2.33,1.56-3.86-.52-2.82-1.56-3.85c-1.04-1.03-2.32-1.55-3.86-1.55h-27.06v-27.06c0-1.53-.52-2.82-1.56-3.86-1.04-1.04-2.33-1.56-3.86-1.56s-2.82.52-3.85,1.56c-1.03,1.04-1.55,2.32-1.55,3.86v27.06h-27.06c-1.53,0-2.82.52-3.86,1.56s-1.56,2.33-1.56,3.86.52,2.82,1.56,3.85c1.04,1.03,2.32,1.55,3.86,1.55h27.06Z" style="fill:#666; opacity:.57;" />
                                                </g>
                                            </svg>
                                        </div>
                                        <div class="p-2">
                                            <label for="" class="fw-semibold theme-label">+ Add New Theme</label>
                                            <p class="mb-0 theme-desc">Upload your theme to the theme storage directory.</p>
                                        </div>
                                        <!-- </div> -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div data-smenu-container="design">
                <div id="Sidebar">
                    <div class="builder-sidebar-tabs px-3 py-2 rounded-0 d-flex bg-light border-bottom">
                        
                            <div class="tab-item active" data-tab="widgets">
                                <span class="material-symbols-rounded">widgets</span>
                            </div>
                        
                            <div class="tab-item" data-tab="controls">
                                <span class="material-symbols-rounded">settings</span>
                            </div>
                        
                            <div class="tab-item" data-tab="styles">
                                <span class="material-symbols-rounded">palette</span>
                            </div>
                        
                    </div>
                    <div>
                        
                        <div id="WidgetsContainer" data-tab-container="widgets" style="display: block;">
                        </div>

                        <div id="SettingsContainer" data-tab-container="controls" style="display: none;">
                        </div>
                        
                        <div data-tab-container="styles" style="display: none;">
                        </div>
                        
                    </div>
                </div>
            </div>
            <div data-smenu-container="import" style="display:none;">
                <div class="builder-sidebar-tabs px-3 py-2 rounded-0 d-flex bg-light border-bottom">
                    <div class="tab-item active">
                        <span class="material-symbols-rounded">auto_awesome_mosaic</span>
                        <!-- <span>Widgets</span> -->
                    </div>
                    <div class="tab-item"
                        data-bs-toggle="tooltip" data-bs-placement="top"
                        data-bs-custom-class="custom-tooltip"
                        data-bs-title="Coming soon!">
                        <span class="material-symbols-rounded">interests</span>
                        <!-- <span>Settings</span> -->
                        <span class="material-symbols-rounded small text-danger">info</span>
                    </div>

                </div>
                <div class="themes-panel bg-white">
                    <div class="settings-header d-flex align-items-center py-2 px-3 mb-2">
                        <h6 class="text-start me-auto mb-0 fw-bold text-nowrap">
                            Import
                        </h6>
                        <div>
                            <button data-control="remove-element" class="btn btn-light p-1 d-flex align-items-center">
                                <span class="material-symbols-rounded">settings</span>
                            </button>
                        </div>
                    </div>

                    <div class="themes-header mx-3">
                        <div class="d-flex align-items-center justify-content-between">
                            <span class="fw-semibold small text-nowrap">Upload</span>
                            <span class="d-block mx-3 w-100" style="height:1px;background-color:rgb(206, 212, 218);"></span>
                            <span class="d-flex align-items-center"><span class="material-symbols-rounded">keyboard_arrow_down</span></span>
                        </div>

                        <div class="mt-3">
                            <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-0">🎨 Here we can upload your theme to the themes builder for reviewing, testing, and export. 🚀</div>
                        </div>

                        <div class="upload-container mt-3 p-3 border rounded bg-light text-center">
                            <div id="uploadPlaceholder" class="p-5 border-dashed rounded bg-white" style="cursor: pointer;">
                                <span class="material-symbols-rounded text-muted" style="font-size: 50px;">upload_file</span>
                                <p id="fileName" class="text-muted">Click to browse or drag & drop your *<strong>.bundle.zip</strong> file here</p>
                            </div>
                            <input id="fileInput" type="file" accept=".zip" style="display: none;" />
                            <button id="uploadButton" class="btn btn-primary mt-3" disabled>Upload Theme</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="global-sidebar bg-white border-start">
            <div class="sidebar-toggle-button">
                <span class="material-symbols-rounded sidebar-toggle-icon">
                    menu_open
                </span>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', () => {
                    const toggleButton = document.querySelector('.sidebar-toggle-button');

                    toggleButton.addEventListener('click', () => {
                        document.body.classList.toggle('hide-sidebar');
                    });
                });
            </script>


            <div class="smenu-items p-2">
                <div data-control="ai-menu" class="smenu-item p-2 my-3">
                    <div class="d-flex align-items-center justify-content-center w-100">
                        <span class="smenu-item-icon rounded-2 p-1 mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.4em" height="1.6em" fill="currentColor" stroke="currentColor" stroke-width="0" viewBox="0 0 256 256" color="#495057">
                                <path stroke="none" d="M208 144a15.78 15.78 0 0 1-10.42 14.94L146 178l-19 51.62a15.92 15.92 0 0 1-29.88 0L78 178l-51.62-19a15.92 15.92 0 0 1 0-29.88L78 110l19-51.62a15.92 15.92 0 0 1 29.88 0L146 110l51.62 19A15.78 15.78 0 0 1 208 144m-56-96h16v16a8 8 0 0 0 16 0V48h16a8 8 0 0 0 0-16h-16V16a8 8 0 0 0-16 0v16h-16a8 8 0 0 0 0 16m88 32h-8v-8a8 8 0 0 0-16 0v8h-8a8 8 0 0 0 0 16h8v8a8 8 0 0 0 16 0v-8h8a8 8 0 0 0 0-16"></path>
                            </svg>
                        </span>
                    </div>
                    <div class="d-block text-center smenu-item-label fw-semoibold">AI</div>
                </div>

                <div data-smenu="themes" class="smenu-item p-2 my-3">
                    <div class="d-flex align-items-center justify-content-center w-100">
                        <span class="material-symbols-rounded smenu-item-icon rounded-2 p-1 mb-1">
                            newspaper
                        </span>
                    </div>
                    <div class="d-block text-center smenu-item-label">Themes</div>
                </div>

                <div data-smenu="design" class="smenu-item p-2 my-3 active">
                    <div class="d-flex align-items-center justify-content-center w-100">
                        <span class="material-symbols-rounded smenu-item-icon rounded-2 p-1 mb-1">
                            design_services
                        </span>
                    </div>
                    <div class="d-block text-center smenu-item-label">Design</div>
                </div>

                <div data-smenu="import" class="smenu-item p-2 my-3">
                    <div class="d-flex align-items-center justify-content-center w-100">
                        <span class="material-symbols-rounded smenu-item-icon rounded-2 p-1 mb-1">
                            arrow_circle_down
                        </span>
                    </div>
                    <div class="d-block text-center smenu-item-label">Import</div>
                </div>

                <div data-smenu="branding" class="smenu-item p-2 my-3 position-relative"
                    data-bs-toggle="tooltip" data-bs-placement="top"
                    data-bs-custom-class="custom-tooltip"
                    data-bs-title="Coming soon!">
                    <div class="d-flex align-items-center justify-content-center w-100">
                        <span class="material-symbols-rounded smenu-item-icon rounded-2 p-1 mb-1">
                            corporate_fare
                        </span>
                        <span class="material-symbols-rounded small text-danger"
                            style="position: absolute; top: 10px; right: 1px; font-size: 14px;">
                            info</span>
                    </div>
                    <div class="d-block text-center smenu-item-label">Branding</div>
                </div>

                <div onclick="selectPageElement();" data-smenu="settings" class="smenu-item p-2 my-3">
                    <div class="d-flex align-items-center justify-content-center w-100">
                        <span class="material-symbols-rounded smenu-item-icon rounded-2 p-1 mb-1">
                            settings
                        </span>
                    </div>
                    <div class="d-block text-center smenu-item-label">Settings</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Config
        const handlerAssetUploadHandler = '/asset-upload.php';
        const handlerAIHandler = '/ai-handler.php';
        const handlerExportHtml = '/exportHTML.php';
        const handlerExportZip = '/export.php';
        const handlerExportBundle = '/export.php';
        const handlerSave = '/save.php';
        const handlerUpload = '/upload.php';

        const themeUrl = '<?php echo $currentTheme['themeUrl']; ?>';
        const themeName = '<?php echo $currentTheme['name']; ?>';
        const themeJson = <?php echo $currentTheme['json']; ?>;
        const themeDir = '<?php echo $currentTheme['dir']; ?>';

        const isCarousel = <?php echo $isCarousel ? 'true' : 'false'; ?>;

    </script>


    <script>
        // Main Builder initialization
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize the Builder instance
            window.builder = new Builder({
                mainContainer: '#MainContainer', // Content ID where page content will render
                settingsContainer: '#SettingsContainer', // Where Element Settings/Controls will be render
                widgetsContainer: '#WidgetsContainer', // Where Widgets will be rendered
                assetUploadHandler: handlerAssetUploadHandler,
                aiHandler: handlerAIHandler,

                carousel: isCarousel, // Enable carousel features
            });

            // Builder: load current theme data
            builder.load(themeJson, themeUrl, () => {
                // remove page loading effects
                document.querySelector('.spin-loader').remove();
            });


            // UI tab: SMenu
            window.smenu = new TabsManager();
            smenu.addTab(document.querySelector('[data-smenu="themes"]'), document.querySelector('[data-smenu-container="themes"]'));
            smenu.addTab(document.querySelector('[data-smenu="design"]'), document.querySelector('[data-smenu-container="design"]'));
            smenu.addTab(document.querySelector('[data-smenu="import"]'), document.querySelector('[data-smenu-container="import"]'));

            // UI tab: Sidebar tabs
            window.sidebarTabManager = new TabsManager();
            sidebarTabManager.addTab(document.querySelector('[data-tab="widgets"]'), document.querySelector('[data-tab-container="widgets"]'));
            sidebarTabManager.addTab(document.querySelector('[data-tab="controls"]'), document.querySelector('[data-tab-container="controls"]'));
            sidebarTabManager.addTab(document.querySelector('[data-tab="styles"]'), document.querySelector('[data-tab-container="styles"]'));

            // Set default mode to desktop
            switchToDesktopMode();

            // Change Theme Popup
            window.changeThemePopup = new ChangeThemePopup();

            // Upload Manager
            window.uploadManager = new UploadManager(
                document.getElementById('uploadPlaceholder'),
                document.getElementById('fileInput'),
                document.getElementById('uploadButton'),
                document.getElementById('fileName')
            );
            
            // AI Popup
            new AIPopup(document.querySelector('[data-control="ai-menu"]')); // Initialize the AI popup when the document is ready

            // @todo
            document.querySelector('[data-tab="styles"]').addEventListener('click', () => {
                if (window.smenu) {
                    window.smenu.openTab(document.querySelector('[data-smenu="themes"]'));
                }
            });
        });

        async function downloadPDF(button) {
            // Show loading effect
            originalText = button.innerHTML; // Save original text
            button.disabled = true;
            button.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Generating PDF file...
            `;

            const elements = builder.iframe.contentWindow.document.querySelectorAll('[builder-element="CarouselBlockElement"]');

            // Render the first element to get its size
            const {
                imgData,
                width,
                height
            } = await elementToImage(elements[0]);
            const pdfWidth = (width * 25.4) / 96;
            const pdfHeight = (height * 25.4) / 96;

            const {
                jsPDF
            } = window.jspdf;
            const pdf = new jsPDF({
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            // First page
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            // Rest of the pages
            for (let i = 1; i < elements.length; i++) {
                const {
                    imgData,
                    width,
                    height
                } = await elementToImage(elements[i]);
                const w = (width * 25.4) / 96;
                const h = (height * 25.4) / 96;

                pdf.addPage([w, h]);
                pdf.addImage(imgData, 'PNG', 0, 0, w, h);
            }

            pdf.save('carousel-images.pdf');

            // Remove loading effect
            button.disabled = false;
            button.innerHTML = originalText;
        }

        function elementToImage(element) {
            return html2canvas(element).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                return {
                    imgData,
                    width: canvas.width,
                    height: canvas.height
                };
            });
        }

        function exportThemeHTML(exportButton) {
            // Show loading effect
            originalText = exportButton.innerHTML; // Save original text
            exportButton.disabled = true;
            exportButton.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Exporting...
            `;

            const payload = new URLSearchParams();
            payload.append('html', builder.getHtml()); // Get the HTML content
            payload.append('type', 'html');

            fetch(handlerExportHtml, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: payload.toString()
                })
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = themeName + '.html'; // Download as theme.html
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                })
                .catch(error => {
                    alert('Error exporting theme: ' + error);
                })
                .finally(() => {
                    // Remove loading effect
                    exportButton.disabled = false;
                    exportButton.innerHTML = originalText;
                });
        }

        function exportThemeZip(exportButton) {

            // Show loading effect
            originalText = exportButton.innerHTML; // Save original text
            exportButton.disabled = true;
            exportButton.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Exporting...
            `;

            const payload = new URLSearchParams();
            payload.append('themeUrl', themeUrl); // Add current theme
            payload.append('dir', themeDir); // Add current theme
            payload.append('html', builder.getHtml()); // Get the HTML content
            payload.append('type', 'zip');

            fetch(handlerExportZip, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: payload.toString()
                })
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = themeName + '.zip'; // Download as theme.zip
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                })
                .catch(error => {
                    alert('Error exporting theme: ' + error);
                })
                .finally(() => {
                    // Remove loading effect
                    exportButton.disabled = false;
                    exportButton.innerHTML = originalText;
                });
        }

        function exportBundle(exportButton) {
            // Show loading effect
            originalText = exportButton.innerHTML; // Save original text
            exportButton.disabled = true;
            exportButton.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Exporting...
            `;

            const payload = new URLSearchParams();
            payload.append('themeUrl', themeUrl); // Add current theme
            payload.append('dir', themeDir); // Add current theme
            payload.append('html', builder.getHtml()); // Get the HTML content
            payload.append('type', 'bundle');

            fetch(handlerExportBundle, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: payload.toString()
                })
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = themeName + '_bundle.zip'; // Download as theme.zip
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                })
                .catch(error => {
                    alert('Error exporting theme: ' + error);
                })
                .finally(() => {
                    // Remove loading effect
                    exportButton.disabled = false;
                    exportButton.innerHTML = originalText;
                });
        }

        // Actions
        function runSampleCode() {
            // H1 Sample
            const h1 = new H1Element('H1', 'Welcome!');
            builder.appendElements([h1]);

            // Paragraph Sample
            const p = new PElement('P', 'Hello, world!');
            builder.appendElements([p]);

            // Add Menu to Page
            const menu = new MenuElement('Menu', [{
                    text: 'Home',
                    url: '#'
                },
                {
                    text: 'About',
                    url: '#'
                },
                {
                    text: 'Contact',
                    url: '#'
                }
            ]);
            builder.appendElements([menu]);

            // GRID + CELLs
            const grid = new GridElement('Grid');
            const cell_1 = new CellElement('Cell');
            const cell_2 = new CellElement('Cell');

            const cell_p1 = new PElement('P', 'Inside cell 1');
            const cell_p2 = new PElement('P', 'Inside cell 2');
            cell_1.appendElements([cell_p1]);
            cell_2.appendElements([cell_p2]);

            builder.appendElements([grid]);

            // // DROP WIDGET INSIDE PAGE
            // const widget = new MenuWidget();
            // builder.appendElements(widget.renderElements());

            // Image Element
            const image = new ImageElement('Image');
            builder.appendElements([image]);
        }

        function clearPage() {
            builder.clear();
        }

        function toggleDesignMode() {
            if (builder.getMode() == 'design') {
                builder.setMode('preview');
                document.getElementById('toggleButton').innerHTML = `
                    <span class="d-flex align-items-center">
                        <span class="material-symbols-rounded">visibility_off</span>
                    </span>
                `;
            } else {
                builder.setMode('design');
                document.getElementById('toggleButton').innerHTML = `
                    <span class="d-flex align-items-center">
                        <span class="material-symbols-rounded">visibility</span>
                    </span>
                `;
            }
        }

        // filepath: /Users/luan/apps/builder/demo/index.php
        function saveToStore() {
            // Show loading effect
            const saveButton = document.getElementById('saveToStoreButton');
            saveButton.disabled = true;
            saveButton.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
            `;

            const data = builder.getData(); // Get existing data
            const payload = new URLSearchParams();
            payload.append('dir', themeDir); // Add current theme
            payload.append('data', JSON.stringify(data)); // Include the rest of the data
            payload.append('html', builder.getHtml()); // Include the rest of the data

            fetch(handlerSave, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: payload.toString()
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Alert
                        SAlert.show('Data saved successfully.');
                    } else {
                        alert('Error saving data: ' + data.message);
                    }
                })
                .catch(error => {
                    alert('Error saving data: ' + error);
                })
                .finally(() => {
                    // Remove loading effect
                    saveButton.disabled = false;
                    saveButton.innerHTML = `
                    <span class="d-flex align-items-center">
                        <span class="material-symbols-rounded me-2">save</span>
                        <span>Save</span>
                    </span>
                `;
                });
        }

        function switchToMobileMode() {
            const contentContainer = document.querySelector('.content-container');
            const mobileButton = document.getElementById('mobileModeButton');
            const desktopButton = document.getElementById('desktopModeButton');
            const tabletButton = document.getElementById('tabletModeButton');

            contentContainer.classList.add('mobile-mode');
            contentContainer.classList.remove('desktop-mode');
            contentContainer.classList.remove('tablet-mode');

            mobileButton.classList.add('active');
            desktopButton.classList.remove('active');
            tabletButton.classList.remove('active');
        }

        function switchToTabletMode() {
            const contentContainer = document.querySelector('.content-container');
            const mobileButton = document.getElementById('mobileModeButton');
            const desktopButton = document.getElementById('desktopModeButton');
            const tabletButton = document.getElementById('tabletModeButton');

            contentContainer.classList.remove('mobile-mode');
            contentContainer.classList.remove('desktop-mode');
            contentContainer.classList.add('tablet-mode');

            mobileButton.classList.remove('active');
            desktopButton.classList.remove('active');
            tabletButton.classList.add('active');
        }

        function switchToDesktopMode() {
            const contentContainer = document.querySelector('.content-container');
            const mobileButton = document.getElementById('mobileModeButton');
            const desktopButton = document.getElementById('desktopModeButton');
            const tabletButton = document.getElementById('tabletModeButton');

            contentContainer.classList.add('desktop-mode');
            contentContainer.classList.remove('mobile-mode');
            contentContainer.classList.remove('tablet-mode');

            desktopButton.classList.add('active');
            mobileButton.classList.remove('active');
            tabletButton.classList.remove('active');
        }

        function selectPageElement() {
            const element = builder.pageElement;

            // Select the element
            builder.selectElement(element);
        }

        var SNotify = {
            show: function(message, type = 'default') {
                // Ensure the notifications wrapper exists
                let wrapper = document.getElementById('notificationsWrapper');
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.id = 'notificationsWrapper';
                    wrapper.style.position = 'fixed';
                    wrapper.style.bottom = '20px';
                    wrapper.style.right = '20px';
                    wrapper.style.zIndex = '1050';
                    wrapper.style.display = 'flex';
                    wrapper.style.flexDirection = 'column-reverse';
                    wrapper.style.gap = '10px';
                    document.body.appendChild(wrapper);
                }

                // Create a new notification element
                const notification = document.createElement('div');

                notification.style.minWidth = '250px';
                // notification.style.color = '#fff';
                notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                notification.style.opacity = '1';
                notification.style.transform = 'translateY(0)';

                // Set background color and icon based on type
                let icon = '';
                let colorClass = 'secondary';
                switch (type) {
                    case 'success':
                        colorClass = 'success';
                        icon = 'check_circle';
                        break;
                    case 'error':
                        colorClass = 'danger';
                        icon = 'error';
                        break;
                    default:
                        colorClass = 'secondary';
                        icon = 'info';
                        break;
                }

                // Set the notification class
                notification.className = `notification shadow rounded d-flex align-items-center p-3 bg-${colorClass}-subtle text-${colorClass}-emphasis`;

                // Add content to the notification
                notification.innerHTML = `
                    <span class="material-symbols-rounded me-2">${icon}</span>
                    <span>${message}</span>
                `;

                // Append the notification to the wrapper
                wrapper.appendChild(notification);

                // Remove the notification after 3 seconds
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateY(20px)';
                    setTimeout(() => wrapper.removeChild(notification), 300);
                }, 3000);
            }
        };

        var ChangeThemePopup = class {
            constructor() {
                this.modalDom = document.createElement('div');
                this.modalDom.innerHTML = `
                    <!-- Add this modal HTML inside the <body> tag if not already present -->
                    <div class="modal fade" id="ChangeThemePopup" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered  modal-xl">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="successModalLabel">Select Theme</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body" id="">
                                    <div class="theme-header w-100 mb-4">
                                         <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-0">🎨 Introducing the Theme Builder! ✨ Click on any of the items below to preview and apply different themes to your page. <br> Easily customize the look and feel of your site — more powerful theme features coming soon! 🚀🎉</div>
                                    </div>
                                    <div class="theme-items row">
                                        <?php foreach ($allThemes as $theme) : ?>
                                            <div class="col-3 mb-4">
                                                <a href="<?php echo $theme['url']; ?>" class="theme-item shadow-sm" draggable="true">
                                                    <!-- <div class="d-flex"> -->
                                                        <div class="theme-thumb">
                                                            <img width="100%" src="<?= $theme['thumbnail'] ?>" alt="">
                                                        </div>
                                                        <div class="p-2">
                                                            <label for="" class="fw-semibold theme-label"><?= $theme['title'] ?></label>
                                                            <p class="mb-0 theme-desc"><?= $theme['description'] ?></p>
                                                        </div>
                                                    <!-- </div> -->
                                                </a>
                                            </div>
                                        <?php endforeach; ?>
                                        <div class="col-3 mb-4">
                                            <div onclick="window.changeThemePopup.hide();smenu.openTab(document.querySelector('[data-smenu=import]'));" class="theme-item shadow-sm " draggable="true">
                                                <!-- <div class="d-flex"> -->
                                                    <div class="theme-thumb">
                                                        <svg xmlns="http://www.w3.org/2000/svg" id="Layer_2" viewBox="0 0 596 769"><g id="Layer_1-2"><rect width="596" height="769" style="fill:#f8f9fa;"/><path d="M254.75,464.46v-105.79c0-4.85,1.71-8.97,5.14-12.35,3.43-3.38,7.56-5.07,12.41-5.07h105.66c4.81,0,8.92,1.71,12.35,5.14,3.42,3.42,5.14,7.54,5.14,12.35v68.08c0,2.39-.47,4.67-1.42,6.84-.94,2.17-2.2,4.04-3.77,5.6l-37.51,37.51c-1.57,1.57-3.44,2.82-5.6,3.77-2.17.94-4.45,1.42-6.84,1.42h-68.08c-4.81,0-8.92-1.71-12.35-5.14-3.42-3.42-5.14-7.54-5.14-12.35ZM200.91,326.06c-.94-4.84-.02-9.22,2.78-13.12,2.8-3.91,6.62-6.3,11.48-7.19l104.1-18.34c4.8-.94,9.13,0,12.99,2.82,3.86,2.82,6.3,6.64,7.33,11.44l1.48,9.01c.35,1.8.04,3.24-.91,4.32-.95,1.08-2.08,1.7-3.38,1.88-1.32.22-2.58,0-3.79-.67-1.2-.67-2.03-1.9-2.48-3.68l-1.89-9.99c-.28-1.53-1.11-2.74-2.5-3.64-1.39-.9-2.91-1.21-4.58-.94l-104.46,18.54c-1.94.28-3.4,1.18-4.37,2.71-.97,1.53-1.32,3.26-1.04,5.2l19.77,112.22c.26,1.4,0,2.73-.79,3.99-.79,1.26-1.92,2.08-3.39,2.49-1.47.4-2.86.13-4.16-.82-1.3-.95-2.09-2.2-2.35-3.74l-19.83-112.49ZM265.58,358.74v105.72c0,1.94.62,3.54,1.87,4.79,1.25,1.25,2.85,1.87,4.79,1.87h69.1l43.29-43.29v-69.1c0-1.94-.62-3.54-1.87-4.79-1.25-1.25-2.85-1.87-4.79-1.87h-105.72c-1.94,0-3.54.62-4.79,1.87-1.25,1.25-1.87,2.85-1.87,4.79ZM319.69,417.01v27.06c0,1.53.52,2.82,1.56,3.86,1.04,1.04,2.33,1.56,3.86,1.56s2.82-.52,3.85-1.56,1.55-2.32,1.55-3.86v-27.06h27.06c1.53,0,2.82-.52,3.86-1.56s1.56-2.33,1.56-3.86-.52-2.82-1.56-3.85c-1.04-1.03-2.32-1.55-3.86-1.55h-27.06v-27.06c0-1.53-.52-2.82-1.56-3.86-1.04-1.04-2.33-1.56-3.86-1.56s-2.82.52-3.85,1.56c-1.03,1.04-1.55,2.32-1.55,3.86v27.06h-27.06c-1.53,0-2.82.52-3.86,1.56s-1.56,2.33-1.56,3.86.52,2.82,1.56,3.85c1.04,1.03,2.32,1.55,3.86,1.55h27.06Z" style="fill:#666; opacity:.57;"/></g></svg>
                                                    </div>
                                                    <div class="p-2">
                                                        <label for="" class="fw-semibold theme-label">+ Add New Theme</label>
                                                        <p class="mb-0 theme-desc">Upload your theme to the theme storage directory.</p>
                                                    </div>
                                                <!-- </div> -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(this.modalDom);

                this.modal = new bootstrap.Modal(this.modalDom.querySelector('.modal'));
            }

            show() {
                this.modal.show();
            }
            hide() {
                this.modal.hide();
            }
        }

        var UploadManager = class {
            constructor(uploadPlaceholder, fileInput, uploadButton, fileName) {
                this.uploadPlaceholder = uploadPlaceholder;
                this.fileInput = fileInput;
                this.uploadButton = uploadButton;
                this.fileName = fileName;

                this.events();
            }

            browserFile() {
                this.fileInput.click();
            }

            fileChangeHandler() {
                if (this.fileInput.files.length > 0) {
                    this.fileName.textContent = this.fileInput.files[0].name; // Show selected file name
                    this.uploadButton.disabled = false; // Enable upload button
                }
            }

            uploadFile() {
                const file = this.fileInput.files[0];
                if (!file) {
                    alert('Please select a file to upload.');
                    return;
                }

                const formData = new FormData();
                formData.append('file', file);

                fetch(handlerUpload, {
                        method: 'POST',
                        body: formData,
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            // Alert
                            SAlert.show('File uploaded and extracted successfully.');
                        } else {
                            alert('Error: ' + data.message);
                        }
                    })
                    .catch(error => {
                        alert('Error uploading file: ' + error);
                    });
            }

            events() {
                // Trigger file input click on placeholder click
                this.uploadPlaceholder.addEventListener('click', () => {
                    this.browserFile();
                });

                // Handle file selection
                this.fileInput.addEventListener('change', () => {
                    this.fileChangeHandler();
                });

                this.uploadButton.addEventListener('click', () => {
                    this.uploadFile();
                });
            }
        }

        var AIPopup = class {
            constructor(button) {
                this.button = button;
                if (!this.wrapper) {
                    this.wrapper = document.createElement('div');
                    this.wrapper.innerHTML = `
                        <!-- Add this modal HTML inside the <body> tag if not already present -->

                        <div class="modal fade ai-modal" tabindex="-1" aria-labelledby="aiModalLabel" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered modal-lg">
                                <div class="modal-content shadow-lg border-0" style="background: linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%); color: #fff;">
                                    <div class="modal-header border-0" style="background: rgba(0,0,0,0.05);">
                                        <div class="d-flex align-items-center gap-3">
                                            <span class="material-symbols-rounded fs-1">
network_intel_node
</span>
                                            <h3 class="modal-title fw-bold mb-0" id="aiModalLabel">Transform Your Content</h3>
                                        </div>
                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body py-5 px-4">
                                        <div class="row g-4 align-items-center">
                                            <div class="col-md-6 text-center">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <svg width="120" height="120" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-3" style="filter: drop-shadow(0 4px 24px #a5b4fc);">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <defs>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <linearGradient id="sparkleGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <stop stop-color="#a5b4fc"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <stop offset="1" stop-color="#f0f9ff"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </linearGradient>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <linearGradient id="circleGradient" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <stop stop-color="#6366f1"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <stop offset="1" stop-color="#a5b4fc"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </linearGradient>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <linearGradient id="lightningGradient" x1="32" y1="32" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <stop stop-color="#f0f9ff"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <stop offset="1" stop-color="#3b82f6"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </linearGradient>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </defs>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <g>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <!-- Main big bold star, center top -->
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M32 18 l3 -10 l3 10 l10 3 l-10 3 l-3 10 l-3 -10 l-10 -3 l10 -3z" fill="#f8fafc" opacity="0.95"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <!-- Secondary big star, right -->
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M46 28 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" fill="#e0e7ff" opacity="0.85"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <!-- Medium star, left -->
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M20 32 l1.2 -4 l1.2 4 l4 1.2 l-4 1.2 l-1.2 4 l-1.2 -4 l-4 -1.2 l4 -1.2z" fill="#e0e7ff" opacity="0.7"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <!-- Small stars, bottom right and left -->
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M40 46 l0.7 -2.5 l0.7 2.5 l2.5 0.7 l-2.5 0.7 l-0.7 2.5 l-0.7 -2.5 l-2.5 -0.7 l2.5 -0.7z" fill="#f8fafc" opacity="0.6"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M24 44 l0.4 -1.2 l0.4 1.2 l1.2 0.4 l-1.2 0.4 l-0.4 1.2 l-0.4 -1.2 l-1.2 -0.4 l1.2 -0.4z" fill="#f8fafc" opacity="0.5"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <!-- Extra small stars for accent -->
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M36 30 l0.3 -0.9 l0.3 0.9 l0.9 0.3 l-0.9 0.3 l-0.3 0.9 l-0.3 -0.9 l-0.9 -0.3 l0.9 -0.3z" fill="#f8fafc" opacity="0.4"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <path d="M28 38 l0.3 -0.9 l0.3 0.9 l0.9 0.3 l-0.9 0.3 l-0.3 0.9 l-0.3 -0.9 l-0.9 -0.3 l0.9 -0.3z" fill="#e0e7ff" opacity="0.4"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <!-- Dots, accent and highlight -->
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <circle cx="52" cy="24" r="2" fill="#f8fafc" opacity="0.7"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <circle cx="44" cy="36" r="1.2" fill="#e0e7ff" opacity="0.6"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <circle cx="36" cy="26" r="1.5" fill="#f8fafc" opacity="0.5"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <circle cx="22" cy="38" r="1" fill="#e0e7ff" opacity="0.5"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <circle cx="30" cy="22" r="1" fill="#f8fafc" opacity="0.5"/>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </g>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </svg>
                                                <h4 class="fw-bold mb-2" style="letter-spacing: 1px;">Unleash the Power of AI</h4>
                                                <p class="lead mb-3" style="color: #e0e7ff;">Let our AI engine instantly transform your ideas into stunning HTML content. Just describe what you want, and watch the magic happen!</p>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="mb-4">
                                                    <label for="aiPromptInput" class="form-label fw-semibold" style="color: #fff;">Describe your content or idea:</label>
                                                    <textarea id="aiPromptInput" class="form-control form-control-lg border-0 shadow-sm" rows="8" placeholder="e.g. Landing page introducing a trip to Paris, featuring many places to visit, local foods, and generating related images." style="resize: vertical;"></textarea>
                                                </div>
                                                <button type="button" class="btn btn-warning btn-lg w-100 py-3 fw-bold shadow" id="startAITransformBtn" style="font-size: 1.25rem; letter-spacing: 1px;">
                                                    <span class="material-symbols-rounded align-middle me-2" style="font-size: 2rem; vertical-align: middle;">auto_awesome</span>
                                                    Start AI Transform
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="modal-footer border-0 justify-content-center" style="background: rgba(0,0,0,0.03);">
                                        <span class="text-light-emphasis small">AI Builder is powered by advanced generative models. Your creativity is the only limit!</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(this.wrapper);
                }
                this.modal = new bootstrap.Modal(this.wrapper.querySelector('.modal'));

                //
                this.events();
            }

            getStartButton() {
                return this.wrapper.querySelector('#startAITransformBtn');
            }

            show() {
                // Show the modal
                this.modal.show();
            }

            highlightButton() {
                const aiButton = document.querySelector('.ai-btn');
                aiButton.classList.remove('ai-click-effect'); // reset if already applied
                void aiButton.offsetWidth; // force reflow to restart animation
                aiButton.classList.add('ai-click-effect');
            }

            events() {
                this.button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const aiButton = document.querySelector('.ai-btn');

                    if (!aiButton || aiButton.offsetParent == null) {
                        this.show();
                    } else {
                        this.highlightButton();
                    }
                });

                this.getStartButton().addEventListener('click', () => {
                    this.run();
                });
            }

            run() {
                const prompt = this.wrapper.querySelector('#aiPromptInput').value.trim();

                if (prompt) {
                    // Close the modal
                    this.modal.hide();

                    // effect start
                    this.addEffect();

                    // Send prompt to server for AI processing
                    fetch(handlerAIHandler, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ prompt: prompt, type: 'full-page' }),
                    })
                    .then(response => response.json())
                    .then(data => {
                        // effect stop
                        this.removeEffect();

                        if (!data.error) {
                            var json = builder.getData();
                            json.elementLists = data.elementLists; // clear existing content
                            // 
                            builder.parse(json);

                            // SAlert.show('Content generated successfully!');
                        } else {
                            SAlert.show(data.error.message);
                        }
                    })
                    .catch(error => {
                        // effect stop
                        this.removeEffect();

                        alert('Error generating content: ' + error);
                    });
                } else {
                    alert('Please enter a description for your content.');
                }
            }

            addEffect() {

                // Remove any existing effect first
                this.removeEffect();

                // Find #MainContainer
                const mainContainer = document.getElementById('MainContainer');
                mainContainer.style.position = 'relative';
                if (!mainContainer) return;

                // Create overlay
                const overlay = document.createElement('div');
                overlay.id = 'ai-bounce-overlay';
                overlay.innerHTML = `
                    <div class="ai-bounce-blossom">
                        <div class="ai-scan-highlight"></div>
                        <div class="ai-blossom"></div>
                        <div class="ai-blossom2"></div>
                    </div>
                    <div class="ai-bounce-message" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:1.5rem;font-weight:500;text-align:center;text-shadow:0 2px 8px #1e293b;pointer-events:none;">
                        Generating your page with AI magic...
                    </div>
                `;
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.zIndex = '9999';
                overlay.style.pointerEvents = 'none';
                overlay.style.background = 'rgba(30, 41, 59, 0.15)';
                overlay.style.overflow = 'hidden';

                mainContainer.appendChild(overlay);
                // Animate scan
                setTimeout(() => {
                    const scan = overlay.querySelector('.ai-scan-highlight');
                    if (scan) scan.classList.add('active');
                }, 100);
            }

            removeEffect() {
                const mainContainer = document.getElementById('MainContainer');
                if (!mainContainer) return;
                const overlay = mainContainer.querySelector('#ai-bounce-overlay');
                if (overlay) {
                    overlay.classList.add('fadeout');
                    setTimeout(() => {
                        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    }, 1200);
                }
            }
        }
    </script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/2.9.2/umd/popper.min.js" integrity="sha512-2rNj2KJ+D8s1ceNasTIex6z4HWyOnEYLVC3FigGOmyQCZc2eBXKgOxQmo3oKLHyfcj53uz4QMsRCWNbLd32Q1g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/js/bootstrap.bundle.min.js" integrity="sha384-k6d4wzSIapyDyv1kpU366/PK5hCdSbCRGRCMv+eplOQJWyd1fbcAu9OCUj5zNLiq" crossorigin="anonymous"></script>
    <script>
        var tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
        var tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
    </script>
</body>

</html>