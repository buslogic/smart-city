<?php
/**
 * Smart City GPS Helper Functions
 * 
 * Ovaj fajl sadrži funkcije za slanje GPS podataka na Smart City API
 * Include se u util_teltonika.php
 * 
 * Datum: 02.09.2025
 */

// Globalni buffer za batch slanje
global $smartcity_batch_buffer;
global $smartcity_batch_count;
global $smartcity_stats;

$smartcity_batch_buffer = array();
$smartcity_batch_count = 0;
$smartcity_stats = array(
    'total_sent' => 0,
    'total_failed' => 0,
    'last_send_time' => null,
    'last_error' => null
);

/**
 * Dodaje GPS tačku u batch buffer
 * 
 * @param string $garageNo - Garažni broj vozila (npr. P93597)
 * @param string $timestamp - Vreme GPS tačke
 * @param float $lat - Latitude
 * @param float $lng - Longitude
 * @param int $speed - Brzina
 * @param int $course - Kurs/pravac
 * @param int $alt - Visina
 * @param int $state - Status (0 ili 1)
 * @param int $inRoute - Da li je na ruti
 * @param string $imei - IMEI uređaja (opciono)
 */
function smartcity_add_to_batch($garageNo, $timestamp, $lat, $lng, $speed, $course, $alt, $state, $inRoute, $imei = null) {
    global $smartcity_batch_buffer, $smartcity_batch_count;
    
    // Proveri da li je integracija omogućena
    if (!defined('SMARTCITY_THIS_INSTANCE_ENABLED') || !SMARTCITY_THIS_INSTANCE_ENABLED) {
        return false;
    }
    
    // Proveri da li treba poslati podatke za ovo vozilo
    if (function_exists('smartcity_should_send_vehicle')) {
        if (!smartcity_should_send_vehicle($garageNo)) {
            // Log za debug (samo ako je verbose)
            if (defined('SMARTCITY_LOG_VERBOSE') && SMARTCITY_LOG_VERBOSE) {
                smartcity_log('DEBUG', "Skipping vehicle $garageNo (filtered out)");
            }
            return false;
        }
    }
    
    // Dodaj u buffer
    $smartcity_batch_buffer[] = array(
        'garageNo' => $garageNo,
        'imei' => $imei,
        'timestamp' => $timestamp,
        'lat' => (float)$lat,
        'lng' => (float)$lng,
        'speed' => (int)$speed,
        'course' => (int)$course,
        'altitude' => (int)$alt,
        'state' => (int)$state,
        'inRoute' => (int)$inRoute,
        'satellites' => 0  // Legacy sistem nema ovu informaciju
    );
    
    $smartcity_batch_count++;
    
    // Log za debug
    if (defined('SMARTCITY_LOG_VERBOSE') && SMARTCITY_LOG_VERBOSE) {
        smartcity_log('DEBUG', "Added to batch: $garageNo at $timestamp (buffer: $smartcity_batch_count)");
    }
    
    // Ako je buffer pun, pošalji
    if ($smartcity_batch_count >= SMARTCITY_BATCH_SIZE) {
        return smartcity_send_batch();
    }
    
    return true;
}

/**
 * Šalje batch na Smart City API
 */
function smartcity_send_batch() {
    global $smartcity_batch_buffer, $smartcity_batch_count, $smartcity_stats;
    
    // Ako je buffer prazan, nema šta da se šalje
    if ($smartcity_batch_count == 0) {
        return true;
    }
    
    // Proveri da li je integracija omogućena
    if (!defined('SMARTCITY_THIS_INSTANCE_ENABLED') || !SMARTCITY_THIS_INSTANCE_ENABLED) {
        // Očisti buffer
        $smartcity_batch_buffer = array();
        $smartcity_batch_count = 0;
        return false;
    }
    
    // Pripremi payload
    $payload = array(
        'data' => $smartcity_batch_buffer,
        'source' => 'legacy_teltonika'
    );
    
    // Log početak slanja
    smartcity_log('INFO', "Sending batch of $smartcity_batch_count GPS points to Smart City API");
    
    // Pošalji na API
    $success = smartcity_send_to_api($payload);
    
    if ($success) {
        $smartcity_stats['total_sent'] += $smartcity_batch_count;
        $smartcity_stats['last_send_time'] = date('Y-m-d H:i:s');
        smartcity_log('INFO', "Successfully sent $smartcity_batch_count GPS points");
    } else {
        $smartcity_stats['total_failed'] += $smartcity_batch_count;
        smartcity_log('ERROR', "Failed to send $smartcity_batch_count GPS points");
    }
    
    // Očisti buffer bez obzira na rezultat
    $smartcity_batch_buffer = array();
    $smartcity_batch_count = 0;
    
    return $success;
}

