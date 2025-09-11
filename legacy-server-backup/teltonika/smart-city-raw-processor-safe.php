<?php
echo "[" . date("Y-m-d H:i:s") . "] Starting processing...\n";
/**
 * Smart City GPS Raw Log Processor - FINAL VERSION
 * NE BRIŠE podatke ako server nije dostupan!
 * Sa retry mehanizmom i ispravnim vehicle ID mapiranjem
 */

// Učitaj konfiguraciju
require_once __DIR__ . '/smart-city-config.php';
echo "[" . date("Y-m-d H:i:s") . "] Starting processing...\n";

// Konstante
define('RAW_LOG_FILE', __DIR__ . '/smart-city-gps-raw-log.txt');
define('PENDING_LOG_FILE', __DIR__ . '/smart-city-gps-pending.txt');
define('VEHICLE_FILTER_FILE', __DIR__ . '/smart-city-gps-vehicles.json');
define('PROCESSED_DIR', __DIR__ . '/processed_logs');
define('FAILED_DIR', __DIR__ . '/failed_logs');
define('BACKUP_DIR', __DIR__ . '/backups');
define('BATCH_SIZE', 200);
define('MAX_LINES_TO_PROCESS', 10000);

// Kreiraj direktorijume ako ne postoje
if (!file_exists(PROCESSED_DIR)) {
    mkdir(PROCESSED_DIR, 0755, true);
}
if (!file_exists(FAILED_DIR)) {
    mkdir(FAILED_DIR, 0755, true);
}

// Učitaj filter vozila (format: {"garageNo": vehicleId, ...})
$vehicleFilter = [];
if (file_exists(VEHICLE_FILTER_FILE)) {
    $vehicleFilter = json_decode(file_get_contents(VEHICLE_FILTER_FILE), true);
    if (!$vehicleFilter) {
        die("Failed to load vehicle filter\n");
    }
    echo "Loaded vehicle filter with " . count($vehicleFilter) . " vehicles\n";
}

// Kreiraj backup direktorijum ako ne postoji
if (!file_exists(BACKUP_DIR)) {
    mkdir(BACKUP_DIR, 0755, true);
}

// === SAFE TRANSACTION START ===

