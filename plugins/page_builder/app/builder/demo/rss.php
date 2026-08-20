<?php
header('Content-Type: application/json');

// Check if the URL parameter is provided
if (!isset($_GET['url']) || empty($_GET['url'])) {
    echo json_encode(['error' => 'RSS URL is required.']);
    exit;
}

$rssUrl = $_GET['url'];

// Validate the URL
if (!filter_var($rssUrl, FILTER_VALIDATE_URL)) {
    echo json_encode(['error' => 'Invalid RSS URL.']);
    exit;
}

// Fetch the RSS feed
try {
    $rssContent = file_get_contents($rssUrl);
    if ($rssContent === false) {
        throw new Exception('Failed to fetch RSS feed.');
    }

    // Parse the RSS feed
    $rssXml = new SimpleXMLElement($rssContent);
    $items = [];
    foreach ($rssXml->channel->item as $item) {
        $items[] = [
            'title' => (string) $item->title,
            'link' => (string) $item->link,
            'description' => strip_tags((string) $item->description), // Add description
            'pubDate' => (string) $item->pubDate, // Add publication date
        ];
    }

    // Return the items as JSON
    echo json_encode(['items' => $items]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
