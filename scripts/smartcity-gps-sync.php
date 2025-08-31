<?php
/**
 * SmartCity GPS Sync Script
 * Ovaj skript se pokreće na legacy serveru kao CRON job
 * i šalje GPS podatke na SmartCity API
 * 
 * CRON setup: */5 * * * * /usr/bin/php /path/to/smartcity-gps-sync.php
 */

// Konfiguracija
$config = [
    'api_url' => 'https://api.smart-city.rs/gps-ingest/batch', // Promeni na produkcijski URL
    'api_key' => 'smartcity_legacy_gps_key_2024',
    'db_host' => '79.101.48.11',
    'db_port' => 3306,
    'db_name' => 'pib100065430gps',
    'db_user' => 'YOUR_DB_USER', // Postavi kredencijale
    'db_pass' => 'YOUR_DB_PASS',
    'batch_size' => 1000, // Broj GPS tačaka po batch-u
    'time_window' => 300, // Poslednih 5 minuta (300 sekundi)
    'log_file' => '/var/log/smartcity-gps-sync.log',
    'debug' => true
];

// Logging funkcija
function logMessage($message, $level = 'INFO') {
    global $config;
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[$timestamp] [$level] $message\n";
    
    if ($config['debug']) {
        echo $logLine;
    }
    
    if ($config['log_file']) {
        file_put_contents($config['log_file'], $logLine, FILE_APPEND);
    }
}

// Početak skripte
logMessage("=== SmartCity GPS Sync Started ===");

try {
    // Konektuj se na legacy bazu
    $dsn = "mysql:host={$config['db_host']};port={$config['db_port']};dbname={$config['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    logMessage("Connected to legacy database");
    
    // Dohvati GPS podatke iz current tabele (poslednih 5 minuta)
    $sql = "
        SELECT 
            garageNo,
            lat,
            lng,
            speed,
            course,
            alt,
            state,
            inroute AS inRoute,
            line_number AS lineNumber,
            direction,
            captured,
            edited,
            people_counter_1_in + people_counter_2_in + people_counter_3_in + people_counter_4_in AS peopleIn,
            people_counter_1_out + people_counter_2_out + people_counter_3_out + people_counter_4_out AS peopleOut,
            battery_status AS batteryStatus
        FROM current
        WHERE captured > DATE_SUB(NOW(), INTERVAL :time_window SECOND)
        AND garageNo IS NOT NULL
        AND lat IS NOT NULL
        AND lng IS NOT NULL
        ORDER BY captured DESC
        LIMIT :batch_size
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'time_window' => $config['time_window'],
        'batch_size' => $config['batch_size']
    ]);
    
    $gpsData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $count = count($gpsData);
    
    logMessage("Found $count GPS points to sync");
    
    if ($count == 0) {
        logMessage("No new GPS data to sync");
        exit(0);
    }
    
    // Pripremi podatke za slanje
    $payload = [
        'data' => array_map(function($row) {
            return [
                'garageNo' => $row['garageNo'],
                'lat' => (float)$row['lat'],
                'lng' => (float)$row['lng'],
                'speed' => (int)$row['speed'],
                'course' => (int)$row['course'],
                'alt' => (int)($row['alt'] ?? 0),
                'state' => (int)($row['state'] ?? 0),
                'inRoute' => (int)($row['inRoute'] ?? 0),
                'lineNumber' => $row['lineNumber'],
                'direction' => $row['direction'] ? (int)$row['direction'] : null,
                'peopleIn' => (int)($row['peopleIn'] ?? 0),
                'peopleOut' => (int)($row['peopleOut'] ?? 0),
                'batteryStatus' => $row['batteryStatus'] ? (int)$row['batteryStatus'] : null,
                'captured' => date('c', strtotime($row['captured'])),
                'edited' => date('c', strtotime($row['edited']))
            ];
        }, $gpsData),
        'source' => 'legacy_cron',
        'timestamp' => date('c')
    ];
    
    // Pošalji podatke na API
    $ch = curl_init($config['api_url']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . $config['api_key']
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false // Za development, u produkciji postaviti na true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception("CURL error: $error");
    }
    
    if ($httpCode !== 200) {
        throw new Exception("API returned HTTP $httpCode: $response");
    }
    
    $result = json_decode($response, true);
    
    if ($result && $result['success']) {
        logMessage("Successfully synced {$result['processed']} GPS points");
        if ($result['failed'] > 0) {
            logMessage("Failed to sync {$result['failed']} GPS points", 'WARNING');
        }
    } else {
        throw new Exception("API error: $response");
    }
    
} catch (Exception $e) {
    logMessage("ERROR: " . $e->getMessage(), 'ERROR');
    exit(1);
}

logMessage("=== SmartCity GPS Sync Completed ===");
exit(0);