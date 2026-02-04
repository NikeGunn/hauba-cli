// ============================================================================
// HAUBA CLI - Main Entry Point
// File: tools/cli/src/index.ts
// The first Nepalese AI employee that actually works
// ============================================================================

import { Command } from 'commander';

import { initCommand } from './commands/init.js';
import { skillCommand } from './commands/skill.js';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/login.js';
import { deployCommand } from './commands/deploy.js';
import { daemonCommand } from './commands/daemon.js';
import { doctorCommand } from './commands/doctor.js';
import { onboardAICommand, isFirstRun } from './commands/onboard-ai.js';
import { channelsCommand } from './commands/channels.js';
import { gatewayCommand } from './commands/gateway.js';
import { updateCommand } from './commands/update.js';
import { pairingCommand } from './commands/pairing.js';
import { swarmCommand } from './commands/swarm.js';
import { personaCommand } from './commands/persona.js';
import { marketplaceCommand } from './commands/marketplace.js';
import { versionCommand } from './commands/version.js';
import { ratLogo, colors, msg, section, help, box } from './ui.js';

// ============================================================================
// CLI SETUP
// ============================================================================

const program = new Command();

// Custom help formatting
const customHelp = `
${section.header('COMMANDS')}

${colors.primary('  init')} ${colors.muted('<name>')}           Create a new Hauba project
${colors.primary('  skill')} ${colors.muted('<command>')}       Manage and generate skills
${colors.primary('  login')}                  Authenticate with Hauba
${colors.primary('  logout')}                 Sign out of Hauba
${colors.primary('  whoami')}                 Show current user info
${colors.primary('  deploy')}                 Deploy your agent to production

${section.header('CONNECTIVITY')}

${colors.primary('  channels')} ${colors.muted('<cmd>')}        Manage WhatsApp, Telegram, Slack, Discord
${colors.primary('  gateway')} ${colors.muted('<cmd>')}         Manage the gateway server
${colors.primary('  pairing')} ${colors.muted('<cmd>')}         Manage who can message your agent

${section.header('MULTI-AGENT (UNIQUE)')}

${colors.primary('  swarm')} ${colors.muted('<command>')}       Multi-agent orchestration
${colors.primary('  persona')} ${colors.muted('<cmd>')}         Customize AI personality

${section.header('MARKETPLACE')}

${colors.primary('  marketplace')} ${colors.muted('<cmd>')}     Browse and install skills
${colors.primary('  daemon')} ${colors.muted('<command>')}      Manage background daemon

${section.header('UTILITIES')}

${colors.primary('  doctor')}                 Run health diagnostics
${colors.primary('  onboard')}                AI-guided setup wizard
${colors.primary('  update')}                 Update Hauba CLI
${colors.primary('  version')} ${colors.muted('<cmd>')}         Manage package versioning & npm publishing
${colors.primary('  config')} ${colors.muted('<cmd>')}          Manage configuration

${section.header('QUICK START')}

${help.example('hauba onboard', 'AI-guided setup wizard (recommended for new users)')}

${help.example('hauba channels add whatsapp', 'Connect WhatsApp with QR code')}

${help.example('hauba skill generate', 'Create a skill using AI')}

${help.example('hauba swarm create "My Team"', 'Create a multi-agent swarm')}

${section.header('LEARN MORE')}

  ${colors.muted('Documentation:')}  ${colors.link('https://hauba.dev/docs')}
  ${colors.muted('GitHub:')}         ${colors.link('https://github.com/hauba/cli')}
  ${colors.muted('Discord:')}        ${colors.link('https://discord.gg/hauba')}

`;

program
  .name('hauba')
  .description('HAUBA - The First Nepalese AI Employee')
  .version('1.1.0', '-v, --version', 'Show CLI version')
  .addHelpText('beforeAll', ratLogo)
  .addHelpText('after', customHelp)
  .helpOption('-h, --help', 'Show help information')
  .showHelpAfterError(`\n${colors.muted('Run')} ${colors.primary('hauba --help')} ${colors.muted('for usage')}\n`);

// ============================================================================
// REGISTER COMMANDS
// ============================================================================

