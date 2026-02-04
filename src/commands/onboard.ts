// ============================================================================
// HAUBA CLI - Onboard Command (Interactive Setup Wizard)
// File: tools/cli/src/commands/onboard.ts
// Guide users through complete HAUBA setup
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogo, ratLogoMini, msg, section, box, spinner, status } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

interface OnboardAnswers {
  projectName: string;
  projectPath: string;
  database: 'postgres-local' | 'postgres-docker' | 'postgres-url' | 'skip';
  redis: 'redis-local' | 'redis-docker' | 'skip';
  aiProvider: 'google' | 'anthropic' | 'openai' | 'skip';
  apiKey?: string;
  channels: string[];
  installDaemon: boolean;
  startDaemon: boolean;
}

interface OnboardOptions {
  installDaemon: boolean;
  skipDocker: boolean;
  minimal: boolean;
  yes: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');

// ============================================================================
// STEP IMPLEMENTATIONS
// ============================================================================

/**
 * Step 1: Welcome and introduction
 */
async function stepWelcome(): Promise<void> {
  console.log(ratLogo);

  console.log(box.titled('WELCOME TO HAUBA', [
    '',
    "Let's get your AI agent platform set up!",
    '',
    'This wizard will help you:',
    '',
    `  ${colors.accent('1.')} Configure your environment`,
    `  ${colors.accent('2.')} Set up required services (DB, Redis)`,
    `  ${colors.accent('3.')} Configure AI API keys`,
    `  ${colors.accent('4.')} Install and start the daemon`,
    '',
    colors.muted('Press Enter to continue...'),
    '',
  ], 56));

  await waitForEnter();
}

/**
 * Step 2: Check prerequisites
 */
async function stepPrerequisites(): Promise<boolean> {
  console.log(section.header('CHECKING PREREQUISITES'));

  const checks = [
    {
      name: 'Node.js 18+',
      check: () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0]);
        return major >= 18;
      },
      fix: 'Install Node.js 18+ from https://nodejs.org',
    },
    {
      name: 'pnpm or npm',
      check: () => {
        try {
          execSync('pnpm --version', { stdio: 'pipe' });
          return true;
        } catch {
          try {
            execSync('npm --version', { stdio: 'pipe' });
            return true;
          } catch {
            return false;
          }
        }
      },
      fix: 'Install pnpm: npm install -g pnpm',
    },
    {
      name: 'Docker (optional)',
      check: () => {
        try {
          execSync('docker --version', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      },
      optional: true,
      fix: 'Install Docker from https://docker.com',
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    const s = spinner.create(check.name);
    s.start();
    await new Promise(resolve => setTimeout(resolve, 500));

    if (check.check()) {
      s.succeed(colors.accent(check.name));
    } else if (check.optional) {
      s.warn(`${check.name} ${colors.muted('(optional)')}`);
    } else {
      s.fail(`${check.name} ${colors.error('- required')}`);
      console.log(`     ${colors.muted(check.fix)}`);
      allPassed = false;
    }
  }

  console.log('');
  return allPassed;
}

/**
 * Step 3: Database setup
 */
async function stepDatabase(
  inquirer: typeof import('inquirer').default,
  options: OnboardOptions
): Promise<string | null> {
  console.log(section.header('DATABASE SETUP'));

  if (options.minimal) {
    msg.info('Skipping database setup (minimal mode)');
    return null;
  }

  const choices = [
    {
      name: `${colors.accent('Docker')} - Start PostgreSQL in Docker ${colors.muted('(recommended)')}`,
      value: 'postgres-docker',
    },
    {
      name: 'Local - Use existing PostgreSQL installation',
      value: 'postgres-local',
    },
    {
      name: 'URL - Enter a connection string',
      value: 'postgres-url',
    },
    {
      name: colors.muted('Skip - Configure later'),
      value: 'skip',
    },
  ];

  if (options.skipDocker) {
    choices.shift(); // Remove Docker option
  }

  const { database } = await inquirer.prompt([
    {
      type: 'list',
      name: 'database',
      message: 'How would you like to set up PostgreSQL?',
      choices,
    },
  ]);

  let connectionUrl: string | null = null;

  switch (database) {
    case 'postgres-docker': {
      const s = spinner.create('Starting PostgreSQL container...');
      s.start();

      try {
        // Stop existing container if any
        execSync('docker rm -f hauba-postgres 2>/dev/null || true', { stdio: 'pipe' });

        // Start new container
        execSync(
          'docker run -d --name hauba-postgres -p 5432:5432 -e POSTGRES_PASSWORD=hauba -e POSTGRES_DB=hauba postgres:15-alpine',
          { stdio: 'pipe' }
        );

        await new Promise(resolve => setTimeout(resolve, 3000));
        s.succeed('PostgreSQL started in Docker');
        connectionUrl = 'postgresql://postgres:hauba@localhost:5432/hauba';
        msg.info(`Connection URL: ${colors.muted(connectionUrl)}`);
      } catch (error) {
        s.fail('Failed to start PostgreSQL');
        if (error instanceof Error) {
          console.log(colors.error(error.message));
        }
      }
      break;
    }

    case 'postgres-local': {
      connectionUrl = 'postgresql://localhost:5432/hauba';
      msg.info('Using local PostgreSQL');
      msg.hint('Make sure PostgreSQL is running and the database exists');
      break;
    }

    case 'postgres-url': {
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter your PostgreSQL connection URL:',
          validate: (input: string) => {
            if (!input.startsWith('postgres')) {
              return 'URL should start with postgresql:// or postgres://';
            }
            return true;
          },
        },
      ]);
      connectionUrl = url;
      break;
    }
  }

  console.log('');
  return connectionUrl;
}

