#!/usr/bin/env python3
"""
Helper skripta za parsiranje JSON inputa za Claude Code hooks.
Čita JSON sa stdin i ekstraktuje 'command' polje.
"""

import sys
import json

try:
    data = json.load(sys.stdin)
    command = data.get('tool_input', {}).get('command', '')
    print(command)
except:
    # Ako ne možemo parsirati JSON, vraćamo prazan string
    print('')