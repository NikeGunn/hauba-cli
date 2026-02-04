// ============================================================================
// HAUBA CLI - AI Skill Generation Command (Phase 5)
// File: tools/cli/src/commands/generate.ts
// Professional, rat-themed design with BYOK validation
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  colors,
  ratLogoMini,
  msg,
  section,
  box,
  spinner as uiSpinner,
  status,
  table,
  apiKeyRequired,
} from '../ui.js';

// ============================================================================
// TYPES
// ============================================================================

interface AuthConfig {
  token: string;
  user: {
    email: string;
    tenantId: string;
  };
}

interface SettingsResponse {
  success: boolean;
  data: {
    apiKeysConfigured: {
      google: boolean;
      anthropic: boolean;
      openai: boolean;
    };
  };
}

interface GenerateRequest {
  description: string;
  suggestedTriggers?: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  suggestedPermissions?: string[];
  category?: string;
  examples?: Array<{ input: string; output: string }>;
}

interface GeneratedSkillResponse {
  skillId: string;
  manifest: {
    name: string;
    version: string;
    description: string;
    permissions: string[];
    triggers: Array<{
      type: string;
      config: Record<string, unknown>;
    }>;
  };
  readme: string;
  testCases: Array<{
    input: string;
    expectedBehavior: string;
  }>;
}

// ============================================================================
// UTILITIES
// ============================================================================