/**
 * Step 4: Redis setup
 */
async function stepRedis(
  inquirer: typeof import('inquirer').default,
  options: OnboardOptions
): Promise<string | null> {
  console.log(section.header('REDIS SETUP'));

  if (options.minimal) {
    msg.info('Skipping Redis setup (minimal mode)');
    return null;
  }

  const choices = [
    {
      name: `${colors.accent('Docker')} - Start Redis in Docker ${colors.muted('(recommended)')}`,
      value: 'redis-docker',
    },
    {
      name: 'Local - Use existing Redis installation',
      value: 'redis-local',
    },
    {
      name: colors.muted('Skip - Configure later'),
      value: 'skip',
    },
  ];

  if (options.skipDocker) {
    choices.shift();
  }

  const { redis } = await inquirer.prompt([
    {
      type: 'list',
      name: 'redis',
      message: 'How would you like to set up Redis?',
      choices,
    },
  ]);

  let redisUrl: string | null = null;

  switch (redis) {
    case 'redis-docker': {
      const s = spinner.create('Starting Redis container...');
      s.start();

      try {
        execSync('docker rm -f hauba-redis 2>/dev/null || true', { stdio: 'pipe' });
        execSync('docker run -d --name hauba-redis -p 6379:6379 redis:7-alpine', { stdio: 'pipe' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        s.succeed('Redis started in Docker');
        redisUrl = 'redis://localhost:6379';
      } catch (error) {
        s.fail('Failed to start Redis');
        if (error instanceof Error) {
          console.log(colors.error(error.message));
        }
      }
      break;
    }

    case 'redis-local': {
      redisUrl = 'redis://localhost:6379';
      msg.info('Using local Redis');
      msg.hint('Make sure Redis is running on port 6379');
      break;
    }
  }

  console.log('');
  return redisUrl;
}

/**
 * Step 5: AI Provider setup
 */
async function stepAiProvider(
  inquirer: typeof import('inquirer').default,
  options: OnboardOptions
): Promise<{ provider: string; apiKey: string } | null> {
  console.log(section.header('AI PROVIDER SETUP'));

  console.log(box.simple([
    '',
    'HAUBA uses a Bring-Your-Own-Key (BYOK) model.',
    'You need an API key from one of these providers:',
    '',
    `  ${colors.accent('Google AI')} - Free tier available!`,
    `  ${colors.text('Anthropic')} - Claude models`,
    `  ${colors.text('OpenAI')}    - GPT models`,
    '',
  ], 52));

  if (options.minimal) {
    msg.info('Skipping AI setup (minimal mode)');
    return null;
  }

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which AI provider would you like to use?',
      choices: [
        {
          name: `${colors.accent('Google AI')} ${colors.muted('(FREE tier available)')}`,
          value: 'google',
        },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
        { name: colors.muted('Skip - Configure later'), value: 'skip' },
      ],
    },
  ]);

  if (provider === 'skip') {
    console.log('');
    return null;
  }

  // Show instructions for getting API key
  const instructions: Record<string, string[]> = {
    google: [
      '',
      'To get a Google AI API key (FREE):',
      '',
      `  1. Go to ${colors.link('https://makersuite.google.com/app/apikey')}`,
      '  2. Click "Create API Key"',
      '  3. Copy the key',
      '',
    ],
    anthropic: [
      '',
      'To get an Anthropic API key:',
      '',
      `  1. Go to ${colors.link('https://console.anthropic.com')}`,
      '  2. Navigate to API Keys',
      '  3. Create and copy a new key',
      '',
    ],
    openai: [
      '',
      'To get an OpenAI API key:',
      '',
      `  1. Go to ${colors.link('https://platform.openai.com/api-keys')}`,
      '  2. Create a new secret key',
      '  3. Copy the key',
      '',
    ],
  };

  console.log(box.simple(instructions[provider], 52));

  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Paste your API key:',
      mask: '*',
      validate: (input: string) => {
        if (!input || input.length < 10) {
          return 'Please enter a valid API key';
        }
        return true;
      },
    },
  ]);

  console.log('');
  return { provider, apiKey };
}

