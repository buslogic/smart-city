<?php
/**
 * Legacy Server API - GPS Dashboard Status
 * 
 * Ovaj script se postavlja na legacy server (79.101.48.11) i omogućava
 * live serveru da dobije informacije o GPS procesima bez SSH konekcija.
 * 
 * URL: http://79.101.48.11/smart-city-dashboard-api.php
 * Method: GET
 * 
 * Response format:
 * {
 *   "screenSessions": [60, 61, 62, ...],
 *   "cronJobs": [60, 61, 62, ...],
 *   "activeConnections": {"60": 5, "61": 8, ...},
 *   "rawLogSizes": {"60": "1.2M", "61": "3.4M", ...},
 *   "timestamp": "2025-09-03T18:30:00Z",
 *   "success": true
 * }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow GET requests
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

    // 1. Proveri aktivne screen sesije
    $screenOutput = shell_exec('screen -ls 2>/dev/null | grep teltonika | grep -oP "teltonika\\K[0-9]+" 2>/dev/null');
    if ($screenOutput) {
        $sessions = array_filter(array_map('intval', explode("\n", trim($screenOutput))));
        $result['screenSessions'] = array_values($sessions);
    }

    // 2. Proveri cron jobove
    $cronOutput = shell_exec('crontab -l 2>/dev/null | grep "smart-city-raw-processor.php" | grep -oP "teltonika\\K[0-9]+" 2>/dev/null');
    if ($cronOutput) {
        $cronJobs = array_filter(array_map('intval', explode("\n", trim($cronOutput))));
        $result['cronJobs'] = array_values($cronJobs);
    }

    // 3. Proveri aktivne GPS konekcije po portovima (60-76)
    $connections = [];
    for ($port = 60; $port <= 76; $port++) {
        $count = intval(trim(shell_exec("ss -tan 2>/dev/null | grep :120{$port} | grep ESTAB | wc -l 2>/dev/null") ?: '0'));
        if ($count > 0) {
            $connections[$port] = $count;
        }
    }
    $result['activeConnections'] = $connections;

    // 4. Proveri veličinu raw log fajlova za teltonika60-64
    $rawLogSizes = [];
    $folders = ['teltonika60', 'teltonika61', 'teltonika62', 'teltonika63', 'teltonika64'];
    
    foreach ($folders as $folder) {
        $filePath = "/var/www/{$folder}/smart-city-gps-raw-log.txt";
        if (file_exists($filePath)) {
            $instance = intval(preg_replace('/[^0-9]/', '', $folder));
            $size = trim(shell_exec("ls -lh '{$filePath}' 2>/dev/null | awk '{print \$5}' 2>/dev/null") ?: '');
            if ($size) {
                $rawLogSizes[$instance] = $size;
            }
        }
    }
    $result['rawLogSizes'] = $rawLogSizes;

    // 5. Dodaj dodatne informacije
    $result['serverInfo'] = [
        'hostname' => gethostname(),
        'loadavg' => sys_getloadavg(),
        'timestamp' => time(),
        'php_version' => PHP_VERSION
    ];

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => date('c')
    ], JSON_PRETTY_PRINT);
}
?>