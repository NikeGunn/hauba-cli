// ============================================================================
// HAUBA CLI - Init Command
// File: tools/cli/src/commands/init.ts
// Professional, rat-themed design
// ============================================================================

import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import {
  colors,
  ratLogoMini,
  msg,
  section,
  box,
  spinner as uiSpinner,
} from '../ui.js';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectConfig {
  name: string;
  description: string;
  author: string;
  template: 'agent' | 'skill' | 'full';
}

// ============================================================================
// TEMPLATES
// ============================================================================

const packageJsonTemplate = (config: ProjectConfig) => `{
  "name": "${config.name}",
  "version": "0.0.1",
  "description": "${config.description}",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "author": "${config.author}",
  "license": "MIT",
  "dependencies": {
    "@hauba/core": "^1.0.0",
    "@hauba/db": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
`;

const tsconfigTemplate = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;

const envTemplate = `# Hauba Configuration
HAUBA_API_URL=https://api.hauba.tech
HAUBA_ENV=development

# Database
DATABASE_URL=

# AI Provider Keys (optional - uses platform keys by default)
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
`;

const gitignoreTemplate = `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
`;

const readmeTemplate = (config: ProjectConfig) => `# ${config.name}

${config.description}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. Build the project:
   \`\`\`bash
   pnpm build
   \`\`\`

4. Run:
   \`\`\`bash
   pnpm start
   \`\`\`

## Development

\`\`\`bash
pnpm dev    # Watch mode
pnpm test   # Run tests
pnpm lint   # Type check
\`\`\`

## Deployment

\`\`\`bash
hauba deploy
\`\`\`

## License

MIT
`;

const indexTemplate = (config: ProjectConfig) => {
  if (config.template === 'skill') {
    return `// ============================================================================
// ${config.name} - Hauba Skill
// ============================================================================

import { HaubaSkill, SkillContext, SkillCapabilities, SkillResult, z } from '@hauba/sdk';

// Configuration schema
const ConfigSchema = z.object({
  // Add your configuration options here
  enabled: z.boolean().default(true),
});

type Config = z.infer<typeof ConfigSchema>;

// Skill definition
const skill = new HaubaSkill({
  name: '${config.name}',
  version: '0.0.1',
  description: '${config.description}',

  triggers: [
    {
      type: 'message',
      config: {
        contains: ['help'],
      },
    },
  ],

  permissions: [
    'message:read',
    'message:send',
    'ai:generate',
  ],

  configSchema: ConfigSchema,

  async handle(
    context: SkillContext,
    capabilities: SkillCapabilities
  ): Promise<SkillResult> {
    const { ai } = capabilities;
    const userMessage = context.message?.content || '';

    try {
      const response = await ai.generate(
        \`Respond helpfully to: \${userMessage}\`,
        { temperature: 0.7 }
      );

      return {
        success: true,
        response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

export default skill;
`;
  }

  return `// ============================================================================
// ${config.name} - Hauba Agent Project
// ============================================================================

import { HaubaAgent, AgentConfig } from '@hauba/core';

// Agent configuration
const config: AgentConfig = {
  name: '${config.name}',
  description: '${config.description}',
  
  // AI model configuration
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
  },
  
  // Channels (optional)
  channels: [],
  
  // Skills (optional)
  skills: [],
};

// Create agent instance
const agent = new HaubaAgent(config);

// Start the agent
async function main() {
  console.log(\`Starting \${config.name}...\`);
  
  try {
    await agent.start();
    console.log('Agent is running!');
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
}

main();

export { agent, config };
`;
};

// ============================================================================
// COMMAND
// ============================================================================

export const initCommand = new Command('init')
  .description('Initialize a new Hauba project')
  .argument('<project-name>', 'Name of the project to create')
  .option('-t, --template <template>', 'Project template: agent, skill, full', 'agent')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (projectName: string, options: { template: string; yes: boolean }) => {
    console.log(ratLogoMini);
    console.log(section.header('CREATE NEW PROJECT'));
    msg.info(`Project: ${colors.text.bold(projectName)}`);
    console.log('');

    let config: ProjectConfig;

    if (options.yes) {
      config = {
        name: projectName,
        description: `Hauba ${options.template} project`,
        author: '',
        template: options.template as ProjectConfig['template'],
      };
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: `Hauba ${options.template} project`,
        },
        {
          type: 'input',
          name: 'author',
          message: 'Author name:',
          default: '',
        },
        {
          type: 'list',
          name: 'template',
          message: 'Project template:',
          choices: [
            { name: `${colors.secondary('Agent')} ${colors.dim('- Full AI agent')}`, value: 'agent' },
            { name: `${colors.secondary('Skill')} ${colors.dim('- Installable skill package')}`, value: 'skill' },
            { name: `${colors.secondary('Full')} ${colors.dim('- Complete project with all features')}`, value: 'full' },
          ],
          default: options.template,
        },
      ]);

      config = {
        name: projectName,
        description: answers.description,
        author: answers.author,
        template: answers.template,
      };
    }

    const spinner = uiSpinner.create('Creating project structure...').start();

    try {
      const projectDir = path.resolve(process.cwd(), projectName);

      // Create directories
      await fs.mkdir(projectDir, { recursive: true });
      await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(projectDir, 'tests'), { recursive: true });

      // Create files
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        packageJsonTemplate(config)
      );
      await fs.writeFile(
        path.join(projectDir, 'tsconfig.json'),
        tsconfigTemplate
      );
      await fs.writeFile(
        path.join(projectDir, '.env.example'),
        envTemplate
      );
      await fs.writeFile(
        path.join(projectDir, '.gitignore'),
        gitignoreTemplate
      );
      await fs.writeFile(
        path.join(projectDir, 'README.md'),
        readmeTemplate(config)
      );
      await fs.writeFile(
        path.join(projectDir, 'src', 'index.ts'),
        indexTemplate(config)
      );

      // Create skill.json for skill template
      if (config.template === 'skill') {
        const skillJson = {
          $schema: 'https://hauba.tech/schemas/skill-v1.json',
          name: config.name,
          version: '0.0.1',
          description: config.description,
          author: {
            name: config.author || 'Unknown',
          },
          category: 'general',
          tags: [],
          runtime: {
            type: 'nodejs',
            version: '20',
            entrypoint: 'dist/index.js',
          },
          triggers: [
            {
              type: 'message',
              name: 'default',
              description: 'Default message trigger',
              config: {
                contains: ['help'],
              },
            },
          ],
          permissions: ['message:read', 'message:send', 'ai:generate'],
          resources: {
            memory: '256MB',
            timeout: 30,
            cpu: '0.5',
          },
          pricing: {
            type: 'free',
          },
        };

        await fs.writeFile(
          path.join(projectDir, 'skill.json'),
          JSON.stringify(skillJson, null, 2)
        );
      }

      spinner.succeed(colors.accent('Project created successfully!'));

      console.log(box.success('SUCCESS', [
        '',
        `Project ${colors.text.bold(projectName)} created at:`,
        colors.dim(projectDir),
        '',
      ]));

      console.log(section.header('NEXT STEPS'));
      msg.numbered(1, `${colors.primary('cd ' + projectName)}`);
      msg.numbered(2, `${colors.primary('pnpm install')}`);
      msg.numbered(3, `${colors.primary(config.template === 'skill' ? 'hauba skill dev' : 'pnpm dev')}`);
      console.log(`\n${colors.muted('Run')} ${colors.primary('hauba --help')} ${colors.muted('for more commands.')}\n`);
    } catch (error) {
      spinner.fail(colors.error('Failed to create project'));
      throw error;
    }
  });
