<?php
/**
 * Legacy Server API - GPS Dashboard Status (FIXED VERSION)
 * 
 * Postavi na: http://79.101.48.11/teltonika60/smart-city-dashboard-api.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

try {
    $result = [
        'screenSessions' => [],
        'cronJobs' => [],
        'activeConnections' => [],
        'rawLogSizes' => [],
        'timestamp' => date('c'),
        'success' => true
    ];

    // 1. Screen sesije - jednostavniji regex
    $screenCmd = 'screen -ls 2>/dev/null | grep teltonika';
    $screenOutput = shell_exec($screenCmd);
    if ($screenOutput) {
        preg_match_all('/teltonika(\d+)/', $screenOutput, $matches);
        if (!empty($matches[1])) {
            $result['screenSessions'] = array_map('intval', $matches[1]);
        }
    }

    // 2. Cron jobovi
    $cronCmd = 'crontab -l 2>/dev/null | grep smart-city-raw-processor.php';
    $cronOutput = shell_exec($cronCmd);
    if ($cronOutput) {
        preg_match_all('/teltonika(\d+)/', $cronOutput, $matches);
        if (!empty($matches[1])) {
            $result['cronJobs'] = array_map('intval', $matches[1]);
        }
    }

    // 3. Aktivne konekcije
    $connections = [];
    for ($port = 60; $port <= 76; $port++) {
        $cmd = "ss -tan 2>/dev/null | grep :120{$port} | grep ESTAB | wc -l";
        $count = intval(trim(shell_exec($cmd)));
        if ($count > 0) {
            $connections[$port] = $count;
        }
    }
    $result['activeConnections'] = $connections;

    // 4. Raw log sizes
    $rawLogSizes = [];
    $folders = ['teltonika60', 'teltonika61', 'teltonika62', 'teltonika63', 'teltonika64'];
    foreach ($folders as $folder) {
        $filePath = "/var/www/{$folder}/smart-city-gps-raw-log.txt";
        if (file_exists($filePath)) {
            $instance = intval(str_replace('teltonika', '', $folder));
            $size = trim(shell_exec("ls -lh '$filePath' 2>/dev/null | awk '{print \$5}'"));
            if ($size) {
                $rawLogSizes[$instance] = $size;
            }
        }
    }
    $result['rawLogSizes'] = $rawLogSizes;

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => date('c')
    ]);
}
?>