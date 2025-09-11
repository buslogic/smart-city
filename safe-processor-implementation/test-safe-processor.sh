#!/bin/bash

# Safe Processor Test Script
# Testira razne scenario-e kako bi potvrdio da processor ne gubi podatke

SSH_KEY="~/.ssh/hp-notebook-2025-buslogic"
LEGACY_SERVER="79.101.48.11"
TEST_INSTANCE="teltonika60"
TEST_PATH="/var/www/$TEST_INSTANCE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

function print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

function print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

function print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    exit 1
}

# Test 1: Basic functionality
function test_basic() {
    print_test "Test 1: Basic processing"
    
    # Create test data
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER << 'EOF'
        cd /var/www/teltonika60
        
        # Backup current files
        cp smart-city-gps-raw-log.txt smart-city-gps-raw-log.txt.test-backup 2>/dev/null
        cp smart-city-gps-pending.txt smart-city-gps-pending.txt.test-backup 2>/dev/null
        
        # Create small test data (10 lines)
        for i in {1..10}; do
            echo "$(date +%s)|P93597|2025-09-11 10:00:$i|44.815|20.462|50|180|100|10|1" >> smart-city-gps-raw-log.txt
        done
        
        # Run processor
        php smart-city-raw-processor-safe.php
        
        # Check results
        if [ -f smart-city-gps-pending.txt ]; then
            echo "ERROR: Pending file exists after successful processing"
            exit 1
        fi
        
        if [ -s smart-city-gps-raw-log.txt ]; then
            echo "ERROR: Raw log not cleared"
            exit 1
        fi
        
        # Check if data was archived
        if ! find processed_logs -name "*.processed_*" -mmin -1 | grep -q .; then
            echo "ERROR: No processed files found"
            exit 1
        fi
        
        echo "SUCCESS: Basic processing works"
EOF
    
    [ $? -eq 0 ] && print_pass "Basic processing" || print_fail "Basic processing"
}

# Test 2: Server failure simulation
function test_server_failure() {
    print_test "Test 2: Server failure handling"
    
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER << 'EOF'
        cd /var/www/teltonika60
        
        # Create test data
        for i in {1..20}; do
            echo "$(date +%s)|P93598|2025-09-11 10:01:$i|44.815|20.462|50|180|100|10|1" >> smart-city-gps-raw-log.txt
        done
        
        # Temporarily break the server URL in config
        cp smart-city-config.php smart-city-config.php.test-backup
        sed -i "s/157.230.119.11/127.0.0.1/" smart-city-config.php
        
        # Run processor (should fail to send)
        php smart-city-raw-processor-safe.php
        
        # Check if data is in pending
        if [ ! -f smart-city-gps-pending.txt ]; then
            echo "ERROR: No pending file created"
            exit 1
        fi
        
        pending_count=$(wc -l < smart-city-gps-pending.txt)
        if [ "$pending_count" -ne "20" ]; then
            echo "ERROR: Expected 20 lines in pending, got $pending_count"
            exit 1
        fi
        
        # Restore config
        mv smart-city-config.php.test-backup smart-city-config.php
        
        # Run processor again (should process pending)
        php smart-city-raw-processor-safe.php
        
        # Check if pending is cleared
        if [ -f smart-city-gps-pending.txt ]; then
            echo "ERROR: Pending not cleared after successful send"
            exit 1
        fi
        
        echo "SUCCESS: Server failure handling works"
EOF
    
    [ $? -eq 0 ] && print_pass "Server failure handling" || print_fail "Server failure handling"
}

