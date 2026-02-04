// ============================================================================
// HAUBA CLI - Swarm Command (UNIQUE FEATURE)
// File: tools/cli/src/commands/swarm.ts
// Multi-agent orchestration - multiple AI agents working together
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface SwarmAgent {
  id: string;
  name: string;
  role: string;
  skills: string[];
  status: 'active' | 'idle' | 'error';
}

interface Swarm {
  id: string;
  name: string;
  description: string;
  agents: SwarmAgent[];
  coordinator: string;  // Agent ID that coordinates
  workflow: 'parallel' | 'sequential' | 'adaptive';
  status: 'running' | 'stopped' | 'paused';
  createdAt: string;
  stats: {
    tasksCompleted: number;
    averageTime: number;
  };
}

interface SwarmStore {
  swarms: Swarm[];
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const SWARMS_FILE = path.join(HAUBA_DIR, 'swarms.json');

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function loadSwarms(): Promise<SwarmStore> {
  try {
    const content = await fs.readFile(SWARMS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { swarms: [], updatedAt: new Date().toISOString() };
  }
}

async function saveSwarms(store: SwarmStore): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(SWARMS_FILE, JSON.stringify(store, null, 2));
}

function generateId(): string {
  return 'swarm_' + Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// COMMAND: hauba swarm
// ============================================================================

export const swarmCommand = new Command('swarm')
  .description('Multi-agent orchestration - coordinate multiple AI agents')
  .addHelpText('after', `
${section.subheader('ABOUT SWARMS')}

Swarms allow multiple AI agents to work together on complex tasks.
Each agent can have different skills and roles.

${section.subheader('WORKFLOW TYPES')}

  ${colors.accent('parallel')}    - Agents work simultaneously
  ${colors.text('sequential')}  - Agents work one after another
  ${colors.text('adaptive')}    - AI decides the best approach

${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba swarm create "Customer Support Team"
  ${colors.primary('$')} hauba swarm add support-team --agent researcher
  ${colors.primary('$')} hauba swarm add support-team --agent writer
  ${colors.primary('$')} hauba swarm run support-team --task "Answer customer query"
  ${colors.primary('$')} hauba swarm status support-team
`);

// ============================================================================
// SUBCOMMAND: hauba swarm list
// ============================================================================

swarmCommand
  .command('list')
  .description('List all swarms')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('SWARMS'));

    const store = await loadSwarms();

    if (store.swarms.length === 0) {
      console.log(box.simple([
        '',
        `${colors.accent('🐀 Swarms - Multi-Agent Orchestration')}`,
        '',
        'Create teams of AI agents that work together.',
        'Each agent has different skills and roles.',
        '',
        `Create your first swarm:`,
        `${colors.primary('$ hauba swarm create "My Team"')}`,
        '',
      ], 52));
      return;
    }

    const rows = store.swarms.map(s => {
      const statusColor = s.status === 'running' ? colors.accent : 
                         s.status === 'paused' ? colors.warning : colors.muted;
      return [
        colors.text(s.name),
        `${s.agents.length} agents`,
        colors.muted(s.workflow),
        statusColor(s.status),
      ];
    });

    table.rows(['SWARM', 'SIZE', 'WORKFLOW', 'STATUS'], rows);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba swarm create
// ============================================================================

swarmCommand
  .command('create <name>')
  .description('Create a new swarm')
  .option('-d, --description <desc>', 'Swarm description')
  .option('-w, --workflow <type>', 'Workflow type (parallel, sequential, adaptive)', 'adaptive')
  .action(async (name, options) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');
    const store = await loadSwarms();

    // Check if name exists
    if (store.swarms.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      msg.error(`Swarm "${name}" already exists`);
      return;
    }

    // Interactive setup if no description
    let description = options.description;
    let workflow = options.workflow;

    if (!description) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'What will this swarm do?',
          default: `A team of AI agents for ${name.toLowerCase()}`,
        },
        {
          type: 'list',
          name: 'workflow',
          message: 'How should agents work together?',
          choices: [
            { name: `${colors.accent('Adaptive')} - AI decides based on task ${colors.muted('(recommended)')}`, value: 'adaptive' },
            { name: 'Parallel - All agents work simultaneously', value: 'parallel' },
            { name: 'Sequential - Agents work one after another', value: 'sequential' },
          ],
          default: workflow,
        },
      ]);
      description = answers.description;
      workflow = answers.workflow;
    }

    const swarm: Swarm = {
      id: generateId(),
      name,
      description: description || '',
      agents: [],
      coordinator: '',
      workflow,
      status: 'stopped',
      createdAt: new Date().toISOString(),
      stats: {
        tasksCompleted: 0,
        averageTime: 0,
      },
    };

    store.swarms.push(swarm);
    await saveSwarms(store);

    console.log('\n' + box.success('SWARM CREATED', [
      '',
      `Name: ${colors.accent(name)}`,
      `ID:   ${colors.muted(swarm.id)}`,
      `Type: ${colors.text(workflow)}`,
      '',
      'Next steps:',
      `  ${colors.primary('$')} hauba swarm add "${name}" --agent <name>`,
      '',
    ]));
  });

