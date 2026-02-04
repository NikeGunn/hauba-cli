// ============================================================================
// HAUBA CLI - Professional UI Components
// File: tools/cli/src/ui.ts
// Rat-themed, professional, and sexy design
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// COLOR PALETTE - Consistent brand colors
// ============================================================================

export const colors = {
  // Primary brand colors (rat theme - sleek dark grays with neon accents)
  primary: chalk.hex('#E040FB'),      // Neon magenta (main brand)
  secondary: chalk.hex('#00E5FF'),    // Cyan accent
  accent: chalk.hex('#76FF03'),       // Neon green (success)
  warning: chalk.hex('#FFAB00'),      // Amber warning
  error: chalk.hex('#FF5252'),        // Red error
  
  // Neutral tones
  muted: chalk.hex('#78909C'),        // Blue-gray for secondary text
  dim: chalk.hex('#546E7A'),          // Darker gray
  subtle: chalk.hex('#37474F'),       // Very subtle
  
  // Text colors
  text: chalk.white,
  textLight: chalk.hex('#B0BEC5'),
  textDim: chalk.hex('#607D8B'),
  
  // Special
  highlight: chalk.hex('#EA80FC'),    // Light magenta
  link: chalk.hex('#00B0FF'),         // Link blue
};

// ============================================================================
// RAT LOGO - ASCII Art (Cool Rat with Big Eyes)
// ============================================================================

export const ratLogo = `
${colors.primary('    ╭──────────────────────────────────────────────────────╮')}
${colors.primary('    │')}                                                        ${colors.primary('│')}
${colors.primary('    │')}  ${colors.muted('      /\\')}')}${colors.dim('___')}${colors.muted('/\\')}                                        ${colors.primary('│')}
${colors.primary('    │')}  ${colors.muted('     /  ')}${colors.dim('   ')}${colors.muted('  \\')}                                       ${colors.primary('│')}
${colors.primary('    │')}  ${colors.textLight('    |  ')}${colors.accent('◉')}   ${colors.accent('◉')}${colors.textLight('  |')}     ${colors.text.bold('H A U B A')}                 ${colors.primary('│')}
${colors.primary('    │')}  ${colors.textLight('    |')}${colors.dim('    ')}${colors.warning('▼')}${colors.dim('    ')}${colors.textLight('|')}     ${colors.muted('AI Agent Platform')}           ${colors.primary('│')}
${colors.primary('    │')}  ${colors.dim(' ~~')}${colors.textLight(' |')}${colors.muted('  \\___/')}${colors.textLight('  |')}${colors.dim(' ~~')}  ${colors.dim('Build smart agents fast')}       ${colors.primary('│')}
${colors.primary('    │')}  ${colors.muted('     \\\\')}')}${colors.dim('_______')}${colors.muted('//')}     ${colors.dim('v1.0.0')}                      ${colors.primary('│')}
${colors.primary('    │')}  ${colors.subtle('       || ||')}${colors.dim('~~~')}                                      ${colors.primary('│')}
${colors.primary('    │')}  ${colors.subtle('      (__)(__)  ')}                                     ${colors.primary('│')}
${colors.primary('    │')}                                                        ${colors.primary('│')}
${colors.primary('    ╰──────────────────────────────────────────────────────╯')}
`;

// Simple minimal logo for smaller outputs
export const ratLogoMini = `
${colors.primary('  ╭───────────────────────────────────────────╮')}
${colors.primary('  │')}  ${colors.muted('(◉')}${colors.dim('_')}${colors.muted('◉)')} ${colors.text.bold('HAUBA')} ${colors.dim('│')} ${colors.muted('AI Agent Platform')}      ${colors.primary('│')}
${colors.primary('  ╰───────────────────────────────────────────╯')}
`;

// Ultra minimal for inline use
export const brand = colors.primary.bold('HAUBA');

// ============================================================================
// BOX COMPONENTS - Professional box drawing
// ============================================================================

