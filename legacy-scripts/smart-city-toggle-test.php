#!/usr/bin/php
<?php
/**
 * Smart City - Toggle Test Server
 * Skripta za lako uključivanje/isključivanje test servera
 */

$config_file = '/var/www/teltonika60/smart-city-config.php';

// Proveri argumente
if ($argc < 2) {
    echo "Usage: php smart-city-toggle-test.php [on|off|status|localhost|tunnel]\n";
    echo "  on        - Enable test server\n";
    echo "  off       - Disable test server\n";
    echo "  status    - Show current status\n";
    echo "  localhost - Set test URL to localhost:3010\n";
    echo "  tunnel    - Set test URL to SSH tunnel (localhost:3010)\n";
    exit(1);
}

$action = strtolower($argv[1]);

// Učitaj trenutnu konfiguraciju
if (!file_exists($config_file)) {
    echo "Error: Config file not found at $config_file\n";
    echo "Please copy smart-city-config.php to /var/www/teltonika60/\n";
    exit(1);
}

$config = file_get_contents($config_file);

switch ($action) {
    case 'on':
        // Uključi test server
        $config = preg_replace(
            "/define\('TEST_ENABLED',\s*(true|false)\)/",
            "define('TEST_ENABLED', true)",
            $config
        );
        file_put_contents($config_file, $config);
        echo "✅ Test server ENABLED\n";
        echo "Data will be sent to BOTH production and test servers\n";
        break;
        
    case 'off':
        // Isključi test server
        $config = preg_replace(
            "/define\('TEST_ENABLED',\s*(true|false)\)/",
            "define('TEST_ENABLED', false)",
            $config
        );
        file_put_contents($config_file, $config);
        echo "🔴 Test server DISABLED\n";
        echo "Data will be sent ONLY to production server\n";
        break;
        
    case 'localhost':
        // Postavi URL na localhost
        $config = preg_replace(
            "/define\('TEST_API_URL',\s*'[^']+'\)/",
            "define('TEST_API_URL', 'http://localhost:3010/api')",
            $config
        );
        file_put_contents($config_file, $config);
        echo "📍 Test server URL set to: http://localhost:3010/api\n";
        echo "Make sure SSH tunnel is running:\n";
        echo "  ssh -L 3010:localhost:3010 root@YOUR_DEV_SERVER\n";
        break;
        
    case 'tunnel':
        // Isto kao localhost, samo podsednik za SSH tunnel
        $config = preg_replace(
            "/define\('TEST_API_URL',\s*'[^']+'\)/",
            "define('TEST_API_URL', 'http://localhost:3010/api')",
            $config
        );
        file_put_contents($config_file, $config);
        echo "🔗 Test server URL set to SSH tunnel: http://localhost:3010/api\n";
        echo "Make sure SSH tunnel is running:\n";
        echo "  ssh -L 3010:localhost:3010 root@YOUR_DEV_SERVER\n";
        break;
        
    case 'status':
        // Prikaži trenutni status
        echo "=== Current Configuration ===\n";
        
        // Izvuci TEST_ENABLED status
        if (preg_match("/define\('TEST_ENABLED',\s*(true|false)\)/", $config, $matches)) {
            $test_enabled = $matches[1] === 'true';
            echo "Test Server: " . ($test_enabled ? "✅ ENABLED" : "🔴 DISABLED") . "\n";
        }
        
        // Izvuci TEST_API_URL
        if (preg_match("/define\('TEST_API_URL',\s*'([^']+)'\)/", $config, $matches)) {
            echo "Test URL: " . $matches[1] . "\n";
        }
        
        // Izvuci PROD_API_URL
        if (preg_match("/define\('PROD_API_URL',\s*'([^']+)'\)/", $config, $matches)) {
            echo "Production URL: " . $matches[1] . "\n";
        }
        
        // Proveri da li postoji SSH tunnel
        $tunnel_check = shell_exec("ss -tlnp | grep ':3010' 2>/dev/null");
        if ($tunnel_check) {
            echo "SSH Tunnel: ✅ Active on port 3010\n";
        } else {
            echo "SSH Tunnel: ⚠️  Not detected on port 3010\n";
        }
        
        echo "============================\n";
        break;
        
    default:
        echo "Invalid action: $action\n";
        echo "Use: on, off, status, localhost, or tunnel\n";
        exit(1);
}

// Prikaži trenutni status nakon promene
if ($action !== 'status') {
    echo "\nCurrent status:\n";
    passthru("php $argv[0] status");
}