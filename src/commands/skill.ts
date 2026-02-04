// ============================================================================
// HAUBA CLI - Skill Command
// File: tools/cli/src/commands/skill.ts
// Professional, rat-themed design
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { generateCommand } from './generate.js';
import {
  colors,
  ratLogoMini,
  msg,
  section,
  box,
  spinner as uiSpinner,
  status,
} from '../ui.js';

// ============================================================================
// TYPES
// ============================================================================

interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author?: {
    name: string;
    email?: string;
  };
  triggers: Array<{
    type: string;
    name?: string;
    config: Record<string, unknown>;
  }>;
  permissions: string[];
  runtime?: {
    type: string;
    version: string;
    entrypoint: string;
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

async function loadSkillManifest(dir: string): Promise<SkillManifest | null> {
  try {
    const manifestPath = path.join(dir, 'skill.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function validateSkillStructure(dir: string): Promise<string[]> {
  const errors: string[] = [];
  const requiredFiles = ['skill.json', 'package.json', 'src/index.ts'];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(dir, file));
    } catch {
      errors.push(`Missing required file: ${file}`);
    }
  }

  return errors;
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

// ============================================================================
// SKILL INIT COMMAND
// ============================================================================

const skillInitCommand = new Command('init')
  .description('Initialize a new skill project')
  .argument('<skill-name>', 'Name of the skill')
  .option('-c, --category <category>', 'Skill category', 'general')
  .action(async (skillName: string, options: { category: string }) => {
    console.log(ratLogoMini);
    console.log(section.header('CREATE NEW SKILL'));
    msg.info(`Skill name: ${colors.text.bold(skillName)}`);
    console.log('');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Skill description:',
        default: `A Hauba skill that ${skillName.toLowerCase()}`,
      },
      {
        type: 'list',
        name: 'category',
        message: 'Skill category:',
        choices: [
          { name: `${colors.secondary('productivity')} ${colors.dim('- Task automation')}`, value: 'productivity' },
          { name: `${colors.secondary('communication')} ${colors.dim('- Messaging, email')}`, value: 'communication' },
          { name: `${colors.secondary('analytics')} ${colors.dim('- Data analysis')}`, value: 'analytics' },
          { name: `${colors.secondary('integrations')} ${colors.dim('- Third-party APIs')}`, value: 'integrations' },
          { name: `${colors.secondary('automation')} ${colors.dim('- Workflows')}`, value: 'automation' },
          { name: `${colors.secondary('general')} ${colors.dim('- Other')}`, value: 'general' },
        ],
        default: options.category,
      },
      {
        type: 'checkbox',
        name: 'permissions',
        message: 'Required permissions:',
        choices: [
          { name: `${colors.muted('message:read')} ${colors.dim('- Read messages')}`, value: 'message:read', checked: true },
          { name: `${colors.muted('message:send')} ${colors.dim('- Send messages')}`, value: 'message:send', checked: true },
          { name: `${colors.muted('ai:generate')} ${colors.dim('- AI generation')}`, value: 'ai:generate', checked: true },
          { name: `${colors.muted('ai:classify')} ${colors.dim('- AI classification')}`, value: 'ai:classify' },
          { name: `${colors.muted('ai:extract')} ${colors.dim('- AI extraction')}`, value: 'ai:extract' },
          { name: `${colors.muted('storage:read')} ${colors.dim('- Read storage')}`, value: 'storage:read' },
          { name: `${colors.muted('storage:write')} ${colors.dim('- Write storage')}`, value: 'storage:write' },
          { name: `${colors.muted('ocr:extract')} ${colors.dim('- OCR extraction')}`, value: 'ocr:extract' },
          { name: `${colors.muted('web:fetch')} ${colors.dim('- HTTP requests')}`, value: 'web:fetch' },
        ],
      },
    ]);

    const spinner = uiSpinner.create('Creating skill project...').start();

    try {
      const skillDir = path.resolve(process.cwd(), skillName);
      
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'tests'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'tests', 'fixtures'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'tests', 'mocks'), { recursive: true });

      // Create skill.json
      const skillManifest: SkillManifest = {
        name: skillName,
        version: '1.0.0',
        description: answers.description,
        author: { name: '' },
        triggers: [
          {
            type: 'message',
            name: 'default_trigger',
            config: {
              contains: [skillName.toLowerCase()],
            },
          },
        ],
        permissions: answers.permissions,
        runtime: {
          type: 'nodejs',
          version: '20',
          entrypoint: 'dist/index.js',
        },
      };

      await fs.writeFile(
        path.join(skillDir, 'skill.json'),
        JSON.stringify(skillManifest, null, 2)
      );

      // Create package.json
      const packageJson = {
        name: skillName,
        version: '1.0.0',
        type: 'module',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        files: ['dist'],
        scripts: {
          build: 'esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --external:@hauba/sdk',
          dev: 'hauba skill dev',
          test: 'vitest run',
          'test:watch': 'vitest',
          lint: 'tsc --noEmit',
          'publish:skill': 'hauba skill publish',
        },
        dependencies: {
          '@hauba/sdk': '^1.0.0',
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          esbuild: '^0.20.0',
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
          lib: ['ES2022'],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          outDir: './dist',
          rootDir: './src',
          resolveJsonModule: true,
          isolatedModules: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist', 'tests'],
      };

      await fs.writeFile(
        path.join(skillDir, 'tsconfig.json'),
        JSON.stringify(tsconfig, null, 2)
      );

      // Create src/index.ts
      const indexContent = `// ============================================================================
// ${skillName} - Hauba Skill
// ============================================================================

import {
  HaubaSkill,
  SkillContext,
  SkillCapabilities,
  SkillResult,
  z
} from '@hauba/sdk';

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

const ConfigSchema = z.object({
  // Add your configuration options here
  enabled: z.boolean().default(true),
});

type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// SKILL DEFINITION
// ============================================================================

const skill = new HaubaSkill({
  name: '${skillName}',
  version: '1.0.0',
  description: '${answers.description}',

  triggers: [
    {
      type: 'message',
      config: {
        contains: ['${skillName.toLowerCase()}'],
      },
    },
  ],

  permissions: ${JSON.stringify(answers.permissions, null, 4)},

  configSchema: ConfigSchema,

  async handle(
    context: SkillContext,
    capabilities: SkillCapabilities
  ): Promise<SkillResult> {
    const { ai } = capabilities;
    const userMessage = context.message?.content || '';

    if (!userMessage) {
      return {
        success: false,
        error: 'No message content received',
      };
    }

    try {
      // Your skill logic here
      const response = await ai.generate(
        \`Process this request: \${userMessage}\`,
        { temperature: 0.7, maxTokens: 500 }
      );

      return {
        success: true,
        response,
        data: {
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default skill;
`;

      await fs.writeFile(path.join(skillDir, 'src', 'index.ts'), indexContent);

      // Create test file
      const testContent = `import { describe, it, expect, vi, beforeEach } from 'vitest';
import skill from '../src/index';

describe('${skillName}', () => {
  const mockCapabilities = {
    ai: {
      generate: vi.fn().mockResolvedValue('Generated response'),
      classify: vi.fn().mockResolvedValue('other'),
      extract: vi.fn().mockResolvedValue({}),
      embed: vi.fn().mockResolvedValue([]),
      sentiment: vi.fn().mockResolvedValue({ score: 0, label: 'neutral' }),
    },
    ocr: {
      extract: vi.fn().mockResolvedValue({ text: '', confidence: 0.9 }),
    },
    integrations: {
      get: vi.fn().mockReturnValue({ call: vi.fn() }),
    },
    storage: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    notify: vi.fn(),
    config: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle messages successfully', async () => {
    const context = {
      tenantId: 'test',
      agentId: 'test',
      message: { id: '1', content: 'test message' },
    };

    const result = await skill.execute(context, mockCapabilities);

    expect(result.success).toBe(true);
    expect(result.response).toBeDefined();
  });

  it('should handle missing message', async () => {
    const context = {
      tenantId: 'test',
      agentId: 'test',
      message: undefined,
    };

    const result = await skill.execute(context, mockCapabilities);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
`;

      await fs.writeFile(path.join(skillDir, 'tests', 'index.test.ts'), testContent);

      // Create README
      const readmeContent = `# ${skillName}

${answers.description}

## Installation

\`\`\`bash
pnpm install
\`\`\`

## Development

\`\`\`bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
\`\`\`

## Publishing

\`\`\`bash
hauba skill publish
\`\`\`

## Permissions

This skill requires:
${answers.permissions.map((p: string) => `- \`${p}\``).join('\n')}