export const box = {
  // Draw a titled box
  titled: (title: string, content: string[], width: number = 50): string => {
    const topBorder = `╭${'─'.repeat(width - 2)}╮`;
    const bottomBorder = `╰${'─'.repeat(width - 2)}╯`;
    const titleLine = `│ ${colors.text.bold(title.padEnd(width - 4))} │`;
    const separator = `├${'─'.repeat(width - 2)}┤`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `│ ${line}${' '.repeat(Math.max(0, padding))} │`;
    });
    
    return [
      colors.dim(topBorder),
      colors.dim('│ ') + colors.text.bold(title) + colors.dim(' '.repeat(width - 4 - title.length) + ' │'),
      colors.dim(separator),
      ...contentLines.map(l => colors.dim(l.slice(0, 1)) + l.slice(1, -1) + colors.dim(l.slice(-1))),
      colors.dim(bottomBorder)
    ].join('\n');
  },

  // Simple box
  simple: (content: string[], width: number = 50): string => {
    const topBorder = `╭${'─'.repeat(width - 2)}╮`;
    const bottomBorder = `╰${'─'.repeat(width - 2)}╯`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `│ ${line}${' '.repeat(Math.max(0, padding))} │`;
    });
    
    return [
      colors.dim(topBorder),
      ...contentLines.map(l => colors.dim(l.slice(0, 1)) + l.slice(1, -1) + colors.dim(l.slice(-1))),
      colors.dim(bottomBorder)
    ].join('\n');
  },

  // Success box (green border)
  success: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = `╭${'─'.repeat(width - 2)}╮`;
    const bottomBorder = `╰${'─'.repeat(width - 2)}╯`;
    const separator = `├${'─'.repeat(width - 2)}┤`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `│ ${line}${' '.repeat(Math.max(0, padding))} │`;
    });
    
    return [
      colors.accent(topBorder),
      colors.accent('│ ') + colors.accent.bold(` ${title}`) + colors.accent(' '.repeat(width - 5 - title.length) + ' │'),
      colors.accent(separator),
      ...contentLines.map(l => colors.accent(l.slice(0, 1)) + l.slice(1, -1) + colors.accent(l.slice(-1))),
      colors.accent(bottomBorder)
    ].join('\n');
  },

  // Error box (red border)
  error: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = `╭${'─'.repeat(width - 2)}╮`;
    const bottomBorder = `╰${'─'.repeat(width - 2)}╯`;
    const separator = `├${'─'.repeat(width - 2)}┤`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `│ ${line}${' '.repeat(Math.max(0, padding))} │`;
    });
    
    return [
      colors.error(topBorder),
      colors.error('│ ') + colors.error.bold(` ${title}`) + colors.error(' '.repeat(width - 5 - title.length) + ' │'),
      colors.error(separator),
      ...contentLines.map(l => colors.error(l.slice(0, 1)) + l.slice(1, -1) + colors.error(l.slice(-1))),
      colors.error(bottomBorder)
    ].join('\n');
  },

  // Warning box (amber border)
  warning: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = `╭${'─'.repeat(width - 2)}╮`;
    const bottomBorder = `╰${'─'.repeat(width - 2)}╯`;
    const separator = `├${'─'.repeat(width - 2)}┤`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `│ ${line}${' '.repeat(Math.max(0, padding))} │`;
    });
    
    return [
      colors.warning(topBorder),
      colors.warning('│ ') + colors.warning.bold(` ${title}`) + colors.warning(' '.repeat(width - 5 - title.length) + ' │'),
      colors.warning(separator),
      ...contentLines.map(l => colors.warning(l.slice(0, 1)) + l.slice(1, -1) + colors.warning(l.slice(-1))),
      colors.warning(bottomBorder)
    ].join('\n');
  },
};

// ============================================================================
// STATUS INDICATORS
// ============================================================================

export const status = {
  success: (msg: string) => `${colors.accent('✓')} ${msg}`,
  error: (msg: string) => `${colors.error('✗')} ${msg}`,
  warning: (msg: string) => `${colors.warning('!')} ${msg}`,
  info: (msg: string) => `${colors.secondary('●')} ${msg}`,
  pending: (msg: string) => `${colors.muted('○')} ${msg}`,
  arrow: (msg: string) => `${colors.primary('→')} ${msg}`,
};

// ============================================================================
// SECTION HEADERS
// ============================================================================

export const section = {
  header: (title: string): string => {
    return `\n${colors.primary('━━━')} ${colors.text.bold(title)} ${colors.primary('━'.repeat(45 - title.length))}\n`;
  },
  
  subheader: (title: string): string => {
    return `\n${colors.muted('───')} ${colors.textLight(title)} ${colors.muted('─'.repeat(40 - title.length))}\n`;
  },
  
  divider: (): string => {
    return colors.subtle('─'.repeat(50));
  },
};

// ============================================================================
// MESSAGES
// ============================================================================

