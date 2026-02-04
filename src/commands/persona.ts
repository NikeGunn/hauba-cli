// ============================================================================
// HAUBA CLI - Persona Command (UNIQUE FEATURE)
// File: tools/cli/src/commands/persona.ts
// AI personality management - customize how Hauba behaves
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface Persona {
  id: string;
  name: string;
  description: string;
  avatar: string;
  traits: {
    formality: 'casual' | 'balanced' | 'formal';
    verbosity: 'concise' | 'balanced' | 'detailed';
    tone: 'friendly' | 'professional' | 'witty' | 'serious';
    language: string;
  };
  systemPrompt: string;
  examples: Array<{
    user: string;
    assistant: string;
  }>;
  isDefault: boolean;
  isBuiltIn: boolean;
  createdAt: string;
}

interface PersonaStore {
  personas: Persona[];
  activePersona: string;
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const PERSONAS_FILE = path.join(HAUBA_DIR, 'personas.json');

// Built-in personas
const BUILT_IN_PERSONAS: Persona[] = [
  {
    id: 'hauba-default',
    name: 'Hauba',
    description: 'The first Nepalese AI employee - helpful, efficient, slightly witty',
    avatar: '🐀',
    traits: {
      formality: 'balanced',
      verbosity: 'balanced',
      tone: 'friendly',
      language: 'en',
    },
    systemPrompt: `You are Hauba, a helpful AI assistant from Nepal. You are efficient, knowledgeable, and have a slightly witty personality. You occasionally use Nepali greetings like "Namaste" when appropriate. You take pride in being "the first Nepalese AI employee that actually works."`,
    examples: [
      {
        user: 'Hello!',
        assistant: 'Namaste! 🙏 How can I help you today?',
      },
    ],
    isDefault: true,
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal, business-focused communication',
    avatar: '👔',
    traits: {
      formality: 'formal',
      verbosity: 'detailed',
      tone: 'professional',
      language: 'en',
    },
    systemPrompt: `You are a professional AI assistant. Communicate in a formal, business-appropriate manner. Be thorough and precise in your responses. Use proper titles and maintain a respectful tone at all times.`,
    examples: [
      {
        user: 'Send an email to the team',
        assistant: 'I would be happy to assist with drafting that communication. Could you please provide the key points you would like to convey to the team?',
      },
    ],
    isDefault: false,
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'casual',
    name: 'Casual',
    description: 'Relaxed, friendly conversation style',
    avatar: '😎',
    traits: {
      formality: 'casual',
      verbosity: 'concise',
      tone: 'friendly',
      language: 'en',
    },
    systemPrompt: `You are a casual, friendly AI assistant. Keep your responses relaxed and conversational. Use contractions, occasional emoji, and a warm tone. Be helpful but don't be overly formal.`,
    examples: [
      {
        user: 'What should I do today?',
        assistant: "Hey! Let's see... how about tackling that task you mentioned yesterday? Or we could brainstorm some new ideas! 💡",
      },
    ],
    isDefault: false,
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'nepali',
    name: 'नेपाली (Nepali)',
    description: 'Responds primarily in Nepali with cultural context',
    avatar: '🇳🇵',
    traits: {
      formality: 'balanced',
      verbosity: 'balanced',
      tone: 'friendly',
      language: 'ne',
    },
    systemPrompt: `तपाईं हौबा हुनुहुन्छ, एक नेपाली AI सहायक। नेपालीमा जवाफ दिनुहोस् र नेपाली संस्कृति र परम्परालाई सम्मान गर्नुहोस्। आवश्यक परेमा अंग्रेजी प्रयोग गर्न सक्नुहुन्छ।`,
    examples: [
      {
        user: 'Hello',
        assistant: 'नमस्ते! 🙏 म तपाईंलाई कसरी मद्दत गर्न सक्छु?',
      },
    ],
    isDefault: false,
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'concise',
    name: 'Concise',
    description: 'Short, to-the-point responses',
    avatar: '⚡',
    traits: {
      formality: 'balanced',
      verbosity: 'concise',
      tone: 'serious',
      language: 'en',
    },
    systemPrompt: `You are a concise AI assistant. Give the shortest possible answers that fully address the question. No fluff, no unnecessary words. Be direct and efficient.`,
    examples: [
      {
        user: 'What is the capital of Nepal?',
        assistant: 'Kathmandu.',
      },
    ],
    isDefault: false,
    isBuiltIn: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function loadPersonas(): Promise<PersonaStore> {
  try {
    const content = await fs.readFile(PERSONAS_FILE, 'utf-8');
    const store = JSON.parse(content);
    
    // Merge with built-in personas
    const builtInIds = BUILT_IN_PERSONAS.map(p => p.id);
    const customPersonas = store.personas.filter((p: Persona) => !builtInIds.includes(p.id));
    
    return {
      personas: [...BUILT_IN_PERSONAS, ...customPersonas],
      activePersona: store.activePersona || 'hauba-default',
      updatedAt: store.updatedAt,
    };
  } catch {
    return {
      personas: BUILT_IN_PERSONAS,
      activePersona: 'hauba-default',
      updatedAt: new Date().toISOString(),
    };
  }
}

async function savePersonas(store: PersonaStore): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  
  // Only save custom personas
  const customPersonas = store.personas.filter(p => !p.isBuiltIn);
  
  await fs.writeFile(PERSONAS_FILE, JSON.stringify({
    personas: customPersonas,
    activePersona: store.activePersona,
    updatedAt: new Date().toISOString(),
  }, null, 2));
}

// ============================================================================
// COMMAND: hauba persona
// ============================================================================

export const personaCommand = new Command('persona')
  .description('Customize Hauba\'s personality and communication style')
  .addHelpText('after', `
${section.subheader('ABOUT PERSONAS')}

Personas control how Hauba communicates with you and others.
You can use built-in personas or create custom ones.

${section.subheader('BUILT-IN PERSONAS')}

  🐀 ${colors.accent('hauba')}        - Default friendly assistant
  👔 ${colors.text('professional')} - Formal business style  
  😎 ${colors.text('casual')}       - Relaxed conversation
  🇳🇵 ${colors.text('nepali')}       - Responds in Nepali
  ⚡ ${colors.text('concise')}      - Short, direct answers

${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba persona list
  ${colors.primary('$')} hauba persona use professional
  ${colors.primary('$')} hauba persona create
  ${colors.primary('$')} hauba persona info hauba
`);

// ============================================================================
// SUBCOMMAND: hauba persona list
// ============================================================================

personaCommand
  .command('list')
  .description('List all available personas')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('PERSONAS'));