/**
 * Flush - pošalje sve što je ostalo u buffer-u
 */
function smartcity_flush() {
    global $smartcity_batch_count;
    
    if ($smartcity_batch_count > 0) {
        smartcity_log('DEBUG', "Flushing remaining $smartcity_batch_count GPS points");
        return smartcity_send_batch();
    }
    
    return true;
}

/**
 * Slanje na API sa retry logikom
 */
function smartcity_send_to_api($payload) {
    global $smartcity_stats;
    
    if (!defined('SMARTCITY_API_URL') || !defined('SMARTCITY_API_KEY')) {
        return false;
    }
    
    $retries = 0;
    $max_retries = defined('SMARTCITY_MAX_RETRIES') ? SMARTCITY_MAX_RETRIES : 2;
    
    while ($retries <= $max_retries) {
        // Pripremi cURL
        $ch = curl_init(SMARTCITY_API_URL);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/json',
            'X-API-Key: ' . SMARTCITY_API_KEY
        ));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, SMARTCITY_BATCH_TIMEOUT);
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1); // Za timeout < 1000ms
        
        // Pošalji
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        // Proveri rezultat
        if ($http_code == 200) {
            if (defined('SMARTCITY_DEBUG') && SMARTCITY_DEBUG) {
                smartcity_log('DEBUG', "API response: $response");
            }
            return true;
        }
        
        // Log greške
        $error_msg = "API attempt " . ($retries + 1) . " failed - HTTP: $http_code";
        if ($error) {
            $error_msg .= ", Error: $error";
        }
        smartcity_log('WARNING', $error_msg);
        $smartcity_stats['last_error'] = $error_msg;
        
        $retries++;
        
        // Pauza između pokušaja
        if ($retries <= $max_retries) {
            usleep(500000); // 500ms
        }
    }
    
    return false;
}

/**
 * Vraća statistike integracije
 */
function smartcity_get_stats() {
    global $smartcity_stats, $smartcity_batch_count;
    
    $smartcity_stats['current_buffer'] = $smartcity_batch_count;
    return $smartcity_stats;
}

/**
 * Test funkcija
 */
function smartcity_test() {
    echo "\n=== Smart City GPS Helper Test ===\n";
    
    // Proveri konfiguraciju
    if (!defined('SMARTCITY_THIS_INSTANCE_ENABLED')) {
        echo "ERROR: Smart City config not loaded!\n";
        echo "Make sure smartcity_config.inc.php is included.\n";
        return false;
    }
    
    if (!SMARTCITY_THIS_INSTANCE_ENABLED) {
        echo "Smart City integration is DISABLED for this instance.\n";
        return false;
    }
    
    echo "Configuration OK\n";
    echo "API URL: " . SMARTCITY_API_URL . "\n";
    echo "Adding test GPS point...\n";
    
    // Dodaj test tačku
    smartcity_add_to_batch(
        'P93597',
        date('Y-m-d H:i:s'),
        44.8176,
        20.4633,
        45,
        180,
        125,
        1,
        1,
        '860517060123456'
    );
    
    echo "Sending batch...\n";
    $result = smartcity_flush();
    
    if ($result) {
        echo "✅ SUCCESS! Test GPS point sent to Smart City.\n";
    } else {
        echo "❌ FAILED! Check logs for details.\n";
    }
    
    // Prikaži statistike
    $stats = smartcity_get_stats();
    echo "\nStatistics:\n";
    echo "- Total sent: " . $stats['total_sent'] . "\n";
    echo "- Total failed: " . $stats['total_failed'] . "\n";
    echo "- Last send: " . ($stats['last_send_time'] ?? 'Never') . "\n";
    echo "- Last error: " . ($stats['last_error'] ?? 'None') . "\n";
    
    echo "\n=== Test Complete ===\n";
    return $result;
}

// CLI test
if (php_sapi_name() === 'cli' && isset($argv[0]) && basename($argv[0]) == 'smartcity_gps_helper.inc.php') {
    // Učitaj konfiguraciju za test
    if (file_exists(__DIR__ . '/smartcity_config.inc.php')) {
        include_once(__DIR__ . '/smartcity_config.inc.php');
    }
    smartcity_test();
}
?>