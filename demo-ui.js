#!/usr/bin/env node
// ============================================================================
// HAUBA CLI - UI Demo Showcase
// Demonstrates the futuristic robotic design
// ============================================================================

import * as ui from './dist/ui.js';

console.clear();

// Main Logo
console.log(ui.ratLogo);
console.log('');

// Section: Status Indicators
console.log(ui.section.header('STATUS INDICATORS'));
console.log(ui.status.success('Operation completed successfully'));
console.log(ui.status.error('Connection failed'));
console.log(ui.status.warning('Low memory detected'));
console.log(ui.status.info('Processing 1,245 items'));
console.log(ui.status.active('AI Engine: ACTIVE'));
console.log(ui.status.loading('Downloading packages...'));
console.log(ui.status.pending('Queued for processing'));

// Section: Progress Bars
console.log(ui.section.header('PROGRESS VISUALIZATION'));
console.log(ui.progress.bar(25, 100, 35));
console.log(ui.progress.bar(50, 100, 35));
console.log(ui.progress.bar(75, 100, 35));
console.log(ui.progress.bar(100, 100, 35));
console.log('');
console.log(ui.progress.loading('Installing dependencies', 33));
console.log(ui.progress.loading('Compiling TypeScript', 67));
console.log(ui.progress.loading('Build complete', 100));

// Section: Box Styles
console.log(ui.section.header('BOX STYLES'));

console.log(ui.box.success('DEPLOYMENT SUCCESS', [
  '',
  'Your agent is now live!',
  '',
  'URL: https://hauba.dev/agent/abc123',
  'Status: Running',
  '',
]));
console.log('');

console.log(ui.box.error('BUILD FAILED', [
  '',
  'TypeScript compilation error',
  'File: src/index.ts:42',
  '',
  'Fix the errors and try again',
  '',
]));
console.log('');

console.log(ui.box.warning('API KEY REQUIRED', [
  '',
  'Configure your AI provider API key',
  '',
  'Run: hauba config set-key',
  '',
]));
console.log('');

console.log(ui.box.cyber('CYBER INTERFACE', [
  '',
  '⟨⟨ Advanced robotic UI ⟩⟩',
  '',
  'System online',
  'All modules loaded',
  'Ready for deployment',
  '',
]));

// Section: Tables
console.log(ui.section.header('DATA TABLES'));

ui.table.rows(
  ['CHANNEL', 'STATUS', 'MESSAGES'],
  [
    [ui.colors.text('WhatsApp'), ui.colors.accent('Connected'), ui.colors.textLight('1,234')],
    [ui.colors.text('Telegram'), ui.colors.accent('Connected'), ui.colors.textLight('567')],
    [ui.colors.text('Slack'), ui.colors.error('Disconnected'), ui.colors.muted('-')],
    [ui.colors.text('Discord'), ui.colors.warning('Connecting'), ui.colors.muted('-')],
  ]
);

console.log('');

// Section: Messages
console.log(ui.section.header('MESSAGE STYLES'));
ui.msg.title('Configuration Complete');
ui.msg.success('All channels connected');
ui.msg.error('Failed to authenticate with Slack');
ui.msg.warn('API rate limit approaching');
ui.msg.info('Processing messages in background');
ui.msg.hint('Use --verbose for detailed logs');
ui.msg.active('Live monitoring active');
ui.msg.loading('Syncing messages...');
console.log('');
console.log(ui.msg.command('hauba channels add whatsapp'));

// Section: Visual Effects
console.log(ui.section.header('VISUAL EFFECTS'));
console.log(ui.visual.neon('NEON SIGN EFFECT'));
console.log(ui.visual.circuit());
console.log(ui.visual.glitch('Matrix Glitch Effect'));
console.log('');

console.log(ui.visual.banner('⟨ HAUBA AI PLATFORM ⟩'));

// Section: List Items
console.log(ui.section.header('LIST FORMATTING'));
ui.msg.bullet('Connect multiple channels simultaneously');
ui.msg.bullet('AI-powered conversation handling');
ui.msg.bullet('Real-time message processing');
ui.msg.bullet('Custom skill marketplace');
console.log('');
ui.msg.numbered(1, 'Install the CLI globally');
ui.msg.numbered(2, 'Run the onboarding wizard');
ui.msg.numbered(3, 'Connect your first channel');
ui.msg.numbered(4, 'Deploy your AI agent');

// Footer
console.log(ui.section.divider());
console.log('');
console.log(ui.ratLogoMini);
console.log('');
console.log(ui.colors.primary.bold('  ⟨ World\'s Smartest CLI Design ⟩'));
console.log(ui.colors.muted('  Nepal-Made AI Excellence'));
console.log('');
