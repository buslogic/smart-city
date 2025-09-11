#!/usr/bin/php
<?php
/**
 * Sync Vehicle Filter - Smart City
 * Preuzima listu vozila sa backend-a i pravi filter fajl
 * Created: 03.09.2025
 */

// Konfiguracija
$BACKEND_URL = 'http://localhost:3010/api/vehicles-gps/export';
$FILTER_FILE = __DIR__ . '/smart-city-gps-vehicles.json';
$LOG_FILE = '/var/log/vehicle_filter_sync.log';

// Funkcija za logovanje
function logMessage($message) {
    global $LOG_FILE;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($LOG_FILE, "[$timestamp] $message\n", FILE_APPEND);
}

// Preuzmi listu sa backend-a
function fetchVehicleList($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: gps-sync-key-2025'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception("CURL error: $error");
    }
    
    if ($httpCode !== 200) {
        throw new Exception("HTTP error: $httpCode");
    }
    
    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON decode error: " . json_last_error_msg());
    }
    
    return $data;
}

// Main
try {
    logMessage("Starting vehicle filter sync...");
    
    // Preuzmi listu
    $vehicles = fetchVehicleList($BACKEND_URL);
    logMessage("Fetched " . count($vehicles) . " vehicles from backend");
    
    // Kreiraj filter mapu
    $filterMap = [];
    foreach ($vehicles as $vehicle) {
        if (isset($vehicle['id']) && isset($vehicle['garageNumber'])) {
            $filterMap[$vehicle['garageNumber']] = $vehicle['id'];
        }
    }
    
    // Sačuvaj filter
    $json = json_encode($filterMap, JSON_PRETTY_PRINT);
    file_put_contents($FILTER_FILE, $json);
    logMessage("Saved filter with " . count($filterMap) . " vehicles to $FILTER_FILE");
    
    // Proveri da li processor radi
    $processPid = trim(shell_exec("pgrep -f 'gps_raw_processor.php' 2>/dev/null"));
    if ($processPid) {
        logMessage("GPS processor is running (PID: $processPid)");
    }
    
    echo "Vehicle filter synced successfully: " . count($filterMap) . " vehicles\n";
    exit(0);
    
} catch (Exception $e) {
    logMessage("ERROR: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
