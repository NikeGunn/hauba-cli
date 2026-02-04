#!/bin/bash
# ============================================================================
# Hauba CLI - Local Development Helper (Bash)
# Use this to test your CLI during development
# ============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Build if needed
if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo "Building CLI..."
    npm run build
fi

# Run the local CLI
node "$SCRIPT_DIR/bin/hauba.js" "$@"
