// ============================================================================
// HAUBA CLI - AI-Guided Conversational Onboarding
// File: tools/cli/src/commands/onboard-ai.ts
// Unique feature: Claude-style chat to set up everything
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogo, msg, section, box, spinner } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface ConversationState {
  step: 'intro' | 'name' | 'purpose' | 'channels' | 'ai-provider' | 'api-key' | 'daemon' | 'summary';
  userName?: string;
  projectPurpose?: string;
  channels: string[];
  aiProvider?: string;
  apiKey?: string;
  installDaemon?: boolean;
  errors: string[];
}

interface AIMessage {
  role: 'assistant' | 'user';
  content: string;
}

// ============================================================================
// HAUBA PERSONALITY - The AI Employee
// ============================================================================

const HAUBA_PERSONALITY = {
  greeting: (timeOfDay: string) => `
${colors.primary('╭───────────────────────────────────────────────────────╮')}
${colors.primary('│')}  ${colors.muted('(◉_◉)')} ${colors.text.bold('नमस्ते!')} I'm ${colors.primary.bold('Hauba')}, your AI employee.       ${colors.primary('│')}
${colors.primary('╰───────────────────────────────────────────────────────╯')}

${colors.textLight(`Good ${timeOfDay}! I'm the first Nepalese AI that actually works.`)}
${colors.muted('Let me help you get set up. This will only take a minute.')}
`,

  askName: () => `
${colors.text('Before we begin, what should I call you?')}
${colors.muted('(Just your first name is fine)')}
`,

  greetUser: (name: string) => `
${colors.accent('Nice to meet you, ' + name + '!')} ${colors.muted('🙏')}

${colors.textLight("Now tell me - what kind of work do you need help with?")}
${colors.muted('Examples: "customer support", "data extraction", "email replies"')}
`,

  understandPurpose: (purpose: string) => `
${colors.accent('Got it!')} So you need help with ${colors.primary(purpose)}.

${colors.textLight('I can connect to your messaging apps to help you there.')}
${colors.textLight('Which ones do you use?')}

  ${colors.accent('1.')} WhatsApp ${colors.muted('(personal & business)')}
  ${colors.accent('2.')} Telegram ${colors.muted('(bots & channels)')}
  ${colors.accent('3.')} Slack ${colors.muted('(team workspace)')}
  ${colors.accent('4.')} Discord ${colors.muted('(servers & DMs)')}
  ${colors.accent('5.')} All of the above
  ${colors.accent('6.')} None for now ${colors.muted("(I'll connect later)")}

${colors.muted('Enter numbers separated by commas (e.g., 1,2):')}
`,

  channelsSelected: (channels: string[]) => {
    if (channels.length === 0 || channels.includes('none')) {
      return `
${colors.text('No problem! You can always connect channels later with:')}
${colors.primary('$ hauba channels add')}

${colors.textLight('Now, I need an AI brain to think with.')}
`;
    }
    return `
${colors.accent('Perfect!')} I'll help you set up ${colors.primary(channels.join(', '))}.

${colors.textLight('But first, I need an AI brain to think with.')}
`;
  },

  askAiProvider: () => `
${colors.text('Which AI provider would you like me to use?')}

  ${colors.accent('1.')} ${colors.primary('Google AI')} ${colors.accent('← FREE tier available!')}
  ${colors.accent('2.')} Anthropic ${colors.muted('(Claude)')}
  ${colors.accent('3.')} OpenAI ${colors.muted('(GPT)')}
  ${colors.accent('4.')} I'll configure this later

${colors.muted('Enter 1, 2, 3, or 4:')}
`,

  askApiKey: (provider: string) => {
    const urls: Record<string, string> = {
      google: 'https://makersuite.google.com/app/apikey',
      anthropic: 'https://console.anthropic.com/api-keys',
      openai: 'https://platform.openai.com/api-keys',
    };
    return `
${colors.text(`Great choice! Now I need your ${provider} API key.`)}

${colors.muted('Get one here:')} ${colors.link(urls[provider] || urls.google)}

${colors.muted('Paste your API key (it will be hidden):')}
`;
  },

  askDaemon: (name: string) => `
${colors.accent('Almost done, ' + name + '!')}

${colors.text('Do you want me to run in the background 24/7?')}
${colors.muted('This way I can respond to messages even when you\'re away.')}

  ${colors.accent('1.')} Yes, run continuously ${colors.muted('(recommended)')}
  ${colors.accent('2.')} No, I'll start you manually
  ${colors.accent('3.')} Decide later

${colors.muted('Enter 1, 2, or 3:')}
`,

  summary: (state: ConversationState) => `
${colors.primary('━━━')} ${colors.text.bold('Setup Complete!')} ${colors.primary('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}

${colors.accent('Namaste, ' + state.userName + '!')} Here's what I've set up:

  ${colors.muted('Purpose:')}     ${colors.text(state.projectPurpose || 'General assistance')}
  ${colors.muted('Channels:')}    ${colors.text(state.channels.length > 0 ? state.channels.join(', ') : 'None yet')}
  ${colors.muted('AI Brain:')}    ${colors.text(state.aiProvider || 'Not configured')}
  ${colors.muted('Daemon:')}      ${colors.text(state.installDaemon ? 'Will run 24/7' : 'Manual start')}

${section.subheader('NEXT STEPS')}

${state.channels.includes('whatsapp') ? `  ${colors.primary('$')} hauba channels login whatsapp  ${colors.muted('# Scan QR code')}\n` : ''}${state.channels.includes('telegram') ? `  ${colors.primary('$')} hauba channels login telegram  ${colors.muted('# Enter bot token')}\n` : ''}${state.channels.includes('slack') ? `  ${colors.primary('$')} hauba channels login slack      ${colors.muted('# OAuth login')}\n` : ''}${state.channels.includes('discord') ? `  ${colors.primary('$')} hauba channels login discord    ${colors.muted('# Enter bot token')}\n` : ''}
  ${colors.primary('$')} hauba skill generate  ${colors.muted('# Create your first skill')}
  ${colors.primary('$')} hauba doctor          ${colors.muted('# Check system health')}

${colors.dim('─'.repeat(56))}
${colors.muted("I'm ready to work! Just tell me what to do.")}
${colors.muted('Questions? ')}${colors.link('https://hauba.dev/docs')}
`,

  error: (error: string) => `
${colors.error('Oops!')} ${colors.text(error)}
${colors.muted("Let's try again...")}
`,
};

// ============================================================================
// CONVERSATION ENGINE
// ============================================================================

class ConversationEngine {
  private state: ConversationState;
  private history: AIMessage[] = [];
  private readline: any;

  constructor() {
    this.state = {
      step: 'intro',
      channels: [],
      errors: [],
    };
  }

  async start(): Promise<void> {
    const { createInterface } = await import('readline');
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Clear screen and show logo
    console.clear();
    console.log(ratLogo);

    // Determine time of day
    const hour = new Date().getHours();
    let timeOfDay = 'day';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    // Start conversation
    this.typeMessage(HAUBA_PERSONALITY.greeting(timeOfDay));
    await this.delay(500);

    await this.runConversation();
  }

  private async runConversation(): Promise<void> {
    try {
      // Step 1: Ask name
      this.typeMessage(HAUBA_PERSONALITY.askName());
      const name = await this.prompt('  ');
      this.state.userName = name.trim() || 'Friend';
      this.state.step = 'name';

      // Step 2: Greet and ask purpose
      await this.delay(300);
      this.typeMessage(HAUBA_PERSONALITY.greetUser(this.state.userName));
      const purpose = await this.prompt('  ');
      this.state.projectPurpose = purpose.trim() || 'general assistance';
      this.state.step = 'purpose';

      // Step 3: Ask channels
      await this.delay(300);
      this.typeMessage(HAUBA_PERSONALITY.understandPurpose(this.state.projectPurpose));
      const channelInput = await this.prompt('  ');
      this.state.channels = this.parseChannelSelection(channelInput);
      this.state.step = 'channels';

      // Step 4: Tell about channel selection and ask AI provider
      await this.delay(300);
      this.typeMessage(HAUBA_PERSONALITY.channelsSelected(this.state.channels));
      await this.delay(300);
      this.typeMessage(HAUBA_PERSONALITY.askAiProvider());
      const providerInput = await this.prompt('  ');
      this.state.aiProvider = this.parseProviderSelection(providerInput);
      this.state.step = 'ai-provider';

      // Step 5: Ask for API key if provider selected
      if (this.state.aiProvider && this.state.aiProvider !== 'skip') {
        await this.delay(300);
        this.typeMessage(HAUBA_PERSONALITY.askApiKey(this.state.aiProvider));
        
        // Use password input
        const apiKey = await this.promptPassword('  ');
        if (apiKey && apiKey.length > 10) {
          this.state.apiKey = apiKey;
        }
        this.state.step = 'api-key';
      }

      // Step 6: Ask about daemon
      await this.delay(300);
      this.typeMessage(HAUBA_PERSONALITY.askDaemon(this.state.userName));
      const daemonInput = await this.prompt('  ');
      this.state.installDaemon = daemonInput.trim() === '1';
      this.state.step = 'daemon';

      // Step 7: Save configuration
      await this.delay(300);
      await this.saveConfiguration();

      // Step 8: Show summary
      await this.delay(500);
      this.typeMessage(HAUBA_PERSONALITY.summary(this.state));

      this.readline.close();
    } catch (error) {
      if ((error as Error).message?.includes('close')) {
        console.log('\n');
        msg.warn('Setup cancelled. Run `hauba onboard` anytime to continue.');
        process.exit(0);
      }
      throw error;
    }
  }

  private parseChannelSelection(input: string): string[] {
    const selections = input.split(',').map(s => s.trim());
    const channelMap: Record<string, string> = {
      '1': 'whatsapp',
      '2': 'telegram',
      '3': 'slack',
      '4': 'discord',
      '5': 'whatsapp,telegram,slack,discord',
      '6': 'none',
    };

    const channels: string[] = [];
    for (const sel of selections) {
      const mapped = channelMap[sel];
      if (mapped) {
        if (mapped.includes(',')) {
          channels.push(...mapped.split(','));
        } else if (mapped !== 'none') {
          channels.push(mapped);
        }
      }
    }
    return [...new Set(channels)];
  }

  private parseProviderSelection(input: string): string {
    const providerMap: Record<string, string> = {
      '1': 'google',
      '2': 'anthropic',
      '3': 'openai',
      '4': 'skip',
    };
    return providerMap[input.trim()] || 'skip';
  }

  private async saveConfiguration(): Promise<void> {
    const s = spinner.create('Saving your preferences...');
    s.start();

    try {
      const haubaDir = path.join(os.homedir(), '.hauba');
      await fs.mkdir(haubaDir, { recursive: true });

      // Save config
      const config = {
        version: '1.2.2',
        userName: this.state.userName,
        purpose: this.state.projectPurpose,
        channels: this.state.channels,
        aiProvider: this.state.aiProvider,
        daemon: {
          enabled: this.state.installDaemon,
          autoStart: this.state.installDaemon,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        path.join(haubaDir, 'config.json'),
        JSON.stringify(config, null, 2)
      );

      // Save API key to settings if provided
      if (this.state.apiKey && this.state.aiProvider) {
        const settings = {
          aiProvider: this.state.aiProvider,
          [`${this.state.aiProvider}ApiKey`]: this.state.apiKey,
        };
        await fs.writeFile(
          path.join(haubaDir, 'settings.json'),
          JSON.stringify(settings, null, 2)
        );
      }

      // Initialize channels directory
      const channelsDir = path.join(haubaDir, 'channels');
      await fs.mkdir(channelsDir, { recursive: true });

      for (const channel of this.state.channels) {
        await fs.mkdir(path.join(channelsDir, channel), { recursive: true });
      }

      await this.delay(1000);
      s.succeed('Configuration saved!');
    } catch (error) {
      s.fail('Failed to save configuration');
      throw error;
    }
  }

  private prompt(prefix: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.readline.question(colors.primary(prefix), (answer: string) => {
        resolve(answer);
      });
      this.readline.on('close', () => reject(new Error('User closed input')));
    });
  }

  private async promptPassword(prefix: string): Promise<string> {
    // Simple password prompt that hides input
    return new Promise((resolve) => {
      process.stdout.write(colors.primary(prefix));
      
      let password = '';
      const stdin = process.stdin;
      
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      
      const onData = (char: string) => {
        if (char === '\n' || char === '\r') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          console.log('');
          resolve(password);
        } else if (char === '\u007F' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit(0);
        } else {
          password += char;
          process.stdout.write('*');
        }
      };
      
      stdin.on('data', onData);
    });
  }

  private typeMessage(message: string): void {
    // Instant display for now (could add typing effect later)
    console.log(message);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CHECK FIRST RUN
// ============================================================================

export async function isFirstRun(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.hauba', 'config.json');
  try {
    await fs.access(configPath);
    return false;
  } catch {
    return true;
  }
}

export async function getConfig(): Promise<any> {
  const configPath = path.join(os.homedir(), '.hauba', 'config.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ============================================================================
// COMMAND
// ============================================================================

export const onboardAICommand = new Command('onboard')
  .description('AI-guided interactive setup wizard')
  .option('--manual', 'Use traditional step-by-step setup instead of AI conversation')
  .option('--reset', 'Reset configuration and start fresh')
  .action(async (options): Promise<void> => {
    if (options.reset) {
      const haubaDir = path.join(os.homedir(), '.hauba');
      try {
        await fs.rm(haubaDir, { recursive: true, force: true });
        msg.success('Configuration reset. Starting fresh setup...');
      } catch {
        // Ignore if doesn't exist
      }
    }

    if (options.manual) {
      // Fall back to traditional onboard
      const { onboardCommand } = await import('./onboard.js');
      await onboardCommand.parseAsync(['node', 'hauba', 'onboard']);
      return;
    }

    // Check if already configured
    const config = await getConfig();
    if (config && !options.reset) {
      console.log(ratLogo);
      console.log(box.simple([
        '',
        `${colors.accent('Welcome back, ' + config.userName + '!')}`,
        '',
        `${colors.muted('Hauba is already configured.')}`,
        '',
        `To reconfigure: ${colors.primary('hauba onboard --reset')}`,
        '',
      ], 50));
      return;
    }

    // Start AI conversation
    const engine = new ConversationEngine();
    await engine.start();
  });

export default onboardAICommand;
