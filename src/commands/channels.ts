// ============================================================================
// HAUBA CLI - Channels Command
// File: tools/cli/src/commands/channels.ts
// Manage WhatsApp, Telegram, Slack, Discord connections
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface ChannelConfig {
  type: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: string;
  credentials?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ChannelsStore {
  channels: ChannelConfig[];
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const CHANNELS_FILE = path.join(HAUBA_DIR, 'channels.json');

const SUPPORTED_CHANNELS = {
  whatsapp: {
    name: 'WhatsApp',
    description: 'Connect via QR code (personal & business)',
    icon: '📱',
    loginType: 'qr',
  },
  telegram: {
    name: 'Telegram',
    description: 'Connect with bot token',
    icon: '✈️',
    loginType: 'token',
  },
  slack: {
    name: 'Slack',
    description: 'Connect via OAuth',
    icon: '💼',
    loginType: 'oauth',
  },
  discord: {
    name: 'Discord',
    description: 'Connect with bot token',
    icon: '🎮',
    loginType: 'token',
  },
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function loadChannels(): Promise<ChannelsStore> {
  try {
    const content = await fs.readFile(CHANNELS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { channels: [], updatedAt: new Date().toISOString() };
  }
}

async function saveChannels(store: ChannelsStore): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(CHANNELS_FILE, JSON.stringify(store, null, 2));
}

async function getChannel(type: string): Promise<ChannelConfig | undefined> {
  const store = await loadChannels();
  return store.channels.find(c => c.type === type);
}

async function upsertChannel(channel: ChannelConfig): Promise<void> {
  const store = await loadChannels();
  const index = store.channels.findIndex(c => c.type === channel.type);
  if (index >= 0) {
    store.channels[index] = channel;
  } else {
    store.channels.push(channel);
  }
  await saveChannels(store);
}

async function removeChannel(type: string): Promise<boolean> {
  const store = await loadChannels();
  const index = store.channels.findIndex(c => c.type === type);
  if (index >= 0) {
    store.channels.splice(index, 1);
    await saveChannels(store);
    return true;
  }
  return false;
}

// ============================================================================
// CHANNEL LOGIN HANDLERS
// ============================================================================

/**
 * WhatsApp login via QR code
 */
async function loginWhatsApp(): Promise<boolean> {
  console.log(section.header('WHATSAPP SETUP'));
  
  console.log(box.simple([
    '',
    `${colors.accent("I'll show you a QR code to scan with WhatsApp.")}`,
    '',
    '1. Open WhatsApp on your phone',
    '2. Go to Settings → Linked Devices',
    '3. Tap "Link a Device"',
    '4. Scan the QR code below',
    '',
  ], 52));

  const s = spinner.create('Generating QR code...');
  s.start();

  try {
    // Dynamic import to handle optional dependency
    let qrcode: any;
    try {
      qrcode = await import('qrcode-terminal');
    } catch {
      s.fail('QR code library not installed');
      msg.hint('Run: npm install qrcode-terminal');
      return false;
    }

    // Try to import baileys
    let baileys: any;
    try {
      baileys = await import('@whiskeysockets/baileys');
    } catch {
      s.fail('WhatsApp library not installed');
      msg.hint('Run: npm install @whiskeysockets/baileys');
      
      // Fallback: show manual setup instructions
      console.log('\n' + box.warning('MANUAL SETUP', [
        '',
        'For now, you can set up WhatsApp manually:',
        '',
        '1. Get a WhatsApp Business API account',
        '2. Set WHATSAPP_PHONE_NUMBER_ID in .env',
        '3. Set WHATSAPP_ACCESS_TOKEN in .env',
        '',
      ]));
      return false;
    }

    // Create WhatsApp session directory
    const sessionDir = path.join(HAUBA_DIR, 'channels', 'whatsapp', 'session');
    await fs.mkdir(sessionDir, { recursive: true });

    s.text = 'Connecting to WhatsApp...';

    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Hauba AI', 'Chrome', '120.0.0'],
    });

    return new Promise((resolve) => {
      let resolved = false;

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !resolved) {
          s.stop();
          console.log('\n');
          msg.info('Scan this QR code with WhatsApp:');
          console.log('');
          qrcode.generate(qr, { small: true });
          console.log('');
          console.log(colors.muted('Waiting for scan...'));
        }

        if (connection === 'open' && !resolved) {
          resolved = true;
          s.succeed('WhatsApp connected!');
          
          // Save channel config
          await upsertChannel({
            type: 'whatsapp',
            name: 'WhatsApp',
            status: 'connected',
            lastConnected: new Date().toISOString(),
            metadata: {
              sessionDir,
            },
          });

          // Close socket (will reconnect when daemon starts)
          sock.end(undefined as any);
          resolve(true);
        }

        if (connection === 'close' && !resolved) {
          const reason = (lastDisconnect?.error as any)?.output?.statusCode;
          if (reason === DisconnectReason.loggedOut) {
            s.fail('WhatsApp logged out');
            resolved = true;
            resolve(false);
          } else if (reason !== DisconnectReason.restartRequired) {
            // Retry
            s.text = 'Reconnecting...';
          }
        }
      });

      sock.ev.on('creds.update', saveCreds as any);

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          s.fail('Connection timed out');
          sock.end(undefined as any);
          resolve(false);
        }
      }, 120000);
    });
  } catch (error) {
    s.fail('WhatsApp setup failed');
    if (error instanceof Error) {
      msg.error(error.message);
    }
    return false;
  }
}

