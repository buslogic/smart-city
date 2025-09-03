<?php
/**
 * Smart City GPS Raw Data Processor v2
 * Procesira raw GPS log i šalje na produkciju i/ili test server
 */

require_once __DIR__ . '/smart-city-config.php';

// Prikaži konfiguraciju pri pokretanju
show_config_status();

// Učitaj vehicle filter
$vehicle_filter = load_vehicle_filter('production');

if (empty($vehicle_filter)) {
    smart_city_log("No vehicles in filter, exiting", 'ERROR');
    exit(1);
}

smart_city_log("Starting GPS data processing with " . count($vehicle_filter) . " vehicles in filter", 'INFO');

// Proveri da li raw log postoji
if (!file_exists(GPS_RAW_LOG)) {
    smart_city_log("Raw log file does not exist: " . GPS_RAW_LOG, 'ERROR');
    exit(1);
}

// Učitaj raw log
$raw_data = file(GPS_RAW_LOG, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

if (empty($raw_data)) {
    smart_city_log("No data to process", 'INFO');
    exit(0);
}

smart_city_log("Processing " . count($raw_data) . " raw GPS points", 'INFO');

// Grupiši podatke u batch-eve
$batch = ['points' => []];
$processed_count = 0;
$filtered_count = 0;
$sent_count = 0;

foreach ($raw_data as $line) {
    // Format: timestamp|garage_no|gps_time|lat|lng|speed|angle|altitude|in_route|in_route_uid
    $parts = explode('|', $line);
    
    if (count($parts) !== 10) {
        smart_city_log("Invalid line format: $line", 'DEBUG');
        continue;
    }
    
    list($timestamp, $garage_no, $gps_time, $lat, $lng, $speed, $angle, $altitude, $in_route, $in_route_uid) = $parts;
    
    // Proveri da li vozilo postoji u filteru
    if (!isset($vehicle_filter[$garage_no])) {
        smart_city_log("Vehicle $garage_no not in filter, skipping", 'DEBUG');
        $filtered_count++;
        continue;
    }
    
    // Pripremi podatak za slanje
    $point = [
        'vehicleId' => $vehicle_filter[$garage_no],
        'garageNo' => $garage_no,
        'timestamp' => intval($timestamp),
        'gpsTime' => $gps_time,
        'lat' => floatval($lat),
        'lng' => floatval($lng),
        'speed' => intval($speed),
        'angle' => intval($angle),
        'altitude' => intval($altitude),
        'inRoute' => intval($in_route),
        'inRouteUid' => $in_route_uid
    ];
    
    $batch['points'][] = $point;
    $processed_count++;
    
    // Kada dostignemo batch size, pošalji
    if (count($batch['points']) >= BATCH_SIZE) {
        smart_city_log("Sending batch of " . count($batch['points']) . " points", 'INFO');
        
        $results = send_batch_to_servers($batch);
        
        // Proveri rezultate
        $all_success = true;
        foreach ($results as $server => $success) {
            if (!$success && $server === 'production') {
                // Ako produkcija ne uspe, to je kritično
                smart_city_log("Production server failed, will retry", 'ERROR');
                $all_success = false;
            }
        }
        
        if ($all_success || (isset($results['production']) && $results['production'])) {
            $sent_count += count($batch['points']);
            $batch = ['points' => []];
        } else {
            // Retry logic
            smart_city_log("Retrying batch...", 'WARNING');
            sleep(RETRY_DELAY);
            
            // Pokušaj ponovo samo produkciju
            if (PROD_ENABLED) {
                $prod_url = PROD_API_URL . '/gps-processor/process';
                if (send_to_server($prod_url, PROD_API_KEY, $batch, 'PRODUCTION-RETRY')) {
                    $sent_count += count($batch['points']);
                    $batch = ['points' => []];
                } else {
                    smart_city_log("Retry failed, skipping batch", 'ERROR');
                    $batch = ['points' => []];
                }
            }
        }
    }
}

// Pošalji poslednji batch ako postoji
if (!empty($batch['points'])) {
    smart_city_log("Sending final batch of " . count($batch['points']) . " points", 'INFO');
    
    $results = send_batch_to_servers($batch);
    
    if (isset($results['production']) && $results['production']) {
        $sent_count += count($batch['points']);
    }
}

// Arhiviraj obrađeni fajl
if ($sent_count > 0) {
    $archive_dir = GPS_PROCESSED_LOG;
    if (!is_dir($archive_dir)) {
        mkdir($archive_dir, 0755, true);
    }
    
    $archive_file = $archive_dir . date('Y-m-d_H-i-s') . '_processed.txt';
    rename(GPS_RAW_LOG, $archive_file);
    smart_city_log("Archived processed file to: $archive_file", 'INFO');
} else {
    smart_city_log("No data sent, keeping raw log file", 'WARNING');
}

// Finalni izveštaj
echo PHP_EOL . "=== Processing Complete ===" . PHP_EOL;
echo "Total raw points: " . count($raw_data) . PHP_EOL;
echo "Filtered out: $filtered_count" . PHP_EOL;
echo "Processed: $processed_count" . PHP_EOL;
echo "Successfully sent: $sent_count" . PHP_EOL;

if (TEST_ENABLED) {
    echo "Test server: ENABLED (data sent to both servers)" . PHP_EOL;
} else {
    echo "Test server: DISABLED (data sent only to production)" . PHP_EOL;
}

echo "===========================" . PHP_EOL;