#!/usr/bin/env node

// ============================================================================
// HAUBA CLI - Entry Point (OpenClaw-style minimal loader)
// File: tools/cli/bin/hauba.js
// ============================================================================

import module from "node:module";

// ============================================================================
// FIX: Windows PowerShell UTF-8 Encoding
// ============================================================================
// Set console output to UTF-8 to properly display Unicode characters
if (process.platform === 'win32') {
  try {
    // Set output encoding to UTF-8
    if (process.stdout.isTTY) {
      process.stdout.setDefaultEncoding('utf8');
    }
    if (process.stderr.isTTY) {
      process.stderr.setDefaultEncoding('utf8');
    }
    // Set console code page to UTF-8 (65001)
    if (process.env.TERM_PROGRAM !== 'vscode') {
      // Only set if not in VS Code integrated terminal
      process.env.PYTHONIOENCODING = 'utf-8';
    }
  } catch {
    // Ignore encoding errors
  }
}

// Enable compile cache for faster startup (Node 20+)
// https://nodejs.org/api/module.html#module-compile-cache
if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
  try {
    module.enableCompileCache();
  } catch {
    // Ignore errors on older Node versions
  }
}

// Lazy-load the CLI to prevent blocking on install
try {
  const { run } = await import('../dist/index.js');
  await run();
} catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('\n\x1b[31m✗ Hauba CLI not built properly.\x1b[0m');
    console.error('\x1b[90mRun: cd tools/cli && pnpm build\x1b[0m\n');
    process.exit(1);
  }
  throw error;
}