async function loadAuth(): Promise<AuthConfig | null> {
  try {
    const authPath = path.join(os.homedir(), '.hauba', 'auth.json');
    const content = await fs.readFile(authPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function checkApiKeys(
  token: string,
  apiUrl: string
): Promise<{ hasKeys: boolean; providers: { google: boolean; anthropic: boolean; openai: boolean } }> {
  try {
    const response = await fetch(`${apiUrl}/api/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { hasKeys: false, providers: { google: false, anthropic: false, openai: false } };
    }

    const result = (await response.json()) as SettingsResponse;
    const providers = result.data.apiKeysConfigured;
    const hasKeys = providers.google || providers.anthropic || providers.openai;
    
    return { hasKeys, providers };
  } catch {
    return { hasKeys: false, providers: { google: false, anthropic: false, openai: false } };
  }
}

async function callGenerateAPI(
  token: string,
  request: GenerateRequest,
  apiUrl: string = 'http://localhost:3001'
): Promise<GeneratedSkillResponse> {
  const response = await fetch(`${apiUrl}/api/skills/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({ error: response.statusText }));
    
    // Handle API key required specifically
    if (response.status === 402 || error.error?.code === 'API_KEY_REQUIRED') {
      const err = new Error('API_KEY_REQUIRED');
      (err as any).code = 'API_KEY_REQUIRED';
      throw err;
    }
    
    throw new Error(error.error?.message || error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const result: any = await response.json();
  return result.data;
}

async function saveSkillToFile(
  skillName: string,
  code: string,
  manifest: GeneratedSkillResponse['manifest'],
  readme: string
): Promise<string> {
  const skillDir = path.join(process.cwd(), skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.mkdir(path.join(skillDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(skillDir, 'tests'), { recursive: true });

  // Save code
  await fs.writeFile(path.join(skillDir, 'src', 'index.ts'), code);

  // Save manifest as skill.json
  await fs.writeFile(
    path.join(skillDir, 'skill.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Save README
  await fs.writeFile(path.join(skillDir, 'README.md'), readme);

  // Create package.json
  const packageJson = {
    name: skillName,
    version: manifest.version,
    description: manifest.description,
    type: 'module',
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      test: 'vitest run',
      dev: 'hauba skill dev',
    },
    dependencies: {
      '@hauba/sdk': '^1.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
      vitest: '^1.0.0',
    },
  };

  await fs.writeFile(
    path.join(skillDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeFile(
    path.join(skillDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  return skillDir;
}

// ============================================================================
// PROMPT USER FOR API KEY SETUP
// ============================================================================

async function promptApiKeySetup(
  auth: AuthConfig,
  apiUrl: string
): Promise<boolean> {
  console.log('');
  apiKeyRequired.show();
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: `${colors.accent('Add API key now')} ${colors.muted('(recommended)')}`, value: 'add-key' },
        { name: `${colors.muted('Create skill manually')} ${colors.dim('(no AI needed)')}`, value: 'manual' },
        { name: `${colors.muted('Exit')}`, value: 'exit' },
      ],
    },
  ]);
  
  if (action === 'exit') {
    return false;
  }
  
  if (action === 'manual') {
    console.log(`
${section.header('MANUAL SKILL CREATION')}

${colors.muted('Create a skill without AI assistance:')}

${colors.primary('$ hauba skill create --manual')}

${colors.muted('This will:')}
  ${colors.dim('1.')} Prompt you for skill name and description
  ${colors.dim('2.')} Create a skill template in your project
  ${colors.dim('3.')} You fill in the implementation manually

${colors.muted('Documentation:')} ${colors.link('https://hauba.dev/docs/skills/manual')}
`);
    return false;
  }
  
  // Add API key flow
  const { provider, apiKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: [
        { name: `${colors.accent('Google AI')} ${colors.muted('(FREE tier available!)')}`, value: 'google' },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
      ],
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
  
  // Save the key
  const saveSpinner = uiSpinner.create('Saving API key...').start();
  
  try {
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
      throw new Error('Failed to save API key');
    }
    
    saveSpinner.succeed(colors.accent('API key configured!'));
    console.log('');
    return true; // Continue with generation
  } catch (error) {
    saveSpinner.fail(colors.error('Failed to save API key'));
    return false;
  }
}

// ============================================================================
// AI SKILL GENERATION COMMAND
// ============================================================================

export const generateCommand = new Command('generate')
  .description('Generate a skill using AI')
  .alias('gen')
  .option('-d, --description <text>', 'Skill description')
  .option('-c, --category <category>', 'Skill category', 'general')
  .option('--api-url <url>', 'Hauba API URL', 'http://localhost:3001')
  .option('--save', 'Save skill to local directory', false)
  .option('-i, --interactive', 'Interactive mode with examples', false)
  .action(async (options: {
    description?: string;
    category: string;
    apiUrl: string;
    save: boolean;
    interactive: boolean;
  }) => {
    console.log(ratLogoMini);
    console.log(section.header('AI SKILL GENERATOR'));
    console.log(colors.muted('  Powered by Claude Sonnet 4 & GPT-4'));
    console.log(colors.dim('  Using your own API keys (BYOK)'));
    console.log('');

    // ========================================
    // STEP 1: Check authentication
    // ========================================
    const auth = await loadAuth();
    if (!auth) {
      console.log(box.error('NOT AUTHENTICATED', [
        '',
        'You must be logged in to generate skills.',
        '',
        `Run: ${colors.primary('hauba login')}`,
        '',
      ]));
      process.exit(1);
    }

    msg.info(`Logged in as ${colors.text(auth.user.email)}`);
    console.log('');

    // ========================================
    // STEP 2: Check API keys BEFORE proceeding
    // ========================================
    const keyCheckSpinner = uiSpinner.create('Checking API key configuration...').start();
    const { hasKeys, providers } = await checkApiKeys(auth.token, options.apiUrl);
    
    if (!hasKeys) {
      keyCheckSpinner.warn(colors.warning('No API keys configured'));
      
      // Offer to add key or go manual
      const shouldContinue = await promptApiKeySetup(auth, options.apiUrl);
      if (!shouldContinue) {
        process.exit(0);
      }
    } else {
      const configuredProviders = Object.entries(providers)
        .filter(([, configured]) => configured)
        .map(([name]) => name)
        .join(', ');
      keyCheckSpinner.succeed(`API keys ready: ${colors.accent(configuredProviders)}`);
    }
    console.log('');

    // ========================================
    // STEP 3: Gather skill requirements
    // ========================================
    let description = options.description;
    let examples: Array<{ input: string; output: string }> = [];

    // Interactive mode
    if (options.interactive || !description) {
      console.log(section.subheader('DESCRIBE YOUR SKILL'));
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: `${colors.primary('?')} What should this skill do?`,
          default: description,
          validate: (input: string) => {
            if (input.length < 10) {
              return 'Please provide more detail (min 10 characters)';
            }
            if (input.length > 1000) {
              return 'Description too long (max 1000 characters)';
            }
            return true;
          },
        },
        {
          type: 'list',
          name: 'category',
          message: 'Skill category:',
          choices: [
            { name: `${colors.secondary('productivity')} ${colors.dim('- Task automation, scheduling')}`, value: 'productivity' },
            { name: `${colors.secondary('communication')} ${colors.dim('- Email, messaging, notifications')}`, value: 'communication' },
            { name: `${colors.secondary('analytics')} ${colors.dim('- Data analysis, reporting')}`, value: 'analytics' },
            { name: `${colors.secondary('integrations')} ${colors.dim('- Third-party APIs, webhooks')}`, value: 'integrations' },
            { name: `${colors.secondary('automation')} ${colors.dim('- Workflows, triggers')}`, value: 'automation' },
            { name: `${colors.secondary('general')} ${colors.dim('- Other use cases')}`, value: 'general' },
          ],
          default: options.category,
        },
        {
          type: 'confirm',
          name: 'addExamples',
          message: `Add example inputs/outputs? ${colors.dim('(improves AI accuracy)')}`,
          default: false,
        },
      ]);

      description = answers.description;
      options.category = answers.category;

      if (answers.addExamples) {
        console.log(`\n${colors.muted('  Add up to 3 examples. Press Enter with empty input when done.')}\n`);
        
        let addMore = true;
        while (addMore && examples.length < 3) {
          const exampleAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'input',
              message: `${colors.dim(`Example ${examples.length + 1}`)} Input:`,
            },
            {
              type: 'input',
              name: 'output',
              message: `${colors.dim(`Example ${examples.length + 1}`)} Expected output:`,
              when: (ans) => ans.input !== '',
            },
          ]);

          if (exampleAnswers.input && exampleAnswers.output) {
            examples.push({
              input: exampleAnswers.input,
              output: exampleAnswers.output,
            });
            msg.success(`Example ${examples.length} added`);
          } else {
            addMore = false;
          }
        }
      }
    }

    if (!description) {
      console.log(box.error('MISSING DESCRIPTION', [
        '',
        'A skill description is required.',
        '',
        `Use: ${colors.primary('hauba skill generate -d "your description"')}`,
        '',
      ]));
      process.exit(1);
    }

    // Show summary before generation
    console.log(section.subheader('GENERATION REQUEST'));
    table.keyValue([
      ['Description', colors.text(description.slice(0, 60) + (description.length > 60 ? '...' : ''))],
      ['Category', colors.secondary(options.category)],
      ['Examples', colors.dim(examples.length.toString())],
    ]);
    console.log('');

    // ========================================
    // STEP 4: Generate skill with AI
    // ========================================
    const genSpinner = uiSpinner.ai('Generating your skill...').start();

    try {
      const request: GenerateRequest = {
        description,
        category: options.category,
      };

      if (examples.length > 0) {
        request.examples = examples;
      }

      // Call API
      const result = await callGenerateAPI(auth.token, request, options.apiUrl);

      genSpinner.succeed(colors.accent('Skill generated successfully!'));
      console.log('');

      // ========================================
      // STEP 5: Display results
      // ========================================
      console.log(box.success('SKILL CREATED', [
        '',
        `${colors.muted('Skill ID:')}     ${colors.text(result.skillId)}`,
        `${colors.muted('Name:')}         ${colors.text(result.manifest.name)}`,
        `${colors.muted('Version:')}      ${colors.dim(result.manifest.version)}`,
        '',
      ]));

      // Permissions
      console.log(section.subheader('PERMISSIONS'));
      result.manifest.permissions.forEach((p) => {
        msg.bullet(colors.secondary(p));
      });

      // Triggers
      console.log(section.subheader('TRIGGERS'));
      result.manifest.triggers.forEach((t, i) => {
        msg.numbered(i + 1, `${colors.secondary(t.type)} ${colors.dim(JSON.stringify(t.config))}`);
      });

      // Test cases
      if (result.testCases.length > 0) {
        console.log(section.subheader('TEST CASES'));
        result.testCases.forEach((tc, i) => {
          msg.numbered(i + 1, colors.text(tc.expectedBehavior));
        });
      }

      // Save to local directory if requested
      if (options.save) {
        console.log('');
        msg.info(`Saving to local directory...`);
        msg.hint(`Use: ${colors.primary(`hauba skill pull ${result.skillId}`)}`);
      }

      // Next steps
      console.log(section.header('NEXT STEPS'));
      msg.numbered(1, `Test in dashboard: ${colors.link('https://hauba.dev/skills/' + result.skillId)}`);
      msg.numbered(2, `View details: ${colors.primary('hauba skill info ' + result.skillId)}`);
      msg.numbered(3, `Deploy: ${colors.primary('hauba agent add-skill <agent-id> ' + result.skillId)}`);
      msg.numbered(4, `Publish: ${colors.primary('hauba skill publish ' + result.skillId)}`);
      console.log('');

    } catch (error) {
      genSpinner.fail(colors.error('Skill generation failed'));
      console.log('');
      
      if ((error as any)?.code === 'API_KEY_REQUIRED') {
        // This shouldn't happen since we checked earlier, but handle it
        apiKeyRequired.show();
        process.exit(1);
      }
      
      if (error instanceof Error) {
        console.log(box.error('GENERATION ERROR', [
          '',
          error.message,
          '',
        ]));
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          msg.hint('Your session may have expired. Try: hauba login');
        }
        
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
          msg.hint(`Make sure the API server is running at ${options.apiUrl}`);
          msg.hint('Start with: pnpm --filter @hauba/api dev');
        }
      }
      
      process.exit(1);
    }
  });

// ============================================================================
// EXPORT
// ============================================================================

export default generateCommand;