    const store = await loadPersonas();

    const rows = store.personas.map(p => {
      const isActive = store.activePersona === p.id;
      const name = isActive 
        ? colors.accent(`${p.avatar} ${p.name} ◄ active`)
        : `${p.avatar} ${colors.text(p.name)}`;
      
      return [
        name,
        colors.muted(p.traits.tone),
        colors.muted(p.traits.formality),
        p.isBuiltIn ? colors.dim('built-in') : colors.secondary('custom'),
      ];
    });

    table.rows(['PERSONA', 'TONE', 'STYLE', 'TYPE'], rows);
    
    console.log('');
    msg.hint(`Switch persona: ${colors.primary('hauba persona use <name>')}`);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba persona use
// ============================================================================

personaCommand
  .command('use <persona>')
  .description('Switch to a different persona')
  .action(async (personaId) => {
    console.log(ratLogoMini);

    const store = await loadPersonas();
    const persona = store.personas.find(
      p => p.id === personaId || p.name.toLowerCase() === personaId.toLowerCase()
    );

    if (!persona) {
      msg.error(`Persona not found: ${personaId}`);
      msg.hint(`List personas with: ${colors.primary('hauba persona list')}`);
      return;
    }

    store.activePersona = persona.id;
    await savePersonas(store);

    console.log(box.success('PERSONA ACTIVATED', [
      '',
      `${persona.avatar} ${colors.accent(persona.name)}`,
      '',
      colors.muted(persona.description),
      '',
      `Tone: ${persona.traits.tone}`,
      `Style: ${persona.traits.formality}`,
      '',
    ]));
  });

// ============================================================================
// SUBCOMMAND: hauba persona info
// ============================================================================

personaCommand
  .command('info <persona>')
  .description('Show detailed persona information')
  .action(async (personaId) => {
    console.log(ratLogoMini);

    const store = await loadPersonas();
    const persona = store.personas.find(
      p => p.id === personaId || p.name.toLowerCase() === personaId.toLowerCase()
    );

    if (!persona) {
      msg.error(`Persona not found: ${personaId}`);
      return;
    }

    const isActive = store.activePersona === persona.id;

    console.log(section.header(`${persona.avatar} ${persona.name}`));

    if (isActive) {
      msg.success('Currently active');
      console.log('');
    }

    table.keyValue([
      ['Description', persona.description],
      ['Tone', persona.traits.tone],
      ['Formality', persona.traits.formality],
      ['Verbosity', persona.traits.verbosity],
      ['Language', persona.traits.language],
      ['Type', persona.isBuiltIn ? 'Built-in' : 'Custom'],
    ], 15);

    if (persona.examples.length > 0) {
      console.log(section.subheader('EXAMPLE'));
      const example = persona.examples[0];
      console.log(`  ${colors.muted('User:')} ${example.user}`);
      console.log(`  ${colors.accent('Assistant:')} ${example.assistant}`);
    }

    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba persona create
// ============================================================================

personaCommand
  .command('create')
  .description('Create a custom persona')
  .option('-n, --name <name>', 'Persona name')
  .action(async (options) => {
    console.log(ratLogoMini);
    console.log(section.header('CREATE PERSONA'));

    const { default: inquirer } = await import('inquirer');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Persona name:',
        default: options.name,
        validate: (input: string) => input.length > 0 || 'Name required',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Short description:',
      },
      {
        type: 'input',
        name: 'avatar',
        message: 'Avatar emoji:',
        default: '🤖',
      },
      {
        type: 'list',
        name: 'tone',
        message: 'Tone of communication:',
        choices: ['friendly', 'professional', 'witty', 'serious'],
      },
      {
        type: 'list',
        name: 'formality',
        message: 'Formality level:',
        choices: ['casual', 'balanced', 'formal'],
      },
      {
        type: 'list',
        name: 'verbosity',
        message: 'Response length:',
        choices: ['concise', 'balanced', 'detailed'],
      },
      {
        type: 'editor',
        name: 'systemPrompt',
        message: 'System prompt (press Enter to open editor):',
        default: 'You are a helpful AI assistant.',
      },
    ]);

    const store = await loadPersonas();

    const persona: Persona = {
      id: 'custom_' + Math.random().toString(36).substring(2, 8),
      name: answers.name,
      description: answers.description || `Custom persona: ${answers.name}`,
      avatar: answers.avatar,
      traits: {
        formality: answers.formality,
        verbosity: answers.verbosity,
        tone: answers.tone,
        language: 'en',
      },
      systemPrompt: answers.systemPrompt,
      examples: [],
      isDefault: false,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };

    store.personas.push(persona);
    await savePersonas(store);

    console.log('\n' + box.success('PERSONA CREATED', [
      '',
      `${persona.avatar} ${colors.accent(persona.name)}`,
      '',
      `ID: ${colors.muted(persona.id)}`,
      '',
      `Activate with: ${colors.primary(`hauba persona use "${persona.name}"`)}`,
      '',
    ]));
  });

