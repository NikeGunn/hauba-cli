// ============================================================================
// HAUBA CLI - Professional UI Components
// File: tools/cli/src/ui.ts
// Futuristic robotic design with ASCII fallback
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// ENCODING DETECTION
// ============================================================================

// Detect if terminal supports UTF-8 (for Unicode box-drawing)
const supportsUnicode = (): boolean => {
  // Check environment variables
  if (process.env.HAUBA_ASCII === '1') return false;
  if (process.argv.includes('--ascii')) return false;
  
  // Check if running in Windows Command Prompt (limited Unicode support)
  if (process.platform === 'win32') {
    const isCmd = process.env.PROMPT !== undefined && !process.env.WT_SESSION;
    if (isCmd) return false;
  }
  
  // Check LANG/LC_ALL for UTF-8
  const lang = process.env.LANG || process.env.LC_ALL || '';
  if (lang.toLowerCase().includes('utf-8') || lang.toLowerCase().includes('utf8')) {
    return true;
  }
  
  // Default to true for modern terminals
  return true;
};

const USE_UNICODE = supportsUnicode();

// ============================================================================
// COLOR PALETTE - Cyberpunk/Robotic Theme
// ============================================================================

export const colors = {
  // Primary brand colors (cyberpunk neon theme)
  primary: chalk.hex('#00FFFF'),      // Neon cyan (cyberpunk)
  secondary: chalk.hex('#FF00FF'),    // Neon magenta
  accent: chalk.hex('#00FF41'),       // Matrix green (success)
  warning: chalk.hex('#FFD700'),      // Gold warning
  error: chalk.hex('#FF0055'),        // Hot pink error
  
  // Neutral tones
  muted: chalk.hex('#6B7280'),        // Cool gray for secondary text
  dim: chalk.hex('#4B5563'),          // Medium gray
  subtle: chalk.hex('#374151'),       // Dark gray
  
  // Text colors
  text: chalk.hex('#F3F4F6'),         // Almost white
  textLight: chalk.hex('#D1D5DB'),    // Light gray
  textDim: chalk.hex('#9CA3AF'),      // Mid gray
  
  // Special effects
  highlight: chalk.hex('#7C3AED'),    // Purple
  link: chalk.hex('#3B82F6'),         // Blue
  glow: chalk.hex('#A78BFA'),         // Glowing purple
  neon: chalk.hex('#06FFA5'),         // Bright neon
  electric: chalk.hex('#FAFF00'),     // Electric yellow
  
  // Gradient effects
  gradient1: chalk.hex('#8B5CF6'),
  gradient2: chalk.hex('#EC4899'),
  gradient3: chalk.hex('#06B6D4'),
};

// ============================================================================
// RAT LOGO - Advanced Robotic ASCII Art
// ============================================================================

// Unicode version (for modern terminals)
const ratLogoUnicode = `
${colors.primary('    ╔═══════════════════════════════════════════════════════╗')}
${colors.primary('    ║')}${colors.gradient1('░')}${colors.gradient2('▒')}${colors.gradient3('▓')}${colors.primary('█')}                                                   ${colors.primary('║')}
${colors.primary('    ║')}      ${colors.dim('┌─────┐')}     ${colors.text.bold('╦ ╦╔═╗╦ ╦╔╗ ╔═╗')}       ${colors.neon('◢◣')}       ${colors.primary('║')}
${colors.primary('    ║')}      ${colors.textLight('│')}${colors.accent('●')}${colors.dim('─')}${colors.accent('●')}${colors.textLight('│')}     ${colors.text.bold('╠═╣╠═╣║ ║╠╩╗╠═╣')}      ${colors.neon('◢')}${colors.electric('█')}${colors.neon('◣')}      ${colors.primary('║')}
${colors.primary('    ║')}      ${colors.dim('└──')}${colors.warning('◉')}${colors.dim('──┘')}     ${colors.text.bold('╩ ╩╩ ╩╚═╝╚═╝╩ ╩')}      ${colors.neon('◥')}${colors.electric('█')}${colors.neon('◤')}      ${colors.primary('║')}
${colors.primary('    ║')}       ${colors.muted('▔▔')}${colors.textLight('╲')}${colors.accent('▃▃▃')}${colors.textLight('╱')}${colors.muted('▔▔')}                        ${colors.neon('◥◤')}       ${colors.primary('║')}
${colors.primary('    ║')}      ${colors.textDim('◢█◣')}  ${colors.dim('◢')}${colors.muted('█')}${colors.dim('◣')}                                    ${colors.primary('║')}
${colors.primary('    ║')}      ${colors.textDim('◥█◤')}  ${colors.dim('◥')}${colors.muted('█')}${colors.dim('◤')}     ${colors.secondary('⟨ AI AGENT PLATFORM ⟩')}       ${colors.primary('║')}
${colors.primary('    ║')}                                                     ${colors.primary('║')}
${colors.primary('    ║')}   ${colors.glow('▸')} ${colors.textLight('Smart Agents')}  ${colors.glow('▸')} ${colors.textLight('Multi-Channel')}  ${colors.glow('▸')} ${colors.textLight('Nepal-Made')}   ${colors.primary('║')}
${colors.primary('    ║')}${colors.gradient3('█')}${colors.gradient2('▓')}${colors.gradient1('▒')}${colors.dim('░')}                             ${colors.muted('v1.1.0')}                ${colors.primary('║')}
${colors.primary('    ╚═══════════════════════════════════════════════════════╝')}
`;

