<?php
/**
 * Smart City GPS Integration - Modified util_teltonika.php
 * 
 * VAŽNO: Ovo je modifikovana verzija util_teltonika.php sa Smart City integracijom
 * Pre produkcijske upotrebe:
 * 1. Backup originalni util_teltonika.php
 * 2. Testiraj sa jednom instancom (teltonika60)
 * 3. Monitor 1 sat
 * 4. Postupno uključi ostale instance
 * 
 * Dodato: 02.09.2025
 * Autor: Smart City Tim
 */

// ========================================
// SMART CITY KONFIGURACIJA - POČETAK
// ========================================

// Environment konfiguracija - promeni prema potrebi
define('SMARTCITY_ENV', 'LOCAL'); // LOCAL | STAGING | PRODUCTION

// API URL-ovi za različita okruženja
switch(SMARTCITY_ENV) {
    case 'LOCAL':
        // Za lokalni development kroz SSH tunel
        define('SMARTCITY_API_URL', 'http://localhost:3010/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'test-api-key-2024');
        define('SMARTCITY_DEBUG', true);
        break;
    
    case 'STAGING':
        define('SMARTCITY_API_URL', 'https://staging.smart-city.rs/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'staging-api-key-2024');
        define('SMARTCITY_DEBUG', true);
        break;
    
    case 'PRODUCTION':
        define('SMARTCITY_API_URL', 'https://gsp-admin.smart-city.rs/api/gps-ingest/batch');
        define('SMARTCITY_API_KEY', 'production-api-key-2024'); // TODO: Zameni sa pravim ključem
        define('SMARTCITY_DEBUG', false);
        break;
    
    default:
        // Ako nije definisano, isključi integraciju
        define('SMARTCITY_API_URL', '');
        define('SMARTCITY_API_KEY', '');
        define('SMARTCITY_DEBUG', false);
}

// Da li je integracija omogućena?
define('SMARTCITY_ENABLED', !empty(SMARTCITY_API_URL) && !empty(SMARTCITY_API_KEY));

// Batch konfiguracija
define('SMARTCITY_BATCH_SIZE', 50);      // Maksimalan broj GPS tačaka po batch-u
define('SMARTCITY_BATCH_TIMEOUT', 5);    // Timeout za cURL u sekundama
define('SMARTCITY_MAX_RETRIES', 2);      // Broj pokušaja ako slanje ne uspe

// Log fajl za Smart City integraciju
define('SMARTCITY_LOG_FILE', '/var/log/smartcity_gps.log');

/**
 * Smart City GPS Batch Handler
 * Klasa za batch slanje GPS podataka na Smart City API
 */
class SmartCityGPSHandler {
    private $batch_buffer = [];
    private $batch_count = 0;
    private $total_sent = 0;
    private $total_failed = 0;
    
    /**
     * Dodaje GPS tačku u batch buffer
     */
    public function addToBatch($garageNo, $timestamp, $lat, $lng, $speed, $course, $alt, $state, $inRoute, $imei = null) {
        $this->batch_buffer[] = [
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
        ];
        
        $this->batch_count++;
        
        // Ako je batch pun, pošalji
        if ($this->batch_count >= SMARTCITY_BATCH_SIZE) {
            $this->sendBatch();
        }
    }
    
    /**
     * Šalje batch na Smart City API
     */
    public function sendBatch() {
        if (empty($this->batch_buffer)) {
            return true;
        }
        
        if (!SMARTCITY_ENABLED) {
            $this->batch_buffer = [];
            $this->batch_count = 0;
            return false;
        }
        
        $payload = [
            'data' => $this->batch_buffer,
            'source' => 'legacy_teltonika'
        ];
        
        $success = $this->sendToAPI($payload);
        
        if ($success) {
            $this->total_sent += $this->batch_count;
            $this->logDebug("Batch poslat: {$this->batch_count} GPS tačaka");
        } else {
            $this->total_failed += $this->batch_count;
            $this->logError("Batch slanje neuspešno: {$this->batch_count} GPS tačaka");
        }
        
        // Očisti buffer bez obzira na rezultat
        $this->batch_buffer = [];
        $this->batch_count = 0;
        
        return $success;
    }
    
    /**
     * Flush - pošalji sve što je ostalo u buffer-u
     */
    public function flush() {
        if ($this->batch_count > 0) {
            $this->sendBatch();
        }
        
        if (SMARTCITY_DEBUG) {
            $this->logDebug("Flush završen. Ukupno poslato: {$this->total_sent}, Neuspešno: {$this->total_failed}");
        }
    }
    
    /**
     * Slanje na API sa retry logikom
     */
    private function sendToAPI($payload) {
        $retries = 0;
        
        while ($retries <= SMARTCITY_MAX_RETRIES) {
            $ch = curl_init(SMARTCITY_API_URL);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'X-API-Key: ' . SMARTCITY_API_KEY
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, SMARTCITY_BATCH_TIMEOUT);
            curl_setopt($ch, CURLOPT_NOSIGNAL, 1); // Za timeout < 1000ms
            
            $response = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            
            if ($http_code == 200) {
                return true;
            }
            
            if (SMARTCITY_DEBUG) {
                $this->logDebug("API pokušaj " . ($retries + 1) . " - HTTP: $http_code, Error: $error");
            }
            
            $retries++;
            
            if ($retries <= SMARTCITY_MAX_RETRIES) {
                usleep(500000); // 500ms pauza između pokušaja
            }
        }
        
        return false;
    }
    
    /**
     * Logovanje za debug
     */
    private function logDebug($message) {
        if (SMARTCITY_DEBUG) {
            $this->writeLog("[DEBUG]", $message);
        }
    }
    
    /**
     * Logovanje grešaka
     */
    private function logError($message) {
        $this->writeLog("[ERROR]", $message);
    }
    
    /**
     * Pisanje u log fajl
     */
    private function writeLog($level, $message) {
        $timestamp = date('Y-m-d H:i:s');
        $log_message = "$timestamp $level $message\n";
        
        // Pokušaj pisanja u log fajl
        @file_put_contents(SMARTCITY_LOG_FILE, $log_message, FILE_APPEND | LOCK_EX);
    }
}

// ========================================
// SMART CITY KONFIGURACIJA - KRAJ
// ========================================

// ========================================
// ORIGINALNI util_teltonika KOD - POČETAK
// ========================================

// NAPOMENA: Ovde bi bio kompletan originalni kod util_teltonika.php klase
// Za testiranje, samo ćemo simulirati saveRows funkciju

class util_teltonika {
    
    private $mysqli_link_gps;
    private $garage_no;
    private $track_speed = true;
    private $speed_limit = 60;
    private $smartcity_handler; // Smart City handler instanca
    
    public function __construct() {
        // Inicijalizuj Smart City handler
        if (SMARTCITY_ENABLED) {
            $this->smartcity_handler = new SmartCityGPSHandler();
        }
    }
    
    /**
     * MODIFIKOVANA saveRows funkcija sa Smart City integracijom
     * Ovo je samo relevantni deo oko linije 433
     */
    public function saveRows($data_array, $imei) {
        // ... postojeći kod do linije 433 ...
        
        $counter = 0;
        
        foreach ($data_array as $one_row) {
            // ... postojeći kod za proveru stanica i ruta ...
            $in_range = 0;
            $in_range_uid = 0;
            
            // ORIGINALNI INSERT (linija 433)
            $q = "INSERT INTO `".$this->garage_no."gps` SET captured='".$one_row['timestamp']."',lat='".$one_row['latitude']."',lng='".$one_row['longitude']."',course='".$one_row['angle']."',speed='".$one_row['speed']."',alt='".$one_row['altitude']."',`inroute`='".$in_range_uid."',`state`='".$in_range."'";
            
            $result = mysqli_query($this->mysqli_link_gps, $q);
            
            if ($result) {
                $counter++;
                
                // ========================================
                // SMART CITY INTEGRACIJA - DODATO
                // ========================================
                if (SMARTCITY_ENABLED && $this->smartcity_handler) {
                    try {
                        $this->smartcity_handler->addToBatch(
                            $this->garage_no,
                            $one_row['timestamp'],
                            $one_row['latitude'],
                            $one_row['longitude'],
                            $one_row['speed'],
                            $one_row['angle'],
                            $one_row['altitude'],
                            $in_range,
                            $in_range_uid,
                            $imei
                        );
                    } catch (Exception $e) {
                        // Ne prekidaj rad ako Smart City integracija ne radi
                        if (SMARTCITY_DEBUG) {
                            error_log("Smart City GPS Error: " . $e->getMessage());
                        }
                    }
                }
                // ========================================
                // KRAJ SMART CITY INTEGRACIJE
                // ========================================
                
            } else {
                $error = mysqli_error($this->mysqli_link_gps);
                if (substr($error, 0, 9) == 'Duplicate') {
                    $counter++;
                }
            }
            
            // ... ostatak postojećeg koda ...
        }
        
        // ========================================
        // SMART CITY FLUSH - DODATO
        // ========================================
        // Na kraju saveRows funkcije, pošalji sve što je ostalo u buffer-u
        if (SMARTCITY_ENABLED && $this->smartcity_handler) {
            try {
                $this->smartcity_handler->flush();
            } catch (Exception $e) {
                if (SMARTCITY_DEBUG) {
                    error_log("Smart City GPS Flush Error: " . $e->getMessage());
                }
            }
        }
        // ========================================
        
        return $counter;
    }
    
    // ... ostatak postojećih funkcija ...
}

// ========================================
// TEST SKRIPTA (samo za testiranje)
// ========================================
if (php_sapi_name() === 'cli' && isset($argv[1]) && $argv[1] === 'test') {
    echo "\n=== Smart City GPS Integration Test ===\n";
    echo "Environment: " . SMARTCITY_ENV . "\n";
    echo "API URL: " . SMARTCITY_API_URL . "\n";
    echo "API Key: " . SMARTCITY_API_KEY . "\n";
    echo "Enabled: " . (SMARTCITY_ENABLED ? 'DA' : 'NE') . "\n";
    echo "Debug: " . (SMARTCITY_DEBUG ? 'DA' : 'NE') . "\n";
    echo "Batch Size: " . SMARTCITY_BATCH_SIZE . "\n\n";
    
    if (SMARTCITY_ENABLED) {
        echo "Testiram slanje test podataka...\n";
        
        $handler = new SmartCityGPSHandler();
        
        // Dodaj test podatke
        $handler->addToBatch(
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
        
        // Pošalji
        $handler->flush();
        
        echo "Test završen. Proveri logove.\n";
    } else {
        echo "Smart City integracija je ISKLJUČENA.\n";
    }
    
    echo "\n";
}
?>