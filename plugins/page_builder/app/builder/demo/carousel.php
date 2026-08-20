<?php
    include_once('includes.php');

    // Get the current theme name from the URL, default to 'Default'
    $currentThemeName = $_GET["theme"] ?? 'carousel/Z_Carousel';
    $currentTheme = loadThemeFromDirName($currentThemeName);

    // Build the absolute base path to the themes directory (for use in JS, asset loading, etc.)
    $themeUrl = (
        isset($_SERVER["REQUEST_SCHEME"]) ? $_SERVER["REQUEST_SCHEME"] : "http"
    ) . "://" . $_SERVER["HTTP_HOST"] . rtrim(dirname($_SERVER["REQUEST_URI"]), '/\\') . "/themes/" . $currentThemeName;

    // Get theme by type
    $allThemes = loadThemes('carousel');
    // $allThemes = array_merge($allThemes, loadThemes('extended'));

    // Check if theme is carousel
    $isCarousel = str_contains($currentTheme["name"], 'Carousel') ? true : false;
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-SgOJa3DmI69IUzQ2PVdRZhwQ+dy64/BUtbMJw1MZ8t5HZApcHrRKUc4W0kG879m7" crossorigin="anonymous">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">

    <script src="tinymce/tinymce.min.js" referrerpolicy="origin"></script>

    <link href="dist/builder.css" rel="stylesheet" />
    <script src="dist/builder.js"></script>

    <?php if ($isCarousel) { ?>
        <!-- HTML2Canvas -->
        <script src="html2canvas/html2canvas.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <?php } ?>

    <link rel="icon" type="image/x-icon" href="logo.svg">

    <title>aiCarousels</title>

    <link href="carousel.css" rel="stylesheet" />

    <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
    
    <style>
        :root,
        .btn {
            --bs-body-font-size: 0.875rem;
            --bs-btn-font-size: 0.8125rem;
            --bs-form-label-font-size: 0.8125rem;
            --bs-small-font-size: 0.75rem;
            --bs-btn-padding-y: 0.475rem;
            --bs-navbar-height: 72px;
        }

        body {
            overflow-x: hidden;
            font-size: var(--bs-body-font-size);

            background-image: url(image/dots.svg);
            background-size: 93.913048px;
            background-color: #F4F5F7;
        }

        .form-select {
            font-size: var(--bs-body-font-size);
        }

        .btn {
            font-size: var(--bs-btn-font-size);
            font-weight: 600;
        }

        .purple-header .btn .material-symbols-rounded {
            font-size: 20px;
        }

        .btn span {
            font-size: inherit;
        }

        .btn .material-symbols-rounded {
            font-size: 1.2em;
        }

        .form-label {
            font-size: var(--bs-form-label-font-size);
        }

        .small,
        small {
            font-size: var(--bs-small-font-size);
        }

        h6 {
            font-size: 0.9375rem;
        }

        .purple-header {
            background: white;
            color: #333;
            font-size: var(--bs-body-font-size);
            border-bottom: 1px solid #e9ecef;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .purple-header h5 {
            font-size: 1.125rem;
            color: #333;
        }

        .purple-header .btn {
            font-size: var(--bs-btn-font-size) !important;
        }

        .purple-header .btn span {
            font-size: inherit;
        }

        .purple-header small {
            font-size: var(--bs-small-font-size);
            color: #666;
        }

        .left-sidebar {
            min-height: 100vh;
            width: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0;
            position: fixed;
            left: 0;
            top: 0;
            z-index: 1000;
            border-right: 1px solid #e9ecef;
            box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        }

        .left-sidebar-icon {
            margin-bottom: 15px;
        }

        .left-sidebar-icon.menu-icon {
            background-color: #e8dff5;
            /* Light purple background like sidebar */
        }

        .left-sidebar-icon.mb-4 {
            margin-bottom: 0 !important;
            width: 100%;
            height: var(--bs-navbar-height);
            /* Match exact header height including border */
            display: flex;
            align-items: center;
            justify-content: center;
            border-bottom: 1px solid #e9ecef;
        }

        .left-sidebar-icon .btn {
            width: 40px;
            height: 40px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
        }

        .left-sidebar-icon.mb-4 .btn {
            width: 44px;
            height: 44px;
        }

        .left-sidebar-icon .btn .material-symbols-rounded {
            font-size: 20px;
        }

        .left-sidebar-icon.mb-4 .btn .material-symbols-rounded {
            font-size: 24px;
        }

        .left-sidebar-icon.active .btn {
            background-color: #6941C6;
            border-color: #6941C6;
            color: white;
        }

        .left-sidebar .navigation-icons {
            padding: 20px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .main-wrapper {
            margin-left: 60px;
        }

        .sidebar {
            border-right: 1px solid #dee2e6;
            overflow: auto;
            z-index: 1;
        }

        .header-with-sidebar {
            margin-left: 60px;
            height: var(--bs-navbar-height);
            align-items: center;
            display: flex;
            position: sticky;
            top: 0;
            z-index: 1;
        }

        .carousel-preview-container {
            /* height: calc(100vh - var(--bs-navbar-height)); */
            /* overflow: auto; */
        }

        /* Override Bootstrap btn-secondary to match purple theme */
        .btn-secondary {
            background-color: #e1d5f3 !important;
            color: #6941C6 !important;
            border: 1px solid #e1d5f3 !important;
            font-size: var(--bs-btn-font-size) !important;
        }

        .btn-secondary:hover {
            background-color: #d4c4f0 !important;
            color: #6941C6 !important;
            border-color: #d4c4f0 !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(105, 65, 198, 0.15);
        }

        .btn-secondary:focus {
            background-color: #e1d5f3 !important;
            color: #6941C6 !important;
            border-color: #e1d5f3 !important;
            box-shadow: 0 0 0 0.25rem rgba(105, 65, 198, 0.25);
        }

        .btn-secondary:active {
            background-color: #d4c4f0 !important;
            color: #6941C6 !important;
            border-color: #d4c4f0 !important;
        }

        /* Override Bootstrap btn-primary to match purple theme */
        .btn-primary {
            background-color: #6941C6 !important;
            color: white !important;
            border: 1px solid #6941C6 !important;
            font-size: var(--bs-btn-font-size) !important;
        }

        .btn-primary:hover {
            background-color: #5a369f !important;
            color: white !important;
            border-color: #5a369f !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(105, 65, 198, 0.25);
        }

        .btn-primary:focus {
            background-color: #6941C6 !important;
            color: white !important;
            border-color: #6941C6 !important;
            box-shadow: 0 0 0 0.25rem rgba(105, 65, 198, 0.25);
        }

        .btn-primary:active {
            background-color: #5a369f !important;
            color: white !important;
            border-color: #5a369f !important;
        }

        /* Custom button hover effects following Bootstrap patterns */
        .btn[style*="background-color: #e1d5f3"]:hover {
            background-color: #d4c4f0 !important;
            border-color: #c8b6ec !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(105, 65, 198, 0.15);
        }

        .btn[style*="background-color: #6941C6"]:hover {
            background-color: #5a369f !important;
            border-color: #5a369f !important;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(105, 65, 198, 0.25);
        }

        .btn-link:hover {
            text-decoration: none !important;
            color: #6941C6 !important;
        }

        .btn-outline-dark:hover {
            background-color: #212529;
            border-color: #212529;
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(33, 37, 41, 0.15);
        }

        /* Custom btn-outline-primary styling to match the real design */
        .btn-outline-primary {
            color: #6941C6;
            border-color: #c8b6ec;
            background-color: transparent;
        }

        .btn-outline-primary:hover {
            color: #6941C6;
            /* Keep dark purple text */
            background-color: #e8dff5;
            /* Light purple background */
            border-color: #c8b6ec;
            /* Keep light purple border */
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(105, 65, 198, 0.15);
        }

        .btn-outline-primary:focus {
            color: #6941C6;
            /* Keep dark purple text */
            background-color: #e8dff5;
            /* Light purple background */
            border-color: #c8b6ec;
            /* Keep light purple border */
            box-shadow: 0 0 0 0.2rem rgba(105, 65, 198, 0.25);
        }

        /* Add smooth transitions for all buttons */
        .btn {
            transition: all 0.15s ease-in-out;
        }

        /* Radio button styling - make checked state look like btn-secondary */
        .btn-check:checked+.btn-outline-primary {
            background-color: #e1d5f3 !important;
            color: #6941C6 !important;
            border-color: #e1d5f3 !important;
        }

        .btn-check:checked+.btn-outline-primary:hover {
            background-color: #d4c4f0 !important;
            color: #6941C6 !important;
            border-color: #d4c4f0 !important;
        }

        /* Override Bootstrap variables for radio button hover states */
        .btn-check+.btn:hover {
            --bs-btn-color: #6941C6 !important;
            --bs-btn-bg: #e8dff5 !important;
            --bs-btn-border-color: #c8b6ec !important;
        }

        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 34px;
            height: 18px;
        }

        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 18px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 14px;
            width: 14px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked+.slider {
            background-color: #6941C6;
        }

        input:checked+.slider:before {
            transform: translateX(16px);
        }

        .sidebar-section {
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 1rem;
            margin-bottom: 1rem;
        }

        .sidebar-section:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }

        .collapsible-header {
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .collapsible-header:hover {
            color: #6941C6;
        }

        .collapse-icon {
            transition: transform 0.3s ease;
            font-size: 14px;
        }

        .sidebar-divider {
            border-top: 1px solid #e9ecef;
            margin: 0.75rem 0;
        }

        .section-header {
            padding: 0.25rem 0;
        }

        .or-divider {
            position: relative;
            text-align: center;
            margin: 1rem 0;
        }

        .or-divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background-color: #dee2e6;
        }

        .or-text {
            background-color: #fff;
            padding: 0 1rem;
            color: #6c757d;
            font-size: 0.875rem;
            position: relative;
            z-index: 1;
        }

        .carousel-preview {
            height: 650px;
            overflow: hidden;
            padding-left: calc(100% - 900px);
            padding-top: 10px;
            padding-bottom: 10px;
            position: relative;
            padding-right: 300px;
        }

        .slide-settings-container {
            margin-left: calc(100% - 900px);
            width: 600px;
            margin-top: -9px;
            z-index: 100;
        }

        .carousel-preview iframe {
            height: 100%;
            box-shadow: 0 0 0.2rem 0.2rem rgba(108, 92, 231, 0.05);
            border-radius: 3px;
            overflow: hidden;
        }

        /* Carousel navigation arrows */
        .carousel-nav-arrow {
            position: sticky;
            top: calc(50vh - var(--bs-navbar-height));
            width: 45px;
            height: 45px;
            background-color: rgba(105, 65, 198, 0.1);
            border: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease-in-out;
            z-index: 1000;
            color: #6941C6;
            border: 5px solid rgba(255, 255, 255, 0.95);
            background-color: rgba(255, 255, 255, 0.8);
            opacity: 0.8;
            pointer-events: none;
        }

        .carousel-nav-arrow.active {
            background-color: #6941C6 !important;
            color: white !important;
            opacity: 1;
            pointer-events: all;
        }

        .carousel-nav-arrow.active:hover {
            background-color: #5a369f !important;
            color: white !important;
            box-shadow: 0 2px 5px rgba(105, 65, 198, 0.25);
        }

        .carousel-nav-arrow .material-symbols-rounded {
            font-size: 24px;
        }

        .carousel-nav-arrow.left {
            margin-left: 0;
            border-radius: 0 10px 10px 0;
            border-left-width: 0;
        }

        .carousel-nav-arrow.right {
            float: right;
            margin-right: 0;
            border-radius: 10px 0 0 10px;
            border-right-width: 0;
        }


        .slide-content {
            position: absolute;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: white;
            width: 60%;
        }

        .top-right-content {
            position: absolute;
            top: 80px;
            right: 80px;
            color: white;
            text-align: right;
        }

        .slide-number {
            position: absolute;
            top: 30px;
            right: 30px;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
        }

        .author-badge {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 20px;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .swipe-btn {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: #ff6b6b;
            border: none;
            border-radius: 20px;
            padding: 8px 20px;
            color: white;
            font-weight: 500;
            font-size: var(--bs-btn-font-size) !important;
        }

        .swipe-btn span {
            font-size: inherit;
        }

        /* Override Bootstrap nav-tabs to look like button group */
        .nav-tabs {
            display: flex;
            background-color: transparent;
            border-radius: 0;
            padding: 0;
            gap: 0;
            border-bottom: none;
            border: 1px solid #c8b6ec;
            border-radius: 8px;
            overflow: hidden;
        }

        .nav-tabs .nav-item {
            flex: 1;
        }

        .nav-tabs .nav-item:not(:last-child) {
            border-right: 1px solid #c8b6ec;
        }

        .nav-tabs .nav-link {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px 12px;
            border-radius: 0;
            font-size: 12px;
            font-weight: 500;
            color: #6c757d;
            background-color: transparent;
            border: none;
            transition: all 0.2s ease;
            text-decoration: none;
            text-align: center;
            width: 100%;
            margin: 0;
        }

        .nav-tabs .nav-item:first-child .nav-link {
            border-top-left-radius: 7px;
            border-bottom-left-radius: 7px;
        }

        .nav-tabs .nav-item:last-child .nav-link {
            border-top-right-radius: 7px;
            border-bottom-right-radius: 7px;
        }

        .nav-tabs .nav-link.active {
            background-color: #e1d5f3;
            color: #6941C6;
            font-weight: 600;
            border: none;
        }

        .nav-tabs .nav-link:hover {
            background-color: #e8dff5;
            color: #6941C6;
            border: none;
        }

        .nav-tabs .nav-link.active:hover {
            background-color: #d4c4f0;
            color: #6941C6;
        }

        /* Style the NEW badge */
        .nav-tabs .badge {
            font-size: 8px;
            padding: 2px 6px;
            border-radius: 10px;
            background-color: #6941C6 !important;
            color: white;
            margin-left: 6px;
        }

        /* Form controls styling to match the image */
        .slide-settings-container .form-control {
            font-size: var(--bs-small-font-size);
            padding: 8px 12px;
        }

        .slide-settings-container .form-control:focus {
            border-color: #6941C6;
            box-shadow: 0 0 0 0.2rem rgba(105, 65, 198, 0.25);
        }

        /* Custom styling for form elements in background image section */
        .slide-settings-container .form-range {
            accent-color: #6941C6;
        }

        .slide-settings-container .form-check-input {
            accent-color: #6941C6;
        }

        .slide-settings-container .form-check-input:checked {
            background-color: #6941C6;
            border-color: #6941C6;
        }

        .slide-settings-container .form-check-input:focus {
            border-color: #6941C6;
            box-shadow: 0 0 0 0.2rem rgba(105, 65, 198, 0.25);
        }

        .hamburger-menu {
            font-size: 24px;
            cursor: pointer;
            color: #6941C6 !important;
            /* Dark purple color for consistency */
            text-decoration: none !important;
        }

        .hamburger-menu:hover {
            color: #5a369f !important;
            /* Darker purple on hover */
            opacity: 1;
        }

        #page-loader-overlay {
            background: #e5dbffff;
        }

        .loader::before {
            background: #6343BF;
        }

        .loader::after {}

        .emoji-option {
            font-size: 24px;
        }
    </style>