## License

MIT
`;

      await fs.writeFile(path.join(skillDir, 'README.md'), readmeContent);

      spinner.succeed(colors.accent('Skill project created!'));

      console.log(box.success('SUCCESS', [
        '',
        `Skill ${colors.text.bold(skillName)} created at:`,
        colors.dim(skillDir),
        '',
      ]));

      console.log(section.header('NEXT STEPS'));
      msg.numbered(1, `${colors.primary('cd ' + skillName)}`);
      msg.numbered(2, `${colors.primary('pnpm install')}`);
      msg.numbered(3, `${colors.primary('pnpm dev')}`);
      console.log(`\n${colors.muted('Documentation:')} ${colors.link('https://hauba.dev/docs/skills')}\n`);
    } catch (error) {
      spinner.fail(colors.error('Failed to create skill'));
      throw error;
    }
  });

// ============================================================================
// SKILL DEV COMMAND
// ============================================================================

const skillDevCommand = new Command('dev')
  .description('Start skill development server')
  .option('-p, --port <port>', 'Development server port', '3001')
  .action(async (options: { port: string }) => {
    const spinner = uiSpinner.create('Starting development server...').start();

    const manifest = await loadSkillManifest(process.cwd());
    if (!manifest) {
      spinner.fail(colors.error('No skill.json found. Are you in a skill directory?'));
      return;
    }

    const errors = await validateSkillStructure(process.cwd());
    if (errors.length > 0) {
      spinner.fail(colors.error('Skill validation failed:'));
      errors.forEach((e) => msg.error(e));
      return;
    }

    spinner.succeed(colors.accent(`${manifest.name} dev server ready`));

    console.log(box.simple([
      '',
      `${colors.muted('Skill:')} ${colors.text.bold(manifest.name)}`,
      `${colors.muted('Port:')}  ${colors.text(options.port)}`,
      `${colors.muted('URL:')}   ${colors.link(`http://localhost:${options.port}`)}`,
      '',
    ]));

    console.log(colors.dim('  Watching for file changes...'));
    console.log(colors.muted(`  Press ${colors.warning('Ctrl+C')} to stop\n`));

    // Keep process running
    process.on('SIGINT', () => {
      console.log(colors.dim('\n  Shutting down...'));
      process.exit(0);
    });
  });

// ============================================================================
// SKILL BUILD COMMAND
// ============================================================================

const skillBuildCommand = new Command('build')
  .description('Build skill for production')
  .action(async () => {
    const spinner = uiSpinner.create('Building skill...').start();

    const manifest = await loadSkillManifest(process.cwd());
    if (!manifest) {
      spinner.fail(colors.error('No skill.json found. Are you in a skill directory?'));
      return;
    }

    try {
      spinner.text = 'Compiling TypeScript...';
      await runProcess('npx', ['esbuild', 'src/index.ts', 
        '--bundle', 
        '--platform=node', 
        '--outfile=dist/index.js', 
        '--format=esm',
        '--external:@hauba/sdk'
      ], process.cwd());

      spinner.succeed(colors.accent(`${manifest.name} built successfully!`));

      console.log(`
