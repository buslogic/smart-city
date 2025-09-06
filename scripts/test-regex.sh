#!/bin/bash

# Test regex pattern from prisma-guard-hook.sh
FOLDER_NAME="20250906152240_add_dashboard_permissions"

echo "Testing folder name: $FOLDER_NAME"

if echo "$FOLDER_NAME" | grep -E "^[0-9]{14}_" > /dev/null 2>&1; then
    echo "✅ Folder name matches the pattern"
else
    echo "❌ Folder name does NOT match the pattern"
fi

# Alternative check
if [[ "$FOLDER_NAME" =~ ^[0-9]{14}_ ]]; then
    echo "✅ Folder name matches (bash regex)"
else
    echo "❌ Folder name does NOT match (bash regex)"
fi