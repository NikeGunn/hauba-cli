// ============================================================================
// HAUBA CLI - Pairing Command
// File: tools/cli/src/commands/pairing.ts
// Manage DM allowlists - who can message your Hauba agent
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface PairingEntry {
  id: string;
  channel: string;
  identifier: string;  // phone number, username, email
  name?: string;
  status: 'allowed' | 'blocked';
  addedAt: string;
  lastMessage?: string;
}

interface PairingStore {
  entries: PairingEntry[];
  settings: {
    defaultAction: 'allow' | 'block';
    requireApproval: boolean;
  };
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const PAIRING_FILE = path.join(HAUBA_DIR, 'pairing.json');

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function loadPairing(): Promise<PairingStore> {
  try {
    const content = await fs.readFile(PAIRING_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      entries: [],
      settings: {
        defaultAction: 'allow',
        requireApproval: false,
      },
      updatedAt: new Date().toISOString(),
    };
  }
}

async function savePairing(store: PairingStore): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(PAIRING_FILE, JSON.stringify(store, null, 2));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// COMMAND: hauba pairing
// ============================================================================

export const pairingCommand = new Command('pairing')
  .description('Manage who can message your Hauba agent')
  .addHelpText('after', `
${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba pairing list
  ${colors.primary('$')} hauba pairing add +1234567890 --channel whatsapp
  ${colors.primary('$')} hauba pairing add @username --channel telegram
  ${colors.primary('$')} hauba pairing block +1234567890
  ${colors.primary('$')} hauba pairing remove abc123
  ${colors.primary('$')} hauba pairing settings
`);

// ============================================================================
// SUBCOMMAND: hauba pairing list
// ============================================================================

pairingCommand
  .command('list')
  .description('List all paired contacts')
  .option('--channel <channel>', 'Filter by channel')
  .option('--blocked', 'Show only blocked contacts')
  .action(async (options) => {
    console.log(ratLogoMini);
    console.log(section.header('PAIRED CONTACTS'));

    const store = await loadPairing();
    let entries = store.entries;

    if (options.channel) {
      entries = entries.filter(e => e.channel === options.channel);
    }

    if (options.blocked) {
      entries = entries.filter(e => e.status === 'blocked');
    }

    if (entries.length === 0) {
      console.log(box.simple([
        '',
        `${colors.muted('No contacts paired yet.')}`,
        '',
        `${colors.muted('Add one with:')} ${colors.primary('hauba pairing add <identifier>')}`,
        '',
      ], 50));
      
      // Show settings
      console.log(section.subheader('CURRENT SETTINGS'));
      msg.bullet(`Default action: ${store.settings.defaultAction === 'allow' ? colors.accent('Allow all') : colors.error('Block all')}`);
      msg.bullet(`Require approval: ${store.settings.requireApproval ? colors.warning('Yes') : colors.muted('No')}`);
      console.log('');
      return;
    }

    const rows = entries.map(e => {
      const statusColor = e.status === 'allowed' ? colors.accent : colors.error;
      const channelIcon: Record<string, string> = {
        whatsapp: '📱',
        telegram: '✈️',
        slack: '💼',
        discord: '🎮',
      };
      return [
        colors.muted(e.id),
        `${channelIcon[e.channel] || '📡'} ${colors.text(e.identifier)}`,
        e.name || colors.muted('-'),
        statusColor(e.status),
      ];
    });

    table.rows(['ID', 'CONTACT', 'NAME', 'STATUS'], rows);
    console.log('');
      console.log(colors.muted(`Total: ${entries.length} contacts`));
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba pairing add
// ============================================================================

pairingCommand
  .command('add <identifier>')
  .description('Add a contact to the allowlist')
  .option('-c, --channel <channel>', 'Channel (whatsapp, telegram, slack, discord)', 'whatsapp')
  .option('-n, --name <name>', 'Contact name')
  .action(async (identifier, options) => {
    console.log(ratLogoMini);

    const store = await loadPairing();

    // Check if already exists
    const existing = store.entries.find(
      e => e.identifier === identifier && e.channel === options.channel
    );

    if (existing) {
      if (existing.status === 'allowed') {
        msg.info(`${identifier} is already allowed on ${options.channel}`);
        return;
      }
      // Update existing to allowed
      existing.status = 'allowed';
      existing.name = options.name || existing.name;
      await savePairing(store);
      msg.success(`${identifier} is now allowed on ${options.channel}`);
      return;
    }

    // Add new entry
    const entry: PairingEntry = {
      id: generateId(),
      channel: options.channel,
      identifier,
      name: options.name,
      status: 'allowed',
      addedAt: new Date().toISOString(),
    };

    store.entries.push(entry);
    await savePairing(store);

    msg.success(`Added ${colors.accent(identifier)} to ${options.channel} allowlist`);
    msg.bullet(`ID: ${colors.muted(entry.id)}`);
    
    if (options.name) {
      msg.bullet(`Name: ${colors.text(options.name)}`);
    }
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba pairing block
// ============================================================================

pairingCommand
  .command('block <identifier>')
  .description('Block a contact from messaging')
  .option('-c, --channel <channel>', 'Channel (whatsapp, telegram, slack, discord)', 'whatsapp')
  .action(async (identifier, options) => {
    console.log(ratLogoMini);

    const store = await loadPairing();

    // Check if exists
    const existing = store.entries.find(
      e => e.identifier === identifier && e.channel === options.channel
    );

    if (existing) {
      existing.status = 'blocked';
      await savePairing(store);
      msg.success(`${identifier} is now blocked on ${options.channel}`);
      return;
    }

    // Add as blocked
    const entry: PairingEntry = {
      id: generateId(),
      channel: options.channel,
      identifier,
      status: 'blocked',
      addedAt: new Date().toISOString(),
    };

    store.entries.push(entry);
    await savePairing(store);

    msg.success(`Blocked ${colors.error(identifier)} on ${options.channel}`);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba pairing remove
// ============================================================================

pairingCommand
  .command('remove <id>')
  .description('Remove a contact from the list')
  .action(async (id) => {
    console.log(ratLogoMini);

    const store = await loadPairing();
    const index = store.entries.findIndex(e => e.id === id || e.identifier === id);

    if (index < 0) {
      msg.error(`Contact not found: ${id}`);
      return;
    }

    const entry = store.entries[index];
    store.entries.splice(index, 1);
    await savePairing(store);

    msg.success(`Removed ${colors.text(entry.identifier)} from ${entry.channel}`);
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba pairing settings
// ============================================================================

pairingCommand
  .command('settings')
  .description('Configure pairing settings')
  .option('--default <action>', 'Default action for unknown contacts (allow/block)')
  .option('--require-approval', 'Require approval for new contacts')
  .option('--no-require-approval', 'Don\'t require approval')
  .option('--show', 'Show current settings')
  .action(async (options) => {
    console.log(ratLogoMini);

    const store = await loadPairing();

    if (options.show || (!options.default && options.requireApproval === undefined)) {
      console.log(section.header('PAIRING SETTINGS'));
      
      table.keyValue([
        ['Default Action', store.settings.defaultAction === 'allow' 
          ? colors.accent('Allow all unknown contacts')
          : colors.error('Block all unknown contacts')],
        ['Require Approval', store.settings.requireApproval 
          ? colors.warning('Yes - new contacts need approval')
          : colors.muted('No - automatic based on default action')],
        ['Total Contacts', String(store.entries.length)],
        ['Allowed', String(store.entries.filter(e => e.status === 'allowed').length)],
        ['Blocked', String(store.entries.filter(e => e.status === 'blocked').length)],
      ], 20);
      console.log('');
      return;
    }

    let changed = false;

    if (options.default) {
      if (options.default === 'allow' || options.default === 'block') {
        store.settings.defaultAction = options.default;
        changed = true;
      } else {
        msg.error('Default action must be "allow" or "block"');
        return;
      }
    }

    if (options.requireApproval !== undefined) {
      store.settings.requireApproval = options.requireApproval;
      changed = true;
    }

    if (changed) {
      await savePairing(store);
      msg.success('Settings updated');
      
      console.log('');
      msg.bullet(`Default action: ${store.settings.defaultAction === 'allow' ? colors.accent('Allow') : colors.error('Block')}`);
      msg.bullet(`Require approval: ${store.settings.requireApproval ? colors.warning('Yes') : colors.muted('No')}`);
    }
    console.log('');
  });

// ============================================================================
// SUBCOMMAND: hauba pairing pending
// ============================================================================

pairingCommand
  .command('pending')
  .description('Show contacts awaiting approval')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('PENDING APPROVALS'));

    const store = await loadPairing();
    
    // For now, pending is simulated - in real implementation,
    // this would come from the daemon/API
    msg.info('No pending approval requests');
    msg.hint('Enable approval requirement with: hauba pairing settings --require-approval');
    console.log('');
  });

export default pairingCommand;