// ============================================================================
// SUBCOMMAND: hauba persona delete
// ============================================================================

personaCommand
  .command('delete <persona>')
  .description('Delete a custom persona')
  .action(async (personaId) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');
    const store = await loadPersonas();

    const persona = store.personas.find(
      p => p.id === personaId || p.name.toLowerCase() === personaId.toLowerCase()
    );

    if (!persona) {
      msg.error(`Persona not found: ${personaId}`);
      return;
    }

    if (persona.isBuiltIn) {
      msg.error('Cannot delete built-in personas');
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Delete persona "${persona.name}"?`,
        default: false,
      },
    ]);

    if (!confirm) {
      msg.info('Cancelled');
      return;
    }

    store.personas = store.personas.filter(p => p.id !== persona.id);
    
    if (store.activePersona === persona.id) {
      store.activePersona = 'hauba-default';
      msg.info('Switched to default persona');
    }

    await savePersonas(store);
    msg.success(`Deleted persona: ${persona.name}`);
  });

// ============================================================================
// SUBCOMMAND: hauba persona export
// ============================================================================

personaCommand
  .command('export <persona>')
  .description('Export a persona to JSON')
  .option('-o, --output <file>', 'Output file path')
  .action(async (personaId, options) => {
    console.log(ratLogoMini);

    const store = await loadPersonas();
    const persona = store.personas.find(
      p => p.id === personaId || p.name.toLowerCase() === personaId.toLowerCase()
    );

    if (!persona) {
      msg.error(`Persona not found: ${personaId}`);
      return;
    }

    const exportData = {
      ...persona,
      isBuiltIn: false,  // Exported personas become custom
      id: undefined,     // Will get new ID on import
    };

    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(exportData, null, 2));
      msg.success(`Exported to ${options.output}`);
    } else {
      console.log(JSON.stringify(exportData, null, 2));
    }
  });

// ============================================================================
// SUBCOMMAND: hauba persona import
// ============================================================================

personaCommand
  .command('import <file>')
  .description('Import a persona from JSON file')
  .action(async (filePath) => {
    console.log(ratLogoMini);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const importedPersona = JSON.parse(content);

      const store = await loadPersonas();

      const persona: Persona = {
        ...importedPersona,
        id: 'imported_' + Math.random().toString(36).substring(2, 8),
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
      };

      store.personas.push(persona);
      await savePersonas(store);

      msg.success(`Imported persona: ${colors.accent(persona.name)}`);
      msg.bullet(`ID: ${persona.id}`);
    } catch (error) {
      msg.error('Failed to import persona');
      if (error instanceof Error) {
        msg.error(error.message);
      }
    }
  });

export default personaCommand;
