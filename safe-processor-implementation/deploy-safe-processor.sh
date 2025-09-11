#!/bin/bash

# Safe Processor Deployment Script
# Usage: ./deploy-safe-processor.sh [test|stage1|stage2|stage3|all|rollback]

SSH_KEY="~/.ssh/hp-notebook-2025-buslogic"
LEGACY_SERVER="79.101.48.11"
SCRIPT_NAME="smart-city-raw-processor-safe.php"
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_status() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

function print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

function backup_instance() {
    local instance=$1
    print_status "Backing up teltonika$instance..."
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER \
        "cp /var/www/teltonika$instance/smart-city-raw-processor.php /var/www/teltonika$instance/smart-city-raw-processor.php.backup-safe-$BACKUP_DATE 2>/dev/null" 2>/dev/null
}

function deploy_instance() {
    local instance=$1
    print_status "Deploying to teltonika$instance..."
    
    # Upload new processor
    scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY \
        $SCRIPT_NAME root@$LEGACY_SERVER:/var/www/teltonika$instance/smart-city-raw-processor.php 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_status "✓ Deployed to teltonika$instance"
    else
        print_error "✗ Failed to deploy to teltonika$instance"
        return 1
    fi
}

function test_instance() {
    local instance=$1
    print_status "Testing teltonika$instance..."
    
    # Run processor once
    output=$(ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER \
        "cd /var/www/teltonika$instance && timeout 10 php smart-city-raw-processor.php 2>&1 | tail -5" 2>/dev/null)
    
    # Check for errors
    if echo "$output" | grep -q "error\|Error\|ERROR\|Fatal"; then
        print_error "Test failed for teltonika$instance:"
        echo "$output"
        return 1
    else
        print_status "✓ Test passed for teltonika$instance"
        return 0
    fi
}

function check_pending_queue() {
    local instance=$1
    pending=$(ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER \
        "wc -l /var/www/teltonika$instance/smart-city-gps-pending.txt 2>/dev/null | cut -d' ' -f1" 2>/dev/null)
    
    if [ -z "$pending" ] || [ "$pending" = "0" ]; then
        echo "No pending data"
    else
        echo "$pending lines in pending queue"
    fi
}

function rollback_instance() {
    local instance=$1
    print_status "Rolling back teltonika$instance..."
    
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER \
        "cp /var/www/teltonika$instance/smart-city-raw-processor.php.backup-safe-$BACKUP_DATE /var/www/teltonika$instance/smart-city-raw-processor.php 2>/dev/null" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_status "✓ Rolled back teltonika$instance"
    else
        # Try older backup
        ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY root@$LEGACY_SERVER \
            "cp /var/www/teltonika$instance/smart-city-raw-processor.php.backup-20250911 /var/www/teltonika$instance/smart-city-raw-processor.php" 2>/dev/null
        print_warning "Used older backup for teltonika$instance"
    fi
}

# Main script
case "$1" in
    test)
        print_status "=== TEST DEPLOYMENT (teltonika60 only) ==="
        backup_instance 60
        deploy_instance 60
        test_instance 60
        check_pending_queue 60
        ;;
        
    stage1)
        print_status "=== STAGE 1: Low Traffic (61-63) ==="
        for i in 61 62 63; do
            backup_instance $i
            deploy_instance $i
            test_instance $i
        done
        print_status "Waiting 5 minutes for monitoring..."
        sleep 300
        for i in 61 62 63; do
            echo -n "teltonika$i: "
            check_pending_queue $i
        done
        ;;
        
    stage2)
        print_status "=== STAGE 2: Medium Traffic (64-69) ==="
        for i in {64..69}; do
            backup_instance $i
            deploy_instance $i
        done
        for i in {64..69}; do
            test_instance $i
        done
        ;;
        
    stage3)
        print_status "=== STAGE 3: High Traffic (70-76) ==="
        for i in {70..76}; do
            backup_instance $i
            deploy_instance $i
        done
        for i in {70..76}; do
            test_instance $i
        done
        ;;
        
    all)
        print_status "=== FULL DEPLOYMENT (60-76) ==="
        for i in {60..76}; do
            backup_instance $i
            deploy_instance $i
        done
        print_status "Running tests..."
        for i in {60..76}; do
            test_instance $i
        done
        ;;
        
    rollback)
        print_error "=== EMERGENCY ROLLBACK ==="
        read -p "Are you sure you want to rollback ALL instances? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            for i in {60..76}; do
                rollback_instance $i
            done
            print_status "Rollback completed!"
        else
            print_status "Rollback cancelled"
        fi
        ;;
        
    status)
        print_status "=== CHECKING STATUS ==="
        for i in {60..76}; do
            echo -n "teltonika$i: "
            check_pending_queue $i
        done
        ;;
        
    *)
        echo "Usage: $0 {test|stage1|stage2|stage3|all|rollback|status}"
        echo ""
        echo "  test    - Deploy to teltonika60 only for testing"
        echo "  stage1  - Deploy to low traffic (61-63)"
        echo "  stage2  - Deploy to medium traffic (64-69)"
        echo "  stage3  - Deploy to high traffic (70-76)"
        echo "  all     - Deploy to all instances (60-76)"
        echo "  rollback- Emergency rollback all instances"
        echo "  status  - Check pending queue status"
        exit 1
        ;;
esac

print_status "Operation completed!"