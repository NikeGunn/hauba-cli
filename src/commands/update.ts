// ============================================================================
// HAUBA CLI - Update Command
// File: tools/cli/src/commands/update.ts
// Self-update the Hauba CLI
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner } from '../ui.js';
import { execSync, spawn } from 'child_process';

// ============================================================================
// HELPERS
// ============================================================================

interface VersionInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  changelog?: string[];
}

async function checkForUpdate(): Promise<VersionInfo> {
  // Get current version from package.json
  const packagePath = new URL('../../package.json', import.meta.url);
  const pkg = await import(packagePath.href, { assert: { type: 'json' } });
  const currentVersion = pkg.default.version;

  // Check npm registry for latest version
  try {
    const response = await fetch('https://registry.npmjs.org/hauba/latest', {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return { current: currentVersion, latest: currentVersion, hasUpdate: false };
    }

    const data: any = await response.json();
    const latestVersion = data.version;

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      current: currentVersion,
      latest: latestVersion,
      hasUpdate,
    };
  } catch {
    return { current: currentVersion, latest: currentVersion, hasUpdate: false };
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA > partB) return 1;
    if (partA < partB) return -1;
  }
  return 0;
}

// ============================================================================
// COMMAND: hauba update
// ============================================================================

export const updateCommand = new Command('update')
  .description('Update Hauba CLI to the latest version')
  .option('--check', 'Check for updates without installing')
  .option('--force', 'Force update even if already on latest')
  .option('--beta', 'Install beta version')
  .action(async (options) => {
    console.log(ratLogoMini);

    const s = spinner.create('Checking for updates...');
    s.start();

    const versionInfo = await checkForUpdate();
    s.stop();

    if (options.check) {
      console.log(section.header('VERSION INFO'));
      
      if (versionInfo.hasUpdate) {
        console.log(box.warning('UPDATE AVAILABLE', [
          '',
          `Current version: ${colors.text(versionInfo.current)}`,
          `Latest version:  ${colors.accent(versionInfo.latest)}`,
          '',
          `Run: ${colors.primary('hauba update')} to install`,
          '',
        ]));
      } else {
        console.log(box.success('UP TO DATE', [
          '',
          `You're running the latest version: ${colors.accent(versionInfo.current)}`,
          '',
        ]));
      }
      return;
    }

    if (!versionInfo.hasUpdate && !options.force) {
      msg.success(`Already on latest version (${colors.accent(versionInfo.current)})`);
      return;
    }

    // Confirm update
    if (!options.force) {
      console.log(box.simple([
        '',
        `${colors.text('Current:')} ${versionInfo.current}`,
        `${colors.text('Latest:')}  ${colors.accent(versionInfo.latest)}`,
        '',
      ], 40));

      const { default: inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Install update?',
          default: true,
        },
      ]);

      if (!confirm) {
        msg.info('Update cancelled');
        return;
      }
    }

    // Perform update
    const updateSpinner = spinner.create('Updating Hauba CLI...');
    updateSpinner.start();

    try {
      const packageName = options.beta ? 'hauba@beta' : 'hauba@latest';
      
      // Detect package manager
      let pm = 'npm';
      try {
        execSync('pnpm --version', { stdio: 'pipe' });
        pm = 'pnpm';
      } catch {
        // Use npm
      }

      const installCmd = pm === 'pnpm' 
        ? `pnpm add -g ${packageName}`
        : `npm install -g ${packageName}`;

      execSync(installCmd, { stdio: 'pipe' });

      updateSpinner.succeed('Hauba CLI updated!');

      // Verify new version
      const newVersionInfo = await checkForUpdate();
      msg.success(`Now running version ${colors.accent(newVersionInfo.current)}`);

      // Show changelog hint
      console.log('');
      msg.hint(`View changelog: ${colors.link('https://github.com/NikeGunn/hauba-cli/releases')}`);
    } catch (error) {
      updateSpinner.fail('Update failed');
      if (error instanceof Error) {
        msg.error(error.message);
      }
      msg.hint('Try manually: npm install -g hauba@latest');
    }
  });

// ============================================================================
// COMMAND: hauba version (enhanced)
// ============================================================================

export const versionCommand = new Command('version')
  .description('Show version information')
  .option('--check', 'Also check for updates')
  .action(async (options) => {
    console.log(ratLogoMini);
    console.log(section.header('VERSION'));

    const s = spinner.create('Getting version info...');
    s.start();

    const versionInfo = await checkForUpdate();
    s.stop();

    table.keyValue([
      ['CLI Version', versionInfo.current],
      ['Node.js', process.version],
      ['Platform', `${process.platform} ${process.arch}`],
    ], 15);

    if (options.check || versionInfo.hasUpdate) {
      console.log('');
      if (versionInfo.hasUpdate) {
        msg.warn(`Update available: ${colors.accent(versionInfo.latest)}`);
        msg.hint(`Run: ${colors.primary('hauba update')}`);
      } else {
        msg.success('You\'re on the latest version');
      }
    }

    console.log('');
  });

// Import table for use
import { table } from '../ui.js';

export default updateCommand;
