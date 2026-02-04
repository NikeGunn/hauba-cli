// ============================================================================
// HAUBA CLI - Marketplace Command (UNIQUE FEATURE)
// File: tools/cli/src/commands/marketplace.ts
// Browse and install skills from the Hauba marketplace
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  downloads: number;
  rating: number;
  price: number;  // 0 = free
  tags: string[];
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InstalledSkill {
  id: string;
  marketplaceId: string;
  name: string;
  version: string;
  installedAt: string;
  enabled: boolean;
}

interface MarketplaceStore {
  installed: InstalledSkill[];
  favorites: string[];
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const MARKETPLACE_FILE = path.join(HAUBA_DIR, 'marketplace.json');
const MARKETPLACE_API = process.env.HAUBA_MARKETPLACE_URL || 'https://marketplace.hauba.dev/api';

// Sample skills for offline/demo mode
const SAMPLE_SKILLS: MarketplaceSkill[] = [
  {
    id: 'web-search-pro',
    name: 'Web Search Pro',
    description: 'Advanced web search with multi-source aggregation',
    author: 'Hauba Team',
    version: '1.2.0',
    category: 'Search',
    downloads: 15420,
    rating: 4.8,
    price: 0,
    tags: ['search', 'web', 'research'],
    verified: true,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-12-01T00:00:00.000Z',
  },
  {
    id: 'email-assistant',
    name: 'Email Assistant',
    description: 'Draft, send, and manage emails with AI',
    author: 'Hauba Team',
    version: '2.0.0',
    category: 'Productivity',
    downloads: 12350,
    rating: 4.7,
    price: 0,
    tags: ['email', 'productivity', 'automation'],
    verified: true,
    createdAt: '2024-05-15T00:00:00.000Z',
    updatedAt: '2024-11-20T00:00:00.000Z',
  },
  {
    id: 'slack-integration',
    name: 'Slack Integration',
    description: 'Send messages, manage channels, and automate Slack workflows',
    author: 'Hauba Team',
    version: '1.5.0',
    category: 'Communication',
    downloads: 8900,
    rating: 4.6,
    price: 0,
    tags: ['slack', 'messaging', 'teams'],
    verified: true,
    createdAt: '2024-07-01T00:00:00.000Z',
    updatedAt: '2024-10-15T00:00:00.000Z',
  },
  {
    id: 'data-extraction',
    name: 'Data Extraction',
    description: 'Extract structured data from documents, websites, and PDFs',
    author: 'Hauba Team',
    version: '1.8.0',
    category: 'Data',
    downloads: 7650,
    rating: 4.5,
    price: 0,
    tags: ['data', 'extraction', 'parsing'],
    verified: true,
    createdAt: '2024-04-01T00:00:00.000Z',
    updatedAt: '2024-11-01T00:00:00.000Z',
  },
  {
    id: 'calendar-sync',
    name: 'Calendar Sync',
    description: 'Manage Google Calendar and Outlook events',
    author: 'Hauba Team',
    version: '1.3.0',
    category: 'Productivity',
    downloads: 5420,
    rating: 4.4,
    price: 0,
    tags: ['calendar', 'scheduling', 'google', 'outlook'],
    verified: true,
    createdAt: '2024-08-01T00:00:00.000Z',
    updatedAt: '2024-09-15T00:00:00.000Z',
  },
  {
    id: 'browser-automation',
    name: 'Browser Automation Pro',
    description: 'Control browsers, fill forms, take screenshots',
    author: 'Hauba Team',
    version: '2.1.0',
    category: 'Automation',
    downloads: 11200,
    rating: 4.9,
    price: 0,
    tags: ['browser', 'automation', 'puppeteer', 'playwright'],
    verified: true,
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-12-10T00:00:00.000Z',
  },
  {
    id: 'code-reviewer',
    name: 'AI Code Reviewer',
    description: 'Review pull requests and suggest improvements',
    author: 'DevTools Inc',
    version: '1.0.0',
    category: 'Development',
    downloads: 3200,
    rating: 4.3,
    price: 0,
    tags: ['code', 'review', 'github', 'development'],
    verified: true,
    createdAt: '2024-10-01T00:00:00.000Z',
    updatedAt: '2024-11-30T00:00:00.000Z',
  },
  {
    id: 'image-generator',
    name: 'Image Generator',
    description: 'Generate images using DALL-E, Stable Diffusion, or Midjourney',
    author: 'CreativeAI',
    version: '1.2.2',
    category: 'Creative',
    downloads: 4500,
    rating: 4.6,
    price: 5,  // $5/month
    tags: ['images', 'ai', 'creative', 'generation'],
    verified: true,
    createdAt: '2024-09-01T00:00:00.000Z',
    updatedAt: '2024-12-01T00:00:00.000Z',
  },
];

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function loadMarketplace(): Promise<MarketplaceStore> {
  try {
    const content = await fs.readFile(MARKETPLACE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      installed: [],
      favorites: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

async function saveMarketplace(store: MarketplaceStore): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(MARKETPLACE_FILE, JSON.stringify(store, null, 2));
}

async function fetchSkills(query?: string, category?: string): Promise<MarketplaceSkill[]> {
  try {
    // Try to fetch from API
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    
    const response = await fetch(`${MARKETPLACE_API}/skills?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      const data: any = await response.json();
      return data.skills || [];
    }
  } catch {
    // Fall back to sample data
  }

  // Filter sample data
  let skills = SAMPLE_SKILLS;
  
  if (query) {
    const q = query.toLowerCase();
    skills = skills.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.includes(q))
    );
  }
  
  if (category) {
    skills = skills.filter(s => 
      s.category.toLowerCase() === category.toLowerCase()
    );
  }
  
  return skills;
}

// ============================================================================
// COMMAND: hauba marketplace
// ============================================================================

export const marketplaceCommand = new Command('marketplace')
  .alias('market')
  .alias('mp')
  .description('Browse and install skills from the Hauba marketplace')
  .addHelpText('after', `
${section.subheader('ABOUT')}

The Hauba Marketplace is a collection of pre-built skills
that you can install with one command.

${section.subheader('CATEGORIES')}

  • Search        • Productivity   • Communication
  • Data          • Automation     • Development
  • Creative      • Analytics      • Integration

${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba marketplace browse
  ${colors.primary('$')} hauba marketplace search "email"
  ${colors.primary('$')} hauba marketplace install web-search-pro
  ${colors.primary('$')} hauba marketplace installed
`);

// ============================================================================
// SUBCOMMAND: hauba marketplace browse
// ============================================================================

marketplaceCommand
  .command('browse')
  .description('Browse all available skills')
  .option('-c, --category <category>', 'Filter by category')
  .option('--verified', 'Show only verified skills')
  .option('--free', 'Show only free skills')
  .option('--sort <by>', 'Sort by: downloads, rating, newest', 'downloads')
  .action(async (options) => {
    console.log(ratLogoMini);
    console.log(section.header('HAUBA MARKETPLACE'));

    const s = spinner.create('Loading skills...');
    s.start();

    let skills = await fetchSkills(undefined, options.category);

    if (options.verified) {
      skills = skills.filter(sk => sk.verified);
    }

    if (options.free) {
      skills = skills.filter(sk => sk.price === 0);
    }

    // Sort
    switch (options.sort) {
      case 'rating':
        skills.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        skills.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      default:
        skills.sort((a, b) => b.downloads - a.downloads);
    }

    s.stop();

    if (skills.length === 0) {
      msg.info('No skills found');
      return;
    }

    // Show as cards
    for (const skill of skills.slice(0, 10)) {
      const verified = skill.verified ? colors.accent('✓') : '';
      const price = skill.price > 0 ? colors.warning(`$${skill.price}/mo`) : colors.accent('FREE');
      
      console.log(`
  ${skill.verified ? colors.accent('●') : colors.muted('○')} ${colors.text.bold(skill.name)} ${colors.muted(`v${skill.version}`)} ${verified}
    ${colors.muted(skill.description)}
    ${colors.dim(skill.category)} • ${colors.dim(`${formatNumber(skill.downloads)} downloads`)} • ⭐ ${skill.rating} • ${price}
    ${colors.dim(skill.tags.map(t => `#${t}`).join(' '))}`);
    }

    console.log('');
    msg.info(`Showing ${Math.min(skills.length, 10)} of ${skills.length} skills`);
    msg.hint(`Install with: ${colors.primary('hauba marketplace install <skill-id>')}`);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba marketplace search
// ============================================================================

marketplaceCommand
  .command('search <query>')
  .description('Search for skills')
  .action(async (query) => {
    console.log(ratLogoMini);
    console.log(section.header(`SEARCH: "${query}"`));

    const s = spinner.create('Searching...');
    s.start();

    const skills = await fetchSkills(query);
    s.stop();

    if (skills.length === 0) {
      msg.info('No skills found');
      msg.hint(`Try: ${colors.primary('hauba marketplace browse')}`);
      return;
    }

    const rows = skills.map(skill => [
      colors.text(skill.name) + (skill.verified ? colors.accent(' ✓') : ''),
      colors.muted(skill.description.slice(0, 40) + '...'),
      `⭐ ${skill.rating}`,
      skill.price > 0 ? colors.warning(`$${skill.price}`) : colors.accent('FREE'),
    ]);

    table.rows(['SKILL', 'DESCRIPTION', 'RATING', 'PRICE'], rows);
    console.log('');
    msg.hint(`Install: ${colors.primary('hauba marketplace install <skill-id>')}`);
  });

// ============================================================================
// SUBCOMMAND: hauba marketplace install
// ============================================================================

marketplaceCommand
  .command('install <skill>')
  .description('Install a skill from the marketplace')
  .action(async (skillId) => {
    console.log(ratLogoMini);

    const store = await loadMarketplace();

    // Check if already installed
    const existing = store.installed.find(s => s.marketplaceId === skillId);
    if (existing) {
      msg.warn(`${existing.name} is already installed (v${existing.version})`);
      msg.hint(`Update with: ${colors.primary(`hauba marketplace update ${skillId}`)}`);
      return;
    }

    const s = spinner.create(`Installing ${skillId}...`);
    s.start();

    // Find skill info
    const skills = await fetchSkills();
    const skill = skills.find(sk => sk.id === skillId);

    if (!skill) {
      s.fail(`Skill not found: ${skillId}`);
      return;
    }

    // Check if paid
    if (skill.price > 0) {
      s.stop();
      console.log(box.warning('PAID SKILL', [
        '',
        `${skill.name} costs $${skill.price}/month`,
        '',
        'To purchase, visit:',
        `${colors.link(`https://marketplace.hauba.dev/skills/${skillId}`)}`,
        '',
      ]));
      return;
    }

    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create skill directory
    const skillDir = path.join(HAUBA_DIR, 'skills', skillId);
    await fs.mkdir(skillDir, { recursive: true });

    // Save skill config
    await fs.writeFile(
      path.join(skillDir, 'skill.json'),
      JSON.stringify({
        id: skill.id,
        name: skill.name,
        version: skill.version,
        marketplace: true,
        installedAt: new Date().toISOString(),
      }, null, 2)
    );

    // Update store
    store.installed.push({
      id: skill.id,
      marketplaceId: skill.id,
      name: skill.name,
      version: skill.version,
      installedAt: new Date().toISOString(),
      enabled: true,
    });
    await saveMarketplace(store);

    s.succeed(`Installed ${colors.accent(skill.name)} v${skill.version}`);

    console.log('\n' + box.success('SKILL INSTALLED', [
      '',
      `${skill.name} is now available!`,
      '',
      `Author: ${skill.author}`,
      `Category: ${skill.category}`,
      '',
      'The skill is automatically enabled.',
      `Disable with: ${colors.primary(`hauba marketplace disable ${skillId}`)}`,
      '',
    ]));
  });

// ============================================================================
// SUBCOMMAND: hauba marketplace installed
// ============================================================================

marketplaceCommand
  .command('installed')
  .description('List installed marketplace skills')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('INSTALLED SKILLS'));

    const store = await loadMarketplace();

    if (store.installed.length === 0) {
      console.log(box.simple([
        '',
        `${colors.muted('No marketplace skills installed yet.')}`,
        '',
        `Browse skills: ${colors.primary('hauba marketplace browse')}`,
        '',
      ], 50));
      return;
    }

    const rows = store.installed.map(s => [
      colors.text(s.name),
      colors.muted(`v${s.version}`),
      s.enabled ? colors.accent('Enabled') : colors.muted('Disabled'),
      colors.dim(new Date(s.installedAt).toLocaleDateString()),
    ]);

    table.rows(['SKILL', 'VERSION', 'STATUS', 'INSTALLED'], rows);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba marketplace uninstall
// ============================================================================

marketplaceCommand
  .command('uninstall <skill>')
  .description('Uninstall a marketplace skill')
  .action(async (skillId) => {
    console.log(ratLogoMini);

    const { default: inquirer } = await import('inquirer');
    const store = await loadMarketplace();

    const index = store.installed.findIndex(s => s.marketplaceId === skillId || s.id === skillId);

    if (index < 0) {
      msg.error(`Skill not installed: ${skillId}`);
      return;
    }

    const skill = store.installed[index];

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Uninstall ${skill.name}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      msg.info('Cancelled');
      return;
    }

    const s = spinner.create('Uninstalling...');
    s.start();

    // Remove skill directory
    const skillDir = path.join(HAUBA_DIR, 'skills', skill.id);
    await fs.rm(skillDir, { recursive: true, force: true });

    // Update store
    store.installed.splice(index, 1);
    await saveMarketplace(store);

    s.succeed(`Uninstalled ${skill.name}`);
  });

// ============================================================================
// SUBCOMMAND: hauba marketplace enable/disable
// ============================================================================

marketplaceCommand
  .command('enable <skill>')
  .description('Enable an installed skill')
  .action(async (skillId) => {
    const store = await loadMarketplace();
    const skill = store.installed.find(s => s.marketplaceId === skillId || s.id === skillId);

    if (!skill) {
      msg.error(`Skill not installed: ${skillId}`);
      return;
    }

    skill.enabled = true;
    await saveMarketplace(store);
    msg.success(`Enabled ${skill.name}`);
  });

marketplaceCommand
  .command('disable <skill>')
  .description('Disable an installed skill')
  .action(async (skillId) => {
    const store = await loadMarketplace();
    const skill = store.installed.find(s => s.marketplaceId === skillId || s.id === skillId);

    if (!skill) {
      msg.error(`Skill not installed: ${skillId}`);
      return;
    }

    skill.enabled = false;
    await saveMarketplace(store);
    msg.success(`Disabled ${skill.name}`);
  });

// ============================================================================
// SUBCOMMAND: hauba marketplace info
// ============================================================================

marketplaceCommand
  .command('info <skill>')
  .description('Show detailed skill information')
  .action(async (skillId) => {
    console.log(ratLogoMini);

    const s = spinner.create('Loading...');
    s.start();

    const skills = await fetchSkills();
    const skill = skills.find(sk => sk.id === skillId);
    s.stop();

    if (!skill) {
      msg.error(`Skill not found: ${skillId}`);
      return;
    }

    const store = await loadMarketplace();
    const isInstalled = store.installed.some(s => s.marketplaceId === skill.id);

    console.log(section.header(skill.name));

    if (skill.verified) {
      msg.success('Verified by Hauba Team');
    }

    if (isInstalled) {
      msg.info('Installed');
    }

    console.log('');
    console.log(`  ${colors.muted(skill.description)}`);
    console.log('');

    table.keyValue([
      ['Version', skill.version],
      ['Author', skill.author],
      ['Category', skill.category],
      ['Downloads', formatNumber(skill.downloads)],
      ['Rating', `⭐ ${skill.rating}/5`],
      ['Price', skill.price > 0 ? `$${skill.price}/month` : 'Free'],
      ['Tags', skill.tags.join(', ')],
      ['Updated', new Date(skill.updatedAt).toLocaleDateString()],
    ], 12);

    console.log('');

    if (!isInstalled) {
      if (skill.price > 0) {
        msg.hint(`Purchase: ${colors.link(`https://marketplace.hauba.dev/skills/${skill.id}`)}`);
      } else {
        msg.hint(`Install: ${colors.primary(`hauba marketplace install ${skill.id}`)}`);
      }
    }
    console.log('');
  });

// ============================================================================
// HELPERS
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

export default marketplaceCommand;
