// ============================================================================
// HAUBA CLI - Version Management Command
// Handles semantic versioning and npm publishing workflow
// ============================================================================

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { colors, ratLogoMini, msg, section, box, spinner, symbols } from '../ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPES
// ============================================================================

type BumpType = 'major' | 'minor' | 'patch';

interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

// ============================================================================
// HELPERS
// ============================================================================

async function getPackageJsonPath(): Promise<string> {
  // Try multiple locations
  const possiblePaths = [
    path.join(process.cwd(), 'package.json'),  // Current directory
    path.join(__dirname, '../../package.json'), // From dist/commands
    path.join(__dirname, '../../../package.json'), // From src/commands (development)
  ];
  
  for (const pkgPath of possiblePaths) {
    try {
      await fs.access(pkgPath);
      return pkgPath;
    } catch {
      continue;
    }
  }
  
  throw new Error('Could not find package.json');
}

async function getPackageJson(): Promise<PackageJson> {
  const pkgPath = await getPackageJsonPath();
  const content = await fs.readFile(pkgPath, 'utf-8');
  return JSON.parse(content);
}

async function updatePackageJson(newVersion: string): Promise<void> {
  const pkgPath = await getPackageJsonPath();
  const pkg = await getPackageJson();
  pkg.version = newVersion;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function bumpVersion(currentVersion: string, type: BumpType): string {
  const parts = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

async function runCommand(cmd: string): Promise<{ success: boolean; output: string }> {
  const { exec } = await import('child_process');
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({
        success: !error,
        output: stdout || stderr
      });
    });
  });
}

async function isGitRepo(): Promise<boolean> {
  const result = await runCommand('git rev-parse --git-dir');
  return result.success;
}

async function hasUncommittedChanges(): Promise<boolean> {
  const result = await runCommand('git status --porcelain');
  return result.output.trim().length > 0;
}

// ============================================================================
// COMMAND: hauba version
// ============================================================================

export const versionCommand = new Command('version')
  .description('Manage package version and prepare for npm publishing')
  .action(async () => {
    console.log(ratLogoMini);
    
    const pkg = await getPackageJson();
    
    console.log(box.simple([
      '',
      `${colors.text.bold('Current Version:')} ${colors.primary(pkg.version)}`,
      `${colors.text.bold('Package Name:')} ${colors.text(pkg.name)}`,
      '',
      `${colors.muted('Use version bump commands to update:')}`,
      ``,
      `${colors.secondary(symbols.arrow)} ${colors.primary('hauba version patch')}  ${colors.dim(symbols.rightArrow)} ${colors.textLight(`1.0.0 ${symbols.rightArrow} 1.0.1`)}`,
      `${colors.secondary(symbols.arrow)} ${colors.primary('hauba version minor')}  ${colors.dim(symbols.rightArrow)} ${colors.textLight(`1.0.0 ${symbols.rightArrow} 1.1.0`)}`,
      `${colors.secondary(symbols.arrow)} ${colors.primary('hauba version major')}  ${colors.dim(symbols.rightArrow)} ${colors.textLight(`1.0.0 ${symbols.rightArrow} 2.0.0`)}`,
      '',
    ], 60));
  });

// ============================================================================
// SUBCOMMAND: hauba version patch
// ============================================================================

versionCommand
  .command('patch')
  .description('Bump patch version (1.0.0 → 1.0.1) - bug fixes')
  .option('--no-git', 'Skip git operations')
  .option('--no-build', 'Skip building the package')
  .action(async (options) => {
    await bumpAndPublish('patch', options);
  });

// ============================================================================
// SUBCOMMAND: hauba version minor
// ============================================================================

versionCommand
  .command('minor')
  .description('Bump minor version (1.0.0 → 1.1.0) - new features')
  .option('--no-git', 'Skip git operations')
  .option('--no-build', 'Skip building the package')
  .action(async (options) => {
    await bumpAndPublish('minor', options);
  });

// ============================================================================
// SUBCOMMAND: hauba version major
// ============================================================================

versionCommand
  .command('major')
  .description('Bump major version (1.0.0 → 2.0.0) - breaking changes')
  .option('--no-git', 'Skip git operations')
  .option('--no-build', 'Skip building the package')
  .action(async (options) => {
    await bumpAndPublish('major', options);
  });

// ============================================================================
// SUBCOMMAND: hauba version set
// ============================================================================

