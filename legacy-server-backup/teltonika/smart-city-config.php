<?php
/**
 * Smart City GPS Configuration - BEZBEDNI SISTEM
 * Koristi novi GPS Legacy API sa API key autentifikacijom
 * Ažurirano: 03.09.2025
 */

// Production Server (UVEK AKTIVAN)
define('PROD_API_URL', 'http://157.230.119.11/api/gps-legacy/ingest');
define('PROD_API_KEY', 'gps-legacy-key-2025-secure');
define('PROD_ENABLED', true); // Ne menjati - produkcija je uvek aktivna

// Test/Development Server (MOŽE SE UKLJUČITI/ISKLJUČITI)
define('TEST_ENABLED', false); // Promeni na true za slanje na test server
define('TEST_API_URL', 'http://localhost:3010/api/gps-legacy/ingest'); 
define('TEST_API_KEY', 'gps-legacy-key-2025-secure');

// Batch Settings
define('BATCH_SIZE', 200);
define('MAX_RETRIES', 3);
define('RETRY_DELAY', 2); // sekunde

// File Paths
define('GPS_RAW_LOG', '/var/www/teltonika70/smart-city-gps-raw-log.txt');
define('GPS_PROCESSED_LOG', '/var/www/teltonika70/processed_logs/');
define('VEHICLE_FILTER_FILE', '/var/www/teltonika70/smart-city-gps-vehicles.json');
define('ERROR_LOG', '/var/www/teltonika70/smart-city-errors.log');

// Debug Mode
define('DEBUG_MODE', false); // Promeni na true za detaljne logove

/**
 * Funkcija za slanje podataka na novi GPS Legacy API
 */
function sendToSmartCityAPI($data, $serverType = 'prod') {
    $url = ($serverType === 'test') ? TEST_API_URL : PROD_API_URL;
    $apiKey = ($serverType === 'test') ? TEST_API_KEY : PROD_API_KEY;
    
    $headers = [
        'Content-Type: application/json',
        'x-api-key: ' . $apiKey
    ];
    
    $payload = json_encode(['points' => $data]);
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'success' => ($httpCode === 200 || $httpCode === 201),
        'response' => $response,
        'http_code' => $httpCode
    ];
}

/**
 * Log error poruku
 */
function logError($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents(ERROR_LOG, $logMessage, FILE_APPEND);
}

/**
 * Log debug poruku (samo ako je DEBUG_MODE = true)
 */
function logDebug($message) {
    if (DEBUG_MODE) {
        error_log("[DEBUG] $message");
    }
}