// 1. Učitaj pending podatke od prošlog puta (ako postoje)
$pendingLines = [];
if (file_exists(PENDING_LOG_FILE)) {
    $pendingLines = file(PENDING_LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    echo "Found " . count($pendingLines) . " pending lines from previous run\n";
}

// 2. Učitaj nove podatke iz raw log-a
$newLines = [];
if (file_exists(RAW_LOG_FILE)) {
    $newLines = file(RAW_LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!empty($newLines)) {
        echo "Found " . count($newLines) . " new lines in raw log\n";
        
        // Backup raw log pre bilo kakve operacije
        $backupFile = BACKUP_DIR . '/raw_' . date('YmdHis') . '.txt';
        copy(RAW_LOG_FILE, $backupFile);
        
        // KRITIČNO: Odmah premesti raw u pending da ne izgubimo podatke
        $allPendingLines = array_merge($pendingLines, $newLines);
        file_put_contents(PENDING_LOG_FILE, implode("\n", $allPendingLines) . "\n", LOCK_EX);
        
        // Očisti raw log (podaci su sada sigurni u pending)
        file_put_contents(RAW_LOG_FILE, '', LOCK_EX);
        echo "Moved raw data to pending queue\n";
    }
} else {
    echo "No raw log file to process\n";
}

// 3. Kombinuj sve linije za procesiranje
$allLines = array_merge($pendingLines, $newLines);
if (empty($allLines)) {
    echo "No data to process\n";
    
    // Cleanup old backups (older than 1 day)
    foreach (glob(BACKUP_DIR . '/raw_*.txt') as $oldBackup) {
        if (filemtime($oldBackup) < time() - 1*24*60*60) {
            unlink($oldBackup);
        }
    }
    exit(0);
}

// 4. Limitiraj broj linija za procesiranje (za performance)
$totalLines = count($allLines);
if ($totalLines > MAX_LINES_TO_PROCESS) {
    echo "WARNING: $totalLines lines in queue, processing first " . MAX_LINES_TO_PROCESS . "\n";
    $linesToProcess = array_slice($allLines, 0, MAX_LINES_TO_PROCESS);
    $remainingLines = array_slice($allLines, MAX_LINES_TO_PROCESS);
} else {
    $linesToProcess = $allLines;
    $remainingLines = [];
}

$lines = $linesToProcess;
echo "Processing " . count($lines) . " lines\n";

// Procesiranje
$batch = [];
$batchLines = []; // Track koje linije su u kom batch-u
$processed = 0;
$skipped = 0;
$successfulLines = [];
$failedLines = [];

foreach ($lines as $line) {
    $parts = explode('|', $line);
    
    if (count($parts) < 10) {
        $skipped++;
        continue;
    }
    
    $garageNo = $parts[1];
    
    // Proveri filter - koristi isset() za objekat!
    if (!empty($vehicleFilter) && !isset($vehicleFilter[$garageNo])) {
        $skipped++;
        continue;
    }
    
    // Parsiranje podataka - VAŽNO: vehicleId mora biti INT iz filtera!
    $vehicleId = isset($vehicleFilter[$garageNo]) ? $vehicleFilter[$garageNo] : null;
    
    // Ako nema vehicle ID, preskoči
    if ($vehicleId === null) {
        $skipped++;
        continue;
    }
    
    $point = [
        'vehicleId' => $vehicleId,  // INT iz filtera!
        'garageNo' => $garageNo,     // STRING garage number
        'timestamp' => strtotime($parts[2]), // GPS vreme!
        'lat' => floatval($parts[3]),
        'lng' => floatval($parts[4]),
        'speed' => intval($parts[5]),
        'angle' => intval($parts[6]),
        'altitude' => intval($parts[7]),
        'satellites' => intval($parts[8]),
        'inRoute' => intval($parts[9]),
        'gpsTime' => $parts[2]
    ];
    
    $batch[] = $point;
    $batchLines[] = $line; // Sačuvaj originalnu liniju
    
    // Ako je batch pun, pošalji
    if (count($batch) >= BATCH_SIZE) {
        if (sendBatch($batch)) {
            $processed += count($batch);
            echo "Batch sent successfully (" . count($batch) . " points)\n";
            // Dodaj u uspešne linije
            $successfulLines = array_merge($successfulLines, $batchLines);
        } else {
            echo "Batch failed, will retry in next run\n";
            // Dodaj u neuspešne linije za retry
            $failedLines = array_merge($failedLines, $batchLines);
        }
        $batch = [];
        $batchLines = [];
    }
}

// Pošalji poslednji batch
if (!empty($batch)) {
    if (sendBatch($batch)) {
        $processed += count($batch);
        echo "Batch sent successfully (" . count($batch) . " points)\n";
        $successfulLines = array_merge($successfulLines, $batchLines);
    } else {
        echo "Batch failed, will retry in next run\n";
        $failedLines = array_merge($failedLines, $batchLines);
    }
}

echo "Processed: $processed, Skipped (not in filter): $skipped\n";

// === SAFE TRANSACTION END ===

// 1. Arhiviraj uspešno poslate linije
if (!empty($successfulLines)) {
    $year = date('Y');
    $month = date('m');
    $day = date('d');
    $processedPath = PROCESSED_DIR . "/$year/$month/$day";
    
    if (!file_exists($processedPath)) {
        mkdir($processedPath, 0755, true);
    }
    
    $processedFile = $processedPath . '/smart-city-gps-raw-log.processed_' . date('YmdHis');
    file_put_contents($processedFile, implode("\n", $successfulLines) . "\n");
    
    echo "Archived " . count($successfulLines) . " successful lines to: $processedFile\n";
}

// 2. Sačuvaj neuspešne + preostale linije za sledeći pokušaj
$pendingForNext = array_merge($failedLines, $remainingLines);
if (!empty($pendingForNext)) {
    file_put_contents(PENDING_LOG_FILE, implode("\n", $pendingForNext) . "\n", LOCK_EX);
    echo "Saved " . count($pendingForNext) . " lines for next run ";
    echo "(" . count($failedLines) . " failed, " . count($remainingLines) . " remaining)\n";
} else {
    // Sve je uspešno poslato, obriši pending fajl
    if (file_exists(PENDING_LOG_FILE)) {
        unlink(PENDING_LOG_FILE);
        echo "All data processed successfully, pending queue cleared\n";
    }
}

// 3. Cleanup old backups (older than 1 day)
foreach (glob(BACKUP_DIR . '/raw_*.txt') as $oldBackup) {
    if (filemtime($oldBackup) < time() - 1*24*60*60) {
        unlink($oldBackup);
        echo "Deleted old backup: " . basename($oldBackup) . "\n";
    }
}

/**
 * Pošalji batch podataka sa retry
 */
function sendBatch($data) {
    $maxRetries = 3;
    $retryDelay = 2;
    
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        $success = true;
        
        // Pokušaj poslati na produkciju
        if (PROD_ENABLED) {
            $result = sendToSmartCityAPI($data, 'prod');
            if (!$result['success']) {
                logError('[PRODUCTION] Failed: ' . $result['response']);
                $success = false;
            }
        }
        
        // Pokušaj poslati na test
        if (TEST_ENABLED) {
            $result = sendToSmartCityAPI($data, 'test');
            if (!$result['success']) {
                logError('[TEST] Failed: ' . $result['response']);
                $success = false;
            }
        }
        
        if ($success) {
            return true;
        }
        
        // Retry sa eksponencijalnim backoff
        if ($attempt < $maxRetries) {
            $delay = $retryDelay * pow(2, $attempt - 1);
            echo "Attempt $attempt failed. Retrying in $delay seconds...\n";
            sleep($delay);
        }
    }
    
    echo "Failed to send batch after $maxRetries attempts\n";
    return false;
}