// Core commands
program.addCommand(initCommand);
program.addCommand(skillCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(deployCommand);

// Connectivity commands (OpenClaw parity)
program.addCommand(channelsCommand);
program.addCommand(gatewayCommand);
program.addCommand(pairingCommand);

// Multi-agent commands (Unique to Hauba)
program.addCommand(swarmCommand);
program.addCommand(personaCommand);

// Marketplace
program.addCommand(marketplaceCommand);

// System commands
program.addCommand(daemonCommand);
program.addCommand(doctorCommand);
program.addCommand(onboardAICommand);
program.addCommand(updateCommand);
program.addCommand(versionCommand);

// ============================================================================
// CONFIG COMMAND (NEW - for API key management)
// ============================================================================

const configCommand = new Command('config')
  .description('Manage CLI configuration')
  .addCommand(
    new Command('set-key')
      .description('Configure your AI provider API key')
      .option('-p, --provider <provider>', 'AI provider (google, anthropic, openai)', 'google')
      .action(async (options) => {
        const { default: inquirer } = await import('inquirer');
        const ora = await import('ora');
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        
        console.log(ratLogo);
        msg.title('Configure AI Provider', 'Bring Your Own Key');
        
        // Check if logged in
        const authPath = path.join(os.homedir(), '.hauba', 'auth.json');
        let auth;
        try {
          const authContent = await fs.readFile(authPath, 'utf-8');
          auth = JSON.parse(authContent);
        } catch {
          console.log(box.error('NOT AUTHENTICATED', [
            '',
            'You must be logged in to configure API keys.',
            '',
            `Run: ${colors.primary('hauba login')}`,
            '',
          ]));
          process.exit(1);
        }
        
        // Provider selection
        const { provider, apiKey } = await inquirer.prompt([
          {
            type: 'list',
            name: 'provider',
            message: 'Select your AI provider:',
            choices: [
              { name: `${colors.accent('Google AI')} ${colors.muted('(FREE tier available)')}`, value: 'google' },
              { name: 'Anthropic (Claude)', value: 'anthropic' },
              { name: 'OpenAI (GPT)', value: 'openai' },
            ],
            default: options.provider,
          },
          {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your API key:',
            mask: '*',
            validate: (input: string) => {
              if (!input || input.length < 10) {
                return 'Please enter a valid API key';
              }
              return true;
            },
          },
        ]);
        
        // Save to API
        const spinner = ora.default({
          text: 'Saving API key...',
          color: 'magenta',
        }).start();
        
        try {
          const apiUrl = process.env.HAUBA_API_URL || 'http://localhost:3001';
          const response = await fetch(`${apiUrl}/api/settings`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${auth.token}`,
            },
            body: JSON.stringify({
              [`${provider}ApiKey`]: apiKey,
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to save API key: ${response.status}`);
          }
          
          spinner.succeed(colors.accent('API key configured successfully!'));
          
          console.log(`
${section.subheader('NEXT STEPS')}

${colors.muted('  1.')} Generate skills using AI:
     ${colors.primary('$ hauba skill generate')}
     
${colors.muted('  2.')} Or create skills manually:
     ${colors.primary('$ hauba skill create')}

${colors.dim('Your API key is stored securely and only used for AI generation.')}
`);
        } catch (error) {
          spinner.fail(colors.error('Failed to configure API key'));
          if (error instanceof Error) {
            msg.error(error.message);
          }
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('show')
      .description('Show current configuration')
      .action(async () => {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        
        console.log(ratLogo);
        msg.title('Current Configuration');
        
        // Check auth
        const authPath = path.join(os.homedir(), '.hauba', 'auth.json');
        try {
          const authContent = await fs.readFile(authPath, 'utf-8');
          const auth = JSON.parse(authContent);
          
          // Fetch settings from API
          const apiUrl = process.env.HAUBA_API_URL || 'http://localhost:3001';
          const response = await fetch(`${apiUrl}/api/settings`, {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
            },
          });
          
          if (response.ok) {
            const data: any = await response.json();
            const settings = data.data;
            
            console.log(section.subheader('API KEYS'));
            msg.bullet(`Google AI:   ${settings.apiKeysConfigured?.google ? colors.accent('Configured') : colors.muted('Not set')}`);
            msg.bullet(`Anthropic:   ${settings.apiKeysConfigured?.anthropic ? colors.accent('Configured') : colors.muted('Not set')}`);
            msg.bullet(`OpenAI:      ${settings.apiKeysConfigured?.openai ? colors.accent('Configured') : colors.muted('Not set')}`);
            
            console.log(section.subheader('ACCOUNT'));
            msg.bullet(`Email:       ${colors.text(auth.user.email)}`);
            msg.bullet(`Tenant ID:   ${colors.dim(auth.user.tenantId)}`);
          }
        } catch {
          msg.error('Not authenticated. Run: hauba login');
        }
        
        console.log('');
      })
  );

program.addCommand(configCommand);

// ============================================================================
// ERROR HANDLING
// ============================================================================

program.configureOutput({
  writeErr: (str) => {
    // Clean error display
    if (str.includes('error:')) {
      const cleanError = str.replace('error:', colors.error('error:'));
      console.error(cleanError);
    } else {
      console.error(str);
    }
  },
  writeOut: (str) => {
    console.log(str);
  },
});

program.exitOverride((err) => {
  if (err.code === 'commander.help' || err.code === 'commander.version') {
    process.exit(0);
  }
  process.exit(1);
});

// ============================================================================
// PARSE AND RUN
// ============================================================================

export async function run(argv: string[] = process.argv): Promise<void> {
  try {
    // Check for first run - trigger AI onboarding
    if (argv.length <= 2) {
      const firstRun = await isFirstRun();
      if (firstRun) {
        // First time user - start AI-guided onboarding
        console.log(ratLogo);
        console.log(box.simple([
          '',
          `${colors.accent('नमस्ते!')} Welcome to ${colors.primary.bold('HAUBA')}`,
          '',
          colors.muted('The first Nepalese AI employee that actually works.'),
          '',
          'Looks like this is your first time here.',
          "Let's get you set up!",
          '',
        ], 52));
        
        // Small delay then start onboarding
        await new Promise(resolve => setTimeout(resolve, 1000));
        await onboardAICommand.parseAsync(['node', 'hauba', 'onboard']);
        return;
      }
      
      // Not first run - show help
      program.outputHelp();
      return;
    }
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof Error) {
      console.log(box.error('ERROR', [
        '',
        error.message,
        '',
      ]));
    }
    process.exit(1);
  }
}

// Note: Do not auto-run here - bin/hauba.js handles it

export { program };