export const msg = {
  // Title with optional subtitle
  title: (main: string, sub?: string): void => {
    console.log(`\n${colors.text.bold(main)}${sub ? colors.muted(` ${sub}`) : ''}\n`);
  },
  
  // Success message
  success: (message: string): void => {
    console.log(`${colors.accent('✓')} ${message}`);
  },
  
  // Error message
  error: (message: string): void => {
    console.log(`${colors.error('✗')} ${message}`);
  },
  
  // Warning message
  warn: (message: string): void => {
    console.log(`${colors.warning('!')} ${message}`);
  },
  
  // Info message
  info: (message: string): void => {
    console.log(`${colors.secondary('●')} ${message}`);
  },
  
  // Hint/tip
  hint: (message: string): void => {
    console.log(`${colors.muted('💡')} ${colors.textLight(message)}`);
  },
  
  // Command example
  command: (cmd: string): string => {
    return `${colors.dim('$')} ${colors.primary(cmd)}`;
  },
  
  // Labeled value
  label: (label: string, value: string): void => {
    console.log(`${colors.muted(label + ':')} ${colors.text(value)}`);
  },
  
  // Bullet point
  bullet: (text: string): void => {
    console.log(`${colors.dim('  •')} ${text}`);
  },
  
  // Numbered list item
  numbered: (num: number, text: string): void => {
    console.log(`${colors.muted(`  ${num}.`)} ${text}`);
  },
  
  // Empty line
  newline: (): void => {
    console.log('');
  },
};

// ============================================================================
// API KEY REQUIRED MESSAGES
// ============================================================================

export const apiKeyRequired = {
  show: (): void => {
    console.log(box.warning('API KEY REQUIRED', [
      '',
      `${colors.warning('You must configure your own AI API keys.')}`,
      '',
      `${colors.muted('HAUBA uses a Bring-Your-Own-Key model.')}`,
      `${colors.muted('This keeps costs transparent and in your control.')}`,
      '',
      `${colors.textLight('Get a FREE key from Google AI:')}`,
      `${colors.link('https://makersuite.google.com/app/apikey')}`,
      '',
      `${colors.textLight('Or use Anthropic/OpenAI if you prefer.')}`,
      '',
    ]));
    
    console.log(`\n${section.subheader('QUICK FIX')}`);
    msg.numbered(1, `Get an API key from a supported provider`);
    msg.numbered(2, `Configure it via: ${colors.primary('hauba config set-key')}`);
    msg.numbered(3, `Or set via API: ${colors.dim('PATCH /api/settings')}`);
    
    console.log(`\n${section.subheader('ALTERNATIVE: MANUAL CREATION')}`);
    msg.info(`You can create skills manually without AI.`);
    msg.bullet(`Run: ${colors.primary('hauba skill create --manual')}`);
    msg.bullet(`Follow the prompts to define your skill`);
    msg.bullet(`See docs: ${colors.link('https://hauba.dev/docs/skills')}`);
  },
};

// ============================================================================
// HELP TEXT FORMATTING
// ============================================================================

export const help = {
  // Command example with description
  example: (command: string, description: string): string => {
    return `  ${colors.primary('$')} ${colors.text(command)}\n  ${colors.muted(description)}`;
  },
  
  // Option formatting
  option: (flags: string, description: string): string => {
    const paddedFlags = flags.padEnd(25);
    return `  ${colors.secondary(paddedFlags)} ${colors.textLight(description)}`;
  },
};

// ============================================================================
// PROGRESS & SPINNERS
// ============================================================================

import ora, { Ora } from 'ora';

export const spinner = {
  create: (text: string): Ora => {
    return ora({
      text,
      color: 'magenta',
      spinner: {
        interval: 80,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      }
    });
  },
  
  // AI thinking spinner
  ai: (text: string = 'AI is thinking...'): Ora => {
    return ora({
      text: colors.primary(`🐀 ${text}`),
      color: 'cyan',
      spinner: {
        interval: 100,
        frames: ['🧠', '💭', '💡', '✨']
      }
    });
  },
};

// ============================================================================
// UTILITIES
// ============================================================================

// Strip ANSI codes for length calculations  
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Truncate text with ellipsis
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// Pad string considering ANSI codes
export function padEnd(str: string, length: number): string {
  const visibleLength = stripAnsi(str).length;
  const padding = Math.max(0, length - visibleLength);
  return str + ' '.repeat(padding);
}

// ============================================================================
// TABLES (Simple)
// ============================================================================

export const table = {
  // Key-value pairs
  keyValue: (data: Array<[string, string]>, keyWidth: number = 15): void => {
    data.forEach(([key, value]) => {
      console.log(`  ${colors.muted(key.padEnd(keyWidth))} ${colors.text(value)}`);
    });
  },
  
  // Simple rows
  rows: (headers: string[], rows: string[][]): void => {
    const widths = headers.map((h, i) => 
      Math.max(h.length, ...rows.map(r => stripAnsi(r[i] || '').length))
    );
    
    // Header
    const headerRow = headers.map((h, i) => colors.muted(h.padEnd(widths[i]))).join('  ');
    console.log(`  ${headerRow}`);
    console.log(`  ${colors.dim('─'.repeat(widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 2))}`);
    
    // Data rows
    rows.forEach(row => {
      const dataRow = row.map((cell, i) => padEnd(cell, widths[i])).join('  ');
      console.log(`  ${dataRow}`);
    });
  },
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export { stripAnsi };
