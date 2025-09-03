<?php
/**
 * Smart City GPS Configuration
 * Omogućava slanje podataka na produkciju i/ili test server
 */

// Production Server (UVEK AKTIVAN)
define('PROD_API_URL', 'http://157.230.119.11/api');
define('PROD_API_KEY', 'gps-legacy-key-2025-secure');
define('PROD_ENABLED', true); // Ne menjati - produkcija je uvek aktivna

// Test/Development Server (MOŽE SE UKLJUČITI/ISKLJUČITI)
define('TEST_ENABLED', false); // Promeni na true za slanje na test server
define('TEST_API_URL', 'http://localhost:3010/api'); // Lokalni tunel ili drugi test server
define('TEST_API_KEY', 'gps-legacy-key-2025-secure');

// Batch Settings
define('BATCH_SIZE', 200);
define('MAX_RETRIES', 3);
define('RETRY_DELAY', 2); // sekunde

// File Paths
define('GPS_RAW_LOG', '/var/www/teltonika60/smart-city-gps-raw-log.txt');
define('GPS_PROCESSED_LOG', '/var/www/teltonika60/smart-city-processed/');
define('VEHICLE_FILTER_FILE', '/var/www/teltonika60/smart-city-gps-vehicles.json');
define('ERROR_LOG', '/var/www/teltonika60/smart-city-errors.log');

// Debug Mode
define('DEBUG_MODE', false); // Promeni na true za detaljne logove

/**
 * Helper funkcija za logovanje
 */
function smart_city_log($message, $type = 'INFO') {
    if (!DEBUG_MODE && $type === 'DEBUG') {
        return;
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $log_message = "[$timestamp] [$type] $message" . PHP_EOL;
    
    if ($type === 'ERROR') {
        error_log($log_message, 3, ERROR_LOG);
    }
    
    if (DEBUG_MODE || $type !== 'DEBUG') {
        echo $log_message;
    }
}

/**
 * Funkcija za slanje podataka na server
 * @param string $url - API endpoint
 * @param string $api_key - API key
 * @param array $data - Podaci za slanje
 * @param string $server_name - Ime servera za logovanje
 * @return bool
 */
function send_to_server($url, $api_key, $data, $server_name = 'SERVER') {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-API-Key: ' . $api_key
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        smart_city_log("[$server_name] CURL error: $error", 'ERROR');
        return false;
    }
    
    if ($http_code !== 200 && $http_code !== 201) {
        smart_city_log("[$server_name] HTTP error $http_code: $response", 'ERROR');
        return false;
    }
    
    smart_city_log("[$server_name] Successfully sent " . count($data['points']) . " points", 'INFO');
    return true;
}

/**
 * Funkcija za slanje batch podataka na sve aktivne servere
 * @param array $batch - Batch GPS podataka
 * @return array - Status za svaki server
 */
function send_batch_to_servers($batch) {
    $results = [];
    
    // Uvek šalji na produkciju
    if (PROD_ENABLED) {
        $prod_url = PROD_API_URL . '/gps-legacy/ingest';
        $results['production'] = send_to_server($prod_url, PROD_API_KEY, $batch, 'PRODUCTION');
    }
    
    // Opciono šalji na test server
    if (TEST_ENABLED) {
        $test_url = TEST_API_URL . '/gps-legacy/ingest';
        $results['test'] = send_to_server($test_url, TEST_API_KEY, $batch, 'TEST');
        
        if (!$results['test']) {
            smart_city_log("Test server failed but continuing with production", 'WARNING');
        }
    }
    
    return $results;
}

/**
 * Funkcija za učitavanje vehicle filtera
 * @param string $source - 'production' ili 'test'
 * @return array
 */
function load_vehicle_filter($source = 'production') {
    // Ako je TEST_ENABLED, možemo birati odakle učitavamo filter
    if (TEST_ENABLED && $source === 'test') {
        $url = TEST_API_URL . '/vehicles-gps/export';
        $api_key = TEST_API_KEY;
        smart_city_log("Loading vehicle filter from TEST server", 'INFO');
    } else {
        $url = PROD_API_URL . '/vehicles-gps/export';
        $api_key = PROD_API_KEY;
        smart_city_log("Loading vehicle filter from PRODUCTION server", 'INFO');
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-API-Key: ' . $api_key
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code === 200) {
        $vehicles = json_decode($response, true);
        if ($vehicles) {
            // Kreiraj mapu garageNumber => id
            $filter = [];
            foreach ($vehicles as $vehicle) {
                if (isset($vehicle['garageNumber']) && isset($vehicle['id'])) {
                    $filter[$vehicle['garageNumber']] = $vehicle['id'];
                }
            }
            
            // Sačuvaj u fajl
            file_put_contents(VEHICLE_FILTER_FILE, json_encode($filter, JSON_PRETTY_PRINT));
            smart_city_log("Loaded " . count($filter) . " vehicles to filter", 'INFO');
            return $filter;
        }
    }
    
    // Ako ne uspe, učitaj iz fajla
    if (file_exists(VEHICLE_FILTER_FILE)) {
        $filter = json_decode(file_get_contents(VEHICLE_FILTER_FILE), true);
        smart_city_log("Loaded " . count($filter) . " vehicles from cache file", 'WARNING');
        return $filter;
    }
    
    return [];
}

/**
 * Status funkcija - prikazuje trenutnu konfiguraciju
 */
function show_config_status() {
    echo "=== Smart City GPS Configuration Status ===" . PHP_EOL;
    echo "Production Server: " . (PROD_ENABLED ? "ENABLED" : "DISABLED") . PHP_EOL;
    echo "  URL: " . PROD_API_URL . PHP_EOL;
    echo "Test Server: " . (TEST_ENABLED ? "ENABLED" : "DISABLED") . PHP_EOL;
    echo "  URL: " . TEST_API_URL . PHP_EOL;
    echo "Batch Size: " . BATCH_SIZE . PHP_EOL;
    echo "Debug Mode: " . (DEBUG_MODE ? "ON" : "OFF") . PHP_EOL;
    echo "==========================================" . PHP_EOL;
}

// Ako se poziva direktno, prikaži status
if (php_sapi_name() === 'cli' && basename($_SERVER['PHP_SELF']) === basename(__FILE__)) {
    show_config_status();
}