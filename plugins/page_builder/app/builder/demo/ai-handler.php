<?php
header('Content-Type: application/json');

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);
$prompt = $input['prompt'] ?? '';
$request = $input['request'] ?? 'Rewrite formally';

// Demo full page parse
if ($input['type'] === 'full-page') {
    sleep(2); // Simulate processing time
    $request = 'Update all page content: text + image';
    http_response_code(200);
    echo '{
        "theme": "1_Column_Layout",
        "name": "PageElement",
        "elementLists": [
            [
            {
                "name": "GridElement",
                "template": "Grid",
                "type": null,
                "cells": [
                {
                    "name": "CellElement",
                    "template": "Cell",
                    "elementLists": [
                    [
                        {
                        "name": "ImageElement",
                        "template": "Image",
                        "src": "https://www.freepnglogos.com/uploads/company-logo-png/company-logo-transparent-png-19.png",  
                        "alt": "Sample company logo",
                        "formats": {
                            "background_color": null,
                            "background_image": null,
                            "background_position": "center",
                            "background_size": "100%",
                            "background_repeat": "no-repeat",
                            "padding_top": 0,
                            "padding_right": 0,
                            "padding_bottom": 0,
                            "padding_left": 0,
                            "width": 150,
                            "height": "auto",
                            "max_width": null,
                            "max_height": null,
                            "align": "left"
                        },
                        "effect": {
                            "grayscale": 0,
                            "sepia": 0,
                            "invert": 0,
                            "blur": 0,
                            "brightness": 100,
                            "contrast": 100,
                            "saturate": 100,
                            "hueRotate": 0,
                            "opacity": 100
                        }
                        }
                    ]
                    ],
                    "formats": {
                    "background_color": null,
                    "background_image": null,
                    "background_position": "center",
                    "background_size": "100%",
                    "background_repeat": "no-repeat",
                    "padding_top": 0,
                    "padding_right": 0,
                    "padding_bottom": 0,
                    "padding_left": 0,
                    "width": "",
                    "height": ""
                    }
                },
                {
                    "name": "CellElement",
                    "template": "Cell",
                    "elementLists": [
                    [
                        {
                        "name": "PElement",
                        "template": "HeaderP",
                        "text": "View this email in your browser",
                        "formats": {
                            "text_color": null,
                            "background_color": null,
                            "background_image": null,
                            "background_position": "center",
                            "background_size": "100%",
                            "background_repeat": "no-repeat",
                            "padding_top": 0,
                            "padding_right": 0,
                            "padding_bottom": 0,
                            "padding_left": 0,
                            "text_align": "center"
                        }
                        }
                    ]
                    ],
                    "formats": {
                    "background_color": null,
                    "background_image": null,
                    "background_position": "center",
                    "background_size": "100%",
                    "background_repeat": "no-repeat",
                    "padding_top": 0,
                    "padding_right": 0,
                    "padding_bottom": 0,
                    "padding_left": 0,
                    "width": "",
                    "height": ""
                    }
                }
                ],
                "formats": {
                "font_family": "inherit",
                "font_style": null,
                "font_weight": null,
                "font_size": null,
                "background_color": null,
                "background_image": null,
                "background_position": "center",
                "background_size": "100%",
                "background_repeat": "no-repeat",
                "text_color": null,
                "padding_top": 0,
                "padding_right": 0,
                "padding_bottom": 0,
                "padding_left": 0,
                "margin_top": 0,
                "margin_right": 0,
                "margin_bottom": 0,
                "margin_left": 0,
                "border_radius": 0,
                "content_display": "flex",
                "content_flex_wrap": "nowrap",
                "content_justify_content": "center",
                "content_align_items": null,
                "content_gap": "10px"
                }
            }
            ],
            [
            {
                "name": "H1Element",
                "template": "H1",
                "text": "Welcome to Our Newsletter",
                "formats": {
                "text_color": "#000",
                "background_color": null,
                "background_image": null,
                "background_position": "center",
                "background_size": "100%",
                "background_repeat": "no-repeat",
                "padding_top": 0,
                "padding_right": 0,
                "padding_bottom": 0,
                "padding_left": 0,
                "text_align": "center"
                }
            }
            ],
            [
            {
                "name": "PElement",
                "template": "H5",
                "text": "Stay updated with our latest news and insights",
                "formats": {
                "text_color": null,
                "background_color": null,
                "background_image": null,
                "background_position": "center",
                "background_size": "100%",
                "background_repeat": "no-repeat",
                "padding_top": 0,
                "padding_right": 0,
                "padding_bottom": 0,
                "padding_left": 0,
                "text_align": "center"
                }
            }
            ],
            [
            {
                "name": "PElement",
                "template": "P",
                "text": "We are excited to share the latest updates, product features, and helpful resources with you. Our mission is to help you achieve more with less effort. Explore our tips, guides, and announcements below.",
                "formats": {
                "text_color": null,
                "background_color": null,
                "background_image": null,
                "background_position": "center",
                "background_size": "100%",
                "background_repeat": "no-repeat",
                "padding_top": 0,
                "padding_right": 0,
                "padding_bottom": 0,
                "padding_left": 0,
                "text_align": "center"
                }
            }
            ],
            [
            {
                "name": "DescriptionImageElement",
                "template": "DescImage",
                "items": [
                {
                    "image_url": "https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg",  
                    "title": "Discover Our Latest Feature",
                    "text": "Our new feature helps you work smarter, save time, and achieve better results. Click below to learn how it can benefit you."
                }
                ]
            }
            ],
            [
            {
                "name": "SocialIconsElement",
                "template": "SocialIcons",
                "items": [
                { "link": "https://facebook.com/YourCompany", "image_url": "https://cdn-icons-png.flaticon.com/512/733/733547.png", "label": "Facebook" },
                { "link": "https://linkedin.com/company/YourCompany", "image_url": "https://cdn-icons-png.flaticon.com/512/174/174857.png", "label": "LinkedIn" },
                { "link": "https://youtube.com/YourCompanyChannel", "image_url": "https://cdn-icons-png.flaticon.com/512/1384/1384060.png", "label": "YouTube" },
                { "link": "https://twitter.com/YourCompany", "image_url": "https://cdn-icons-png.flaticon.com/512/733/733579.png", "label": "Twitter" }
                ]
            }
            ],
            [
            {
                "name": "GridElement",
                "template": "CopyrightGrid",
                "type": null,
                "cells": [
                {
                    "name": "CellElement",
                    "template": "CopyrightCell",
                    "elementLists": [
                    [
                        {
                        "name": "PElement",
                        "template": "CopyrightP",
                        "text": "© 2025 Your Company. All rights reserved.",
                        "formats": {
                            "text_color": null,
                            "background_color": null,
                            "background_image": null,
                            "background_position": "center",
                            "background_size": "100%",
                            "background_repeat": "no-repeat",
                            "padding_top": 0,
                            "padding_right": 0,
                            "padding_bottom": 0,
                            "padding_left": 0,
                            "text_align": "center"
                        }
                        },
                        {
                        "name": "GridElement",
                        "template": "CopyrightInlineGrid",
                        "type": null,
                        "cells": [
                            {
                            "name": "CellElement",
                            "template": "CopyrightInlineCell",
                            "elementLists": [
                                [
                                {
                                    "name": "PElement",
                                    "template": "CopyrightP",
                                    "text": "You can ",
                                    "formats": {
                                    "text_color": null,
                                    "background_color": null,
                                    "background_image": null,
                                    "background_position": "center",
                                    "background_size": "100%",
                                    "background_repeat": "no-repeat",
                                    "padding_top": 0,
                                    "padding_right": 0,
                                    "padding_bottom": 0,
                                    "padding_left": 0,
                                    "text_align": "center"
                                    }
                                },
                                {
                                    "name": "LinkElement",
                                    "template": "CopyrightLink",
                                    "text": "update your preferences ",
                                    "url": "https://yourcompany.com/update-profile"
                                },
                                {
                                    "name": "PElement",
                                    "template": "CopyrightP",
                                    "text": "or ",
                                    "formats": {
                                    "text_color": null,
                                    "background_color": null,
                                    "background_image": null,
                                    "background_position": "center",
                                    "background_size": "100%",
                                    "background_repeat": "no-repeat",
                                    "padding_top": 0,
                                    "padding_right": 0,
                                    "padding_bottom": 0,
                                    "padding_left": 0,
                                    "text_align": "center"
                                    }
                                },
                                {
                                    "name": "LinkElement",
                                    "template": "CopyrightLink",
                                    "text": "unsubscribe from this list.",
                                    "url": "https://yourcompany.com/unsubscribe"
                                }
                                ]
                            ],
                            "formats": {
                                "background_color": null,
                                "background_image": null,
                                "background_position": "center",
                                "background_size": "100%",
                                "background_repeat": "no-repeat",
                                "padding_top": 0,
                                "padding_right": 0,
                                "padding_bottom": 0,
                                "padding_left": 0,
                                "width": "",
                                "height": ""
                            }
                            }
                        ],
                        "formats": {
                            "font_family": "inherit",
                            "font_style": null,
                            "font_weight": null,
                            "font_size": null,
                            "background_color": null,
                            "background_image": null,
                            "background_position": "center",
                            "background_size": "100%",
                            "background_repeat": "no-repeat",
                            "text_color": null,
                            "padding_top": 0,
                            "padding_right": 0,
                            "padding_bottom": 0,
                            "padding_left": 0,
                            "margin_top": 0,
                            "margin_right": 0,
                            "margin_bottom": 0,
                            "margin_left": 0,
                            "border_radius": 0,
                            "content_display": "flex",
                            "content_flex_wrap": "nowrap",
                            "content_justify_content": "center",
                            "content_align_items": null,
                            "content_gap": "10px"
                        }
                        }
                    ],
                    [
                        {
                        "name": "LinkElement",
                        "template": "CopyrightLink",
                        "text": "Back to top",
                        "url": "#top"
                        }
                    ]
                    ],
                    "formats": {
                    "background_color": null,
                    "background_image": null,
                    "background_position": "center",
                    "background_size": "100%",
                    "background_repeat": "no-repeat",
                    "padding_top": 0,
                    "padding_right": 0,
                    "padding_bottom": 0,
                    "padding_left": 0,
                    "width": "",
                    "height": ""
                    }
                }
                ],
                "formats": {
                "font_family": "inherit",
                "font_style": null,
                "font_weight": null,
                "font_size": null,
                "background_color": null,
                "background_image": null,
                "background_position": "center",
                "background_size": "100%",
                "background_repeat": "no-repeat",
                "text_color": null,
                "padding_top": 0,
                "padding_right": 0,
                "padding_bottom": 0,
                "padding_left": 0,
                "margin_top": 0,
                "margin_right": 0,
                "margin_bottom": 0,
                "margin_left": 0,
                "border_radius": 0,
                "content_display": "flex",
                "content_flex_wrap": "nowrap",
                "content_justify_content": "center",
                "content_align_items": null,
                "content_gap": "10px"
                }
            }
            ]
        ],
        "formats": {
            "font_family": "inherit",
            "font_style": null,
            "font_weight": null,
            "font_size": null,
            "background_color": null,
            "background_image": null,
            "background_position": "center",
            "background_size": "100%",
            "background_repeat": "no-repeat",
            "text_color": null,
            "padding_top": 0,
            "padding_right": 0,
            "padding_bottom": 0,
            "padding_left": 0
        }
        }';
    exit;
}

// Your OpenAI API key (move to env/config in production)
$apiKey = '';

// Handle if apiKey not provided
if (!$apiKey) {
    echo json_encode(['error' => ['message' => '<h2>Welcome!</h2>
        <p>Your OpenAI API key is currently missing or invalid. Please obtain your key from the <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API Keys page</a>.</p>
        <p>After obtaining your key, update it in your project\'s configuration file at:</p>
        <p><code>ai-handler.php</code></p>
        <p>Ensure you replace the placeholder with your valid API key to restore functionality.</p>']]);
    http_response_code(500);
    exit;
}

$data = [
    'model' => 'gpt-3.5-turbo',
    'messages' => [
        ['role' => 'system', 'content' => 'You are a helpful assistant for text editing.'],
        ['role' => 'user', 'content' => $request . ': ' . $prompt]
    ],
    'max_tokens' => 512,
    'temperature' => 0.7
];

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($response === false) {
    echo json_encode(['error' => ['message' => 'Failed to connect to OpenAI.']]);
    http_response_code(500);
    exit;
}

http_response_code($httpCode);
echo $response;