/**
 * Step 6: Channels setup
 */
async function stepChannels(
  inquirer: typeof import('inquirer').default,
  options: OnboardOptions
): Promise<string[]> {
  console.log(section.header('COMMUNICATION CHANNELS'));

  if (options.minimal) {
    msg.info('Skipping channels setup (minimal mode)');
    return ['api'];
  }

  const { channels } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'channels',
      message: 'Which channels would you like to enable?',
      choices: [
        {
          name: `${colors.accent('API')} ${colors.muted('(always enabled)')}`,
          value: 'api',
          checked: true,
          disabled: true,
        },
        { name: 'Slack', value: 'slack' },
        { name: 'Telegram', value: 'telegram' },
        { name: 'WhatsApp (Twilio)', value: 'whatsapp' },
        { name: 'Email (SMTP)', value: 'email' },
        { name: 'Web Chat Widget', value: 'webchat' },
      ],
    },
  ]);

  if (channels.length > 1) {
    msg.hint('Configure channel credentials in your .env file');
    msg.bullet('See docs for setup instructions per channel');
  }

  console.log('');
  return channels.length > 0 ? channels : ['api'];
}

/**
 * Step 7: Daemon setup
 */
async function stepDaemon(
  inquirer: typeof import('inquirer').default,
  options: OnboardOptions
): Promise<{ install: boolean; start: boolean }> {
  console.log(section.header('BACKGROUND DAEMON'));

  console.log(box.simple([
    '',
    'The HAUBA daemon runs 24/7 in the background to:',
    '',
    `  ${colors.accent('•')} Process incoming messages`,
    `  ${colors.accent('•')} Execute skills`,
    `  ${colors.accent('•')} Run browser automation`,
    `  ${colors.accent('•')} Handle scheduled tasks`,
    '',
  ], 52));

  if (options.installDaemon || options.yes) {
    return { install: true, start: true };
  }

  if (options.minimal) {
    msg.info('Skipping daemon setup (minimal mode)');
    return { install: false, start: false };
  }

  const { installDaemon, startDaemon } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'installDaemon',
      message: 'Would you like to set up the daemon now?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'startDaemon',
      message: 'Start the daemon after setup?',
      default: true,
      when: (answers: any) => answers.installDaemon,
    },
  ]);

  console.log('');
  return { install: installDaemon, start: startDaemon || false };
}