// ============================================================================
// SUBCOMMAND: hauba swarm add
// ============================================================================

swarmCommand
  .command('add <swarm>')
  .description('Add an agent to a swarm')
  .option('-a, --agent <name>', 'Agent name')
  .option('-r, --role <role>', 'Agent role')
  .option('-s, --skills <skills>', 'Comma-separated skills')
  .option('--coordinator', 'Make this agent the coordinator')
  .action(async (swarmName, options) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');
    const store = await loadSwarms();

    const swarm = store.swarms.find(
      s => s.name.toLowerCase() === swarmName.toLowerCase() || s.id === swarmName
    );

    if (!swarm) {
      msg.error(`Swarm not found: ${swarmName}`);
      msg.hint(`List swarms with: ${colors.primary('hauba swarm list')}`);
      return;
    }

    // Interactive if no agent name
    let agentName = options.agent;
    let role = options.role;
    let skills = options.skills?.split(',').map((s: string) => s.trim()) || [];

    if (!agentName) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Agent name:',
          validate: (input: string) => input.length > 0 || 'Name required',
        },
        {
          type: 'list',
          name: 'role',
          message: 'What role does this agent play?',
          choices: [
            { name: 'Researcher - Finds information and context', value: 'researcher' },
            { name: 'Writer - Creates content and responses', value: 'writer' },
            { name: 'Reviewer - Checks and improves quality', value: 'reviewer' },
            { name: 'Executor - Takes actions and runs tools', value: 'executor' },
            { name: 'Coordinator - Manages the team', value: 'coordinator' },
            { name: 'Custom...', value: 'custom' },
          ],
        },
        {
          type: 'input',
          name: 'customRole',
          message: 'Enter custom role:',
          when: (a: any) => a.role === 'custom',
        },
        {
          type: 'checkbox',
          name: 'skills',
          message: 'Select skills for this agent:',
          choices: [
            'web-search',
            'data-extraction',
            'browser-automation',
            'email',
            'calendar',
            'file-management',
            'code-generation',
            'image-analysis',
          ],
        },
      ]);

      agentName = answers.name;
      role = answers.customRole || answers.role;
      skills = answers.skills;
    }

    const agent: SwarmAgent = {
      id: 'agent_' + Math.random().toString(36).substring(2, 8),
      name: agentName,
      role: role || 'worker',
      skills,
      status: 'idle',
    };

    swarm.agents.push(agent);

    if (options.coordinator || role === 'coordinator') {
      swarm.coordinator = agent.id;
    }

    await saveSwarms(store);

    msg.success(`Added ${colors.accent(agentName)} to ${colors.text(swarm.name)}`);
    msg.bullet(`Role: ${role}`);
    if (skills.length > 0) {
      msg.bullet(`Skills: ${skills.join(', ')}`);
    }
    if (swarm.coordinator === agent.id) {
      msg.bullet(`${colors.warning('Coordinator')}`);
    }
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba swarm run
// ============================================================================