versionCommand
  .command('set <version>')
  .description('Set specific version manually (e.g., 2.0.0-beta.1)')
  .option('--no-git', 'Skip git operations')
  .option('--no-build', 'Skip building the package')
  .action(async (version, options) => {
    console.log(ratLogoMini);
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/.test(version)) {
      msg.error('Invalid version format');
      msg.info('Use semantic versioning: MAJOR.MINOR.PATCH (e.g., 2.0.0 or 2.0.0-beta.1)');
      process.exit(1);
    }
    
    const pkg = await getPackageJson();
    console.log(section.header('VERSION UPDATE'));
    console.log(`  ${colors.muted(pkg.version)} ${colors.dim('→')} ${colors.primary(version)}\n`);
    
    // Confirm
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Set version to ${version}?`,
      default: true,
    }]);
    
    if (!confirm) {
      msg.warn('Version update cancelled');
      return;
    }
    
    await performVersionUpdate(pkg.version, version, options);
  });

// ============================================================================
// SUBCOMMAND: hauba version publish
// ============================================================================

versionCommand
  .command('publish')
  .description('Publish current version to npm')
  .option('--tag <tag>', 'npm tag (latest, beta, next)', 'latest')
  .option('--dry-run', 'Test publish without actually publishing')
  .action(async (options) => {
    console.log(ratLogoMini);
    console.log(section.header('NPM PUBLISH'));
    
    const pkg = await getPackageJson();
    console.log(`  ${colors.text('Package:')} ${colors.primary(pkg.name)}`);
    console.log(`  ${colors.text('Version:')} ${colors.primary(pkg.version)}`);
    console.log(`  ${colors.text('Tag:')} ${colors.accent(options.tag)}`);
    console.log('');
    
    if (options.dryRun) {
      msg.info('Running in dry-run mode...');
      console.log('');
    }
    
    // Build first
    const buildSpinner = spinner.robot('Building package...');
    buildSpinner.start();
    
    const buildResult = await runCommand('pnpm build');
    if (!buildResult.success) {
      buildSpinner.fail('Build failed');
      msg.error('Fix build errors before publishing');
      process.exit(1);
    }
    buildSpinner.succeed('Build completed');
    
    // Publish
    const publishCommand = options.dryRun 
      ? 'npm publish --dry-run'
      : `npm publish --tag ${options.tag}`;
    
    const publishSpinner = spinner.matrix('Publishing to npm...');
    publishSpinner.start();
    
    const publishResult = await runCommand(publishCommand);
    
    if (publishResult.success) {
      publishSpinner.succeed('Published successfully!');
      console.log('');
      console.log(box.success('PUBLISHED TO NPM', [
        '',
        `${colors.accent('✓')} Version ${pkg.version} is now live!`,
        '',
        `Install globally:`,
        `${colors.primary('npm install -g ' + pkg.name)}`,
        '',
        `Or use directly:`,
        `${colors.primary('npx ' + pkg.name)}`,
        '',
      ]));
    } else {
      publishSpinner.fail('Publish failed');
      console.log('');
      msg.error('Publishing failed. Check your npm credentials.');
      msg.info('Run: npm login');
      process.exit(1);
    }
  });

// ============================================================================
// VERSION BUMP HELPER
// ============================================================================

async function bumpAndPublish(type: BumpType, options: any): Promise<void> {
  console.log(ratLogoMini);
  
  const pkg = await getPackageJson();
  const newVersion = bumpVersion(pkg.version, type);
  
  console.log(section.header(`VERSION BUMP - ${type.toUpperCase()}`));
  console.log(`  ${colors.muted(pkg.version)} ${colors.dim('→')} ${colors.primary(newVersion)}\n`);
  
  // Show what will happen
  console.log(section.subheader('STEPS'));
  msg.numbered(1, 'Update package.json version');
  if (options.build !== false) {
    msg.numbered(2, 'Build the package');
  }
  if (options.git !== false) {
    msg.numbered(3, 'Git commit and tag');
  }
  console.log('');
  
  // Confirm
  const { default: inquirer } = await import('inquirer');
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Proceed with ${type} version bump?`,
    default: true,
  }]);
  
  if (!confirm) {
    msg.warn('Version bump cancelled');
    return;
  }
  
  await performVersionUpdate(pkg.version, newVersion, options);
}

async function performVersionUpdate(oldVersion: string, newVersion: string, options: any): Promise<void> {
  console.log('');
  
  // Step 1: Update package.json
  const updateSpinner = spinner.create('Updating package.json...');
  updateSpinner.start();
  
  try {
    await updatePackageJson(newVersion);
    updateSpinner.succeed(`Version updated: ${oldVersion} → ${newVersion}`);
  } catch (error) {
    updateSpinner.fail('Failed to update package.json');
    msg.error(String(error));
    process.exit(1);
  }
  
  // Step 2: Build
  if (options.build !== false) {
    const buildSpinner = spinner.robot('Building package...');
    buildSpinner.start();
    
    const buildResult = await runCommand('pnpm build');
    if (!buildResult.success) {
      buildSpinner.fail('Build failed');
      msg.error('Fix build errors before proceeding');
      process.exit(1);
    }
    buildSpinner.succeed('Build completed');
  }
  
  // Step 3: Git operations
  if (options.git !== false) {
    const isGit = await isGitRepo();
    
    if (isGit) {
      const hasChanges = await hasUncommittedChanges();
      
      if (hasChanges) {
        const gitSpinner = spinner.scan('Committing changes...');
        gitSpinner.start();
        
        // Stage package.json
        await runCommand('git add package.json');
        
        // Commit
        const commitResult = await runCommand(`git commit -m "chore: bump version to ${newVersion}"`);
        if (!commitResult.success) {
          gitSpinner.fail('Git commit failed');
        } else {
          gitSpinner.succeed('Changes committed');
        }
        
        // Tag
        const tagSpinner = spinner.scan('Creating git tag...');
        tagSpinner.start();
        
        const tagResult = await runCommand(`git tag v${newVersion}`);
        if (tagResult.success) {
          tagSpinner.succeed(`Tag created: v${newVersion}`);
        } else {
          tagSpinner.fail('Tag creation failed (may already exist)');
        }
      }
    }
  }
  
  // Success summary
  console.log('');
  console.log(box.success('VERSION UPDATED', [
    '',
    `${colors.accent('✓')} New version: ${colors.primary.bold(newVersion)}`,
    '',
    `${colors.muted('Next steps:')}`,
    '',
    `${colors.secondary('1▸')} ${colors.text('Test your changes')}`,
    `   ${colors.dim('node bin/hauba.js --version')}`,
    '',
    `${colors.secondary('2▸')} ${colors.text('Push to git')}`,
    `   ${colors.dim('git push && git push --tags')}`,
    '',
    `${colors.secondary('3▸')} ${colors.text('Publish to npm')}`,
    `   ${colors.dim('hauba version publish')}`,
    `   ${colors.dim('OR: npm publish')}`,
    '',
  ]));
}

export default versionCommand;