// Funkcija saveFailedBatch više nije potrebna jer koristimo pending queue

// ===== CLEANUP PROCESSED FILES =====

/**
 * Cleanup starih processed fajlova
 * Briše fajlove starije od 1 dana (čuva samo danas i juče)
 */
function cleanupOldProcessedFiles() {
    $daysToKeep = 1;
    $processedDir = PROCESSED_DIR;
    $lockFile = $processedDir . '/.cleanup.lock';
    
    // Proveri lock da izbegnemo preklapanje
    if (file_exists($lockFile)) {
        $lockAge = time() - filemtime($lockFile);
        if ($lockAge < 300) { // Manje od 5 minuta
            echo "[CLEANUP] Already running, skipping\n";
            return;
        }
        // Stari lock, ukloni ga
        @unlink($lockFile);
    }
    
    // Kreiraj lock
    file_put_contents($lockFile, getmypid() . "\n" . date('Y-m-d H:i:s'));
    
    try {
        $cutoffTime = time() - ($daysToKeep * 24 * 60 * 60);
        $deletedCount = 0;
        $deletedSize = 0;
        $keptCount = 0;
        
        echo "[CLEANUP] Starting cleanup for files older than " . date('Y-m-d', $cutoffTime) . "\n";
        
        // Rekurzivno skeniraj processed_logs direktorijum
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($processedDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile() && strpos($file->getFilename(), '.processed') !== false) {
                $filePath = $file->getPathname();
                $fileTime = $file->getMTime();
                
                if ($fileTime < $cutoffTime) {
                    $fileSize = $file->getSize();
                    if (@unlink($filePath)) {
                        $deletedCount++;
                        $deletedSize += $fileSize;
                        
                        // Pokušaj obrisati prazne direktorijume
                        $dir = dirname($filePath);
                        while ($dir != $processedDir && is_dir($dir)) {
                            if (count(scandir($dir)) == 2) { // Samo . i ..
                                @rmdir($dir);
                                $dir = dirname($dir);
                            } else {
                                break;
                            }
                        }
                    }
                } else {
                    $keptCount++;
                }
            }
        }
        
        $deletedSizeMB = round($deletedSize / 1024 / 1024, 2);
        echo "[CLEANUP] Completed: $deletedCount files deleted ({$deletedSizeMB}MB), $keptCount files kept\n";
        
    } catch (Exception $e) {
        echo "[CLEANUP] Error: " . $e->getMessage() . "\n";
    } finally {
        // Ukloni lock
        @unlink($lockFile);
    }
}

/**
 * Proveri da li treba pokrenuti cleanup
 * Pokreće se jednom dnevno ili ako ima previše fajlova
 */
function shouldRunCleanup() {
    $markerFile = PROCESSED_DIR . '/.last_cleanup';
    
    // Proveri kada je poslednji put pokrenut
    if (file_exists($markerFile)) {
        $lastCleanup = filemtime($markerFile);
        $hoursSinceCleanup = (time() - $lastCleanup) / 3600;
        
        // Ako je prošlo manje od 23 sata
        if ($hoursSinceCleanup < 23) {
            // Brza provera broja fajlova
            $fileCount = 0;
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator(PROCESSED_DIR, RecursiveDirectoryIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if ($file->isFile()) $fileCount++;
                if ($fileCount > 1000) break; // Dovoljno za odluku
            }
            
            if ($fileCount <= 1000) {
                return false;
            }
            echo "[CLEANUP] Force cleanup due to high file count (>1000)\n";
        }
    }
    
    // Ažuriraj marker
    touch($markerFile);
    return true;
}

// Pokreni cleanup ako je potrebno
if (shouldRunCleanup()) {
    echo "[CLEANUP] Checking for old processed files...\n";
    cleanupOldProcessedFiles();
} else {
    echo "[CLEANUP] Not needed at this time\n";
}

echo "[" . date("Y-m-d H:i:s") . "] Processing complete.\n";