/**
 * Step 8: Generate configuration files
 */
async function stepGenerateConfig(
  databaseUrl: string | null,
  redisUrl: string | null,
  aiConfig: { provider: string; apiKey: string } | null,
  channels: string[]
): Promise<void> {
  console.log(section.header('GENERATING CONFIGURATION'));

  const s = spinner.create('Creating .env file...');
  s.start();

  const envContent = `# ============================================================================
# HAUBA Environment Configuration
# Generated by: hauba onboard
# Date: ${new Date().toISOString()}
# ============================================================================

NODE_ENV=development

# ============================================================================
# SERVER
# ============================================================================
API_PORT=3001
WEB_PORT=3000
GATEWAY_PORT=18789
DAEMON_PORT=18790

# ============================================================================
# DATABASE
# ============================================================================
${databaseUrl ? `DATABASE_URL=${databaseUrl}` : '# DATABASE_URL=postgresql://localhost:5432/hauba'}

# ============================================================================
# REDIS
# ============================================================================
${redisUrl ? `REDIS_URL=${redisUrl}` : '# REDIS_URL=redis://localhost:6379'}

# ============================================================================
# AI PROVIDERS (BYOK - Bring Your Own Key)
# ============================================================================
${aiConfig?.provider === 'google' ? `GOOGLE_AI_API_KEY=${aiConfig.apiKey}` : '# GOOGLE_AI_API_KEY='}
${aiConfig?.provider === 'anthropic' ? `ANTHROPIC_API_KEY=${aiConfig.apiKey}` : '# ANTHROPIC_API_KEY='}
${aiConfig?.provider === 'openai' ? `OPENAI_API_KEY=${aiConfig.apiKey}` : '# OPENAI_API_KEY='}

# ============================================================================
# CHANNELS
# ============================================================================
# Enabled channels: ${channels.join(', ')}

# Slack
# SLACK_BOT_TOKEN=xoxb-xxx
# SLACK_SIGNING_SECRET=xxx
# SLACK_APP_TOKEN=xapp-xxx

# Telegram
# TELEGRAM_BOT_TOKEN=xxx

# WhatsApp (Twilio)
# WHATSAPP_PHONE_NUMBER_ID=xxx
# WHATSAPP_ACCESS_TOKEN=xxx
# WHATSAPP_WEBHOOK_VERIFY_TOKEN=xxx

# Email (SMTP)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=xxx
# SMTP_PASS=xxx

# ============================================================================
# SECURITY
# ============================================================================
JWT_SECRET=${generateSecret(32)}
SESSION_SECRET=${generateSecret(32)}

# ============================================================================
# OPTIONAL
# ============================================================================
# LOG_LEVEL=debug
# ENABLE_METRICS=true
`;

  try {
    const envPath = path.join(process.cwd(), '.env');
    await fs.writeFile(envPath, envContent);
    s.succeed('.env file created');
  } catch (error) {
    s.fail('Failed to create .env file');
    throw error;
  }

  // Create .hauba directory
  const s2 = spinner.create('Creating ~/.hauba directory...');
  s2.start();
  try {
    await fs.mkdir(HAUBA_DIR, { recursive: true });
    s2.succeed('~/.hauba directory ready');
  } catch {
    s2.warn('~/.hauba directory already exists');
  }

  console.log('');
}

/**
 * Step 9: Final summary
 */