// ASCII version (for Windows CMD and terminals without Unicode)
const ratLogoAscii = `
${colors.primary('    +-------------------------------------------------------+')}
${colors.primary('    |')}                                                       ${colors.primary('|')}
${colors.primary('    |')}      ${colors.dim('+-----+')}     ${colors.text.bold('H A U B A')}                   ${colors.primary('|')}
${colors.primary('    |')}      ${colors.textLight('|')}${colors.accent('O')}${colors.dim('-')}${colors.accent('O')}${colors.textLight('|')}     ${colors.text.bold('AI Agent Platform')}         ${colors.primary('|')}
${colors.primary('    |')}      ${colors.dim('+--')}${colors.warning('o')}${colors.dim('--+')}     ${colors.muted('Build Smart Agents Fast')}     ${colors.primary('|')}
${colors.primary('    |')}       ${colors.muted('==')}${colors.textLight('\\')}${colors.accent('___')}${colors.textLight('/')}${colors.muted('==')}                                ${colors.primary('|')}
${colors.primary('    |')}      ${colors.textDim('/|\\')}  ${colors.dim('/')}${colors.muted('|')}${colors.dim('\\')}                                  ${colors.primary('|')}
${colors.primary('    |')}      ${colors.textDim('\\|/')}  ${colors.dim('\\')}${colors.muted('|')}${colors.dim('/')}     ${colors.secondary('< AI AGENT PLATFORM >')}     ${colors.primary('|')}
${colors.primary('    |')}                                                       ${colors.primary('|')}
${colors.primary('    |')}   ${colors.glow('>')} ${colors.textLight('Smart Agents')}  ${colors.glow('>')} ${colors.textLight('Multi-Channel')}  ${colors.glow('>')} ${colors.textLight('Nepal')}  ${colors.primary('|')}
${colors.primary('    |')}                               ${colors.muted('v1.1.0')}                  ${colors.primary('|')}
${colors.primary('    +-------------------------------------------------------+')}
`;

export const ratLogo = USE_UNICODE ? ratLogoUnicode : ratLogoAscii;

// Compact logo
const ratLogoMiniUnicode = `
${colors.primary('  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓')}
${colors.primary('  ┃')}  ${colors.accent('⟪')}${colors.electric('◉')}${colors.accent('⟫')} ${colors.text.bold('HAUBA')} ${colors.dim('│')} ${colors.secondary('AI Agent Platform')}         ${colors.primary('┃')}
${colors.primary('  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')}
`;

const ratLogoMiniAscii = `
${colors.primary('  +--------------------------------------------+')}
${colors.primary('  |')}  ${colors.accent('<')}${colors.electric('O')}${colors.accent('>')} ${colors.text.bold('HAUBA')} ${colors.dim('|')} ${colors.secondary('AI Agent Platform')}         ${colors.primary('|')}
${colors.primary('  +--------------------------------------------+')}
`;

export const ratLogoMini = USE_UNICODE ? ratLogoMiniUnicode : ratLogoMiniAscii;

// Ultra compact for inline
export const brand = USE_UNICODE ? colors.primary.bold('⟨ HAUBA ⟩') : colors.primary.bold('< HAUBA >');

