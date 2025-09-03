<?php
/**
 * Smart City GPS Integration Configuration
 * 
 * Ovaj fajl se include-uje u dbcred.inc.php
 * Sadrži sve konfiguracije za Smart City integraciju
 * 
 * Za aktivaciju dodaj u dbcred.inc.php:
 * include_once('/var/www/teltonika60/smartcity_config.inc.php');
 * 
 * Datum: 02.09.2025
 * Autor: Smart City Tim
 */

// ========================================
// ENVIRONMENT SELEKTOR
// ========================================
// Promeni ovu vrednost za različita okruženja
define('SMARTCITY_ENV', 'LOCAL'); // LOCAL | STAGING | PRODUCTION

// ========================================
// API KONFIGURACIJA PO OKRUŽENJU
// ========================================
switch(SMARTCITY_ENV) {
    case 'LOCAL':
        // Lokalni development kroz SSH reverse tunel
        define('SMARTCITY_API_URL', 'http://localhost:3010/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'test-api-key-2024');
        define('SMARTCITY_DEBUG', true);
        define('SMARTCITY_LOG_VERBOSE', true);
        break;
    
    case 'STAGING':
        // Staging server
        define('SMARTCITY_API_URL', 'https://staging.smart-city.rs/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'staging-gps-key-2024'); // TODO: Zameni sa pravim
        define('SMARTCITY_DEBUG', true);
        define('SMARTCITY_LOG_VERBOSE', false);
        break;
    
    case 'PRODUCTION':
        // Production server
        define('SMARTCITY_API_URL', 'https://gsp-admin.smart-city.rs/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'prod-gps-key-secure-2024'); // TODO: Zameni sa pravim
        define('SMARTCITY_DEBUG', false);
        define('SMARTCITY_LOG_VERBOSE', false);
        break;
    
    default:
        // Ako environment nije prepoznat, isključi integraciju
        define('SMARTCITY_API_URL', '');
        define('SMARTCITY_API_KEY', '');
        define('SMARTCITY_DEBUG', false);
        define('SMARTCITY_LOG_VERBOSE', false);
}

// ========================================
// OSNOVNA PODEŠAVANJA
// ========================================

// Da li je integracija omogućena?
define('SMARTCITY_ENABLED', !empty(SMARTCITY_API_URL) && !empty(SMARTCITY_API_KEY));

// Batch podešavanja
define('SMARTCITY_BATCH_SIZE', 50);        // Broj GPS tačaka po batch-u (max 50)
define('SMARTCITY_BATCH_TIMEOUT', 3);      // Timeout za cURL u sekundama
define('SMARTCITY_MAX_RETRIES', 2);        // Broj pokušaja ako slanje ne uspe

// Log podešavanja
define('SMARTCITY_LOG_FILE', '/var/log/smartcity_gps.log');
define('SMARTCITY_LOG_MAX_SIZE', 10485760); // 10MB max veličina log fajla

// Async podešavanja (za buduću upotrebu)
define('SMARTCITY_ASYNC_ENABLED', false);  // Da li koristiti async cURL
define('SMARTCITY_ASYNC_WORKERS', 2);      // Broj async worker-a

// ========================================
// TELTONIKA SPECIFIČNA PODEŠAVANJA
// ========================================

// Lista teltonika instanci koje koriste Smart City integraciju
// Počinjemo samo sa teltonika60 za testiranje
$SMARTCITY_ENABLED_INSTANCES = array(
    'teltonika60' => true,
    'teltonika61' => false,  // Uključiti nakon testiranja
    'teltonika62' => false,
    'teltonika63' => false,
    'teltonika64' => false,
    'teltonika65' => false,
    'teltonika66' => false,
    'teltonika67' => false,
    'teltonika68' => false,
    'teltonika69' => false,
    'teltonika70' => false,
    'teltonika71' => false,
    'teltonika72' => false,
    'teltonika73' => false,
    'teltonika74' => false,
    'teltonika75' => false,
    'teltonika76' => false,
);

// Proveri da li je trenutna instanca omogućena
$current_instance = basename(dirname($_SERVER['SCRIPT_FILENAME'] ?? __DIR__));
define('SMARTCITY_THIS_INSTANCE_ENABLED', 
    SMARTCITY_ENABLED && 
    isset($SMARTCITY_ENABLED_INSTANCES[$current_instance]) && 
    $SMARTCITY_ENABLED_INSTANCES[$current_instance]
);

// ========================================
// FILTRIRANJE VOZILA
// ========================================

/**
 * Režim filtriranja vozila:
 * - 'ALL' = Šalje podatke za SVA vozila
 * - 'WHITELIST' = Šalje SAMO za vozila iz liste
 * - 'BLACKLIST' = Šalje za sva vozila OSIM onih iz liste
 */
define('SMARTCITY_VEHICLE_FILTER_MODE', 'WHITELIST'); // ALL | WHITELIST | BLACKLIST

/**
 * Lista vozila za filtriranje (garažni brojevi)
 * Koristi se samo ako FILTER_MODE nije 'ALL'
 * 
 * Primeri:
 * - Za testiranje sa par vozila: array('P93597', 'P93598', 'P93599')
 * - Za isključivanje problematičnih: postaviti BLACKLIST mode i dodati ih ovde
 */
$SMARTCITY_VEHICLE_LIST = array(
    'P93597',  // Test vozilo 1
    'P93598',  // Test vozilo 2
    // Dodaj još vozila po potrebi
);

/**
 * Funkcija koja proverava da li treba poslati podatke za vozilo
 * 
 * @param string $garageNo - Garažni broj vozila
 * @return bool - true ako treba poslati, false ako ne
 */
function smartcity_should_send_vehicle($garageNo) {
    global $SMARTCITY_VEHICLE_LIST;
    
    // Ako nije omogućena integracija, ne šalji
    if (!SMARTCITY_THIS_INSTANCE_ENABLED) {
        return false;
    }
    
    // Proveri režim filtriranja
    switch (SMARTCITY_VEHICLE_FILTER_MODE) {
        case 'ALL':
            // Šalji za sva vozila
            return true;
            
        case 'WHITELIST':
            // Šalji SAMO ako je vozilo u listi
            return in_array($garageNo, $SMARTCITY_VEHICLE_LIST);
            
        case 'BLACKLIST':
            // Šalji ako vozilo NIJE u listi
            return !in_array($garageNo, $SMARTCITY_VEHICLE_LIST);
            
        default:
            // Ako režim nije prepoznat, ne šalji
            smartcity_log('ERROR', "Unknown filter mode: " . SMARTCITY_VEHICLE_FILTER_MODE);
            return false;
    }
}

// ========================================
// HELPER FUNKCIJE
// ========================================

/**
 * Loguje poruku u Smart City log fajl
 */
function smartcity_log($level, $message) {
    if (!SMARTCITY_DEBUG && $level == 'DEBUG') {
        return;
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $instance = basename(dirname($_SERVER['SCRIPT_FILENAME'] ?? __DIR__));
    $log_message = "[$timestamp] [$instance] [$level] $message\n";
    
    // Rotacija log fajla ako je prevelik
    if (file_exists(SMARTCITY_LOG_FILE) && filesize(SMARTCITY_LOG_FILE) > SMARTCITY_LOG_MAX_SIZE) {
        rename(SMARTCITY_LOG_FILE, SMARTCITY_LOG_FILE . '.' . date('Ymd_His'));
    }
    
    @file_put_contents(SMARTCITY_LOG_FILE, $log_message, FILE_APPEND | LOCK_EX);
}

/**
 * Prikazuje trenutnu konfiguraciju (za debug)
 */
function smartcity_show_config() {
    global $SMARTCITY_VEHICLE_LIST;
    
    echo "\n=== SMART CITY GPS CONFIGURATION ===\n";
    echo "Environment: " . SMARTCITY_ENV . "\n";
    echo "API URL: " . SMARTCITY_API_URL . "\n";
    echo "API Key: " . substr(SMARTCITY_API_KEY, 0, 10) . "***\n";
    echo "Enabled: " . (SMARTCITY_ENABLED ? 'YES' : 'NO') . "\n";
    echo "This Instance: " . (SMARTCITY_THIS_INSTANCE_ENABLED ? 'ENABLED' : 'DISABLED') . "\n";
    echo "Debug: " . (SMARTCITY_DEBUG ? 'ON' : 'OFF') . "\n";
    echo "Batch Size: " . SMARTCITY_BATCH_SIZE . "\n";
    echo "\n--- VEHICLE FILTERING ---\n";
    echo "Filter Mode: " . SMARTCITY_VEHICLE_FILTER_MODE . "\n";
    
    if (SMARTCITY_VEHICLE_FILTER_MODE != 'ALL') {
        echo "Vehicle List (" . count($SMARTCITY_VEHICLE_LIST) . " vehicles):\n";
        foreach ($SMARTCITY_VEHICLE_LIST as $vehicle) {
            echo "  - $vehicle\n";
        }
        
        if (SMARTCITY_VEHICLE_FILTER_MODE == 'WHITELIST') {
            echo "Action: ONLY these vehicles will be sent\n";
        } else if (SMARTCITY_VEHICLE_FILTER_MODE == 'BLACKLIST') {
            echo "Action: These vehicles will be EXCLUDED\n";
        }
    } else {
        echo "Action: ALL vehicles will be sent\n";
    }
    
    echo "=====================================\n\n";
}

// ========================================
// INICIJALIZACIJA
// ========================================

// Log početak integracije
if (SMARTCITY_THIS_INSTANCE_ENABLED && SMARTCITY_LOG_VERBOSE) {
    smartcity_log('INFO', 'Smart City GPS Integration loaded - ENV: ' . SMARTCITY_ENV);
}

// Za CLI testiranje
if (php_sapi_name() === 'cli' && isset($argv[1]) && $argv[1] === 'test') {
    smartcity_show_config();
}
?>