# Test 3: Large batch processing
function test_large_batch() {
    print_test "Test 3: Large batch (15000 lines)"
    
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER << 'EOF'
        cd /var/www/teltonika60
        
        # Create large test data
        for i in {1..15000}; do
            echo "$(date +%s)|P93599|2025-09-11 10:02:00|44.815|20.462|50|180|100|10|1" >> smart-city-gps-raw-log.txt
        done
        
        # Run processor
        timeout 30 php smart-city-raw-processor-safe.php
        
        # Check if limited to 10000
        if [ -f smart-city-gps-pending.txt ]; then
            remaining=$(wc -l < smart-city-gps-pending.txt)
            if [ "$remaining" -lt "5000" ]; then
                echo "ERROR: Too few lines remaining in pending"
                exit 1
            fi
            echo "INFO: $remaining lines in pending (expected ~5000)"
        fi
        
        # Run again to process remaining
        timeout 30 php smart-city-raw-processor-safe.php
        
        echo "SUCCESS: Large batch handling works"
EOF
    
    [ $? -eq 0 ] && print_pass "Large batch processing" || print_fail "Large batch processing"
}

# Test 4: Concurrent execution
function test_concurrent() {
    print_test "Test 4: Concurrent execution safety"
    
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER << 'EOF'
        cd /var/www/teltonika60
        
        # Create test data
        for i in {1..100}; do
            echo "$(date +%s)|P93600|2025-09-11 10:03:$i|44.815|20.462|50|180|100|10|1" >> smart-city-gps-raw-log.txt
        done
        
        # Run two processors concurrently
        php smart-city-raw-processor-safe.php &
        PID1=$!
        sleep 0.5
        php smart-city-raw-processor-safe.php &
        PID2=$!
        
        # Wait for both
        wait $PID1
        wait $PID2
        
        # Check for data integrity
        if [ -s smart-city-gps-raw-log.txt ]; then
            echo "ERROR: Raw log not cleared"
            exit 1
        fi
        
        echo "SUCCESS: Concurrent execution safe"
EOF
    
    [ $? -eq 0 ] && print_pass "Concurrent execution" || print_fail "Concurrent execution"
}

# Test 5: Cleanup test
function test_cleanup() {
    print_test "Test 5: Cleanup functionality"
    
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER << 'EOF'
        cd /var/www/teltonika60
        
        # Create old processed file (3 days old)
        old_dir="processed_logs/2025/09/08"
        mkdir -p $old_dir
        touch -d "3 days ago" $old_dir/smart-city-gps-raw-log.processed_20250908120000
        
        # Force cleanup
        rm -f processed_logs/.last_cleanup
        
        # Run processor (should trigger cleanup)
        php smart-city-raw-processor-safe.php
        
        # Check if old file was deleted
        if [ -f $old_dir/smart-city-gps-raw-log.processed_20250908120000 ]; then
            echo "ERROR: Old file not deleted"
            exit 1
        fi
        
        echo "SUCCESS: Cleanup works"
EOF
    
    [ $? -eq 0 ] && print_pass "Cleanup functionality" || print_fail "Cleanup functionality"
}

# Cleanup after tests
function cleanup_test_data() {
    print_test "Cleaning up test data"
    
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER << 'EOF'
        cd /var/www/teltonika60
        
        # Restore backups if they exist
        [ -f smart-city-gps-raw-log.txt.test-backup ] && mv smart-city-gps-raw-log.txt.test-backup smart-city-gps-raw-log.txt
        [ -f smart-city-gps-pending.txt.test-backup ] && mv smart-city-gps-pending.txt.test-backup smart-city-gps-pending.txt
        
        # Clear test data
        > smart-city-gps-raw-log.txt
        rm -f smart-city-gps-pending.txt
        
        echo "Test cleanup completed"
EOF
}

# Main execution
echo "=== SAFE PROCESSOR TEST SUITE ==="
echo "Testing on: $TEST_INSTANCE"
echo ""

# Check if safe processor is deployed
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER \
    "test -f $TEST_PATH/smart-city-raw-processor-safe.php" 2>/dev/null

if [ $? -ne 0 ]; then
    print_fail "Safe processor not deployed on $TEST_INSTANCE"
fi

# Run tests
test_basic
test_server_failure
test_large_batch
test_concurrent
test_cleanup

# Cleanup
cleanup_test_data

echo ""
echo -e "${GREEN}=== ALL TESTS PASSED ===${NC}"
echo "Safe processor is ready for deployment!"