// ============================================================================
// BOX COMPONENTS - Futuristic Design
// ============================================================================

export const box = {
  // Draw a titled box
  titled: (title: string, content: string[], width: number = 50): string => {
    const topBorder = USE_UNICODE ? `╔${'═'.repeat(width - 2)}╗` : `+${'='.repeat(width - 2)}+`;
    const bottomBorder = USE_UNICODE ? `╚${'═'.repeat(width - 2)}╝` : `+${'='.repeat(width - 2)}+`;
    const separator = USE_UNICODE ? `╟${'─'.repeat(width - 2)}╢` : `+${'-'.repeat(width - 2)}+`;
    const vbar = USE_UNICODE ? '║' : '|';
    const titleWrap = USE_UNICODE ? `⟨ ${title} ⟩` : `< ${title} >`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `${vbar} ${line}${' '.repeat(Math.max(0, padding))} ${vbar}`;
    });
    
    return [
      colors.primary(topBorder),
      colors.primary(`${vbar} `) + colors.text.bold(titleWrap) + colors.primary(' '.repeat(width - 8 - title.length) + ` ${vbar}`),
      colors.dim(separator),
      ...contentLines.map(l => colors.primary(l.slice(0, 1)) + l.slice(1, -1) + colors.primary(l.slice(-1))),
      colors.primary(bottomBorder)
    ].join('\n');
  },

  // Simple box  
  simple: (content: string[], width: number = 50): string => {
    const topBorder = USE_UNICODE ? `┏${'━'.repeat(width - 2)}┓` : `+${'-'.repeat(width - 2)}+`;
    const bottomBorder = USE_UNICODE ? `┗${'━'.repeat(width - 2)}┛` : `+${'-'.repeat(width - 2)}+`;
    const vbar = USE_UNICODE ? '┃' : '|';
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `${vbar} ${line}${' '.repeat(Math.max(0, padding))} ${vbar}`;
    });
    
    return [
      colors.dim(topBorder),
      ...contentLines.map(l => colors.dim(l.slice(0, 1)) + l.slice(1, -1) + colors.dim(l.slice(-1))),
      colors.dim(bottomBorder)
    ].join('\n');
  },

  // Success box (neon green border)
  success: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = USE_UNICODE ? `╔${'═'.repeat(width - 2)}╗` : `+${'='.repeat(width - 2)}+`;
    const bottomBorder = USE_UNICODE ? `╚${'═'.repeat(width - 2)}╝` : `+${'='.repeat(width - 2)}+`;
    const separator = USE_UNICODE ? `╟${'─'.repeat(width - 2)}╢` : `+${'-'.repeat(width - 2)}+`;
    const vbar = USE_UNICODE ? '║' : '|';
    const checkmark = USE_UNICODE ? '✓' : '+';
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `${vbar} ${line}${' '.repeat(Math.max(0, padding))} ${vbar}`;
    });
    
    return [
      colors.accent(topBorder),
      colors.accent(`${vbar} `) + colors.accent.bold(`${checkmark} ${title}`) + colors.accent(' '.repeat(width - 5 - title.length) + ` ${vbar}`),
      colors.accent(separator),
      ...contentLines.map(l => colors.accent(l.slice(0, 1)) + l.slice(1, -1) + colors.accent(l.slice(-1))),
      colors.accent(bottomBorder)
    ].join('\n');
  },

  // Error box (neon pink border)
  error: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = USE_UNICODE ? `╔${'═'.repeat(width - 2)}╗` : `+${'='.repeat(width - 2)}+`;
    const bottomBorder = USE_UNICODE ? `╚${'═'.repeat(width - 2)}╝` : `+${'='.repeat(width - 2)}+`;
    const separator = USE_UNICODE ? `╟${'─'.repeat(width - 2)}╢` : `+${'-'.repeat(width - 2)}+`;
    const vbar = USE_UNICODE ? '║' : '|';
    const xmark = USE_UNICODE ? '✗' : 'X';
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `${vbar} ${line}${' '.repeat(Math.max(0, padding))} ${vbar}`;
    });
    
    return [
      colors.error(topBorder),
      colors.error(`${vbar} `) + colors.error.bold(`${xmark} ${title}`) + colors.error(' '.repeat(width - 5 - title.length) + ` ${vbar}`),
      colors.error(separator),
      ...contentLines.map(l => colors.error(l.slice(0, 1)) + l.slice(1, -1) + colors.error(l.slice(-1))),
      colors.error(bottomBorder)
    ].join('\n');
  },

  // Warning box (gold border)
  warning: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = USE_UNICODE ? `╔${'═'.repeat(width - 2)}╗` : `+${'='.repeat(width - 2)}+`;
    const bottomBorder = USE_UNICODE ? `╚${'═'.repeat(width - 2)}╝` : `+${'='.repeat(width - 2)}+`;
    const separator = USE_UNICODE ? `╟${'─'.repeat(width - 2)}╢` : `+${'-'.repeat(width - 2)}+`;
    const vbar = USE_UNICODE ? '║' : '|';
    const warnmark = USE_UNICODE ? '⚠' : '!';
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `${vbar} ${line}${' '.repeat(Math.max(0, padding))} ${vbar}`;
    });
    
    return [
      colors.warning(topBorder),
      colors.warning(`${vbar} `) + colors.warning.bold(`${warnmark} ${title}`) + colors.warning(' '.repeat(width - 5 - title.length) + ` ${vbar}`),
      colors.warning(separator),
      ...contentLines.map(l => colors.warning(l.slice(0, 1)) + l.slice(1, -1) + colors.warning(l.slice(-1))),
      colors.warning(bottomBorder)
    ].join('\n');
  },
  
  // Cyber box (glowing effect)
  cyber: (title: string, content: string[]): string => {
    const width = 54;
    const topBorder = USE_UNICODE ? `┏${'━'.repeat(width - 2)}┓` : `+${'-'.repeat(width - 2)}+`;
    const bottomBorder = USE_UNICODE ? `┗${'━'.repeat(width - 2)}┛` : `+${'-'.repeat(width - 2)}+`;
    const separator = USE_UNICODE ? `┣${'╍'.repeat(width - 2)}┫` : `+${'-'.repeat(width - 2)}+`;
    const vbar = USE_UNICODE ? '┃' : '|';
    const titleWrap = USE_UNICODE ? `⟨⟨ ${title} ⟩⟩` : `<< ${title} >>`;
    
    const contentLines = content.map(line => {
      const stripped = stripAnsi(line);
      const padding = width - 4 - stripped.length;
      return `${vbar} ${line}${' '.repeat(Math.max(0, padding))} ${vbar}`;
    });
    
    return [
      colors.glow(topBorder),
      colors.glow(`${vbar} `) + colors.neon.bold(titleWrap) + colors.glow(' '.repeat(width - 10 - title.length) + ` ${vbar}`),
      colors.glow(separator),
      ...contentLines.map(l => colors.glow(l.slice(0, 1)) + l.slice(1, -1) + colors.glow(l.slice(-1))),
      colors.glow(bottomBorder)
    ].join('\n');
  },
};