swarmCommand
  .command('run <swarm>')
  .description('Run a swarm on a task')
  .option('-t, --task <task>', 'Task description')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (swarmName, options) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');
    const store = await loadSwarms();

    const swarm = store.swarms.find(
      s => s.name.toLowerCase() === swarmName.toLowerCase() || s.id === swarmName
    );

    if (!swarm) {
      msg.error(`Swarm not found: ${swarmName}`);
      return;
    }

    if (swarm.agents.length === 0) {
      msg.error('Swarm has no agents');
      msg.hint(`Add agents with: ${colors.primary(`hauba swarm add "${swarm.name}" --agent <name>`)}`);
      return;
    }

    let task = options.task;
    if (!task) {
      const { taskInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'taskInput',
          message: 'What task should the swarm work on?',
        },
      ]);
      task = taskInput;
    }

    if (!task) {
      msg.error('No task specified');
      return;
    }

    console.log(section.header('RUNNING SWARM'));
    console.log(box.simple([
      '',
      `${colors.text('Swarm:')} ${colors.accent(swarm.name)}`,
      `${colors.text('Task:')}  ${task}`,
      `${colors.text('Mode:')}  ${swarm.workflow}`,
      '',
    ], 55));

    // Simulate swarm execution
    swarm.status = 'running';
    await saveSwarms(store);

    for (const agent of swarm.agents) {
      const s = spinner.create(`${agent.name} (${agent.role}) working...`);
      s.start();
      agent.status = 'active';
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
      
      agent.status = 'idle';
      s.succeed(`${colors.accent(agent.name)} completed`);
    }

    swarm.status = 'stopped';
    swarm.stats.tasksCompleted++;
    await saveSwarms(store);

    console.log('\n' + box.success('SWARM COMPLETED', [
      '',
      `Task: ${task}`,
      `Agents used: ${swarm.agents.length}`,
      `Total tasks: ${swarm.stats.tasksCompleted}`,
      '',
      colors.muted('In production, results would be returned here.'),
      '',
    ]));
  });

// ============================================================================
// SUBCOMMAND: hauba swarm status
// ============================================================================

swarmCommand
  .command('status <swarm>')
  .description('Show swarm status')
  .action(async (swarmName) => {
    console.log(ratLogoMini);

    const store = await loadSwarms();
    const swarm = store.swarms.find(
      s => s.name.toLowerCase() === swarmName.toLowerCase() || s.id === swarmName
    );

    if (!swarm) {
      msg.error(`Swarm not found: ${swarmName}`);
      return;
    }

    console.log(section.header(swarm.name.toUpperCase()));

    const statusColor = swarm.status === 'running' ? colors.accent :
                       swarm.status === 'paused' ? colors.warning : colors.muted;

    table.keyValue([
      ['ID', swarm.id],
      ['Status', statusColor(swarm.status)],
      ['Workflow', swarm.workflow],
      ['Agents', String(swarm.agents.length)],
      ['Tasks Completed', String(swarm.stats.tasksCompleted)],
      ['Created', new Date(swarm.createdAt).toLocaleDateString()],
    ], 18);

    if (swarm.agents.length > 0) {
      console.log(section.subheader('AGENTS'));
      
      const agentRows = swarm.agents.map(a => {
        const statusColor = a.status === 'active' ? colors.accent :
                           a.status === 'error' ? colors.error : colors.muted;
        const isCoordinator = swarm.coordinator === a.id;
        return [
          colors.text(a.name) + (isCoordinator ? colors.warning(' ★') : ''),
          colors.muted(a.role),
          colors.dim(a.skills.slice(0, 2).join(', ') + (a.skills.length > 2 ? '...' : '')),
          statusColor(a.status),
        ];
      });

      table.rows(['AGENT', 'ROLE', 'SKILLS', 'STATUS'], agentRows);
    }

    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba swarm delete
// ============================================================================

swarmCommand
  .command('delete <swarm>')
  .description('Delete a swarm')
  .option('-f, --force', 'Skip confirmation')
  .action(async (swarmName, options) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');
    const store = await loadSwarms();

    const index = store.swarms.findIndex(
      s => s.name.toLowerCase() === swarmName.toLowerCase() || s.id === swarmName
    );

    if (index < 0) {
      msg.error(`Swarm not found: ${swarmName}`);
      return;
    }

    const swarm = store.swarms[index];

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Delete swarm "${swarm.name}" with ${swarm.agents.length} agents?`,
          default: false,
        },
      ]);

      if (!confirm) {
        msg.info('Cancelled');
        return;
      }
    }

    store.swarms.splice(index, 1);
    await saveSwarms(store);

    msg.success(`Deleted swarm: ${swarm.name}`);
  });

export default swarmCommand;