/**
 * Telegram login via bot token
 */
async function loginTelegram(): Promise<boolean> {
  console.log(section.header('TELEGRAM SETUP'));

  console.log(box.simple([
    '',
    `${colors.accent('Create a Telegram bot to get started:')}`,
    '',
    '1. Open Telegram and search for @BotFather',
    '2. Send /newbot and follow the prompts',
    '3. Copy the API token it gives you',
    '',
    `${colors.link('https://t.me/BotFather')}`,
    '',
  ], 52));

  const { default: inquirer } = await import('inquirer');

  const { botToken } = await inquirer.prompt([
    {
      type: 'password',
      name: 'botToken',
      message: 'Paste your Telegram bot token:',
      mask: '*',
      validate: (input: string) => {
        if (!input || !input.includes(':')) {
          return 'Invalid token format. Should be like: 123456:ABC-DEF...';
        }
        return true;
      },
    },
  ]);

  const s = spinner.create('Verifying bot token...');
  s.start();

  try {
    // Verify token by calling getMe
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data: any = await response.json();

    if (!data.ok) {
      s.fail('Invalid bot token');
      return false;
    }

    const botInfo = data.result;
    s.succeed(`Connected to @${botInfo.username}`);

    // Save channel config
    await upsertChannel({
      type: 'telegram',
      name: `@${botInfo.username}`,
      status: 'connected',
      lastConnected: new Date().toISOString(),
      credentials: {
        botToken,
      },
      metadata: {
        botId: botInfo.id,
        botUsername: botInfo.username,
        botName: botInfo.first_name,
      },
    });

    msg.success(`Bot: ${colors.accent(botInfo.first_name)} (@${botInfo.username})`);

    // Ask about webhook vs polling
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'How should Hauba receive messages?',
        choices: [
          { name: `${colors.accent('Polling')} - Hauba checks for new messages ${colors.muted('(easier)')}`, value: 'polling' },
          { name: 'Webhook - Telegram sends messages to your server', value: 'webhook' },
        ],
      },
    ]);

    if (mode === 'webhook') {
      const { webhookUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'webhookUrl',
          message: 'Enter your webhook URL (https://...):',
          validate: (input: string) => input.startsWith('https://') || 'Must be HTTPS URL',
        },
      ]);

      // Set webhook
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl + '/telegram')}`
      );
      const webhookData: any = await webhookResponse.json();

      if (webhookData.ok) {
        msg.success('Webhook configured!');
      } else {
        msg.warn('Failed to set webhook: ' + webhookData.description);
      }
    }

    return true;
  } catch (error) {
    s.fail('Telegram setup failed');
    if (error instanceof Error) {
      msg.error(error.message);
    }
    return false;
  }
}

/**
 * Slack login via OAuth
 */
async function loginSlack(): Promise<boolean> {
  console.log(section.header('SLACK SETUP'));

  console.log(box.simple([
    '',
    `${colors.accent('Create a Slack app to get started:')}`,
    '',
    '1. Go to https://api.slack.com/apps',
    '2. Click "Create New App" → "From scratch"',
    '3. Name it "Hauba" and select your workspace',
    '4. Go to "OAuth & Permissions"',
    '5. Add Bot Token Scopes: chat:write, im:read, im:write',
    '6. Install to Workspace and copy the Bot Token',
    '',
    `${colors.link('https://api.slack.com/apps')}`,
    '',
  ], 56));

  const { default: inquirer } = await import('inquirer');

  const { botToken, signingSecret } = await inquirer.prompt([
    {
      type: 'password',
      name: 'botToken',
      message: 'Bot User OAuth Token (xoxb-...):',
      mask: '*',
      validate: (input: string) => {
        if (!input.startsWith('xoxb-')) {
          return 'Should start with xoxb-';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'signingSecret',
      message: 'Signing Secret (from Basic Information):',
      mask: '*',
      validate: (input: string) => input.length > 10 || 'Invalid signing secret',
    },
  ]);

  const s = spinner.create('Verifying Slack credentials...');
  s.start();

  try {
    // Verify token by calling auth.test
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });
    const data: any = await response.json();

    if (!data.ok) {
      s.fail('Invalid bot token: ' + data.error);
      return false;
    }

    s.succeed(`Connected to ${data.team}`);

    // Save channel config
    await upsertChannel({
      type: 'slack',
      name: data.team,
      status: 'connected',
      lastConnected: new Date().toISOString(),
      credentials: {
        botToken,
        signingSecret,
      },
      metadata: {
        teamId: data.team_id,
        teamName: data.team,
        botUserId: data.user_id,
        botId: data.bot_id,
      },
    });

    msg.success(`Workspace: ${colors.accent(data.team)}`);
    msg.success(`Bot User: ${colors.accent(data.user)}`);

    // Ask about Socket Mode vs HTTP
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'How should Hauba receive messages?',
        choices: [
          { name: `${colors.accent('Socket Mode')} - Real-time, no public URL needed ${colors.muted('(recommended)')}`, value: 'socket' },
          { name: 'HTTP - Events sent to your server', value: 'http' },
        ],
      },
    ]);

    if (mode === 'socket') {
      const { appToken } = await inquirer.prompt([
        {
          type: 'password',
          name: 'appToken',
          message: 'App-Level Token (xapp-...):',
          mask: '*',
          validate: (input: string) => input.startsWith('xapp-') || 'Should start with xapp-',
        },
      ]);

      const store = await loadChannels();
      const channel = store.channels.find(c => c.type === 'slack');
      if (channel?.credentials) {
        channel.credentials.appToken = appToken;
        await saveChannels(store);
      }
      msg.success('Socket Mode configured!');
    }

    return true;
  } catch (error) {
    s.fail('Slack setup failed');
    if (error instanceof Error) {
      msg.error(error.message);
    }
    return false;
  }
}

/**
 * Discord login via bot token
 */
async function loginDiscord(): Promise<boolean> {
  console.log(section.header('DISCORD SETUP'));

  console.log(box.simple([
    '',
    `${colors.accent('Create a Discord bot to get started:')}`,
    '',
    '1. Go to https://discord.com/developers/applications',
    '2. Click "New Application" and name it "Hauba"',
    '3. Go to "Bot" and click "Add Bot"',
    '4. Copy the bot token',
    '5. Enable "Message Content Intent" under Privileged Intents',
    '',
    `${colors.link('https://discord.com/developers/applications')}`,
    '',
  ], 56));

  const { default: inquirer } = await import('inquirer');

  const { botToken } = await inquirer.prompt([
    {
      type: 'password',
      name: 'botToken',
      message: 'Bot Token:',
      mask: '*',
      validate: (input: string) => input.length > 50 || 'Invalid token length',
    },
  ]);

  const s = spinner.create('Verifying Discord bot...');
  s.start();

  try {
    // Verify token by calling /users/@me
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      s.fail('Invalid bot token');
      return false;
    }

    const data: any = await response.json();
    s.succeed(`Connected as ${data.username}#${data.discriminator || '0'}`);

    // Save channel config
    await upsertChannel({
      type: 'discord',
      name: data.username,
      status: 'connected',
      lastConnected: new Date().toISOString(),
      credentials: {
        botToken,
      },
      metadata: {
        botId: data.id,
        botUsername: data.username,
        botDiscriminator: data.discriminator,
      },
    });

    // Generate invite link
    const { clientId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'clientId',
        message: 'Application ID (from General Information):',
        validate: (input: string) => /^\d+$/.test(input) || 'Should be a number',
      },
    ]);

    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=274877910016&scope=bot`;
    
    console.log('\n' + box.simple([
      '',
      `${colors.accent('Invite Hauba to your server:')}`,
      '',
      colors.link(inviteUrl),
      '',
    ], 60));

    return true;
  } catch (error) {
    s.fail('Discord setup failed');
    if (error instanceof Error) {
      msg.error(error.message);
    }
    return false;
  }
}

// ============================================================================
// COMMAND: hauba channels
// ============================================================================

export const channelsCommand = new Command('channels')
  .description('Manage messaging channels (WhatsApp, Telegram, Slack, Discord)')
  .addHelpText('after', `