// ============================================================================
// STATUS INDICATORS - Advanced Icons
// ============================================================================

export const status = {
  success: (msg: string) => `${colors.accent(USE_UNICODE ? '◉' : 'O')} ${msg}`,
  error: (msg: string) => `${colors.error(USE_UNICODE ? '◉' : 'X')} ${msg}`,
  warning: (msg: string) => `${colors.warning(USE_UNICODE ? '◉' : '!')} ${msg}`,
  info: (msg: string) => `${colors.secondary(USE_UNICODE ? '◉' : 'i')} ${msg}`,
  pending: (msg: string) => `${colors.muted(USE_UNICODE ? '◯' : 'o')} ${msg}`,
  arrow: (msg: string) => `${colors.primary(USE_UNICODE ? '▸' : '>')} ${msg}`,
  loading: (msg: string) => `${colors.glow(USE_UNICODE ? '◐' : '*')} ${msg}`,
  active: (msg: string) => `${colors.neon(USE_UNICODE ? '◆' : '#')} ${msg}`,
  inactive: (msg: string) => `${colors.dim(USE_UNICODE ? '◇' : '-')} ${msg}`,
};

// ============================================================================
// SECTION HEADERS - Futuristic Design
// ============================================================================

export const section = {
  header: (title: string): string => {
    const line = (USE_UNICODE ? '═' : '=').repeat(Math.max(0, 45 - title.length));
    const start = USE_UNICODE ? '╔═══' : '+===';
    const end = USE_UNICODE ? '╗' : '+';
    return `\n${colors.primary(start)} ${colors.text.bold(title)} ${colors.primary(line + end)}\n`;
  },
  
  subheader: (title: string): string => {
    const line = (USE_UNICODE ? '─' : '-').repeat(Math.max(0, 40 - title.length));
    const start = USE_UNICODE ? '┣━━' : '+--';
    return `\n${colors.secondary(start)} ${colors.textLight(title)} ${colors.muted(line)}\n`;
  },
  
  divider: (): string => {
    return colors.dim((USE_UNICODE ? '┄' : '-').repeat(50));
  },
  
  banner: (text: string): string => {
    const padding = Math.max(0, 48 - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    const line = (USE_UNICODE ? '━' : '=').repeat(50);
    return colors.glow(line) + '\n' +
           colors.neon.bold(' '.repeat(leftPad) + text + ' '.repeat(rightPad)) + '\n' +
           colors.glow(line);
  },
};

// ============================================================================
// MESSAGES - Enhanced Visual Feedback
// ============================================================================

export const msg = {
  // Title with optional subtitle
  title: (main: string, sub?: string): void => {
    const wrap = USE_UNICODE ? `⟨ ${main} ⟩` : `< ${main} >`;
    console.log(`\n${colors.text.bold(wrap)}${sub ? colors.muted(` ${sub}`) : ''}\n`);
  },
  
  // Success message
  success: (message: string): void => {
    console.log(`${colors.accent(USE_UNICODE ? '◉' : 'O')} ${message}`);
  },
  
  // Error message
  error: (message: string): void => {
    console.log(`${colors.error(USE_UNICODE ? '◉' : 'X')} ${message}`);
  },
  
  // Warning message
  warn: (message: string): void => {
    console.log(`${colors.warning(USE_UNICODE ? '◉' : '!')} ${message}`);
  },
  
  // Muted message
  muted: (message: string): void => {
    console.log(`${colors.muted(message)}`)
  },
  
  // Info message
  info: (message: string): void => {
    console.log(`${colors.secondary('▸')} ${message}`);
  },
  
  // Hint/tip
  hint: (message: string): void => {
    console.log(`${colors.electric('💡')} ${colors.textLight(message)}`);
  },
  
  // Command example
  command: (cmd: string): string => {
    return `${colors.dim('▸')} ${colors.primary(cmd)}`;
  },
  
  // Labeled value
  label: (label: string, value: string): void => {
    console.log(`${colors.muted(label + ':')} ${colors.text(value)}`);
  },
  
  // Bullet point
  bullet: (text: string): void => {
    console.log(`${colors.neon('  ◆')} ${text}`);
  },
  
  // Numbered list item
  numbered: (num: number, text: string): void => {
    console.log(`${colors.secondary(`  ${num}▸`)} ${text}`);
  },
  
  // Empty line
  newline: (): void => {
    console.log('');
  },
  
  // Loading indicator
  loading: (message: string): void => {
    console.log(`${colors.glow('◐')} ${message}`);
  },
  
  // Active process
  active: (message: string): void => {
    console.log(`${colors.neon('◆')} ${message}`);
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
// PROGRESS & SPINNERS - Advanced Animations
// ============================================================================

import ora, { Ora } from 'ora';

export const spinner = {
  create: (text: string): Ora => {
    return ora({
      text,
      color: 'cyan',
      spinner: {
        interval: 80,
        frames: ['◐', '◓', '◑', '◒']
      }
    });
  },
  
  // AI thinking spinner
  ai: (text: string = 'AI is thinking...'): Ora => {
    return ora({
      text: colors.primary(`⟨◉⟩ ${text}`),
      color: 'cyan',
      spinner: {
        interval: 100,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      }
    });
  },
  
  // Robot processing
  robot: (text: string = 'Processing...'): Ora => {
    return ora({
      text: colors.neon(`${text}`),
      color: 'magenta',
      spinner: {
        interval: 120,
        frames: ['▰▱▱▱▱', '▰▰▱▱▱', '▰▰▰▱▱', '▰▰▰▰▱', '▰▰▰▰▰', '▱▰▰▰▰', '▱▱▰▰▰', '▱▱▱▰▰', '▱▱▱▱▰']
      }
    });
  },
  
  // Cyber scanning
  scan: (text: string = 'Scanning...'): Ora => {
    return ora({
      text: colors.electric(`${text}`),
      color: 'yellow',
      spinner: {
        interval: 100,
        frames: ['▹▹▹▹▹', '▸▹▹▹▹', '▹▸▹▹▹', '▹▹▸▹▹', '▹▹▹▸▹', '▹▹▹▹▸', '▹▹▹▸▹', '▹▹▸▹▹', '▹▸▹▹▹', '▸▹▹▹▹']
      }
    });
  },
  
  // Matrix-style
  matrix: (text: string = 'Loading...'): Ora => {
    return ora({
      text: colors.accent(`${text}`),
      color: 'green',
      spinner: {
        interval: 80,
        frames: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
      }
    });
  },
};

// ============================================================================
// PROGRESS BAR
// ============================================================================

export const progress = {
  // Simple progress bar
  bar: (current: number, total: number, width: number = 30): string => {
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = colors.accent('━'.repeat(filled)) + colors.dim('╍'.repeat(empty));
    const percent = colors.text(`${Math.floor(percentage)}%`);
    
    return `${colors.primary('▐')}${bar}${colors.primary('▌')} ${percent}`;
  },
  
  // Animated loading bar
  loading: (text: string, percentage: number): string => {
    const width = 25;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = colors.neon('▰'.repeat(filled)) + colors.dim('▱'.repeat(empty));
    return `${colors.secondary('▸')} ${text} ${colors.primary('[')}${bar}${colors.primary(']')} ${colors.text(percentage + '%')}`;
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
// TABLES - Futuristic Design
// ============================================================================

export const table = {
  // Key-value pairs
  keyValue: (data: Array<[string, string]>, keyWidth: number = 15): void => {
    data.forEach(([key, value]) => {
      console.log(`  ${colors.secondary(key.padEnd(keyWidth))} ${colors.dim(USE_UNICODE ? '▸' : '>')} ${colors.text(value)}`);
    });
  },
  
  // Simple rows with futuristic styling
  rows: (headers: string[], rows: string[][]): void => {
    const widths = headers.map((h, i) => 
      Math.max(h.length, ...rows.map(r => stripAnsi(r[i] || '').length))
    );
    
    if (USE_UNICODE) {
      // Top border
      const topBorder = '┏' + widths.map(w => '━'.repeat(w + 2)).join('┳') + '┓';
      console.log(`  ${colors.primary(topBorder)}`);
      
      // Header
      const headerRow = headers.map((h, i) => colors.text.bold(` ${h.padEnd(widths[i])} `)).join(colors.primary('┃'));
      console.log(`  ${colors.primary('┃')}${headerRow}${colors.primary('┃')}`);
      
      // Separator
      const separator = '┣' + widths.map(w => '━'.repeat(w + 2)).join('╋') + '┫';
      console.log(`  ${colors.dim(separator)}`);
      
      // Data rows
      rows.forEach((row, idx) => {
        const dataRow = row.map((cell, i) => ` ${padEnd(cell, widths[i])} `).join(colors.dim('│'));
        console.log(`  ${colors.dim('┃')}${dataRow}${colors.dim('┃')}`);
        
        // Row separator (except last row)
        if (idx < rows.length - 1) {
          const rowSep = '┣' + widths.map(w => '╍'.repeat(w + 2)).join('┿') + '┫';
          console.log(`  ${colors.subtle(rowSep)}`);
        }
      });
      
      // Bottom border
      const bottomBorder = '┗' + widths.map(w => '━'.repeat(w + 2)).join('┻') + '┛';
      console.log(`  ${colors.dim(bottomBorder)}`);
    } else {
      // ASCII fallback
      // Top border
      const topBorder = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
      console.log(`  ${colors.primary(topBorder)}`);
      
      // Header
      const headerRow = headers.map((h, i) => colors.text.bold(` ${h.padEnd(widths[i])} `)).join(colors.primary('|'));
      console.log(`  ${colors.primary('|')}${headerRow}${colors.primary('|')}`);
      
      // Separator
      const separator = '+' + widths.map(w => '='.repeat(w + 2)).join('+') + '+';
      console.log(`  ${colors.dim(separator)}`);
      
      // Data rows
      rows.forEach((row, idx) => {
        const dataRow = row.map((cell, i) => ` ${padEnd(cell, widths[i])} `).join(colors.dim('|'));
        console.log(`  ${colors.dim('|')}${dataRow}${colors.dim('|')}`);
        
        // Row separator (except last row)
        if (idx < rows.length - 1) {
          const rowSep = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
          console.log(`  ${colors.subtle(rowSep)}`);
        }
      });
      
      // Bottom border
      const bottomBorder = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
      console.log(`  ${colors.dim(bottomBorder)}`);
    }
  },
};

// ============================================================================
// EXPORT ALL
// ============================================================================

// Additional visual elements for enhanced interactivity
export const visual = {
  // Animated banner
  banner: (text: string): string => {
    const width = 60;
    const padding = Math.max(0, width - text.length - 4);
    const left = Math.floor(padding / 2);
    const right = padding - left;
    
    if (USE_UNICODE) {
      return `
${colors.primary('╔' + '═'.repeat(width) + '╗')}
${colors.primary('║')}${colors.gradient1('░')}${colors.gradient2('▒')}${colors.gradient3('▓')}${' '.repeat(left)}${colors.neon.bold(text)}${' '.repeat(right)}${colors.gradient3('▓')}${colors.gradient2('▒')}${colors.gradient1('░')}${colors.primary('║')}
${colors.primary('╚' + '═'.repeat(width) + '╝')}`;
    } else {
      return `
${colors.primary('+' + '='.repeat(width) + '+')}
${colors.primary('|')}${colors.gradient1('.')}${colors.gradient2(':')}${colors.gradient3('#')}${' '.repeat(left)}${colors.neon.bold(text)}${' '.repeat(right)}${colors.gradient3('#')}${colors.gradient2(':')}${colors.gradient1('.')}${colors.primary('|')}
${colors.primary('+' + '='.repeat(width) + '+')}`;
    }
  },
  
  // Glitch effect text
  glitch: (text: string): string => {
    return colors.secondary(text) + colors.dim(USE_UNICODE ? '▓' : '#') + colors.muted(USE_UNICODE ? '░' : '.');
  },
  
  // Neon sign effect
  neon: (text: string): string => {
    return colors.neon.bold(USE_UNICODE ? `⟨⟨ ${text} ⟩⟩` : `<< ${text} >>`);
  },
  
  // Circuit pattern
  circuit: (): string => {
    return colors.dim(USE_UNICODE ? '├─┤ ├─┤ ├─┤ ├─┤ ├─┤ ├─┤ ├─┤ ├─┤ ├─┤ ├─┤' : '+-+ +-+ +-+ +-+ +-+ +-+ +-+ +-+ +-+ +-+');
  },
  
  // Data stream effect
  stream: (): string => {
    const charsUnicode = ['0', '1', '▓', '▒', '░', '◆', '◇', '●', '○'];
    const charsAscii = ['0', '1', '#', ':', '.', '*', 'o', 'O', '-'];
    const chars = USE_UNICODE ? charsUnicode : charsAscii;
    return colors.accent(chars[Math.floor(Math.random() * chars.length)]);
  },
};

// ============================================================================
// SYMBOLS - Platform-aware special characters
// ============================================================================

export const symbols = {
  arrow: USE_UNICODE ? '▸' : '>',
  rightArrow: USE_UNICODE ? '→' : '->',
  leftArrow: USE_UNICODE ? '←' : '<-',
  check: USE_UNICODE ? '✓' : '+',
  cross: USE_UNICODE ? '✗' : 'X',
  warning: USE_UNICODE ? '⚠' : '!',
  dot: USE_UNICODE ? '•' : '*',
  star: USE_UNICODE ? '★' : '*',
  circle: USE_UNICODE ? '◉' : 'O',
  circleEmpty: USE_UNICODE ? '◯' : 'o',
  bullet: USE_UNICODE ? '▸' : '>',
};

// ASCII art decorations
export const deco = {
  topLeft: colors.primary('╔'),
  topRight: colors.primary('╗'),
  bottomLeft: colors.primary('╚'),
  bottomRight: colors.primary('╝'),
  horizontal: colors.primary('═'),
  vertical: colors.primary('║'),
  corner: colors.neon('◆'),
  bullet: colors.accent('▸'),
  arrow: colors.secondary('➤'),
  pointer: colors.primary('▸'),
  dot: colors.accent('●'),
};

export { stripAnsi };
