#!/usr/bin/env pwsh
# ============================================================================
# Hauba CLI - Local Development Helper
# Use this to test your CLI during development
# ============================================================================

param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Command
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Build if needed
if (-not (Test-Path "$scriptDir\dist\index.js")) {
    Write-Host "Building CLI..." -ForegroundColor Cyan
    npm run build
}

# Run the local CLI
node "$scriptDir\bin\hauba.js" @Command