async function stepSummary(
  databaseUrl: string | null,
  redisUrl: string | null,
  aiConfig: { provider: string; apiKey: string } | null,
  channels: string[],
  daemonStarted: boolean
): Promise<void> {
  console.log(section.header('SETUP COMPLETE'));

  console.log(box.success('HAUBA IS READY!', [
    '',
    'Your AI agent platform is configured.',
    '',
    `Database:   ${databaseUrl ? colors.accent('Configured') : colors.muted('Not set')}`,
    `Redis:      ${redisUrl ? colors.accent('Configured') : colors.muted('Not set')}`,
    `AI Key:     ${aiConfig ? colors.accent(aiConfig.provider) : colors.muted('Not set')}`,
    `Channels:   ${colors.accent(channels.join(', '))}`,
    `Daemon:     ${daemonStarted ? colors.accent('Running') : colors.muted('Not started')}`,
    '',
  ]));

  console.log(section.subheader('NEXT STEPS'));

  msg.numbered(1, `Start the dev server: ${colors.primary('pnpm dev')}`);
  msg.numbered(2, `Create your first agent: ${colors.primary('hauba init my-agent')}`);
  msg.numbered(3, `Generate a skill: ${colors.primary('hauba skill generate')}`);
  if (!daemonStarted) {
    msg.numbered(4, `Start the daemon: ${colors.primary('hauba daemon start')}`);
  }

  console.log('');
  console.log(section.subheader('USEFUL COMMANDS'));
  msg.bullet(`${colors.primary('hauba doctor')} - Check system health`);
  msg.bullet(`${colors.primary('hauba daemon status')} - View daemon status`);
  msg.bullet(`${colors.primary('hauba --help')} - See all commands`);

  console.log('');
  msg.hint(`Documentation: ${colors.link('https://hauba.dev/docs')}`);
  msg.hint(`Discord: ${colors.link('https://discord.gg/hauba')}`);
  console.log('');
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Wait for Enter key press
 */
async function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Generate a random secret
 */
function generateSecret(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// MAIN ONBOARD COMMAND
// ============================================================================

export const onboardCommand = new Command('onboard')
  .description('Interactive setup wizard for HAUBA')
  .option('--install-daemon', 'Install and configure the daemon')
  .option('--skip-docker', 'Skip Docker-based setup options')
  .option('--minimal', 'Minimal setup (skip optional steps)')
  .option('-y, --yes', 'Accept all defaults')
  .action(async (options: OnboardOptions) => {
    const { default: inquirer } = await import('inquirer');

    try {
      // Step 1: Welcome
      await stepWelcome();

      // Step 2: Prerequisites
      const prereqPassed = await stepPrerequisites();
      if (!prereqPassed) {
        console.log(box.error('PREREQUISITES NOT MET', [
          '',
          'Please install the required dependencies',
          'and run this command again.',
          '',
        ]));
        process.exit(1);
      }

      // Step 3: Database
      const databaseUrl = await stepDatabase(inquirer, options);

      // Step 4: Redis
      const redisUrl = await stepRedis(inquirer, options);

      // Step 5: AI Provider
      const aiConfig = await stepAiProvider(inquirer, options);

      // Step 6: Channels
      const channels = await stepChannels(inquirer, options);

      // Step 7: Daemon
      const { install: installDaemon, start: startDaemon } = await stepDaemon(inquirer, options);

      // Step 8: Generate config
      await stepGenerateConfig(databaseUrl, redisUrl, aiConfig, channels);

      // Start daemon if requested
      let daemonStarted = false;
      if (installDaemon && startDaemon) {
        console.log(section.subheader('STARTING DAEMON'));
        const s = spinner.create('Starting daemon...');
        s.start();

        try {
          // Import and call daemon start
          const { spawn } = await import('child_process');
          const child = spawn('npx', ['hauba', 'daemon', 'start', '--foreground'], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          await new Promise(resolve => setTimeout(resolve, 3000));
          s.succeed('Daemon started');
          daemonStarted = true;
        } catch (error) {
          s.warn('Could not start daemon automatically');
          msg.hint(`Run ${colors.primary('hauba daemon start')} manually`);
        }
      }

      // Step 9: Summary
      await stepSummary(databaseUrl, redisUrl, aiConfig, channels, daemonStarted);

    } catch (error) {
      if (error instanceof Error && error.message.includes('User force closed')) {
        console.log('\n');
        msg.warn('Setup cancelled');
        process.exit(0);
      }
      throw error;
    }
  });

export default onboardCommand;