${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba channels list
  ${colors.primary('$')} hauba channels add whatsapp
  ${colors.primary('$')} hauba channels login telegram
  ${colors.primary('$')} hauba channels status
  ${colors.primary('$')} hauba channels remove slack
`);

// ============================================================================
// SUBCOMMAND: hauba channels list
// ============================================================================

channelsCommand
  .command('list')
  .description('List all connected channels')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('CONNECTED CHANNELS'));

    const store = await loadChannels();

    if (store.channels.length === 0) {
      console.log(box.simple([
        '',
        `${colors.muted('No channels connected yet.')}`,
        '',
        `Run: ${colors.primary('hauba channels add <channel>')}`,
        '',
      ], 45));
      return;
    }

    const rows = store.channels.map(c => {
      const info = SUPPORTED_CHANNELS[c.type as keyof typeof SUPPORTED_CHANNELS];
      const statusColor = c.status === 'connected' ? colors.accent : 
                         c.status === 'error' ? colors.error : colors.muted;
      return [
        `${info?.icon || '📡'} ${colors.text(c.name)}`,
        statusColor(c.status),
        colors.muted(c.lastConnected ? new Date(c.lastConnected).toLocaleDateString() : '-'),
      ];
    });

    table.rows(['CHANNEL', 'STATUS', 'CONNECTED'], rows);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba channels add
// ============================================================================

channelsCommand
  .command('add [channel]')
  .description('Add a new channel')
  .action(async (channel?: string) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');

    if (!channel) {
      // Interactive selection
      const { selectedChannel } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedChannel',
          message: 'Which channel would you like to add?',
          choices: Object.entries(SUPPORTED_CHANNELS).map(([key, info]) => ({
            name: `${info.icon} ${info.name} - ${colors.muted(info.description)}`,
            value: key,
          })),
        },
      ]);
      channel = selectedChannel as string;
    }
    
    // At this point channel is guaranteed to be a string
    const channelType = channel as string;

    // Check if valid channel
    if (!SUPPORTED_CHANNELS[channelType as keyof typeof SUPPORTED_CHANNELS]) {
      msg.error(`Unknown channel: ${channelType}`);
      msg.info(`Supported: ${Object.keys(SUPPORTED_CHANNELS).join(', ')}`);
      process.exit(1);
    }

    // Check if already connected
    const existing = await getChannel(channelType);
    if (existing && existing.status === 'connected') {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `${SUPPORTED_CHANNELS[channelType as keyof typeof SUPPORTED_CHANNELS].name} is already connected. Reconnect?`,
          default: false,
        },
      ]);
      if (!overwrite) return;
    }

    // Run appropriate login flow
    let success = false;
    switch (channelType) {
      case 'whatsapp':
        success = await loginWhatsApp();
        break;
      case 'telegram':
        success = await loginTelegram();
        break;
      case 'slack':
        success = await loginSlack();
        break;
      case 'discord':
        success = await loginDiscord();
        break;
    }

    if (success) {
      console.log('\n' + box.success('CHANNEL CONNECTED', [
        '',
        `${SUPPORTED_CHANNELS[channelType as keyof typeof SUPPORTED_CHANNELS].name} is ready!`,
        '',
        `Start the daemon to begin receiving messages:`,
        `${colors.primary('$ hauba daemon start')}`,
        '',
      ]));
    }
  });

// ============================================================================
// SUBCOMMAND: hauba channels login
// ============================================================================

channelsCommand
  .command('login <channel>')
  .description('Authenticate with a channel')
  .action(async (channel: string) => {
    // Alias for add
    const addCmd = channelsCommand.commands.find(c => c.name() === 'add');
    if (addCmd) {
      await addCmd.parseAsync(['node', 'hauba', 'channels', 'add', channel]);
    }
  });

// ============================================================================
// SUBCOMMAND: hauba channels logout
// ============================================================================

channelsCommand
  .command('logout <channel>')
  .description('Disconnect from a channel')
  .action(async (channel: string) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');

    const existing = await getChannel(channel);
    if (!existing) {
      msg.warn(`${channel} is not connected`);
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Disconnect from ${existing.name}?`,
        default: false,
      },
    ]);

    if (!confirm) return;

    const s = spinner.create('Disconnecting...');
    s.start();

    // Remove session files
    const channelDir = path.join(HAUBA_DIR, 'channels', channel);
    try {
      await fs.rm(channelDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }

    // Remove from store
    await removeChannel(channel);

    s.succeed(`Disconnected from ${existing.name}`);
  });