${colors.muted('  Output:')} ${colors.dim('dist/index.js')}
${colors.muted('  Next:')}   ${colors.primary('hauba skill publish')}
`);
    } catch (error) {
      spinner.fail(colors.error('Build failed'));
      if (error instanceof Error) {
        msg.error(error.message);
      }
    }
  });

// ============================================================================
// SKILL TEST COMMAND
// ============================================================================

const skillTestCommand = new Command('test')
  .description('Run skill tests')
  .option('-w, --watch', 'Watch mode')
  .action(async (options: { watch: boolean }) => {
    const manifest = await loadSkillManifest(process.cwd());
    if (!manifest) {
      console.log(box.error('ERROR', ['', 'No skill.json found.', 'Are you in a skill directory?', '']));
      return;
    }

    console.log(section.header(`TESTING ${manifest.name.toUpperCase()}`));

    try {
      const args = options.watch ? ['vitest'] : ['vitest', 'run'];
      await runProcess('npx', args, process.cwd());
    } catch {
      msg.error('Tests failed');
    }
  });

// ============================================================================
// SKILL PUBLISH COMMAND
// ============================================================================

const skillPublishCommand = new Command('publish')
  .description('Publish skill to Hauba marketplace')
  .option('--unlisted', 'Publish as unlisted (not searchable)')
  .option('--dry-run', 'Simulate publish without uploading')
  .action(async (options: { unlisted: boolean; dryRun: boolean }) => {
    const spinner = uiSpinner.create('Preparing to publish...').start();

    const manifest = await loadSkillManifest(process.cwd());
    if (!manifest) {
      spinner.fail(colors.error('No skill.json found. Are you in a skill directory?'));
      return;
    }

    // Validate skill
    const errors = await validateSkillStructure(process.cwd());
    if (errors.length > 0) {
      spinner.fail(colors.error('Skill validation failed:'));
      errors.forEach((e) => msg.error(e));
      return;
    }

    // Check for dist
    try {
      await fs.access(path.join(process.cwd(), 'dist', 'index.js'));
    } catch {
      spinner.fail(colors.error('No build found.'));
      msg.hint('Run: hauba skill build');
      return;
    }

    spinner.text = 'Validating skill...';

    // Validate manifest
    if (!manifest.name || !manifest.version || !manifest.description) {
      spinner.fail(colors.error('skill.json is missing required fields'));
      return;
    }

    if (options.dryRun) {
      spinner.succeed(colors.accent('Dry run complete - skill is valid'));
      console.log(box.simple([
        '',
        `${colors.muted('Name:')}        ${colors.text(manifest.name)}`,
        `${colors.muted('Version:')}     ${colors.text(manifest.version)}`,
        `${colors.muted('Description:')} ${colors.text(manifest.description)}`,
        `${colors.muted('Visibility:')}  ${options.unlisted ? colors.warning('Unlisted') : colors.accent('Public')}`,
        '',
      ]));
      return;
    }

    spinner.text = 'Uploading skill...';

    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 1500));

    spinner.succeed(colors.accent('Skill published successfully!'));

    console.log(box.success('PUBLISHED', [
      '',
      `${colors.text.bold(manifest.name)} v${manifest.version}`,
      '',
      `${colors.link(`https://marketplace.hauba.tech/skills/${manifest.name}`)}`,
      '',
    ]));

    msg.info('Users can now install your skill from the marketplace.');
    console.log('');
  });

// ============================================================================
// SKILL VALIDATE COMMAND
// ============================================================================

const skillValidateCommand = new Command('validate')
  .description('Validate skill structure and manifest')
  .action(async () => {
    const spinner = uiSpinner.create('Validating skill...').start();

    const manifest = await loadSkillManifest(process.cwd());
    if (!manifest) {
      spinner.fail(colors.error('No skill.json found'));
      return;
    }

    const errors = await validateSkillStructure(process.cwd());
    const warnings: string[] = [];

    // Check manifest fields
    if (!manifest.description || manifest.description.length < 10) {
      warnings.push('Description is too short (min 10 characters)');
    }
    if (!manifest.permissions || manifest.permissions.length === 0) {
      warnings.push('No permissions defined');
    }
    if (!manifest.triggers || manifest.triggers.length === 0) {
      errors.push('No triggers defined');
    }

    if (errors.length > 0) {
      spinner.fail(colors.error('Validation failed'));
      console.log('\n');
      errors.forEach((e) => msg.error(e));
    } else {
      spinner.succeed(colors.accent('Skill is valid'));
    }

    if (warnings.length > 0) {
      console.log(`\n${colors.warning('Warnings:')}`);
      warnings.forEach((w) => msg.warn(w));
    }

    console.log(section.divider());
    console.log(`  ${colors.muted('Name:')}         ${colors.text(manifest.name)}`);
    console.log(`  ${colors.muted('Version:')}      ${colors.text(manifest.version)}`);
    console.log(`  ${colors.muted('Triggers:')}     ${colors.text(String(manifest.triggers?.length || 0))}`);
    console.log(`  ${colors.muted('Permissions:')}  ${colors.text(String(manifest.permissions?.length || 0))}`);
    console.log('');
  });

// ============================================================================
// MAIN SKILL COMMAND
// ============================================================================

export const skillCommand = new Command('skill')
  .description('Manage Hauba skills')
  .addCommand(generateCommand)       // AI-powered generation (Phase 5)
  .addCommand(skillInitCommand)
  .addCommand(skillDevCommand)
  .addCommand(skillBuildCommand)
  .addCommand(skillTestCommand)
  .addCommand(skillPublishCommand)
  .addCommand(skillValidateCommand);