</head>

<body class="bg-light">
    <!-- Loading Overlay -->
    <div id="page-loader-overlay">
        <div class="loader"></div>
    </div>

    <div class="spin-loader">
    </div>

    <!-- Very Left Sidebar with Icons -->
    <div class="left-sidebar bg-white">
        <div class="left-sidebar-icon menu-icon mb-4">
            <button class="btn btn-link p-0 hamburger-menu" data-bs-toggle="collapse" data-bs-target="#mainSidebar">
                <span class="material-symbols-rounded">apps</span>
            </button>
        </div>
        <div class="navigation-icons">
            <div class="left-sidebar-icon active">
                <button class="btn btn-outline-primary">
                    <span class="material-symbols-rounded">home</span>
                </button>
            </div>
            <div class="left-sidebar-icon">
                <button class="btn btn-outline-primary">
                    <span class="material-symbols-rounded">auto_fix_high</span>
                </button>
            </div>
            <div class="left-sidebar-icon">
                <button class="btn btn-outline-primary">
                    <span class="material-symbols-rounded">edit</span>
                </button>
            </div>
            <div class="left-sidebar-icon">
                <button class="btn btn-outline-primary">
                    <span class="material-symbols-rounded">chat</span>
                </button>
            </div>
            <div class="left-sidebar-icon">
                <button class="btn btn-outline-primary">
                    <span class="material-symbols-rounded">bar_chart</span>
                </button>
            </div>
            <div class="left-sidebar-icon">
                <button class="btn btn-outline-primary">
                    <span class="material-symbols-rounded">person</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header class="purple-header py-3 header-with-sidebar">
        <div class="container-fluid">
            <div class="row align-items-center">
                <div class="col-md-3">
                    <div class="d-flex align-items-center">
                        <!-- Logo -->
                        <div class="me-3">
                            <div class="d-flex align-items-center justify-content-center bg-white rounded" style="width: 36px; height: 30px;">
                                <img src="logo.svg" alt="">
                            </div>
                        </div>
                        <h5 class="mb-0 fw-bold">aiCarousels</h5>
                        <small class="ms-2 opacity-75">.com</small>
                    </div>
                </div>
                <div class="col-md-9">
                    <div class="d-flex justify-content-end align-items-center gap-3">
                        <button class="btn btn-link text-decoration-none text-dark">
                            <span class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-1">login</span>
                                <span>Log In</span>
                            </span>
                        </button>
                        <button class="btn btn-link text-decoration-none text-dark">
                            <span class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-1">person_add</span>
                                <span>Sign Up</span>
                            </span>
                        </button>
                        <button id="saveToStoreButton" onclick="saveToStore()" class="btn btn-outline-primary btn-sm">
                            <span class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-1">bookmark</span>
                                <span>Save Draft</span>
                            </span>
                        </button>
                        <button class="btn btn-secondary btn-sm">
                            <span class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-1">cancel</span>
                                <span>Remove Watermark</span>
                            </span>
                        </button>
                        <button class="btn btn-primary btn-sm">
                            <span class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-1">download</span>
                                <span>Download</span>
                            </span>
                        </button>
                        <button class="btn btn-link text-dark">
                            <span class="material-symbols-rounded">help</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div class="main-wrapper">
        <div class="container-fluid ps-0 pe-0">
            <div class="row g-0">
                <!-- Sidebar -->
                <div class="col-md-3 sidebar p-4 collapse show bg-white" id="mainSidebar">
                    <!-- AI Carousel Generator -->
                    <div class="sidebar-section">
                        <div class="d-flex align-items-center mb-3">
                            <span class="material-symbols-rounded me-2 text-dark">smart_toy</span>
                            <h6 class="mb-0 fw-bold">AI Carousel Generator</h6>
                            <span class="badge d-flex align-items-center ms-2" style="background-color: #e1d5f3; color: #6941C6; font-size: 0.7rem;">
                                <span class="material-symbols-rounded me-1" style="font-size: 0.8rem;">lock</span>
                                PRO
                            </span>
                        </div>

                        <button onclick="var pop = new Popup(); pop.load('generateCarouselPopup.php');" class="btn btn-primary w-100">
                            <span class="d-flex align-items-center justify-content-center">
                                <span class="material-symbols-rounded me-2">auto_awesome</span>
                                <span>Generate Carousel...</span>
                            </span>
                        </button>

                        <div class="or-divider">
                            <span class="or-text">or</span>
                        </div>

                        <button class="btn btn-secondary w-100">
                            <span class="d-flex align-items-center justify-content-center">
                                <span class="material-symbols-rounded me-2">upload</span>
                                <span>Import Carousel...</span>
                            </span>
                        </button>
                    </div>

                    <!-- Template Settings -->
                    <div id="carouselSettingsContainer" class="sidebar-section">

                    </div>

                    <!-- LinkedIn Post Formatter -->
                    <div class="sidebar-section">
                        <div class="card border-0 shadow-sm position-relative" style="border-radius: 12px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);">
                            <div class="card-body pb-4" style="padding: 16px;">
                                <div class="d-flex align-items-center justify-content-between">
                                    <div class="d-flex align-items-center">
                                        <div class="icon-container me-3" style="width: 40px; height: 40px; background: linear-gradient(135deg, #C4B5FD 0%, #A855F7 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                            <span class="material-symbols-rounded text-white" style="font-size: 22px;">edit</span>
                                        </div>
                                        <div>
                                            <div class="fw-bold text-dark" style="font-size: 14px; line-height: 1.2; margin-bottom: 2px;">LinkedIn Post Formatter</div>
                                            <div class="text-muted" style="font-size: 14px; line-height: 1.2;">and Post Generator ✨</div>
                                        </div>
                                    </div>
                                    <button class="btn btn-link btn-sm p-0 text-muted" style="border: none; background: none; margin-left: 8px;">
                                        <span class="material-symbols-rounded" style="font-size: 20px;">close</span>
                                    </button>
                                </div>
                            </div>
                            <!-- TOP PICK badge positioned in bottom right -->
                            <span class="badge position-absolute" style="background: linear-gradient(135deg, #C4B5FD 0%, #A855F7 100%); color: white; font-weight: 500; padding: 4px 10px; border-radius: 12px 0 12px 0; font-size: 11px; letter-spacing: 0.3px; bottom: 0px; right: 0px;">TOP PICK</span>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="carousel-preview-container col-md-9 position-relative">
                    <!-- Carousel Navigation Arrows -->
                    <button carousel-control="prev" class="carousel-nav-arrow left" onclick="previousSlide()">
                        <span class="material-symbols-rounded">arrow_left_alt</span>
                    </button>
                    <button carousel-control="next" class="carousel-nav-arrow right" onclick="nextSlide()">
                        <span class="material-symbols-rounded">arrow_right_alt</span>
                    </button>
                    <div carousel-control="container" id="MainContainer" class="carousel-preview position-relative">

                    </div>

                    <!-- Bottom Controls -->
                    <div class="slide-settings-container bg-white p-3 shadow-sm">
                        <div id="Sidebar" class="d-none">
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
                        <div id="carouselElementControlsContainer" class=""></div>
                </div>
            </div>
        </div>
    </div>


    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/2.9.2/umd/popper.min.js" integrity="sha512-2rNj2KJ+D8s1ceNasTIex6z4HWyOnEYLVC3FigGOmyQCZc2eBXKgOxQmo3oKLHyfcj53uz4QMsRCWNbLd32Q1g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/js/bootstrap.bundle.min.js" integrity="sha384-k6d4wzSIapyDyv1kpU366/PK5hCdSbCRGRCMv+eplOQJWyd1fbcAu9OCUj5zNLiq" crossorigin="anonymous"></script>
    <script>
        var tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
        var tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

        // Handle collapse icon rotation
        document.addEventListener('DOMContentLoaded', function() {
            const collapseElements = document.querySelectorAll('[data-bs-toggle="collapse"]');

            collapseElements.forEach(function(element) {
                const targetId = element.getAttribute('data-bs-target');
                const targetElement = document.querySelector(targetId);
                const icon = element.querySelector('.collapse-icon') || element;

                if (targetElement) {
                    targetElement.addEventListener('show.bs.collapse', function() {
                        if (icon.textContent === 'expand_more') {
                            icon.textContent = 'expand_less';
                        }
                        icon.classList.remove('collapsed');
                    });

                    targetElement.addEventListener('hide.bs.collapse', function() {
                        if (icon.textContent === 'expand_less') {
                            icon.textContent = 'expand_more';
                        }
                        icon.classList.add('collapsed');
                    });
                }
            });

            // Handle background image toggle
            const backgroundImageToggle = document.getElementById('backgroundImageToggle');
            const backgroundImageContent = document.getElementById('backgroundImageContent');

            if (backgroundImageToggle && backgroundImageContent) {
                backgroundImageToggle.addEventListener('change', function() {
                    if (this.checked) {
                        backgroundImageContent.style.display = 'block';
                    } else {
                        backgroundImageContent.style.display = 'none';
                    }
                });
            }
        });

        // Brand Type Toggle Function
        function toggleBrandContent() {
            const personalRadio = document.getElementById('brandPersonal');
            const businessRadio = document.getElementById('brandBusiness');
            const personalContent = document.getElementById('personalBrandContent');
            const businessContent = document.getElementById('businessBrandContent');

            if (personalRadio.checked) {
                personalContent.style.display = 'block';
                businessContent.style.display = 'none';
            } else if (businessRadio.checked) {
                personalContent.style.display = 'none';
                businessContent.style.display = 'block';
            }
        }
    </script>

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
                carouselSettingsContainer: '#carouselSettingsContainer',
                carouselElementControlsContainer: '#carouselElementControlsContainer',
            });

            // Builder: load current theme data
            builder.load(themeJson, themeUrl, () => {
                // remove page loading effects
                document.querySelector('.spin-loader').remove();

                // Initialize the carousel
                new CarouselControl({
                    container: document.querySelector('[carousel-control="container"]'),
                    prevButton: document.querySelector('[carousel-control="prev"]'),
                    nextButton: document.querySelector('[carousel-control="next"]'),
                    iframe: document.querySelector('[carousel-control="container"] iframe'),
                    slideWidth: 600
                });

                // Select the first slide/element
                builder.selectElement(builder.pageElement.blocks[0].elements[0]);
            });


            // // UI tab: SMenu
            // window.smenu = new TabsManager();
            // smenu.addTab(document.querySelector('[data-smenu="themes"]'), document.querySelector('[data-smenu-container="themes"]'));
            // smenu.addTab(document.querySelector('[data-smenu="design"]'), document.querySelector('[data-smenu-container="design"]'));
            // smenu.addTab(document.querySelector('[data-smenu="import"]'), document.querySelector('[data-smenu-container="import"]'));

            // UI tab: Sidebar tabs
            window.sidebarTabManager = new TabsManager();
            sidebarTabManager.addTab(document.querySelector('[data-tab="widgets"]'), document.querySelector('[data-tab-container="widgets"]'));
            sidebarTabManager.addTab(document.querySelector('[data-tab="controls"]'), document.querySelector('[data-tab-container="controls"]'));
            sidebarTabManager.addTab(document.querySelector('[data-tab="styles"]'), document.querySelector('[data-tab-container="styles"]'));

            // Set default mode to desktop
            // switchToDesktopMode();

            // Change Theme Popup
            window.changeThemePopup = new ChangeThemePopup();

            // // Upload Manager
            // window.uploadManager = new UploadManager(
            //     document.getElementById('uploadPlaceholder'),
            //     document.getElementById('fileInput'),
            //     document.getElementById('uploadButton'),
            //     document.getElementById('fileName')
            // );
            
            // // AI Popup
            // new AIPopup(document.querySelector('[data-control="ai-menu"]')); // Initialize the AI popup when the document is ready

            // // @todo
            // document.querySelector('[data-tab="styles"]').addEventListener('click', () => {
            //     alert('sss');
            //     if (window.smenu) {
            //         window.smenu.openTab(document.querySelector('[data-smenu="themes"]'));
            //     }
            // });
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
            }
        }
    </script>

    <script>
        var CarouselControl = class {
            constructor(options) {
                this.container = options.container;
                this.prevButton = options.prevButton;
                this.nextButton = options.nextButton;
                this.slideWidth = options.slideWidth;
                this.iframe = options.iframe;

                this.currentSlide = 1;
                this.isAnimating = false; // Add flag to prevent rapid clicks

                if (this.prevButton) {
                    this.prevButton.addEventListener('click', () => this.previousSlide());
                }
                if (this.nextButton) {
                    this.nextButton.addEventListener('click', () => this.nextSlide());
                }

                this.render();
            }

            render() {
                // remove current iframe width
                this.iframe.style.width = 'auto';

                // make sure iframe width is reset
                setTimeout(() => {
                    // adjust iframe width to match the iframe content width
                    const contentWidth = this.iframe.contentWindow.document.body.scrollWidth;
                    this.iframe.style.width = `${contentWidth}px`;

                    //
                    this.refresh();

                    // remove page loader
                    const loader = document.getElementById('page-loader-overlay');
                    loader.classList.add('fade-out');
                }, 500);

            }

            refresh() {
                // Hide prev button if on the first slide
                if (this.isStart()) {
                    this.prevButton.classList.remove('active');
                } else {
                    this.prevButton.classList.add('active');
                }

                // Hide next button if on the last slide
                if (!this.isEnd()) {
                    this.nextButton.classList.add('active');
                } else {
                    this.nextButton.classList.remove('active');
                }
            }

            isStart() {
                return this.currentSlide === 1;
            }

            isEnd() {
                return this.currentSlide >= this.getTotal();
            }

            getTotal() {
                // 6.7 with be 6
                return Math.floor(Math.abs(this.iframe.contentWindow.document.body.scrollWidth / this.slideWidth));
            }

            // Helper method to handle smooth scrolling with animation lock
            scrollToSlide(slideNumber) {
                if (this.isAnimating) {
                    return false;
                }

                this.isAnimating = true;
                this.currentSlide = slideNumber;

                // Calculate exact target position
                const targetScrollLeft = (this.currentSlide - 1) * this.slideWidth;

                // Scroll to exact position with smooth animation
                this.container.scrollTo({
                    left: targetScrollLeft,
                    behavior: 'smooth'
                });

                console.log(this.getTotal(), this.currentSlide);

                // Wait for animation to complete before allowing next click
                this.scheduleRefresh();
                return true;
            }

            // Helper method to schedule refresh after animation
            scheduleRefresh() {
                setTimeout(() => {
                    this.isAnimating = false;
                    this.refresh();
                }, 300); // Standard smooth scroll duration
            }

            previousSlide() {
                // start do nothing
                if (this.isStart()) {
                    return;
                }

                // Use helper method to scroll to previous slide
                this.scrollToSlide(this.currentSlide - 1);

                // Select the first element in the new slide
                builder.selectElement(builder.pageElement.blocks[this.currentSlide - 1].elements[0]);
            }

            nextSlide() {
                // end do nothing
                if (this.isEnd()) {
                    return;
                }

                // Use helper method to scroll to next slide
                this.scrollToSlide(this.currentSlide + 1);

                // Select the first element in the new slide
                builder.selectElement(builder.pageElement.blocks[this.currentSlide - 1].elements[0]);
            }
        }
    </script>
</body>

</html>