// ============================================================================
// SUBCOMMAND: hauba channels remove
// ============================================================================

channelsCommand
  .command('remove <channel>')
  .description('Remove a channel completely')
  .action(async (channel: string) => {
    // Alias for logout
    const logoutCmd = channelsCommand.commands.find(c => c.name() === 'logout');
    if (logoutCmd) {
      await logoutCmd.parseAsync(['node', 'hauba', 'channels', 'logout', channel]);
    }
  });

// ============================================================================
// SUBCOMMAND: hauba channels status
// ============================================================================

channelsCommand
  .command('status')
  .description('Check status of all channels')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('CHANNEL STATUS'));

    const store = await loadChannels();

    if (store.channels.length === 0) {
      msg.info('No channels configured');
      msg.hint(`Add one with: ${colors.primary('hauba channels add')}`);
      return;
    }

    for (const channel of store.channels) {
      const s = spinner.create(`Checking ${channel.name}...`);
      s.start();

      try {
        let isOnline = false;

        switch (channel.type) {
          case 'telegram':
            if (channel.credentials?.botToken) {
              const response = await fetch(
                `https://api.telegram.org/bot${channel.credentials.botToken}/getMe`
              );
              const data: any = await response.json();
              isOnline = data.ok;
            }
            break;

          case 'slack':
            if (channel.credentials?.botToken) {
              const response = await fetch('https://slack.com/api/auth.test', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${channel.credentials.botToken}`,
                },
              });
              const data: any = await response.json();
              isOnline = data.ok;
            }
            break;

          case 'discord':
            if (channel.credentials?.botToken) {
              const response = await fetch('https://discord.com/api/v10/users/@me', {
                headers: {
                  'Authorization': `Bot ${channel.credentials.botToken}`,
                },
              });
              isOnline = response.ok;
            }
            break;

          case 'whatsapp':
            // Check if session exists
            const sessionDir = path.join(HAUBA_DIR, 'channels', 'whatsapp', 'session');
            try {
              await fs.access(sessionDir);
              isOnline = true;
            } catch {
              isOnline = false;
            }
            break;
        }

        if (isOnline) {
          s.succeed(`${channel.name}: ${colors.accent('Online')}`);
          channel.status = 'connected';
        } else {
          s.fail(`${channel.name}: ${colors.error('Offline')}`);
          channel.status = 'disconnected';
        }
      } catch (error) {
        s.fail(`${channel.name}: ${colors.error('Error')}`);
        channel.status = 'error';
      }
    }

    await saveChannels(store);
    console.log('');
  });

export default channelsCommand;
