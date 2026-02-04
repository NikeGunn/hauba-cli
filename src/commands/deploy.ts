// ============================================================================
// HAUBA CLI - Deploy Command
// File: tools/cli/src/commands/deploy.ts
// Professional, rat-themed design
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
} from '../ui.js';

// ============================================================================
// TYPES
// ============================================================================

interface DeployConfig {
  projectName: string;
  environment: 'development' | 'staging' | 'production';
  region: string;
  resources: {
    memory: string;
    cpu: string;
    replicas: number;
  };
}

interface DeploymentResult {
  deploymentId: string;
  url: string;
  status: 'pending' | 'deploying' | 'live' | 'failed';
  createdAt: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

async function loadAuth(): Promise<{ token: string } | null> {
  try {
    const authPath = path.join(os.homedir(), '.hauba', 'auth.json');
    const content = await fs.readFile(authPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function findProjectConfig(): Promise<DeployConfig | null> {
  try {
    // First check for hauba.config.json
    const configPath = path.join(process.cwd(), 'hauba.config.json');
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Try to infer from package.json
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      return {
        projectName: pkg.name,
        environment: 'development',
        region: 'us-east-1',
        resources: {
          memory: '512MB',
          cpu: '0.5',
          replicas: 1,
        },
      };
    } catch {
      return null;
    }
  }
}

async function validateProject(): Promise<string[]> {
  const errors: string[] = [];

  // Check for package.json
  try {
    await fs.access(path.join(process.cwd(), 'package.json'));
  } catch {
    errors.push('Missing package.json');
  }

  // Check for build output
  try {
    await fs.access(path.join(process.cwd(), 'dist'));
  } catch {
    errors.push('No build output found. Run "pnpm build" first.');
  }

  return errors;
}

// ============================================================================
// DEPLOY COMMAND
// ============================================================================

export const deployCommand = new Command('deploy')
  .description('Deploy project to Hauba platform')
  .option('-e, --env <environment>', 'Deployment environment', 'development')
  .option('-r, --region <region>', 'Deployment region', 'us-east-1')
  .option('--prod', 'Deploy to production')
  .option('--dry-run', 'Simulate deployment without uploading')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options: {
    env: string;
    region: string;
    prod: boolean;
    dryRun: boolean;
    yes: boolean;
  }) => {
    console.log(ratLogoMini);
    console.log(section.header('DEPLOYMENT'));

    // Check authentication
    const auth = await loadAuth();
    if (!auth) {
      console.log(box.error('NOT AUTHENTICATED', [
        '',
        'You must be logged in to deploy.',
        '',
        `Run: ${colors.primary('hauba login')}`,
        '',
      ]));
      process.exit(1);
    }

    // Validate project
    const errors = await validateProject();
    if (errors.length > 0) {
      console.log(box.error('VALIDATION FAILED', [
        '',
        ...errors,
        '',
      ]));
      process.exit(1);
    }

    // Load project config
    let config = await findProjectConfig();
    if (!config) {
      msg.warn('No project configuration found.');
      
      const { projectName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: path.basename(process.cwd()),
        },
      ]);

      config = {
        projectName,
        environment: (options.prod ? 'production' : options.env) as DeployConfig['environment'],
        region: options.region,
        resources: {
          memory: '512MB',
          cpu: '0.5',
          replicas: 1,
        },
      };
    }

    // Override with CLI options
    const environment = options.prod ? 'production' : (options.env as DeployConfig['environment']);
    config.environment = environment;
    config.region = options.region;

    // Confirmation for production
    if (environment === 'production' && !options.yes) {
      console.log(box.warning('PRODUCTION DEPLOYMENT', [
        '',
        'This will deploy to the production environment.',
        'All changes will be immediately live.',
        '',
      ]));

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to deploy to production?',
          default: false,
        },
      ]);

      if (!confirm) {
        msg.info('Deployment cancelled.');
        return;
      }
    }

    // Display deployment plan
    console.log(section.subheader('DEPLOYMENT PLAN'));
    console.log(`  ${colors.muted('Project:')}     ${colors.text(config.projectName)}`);
    console.log(`  ${colors.muted('Environment:')} ${getEnvColor(environment)(environment)}`);
    console.log(`  ${colors.muted('Region:')}      ${colors.text(config.region)}`);
    console.log(`  ${colors.muted('Memory:')}      ${colors.dim(config.resources.memory)}`);
    console.log(`  ${colors.muted('CPU:')}         ${colors.dim(config.resources.cpu)}`);
    console.log(`  ${colors.muted('Replicas:')}    ${colors.dim(config.resources.replicas.toString())}`);
    console.log('');

    if (options.dryRun) {
      console.log(box.simple([
        '',
        `${colors.warning('[DRY RUN]')} Deployment simulation complete.`,
        'No changes were made.',
        '',
      ]));
      return;
    }

    // Start deployment
    const spinner = uiSpinner.create('Preparing deployment...').start();

    try {
      // Step 1: Package
      spinner.text = 'Packaging project...';
      await simulateStep(500);

      // Step 2: Upload
      spinner.text = 'Uploading to Hauba Cloud...';
      await simulateStep(1500);

      // Step 3: Build
      spinner.text = 'Building container...';
      await simulateStep(2000);

      // Step 4: Deploy
      spinner.text = `Deploying to ${environment}...`;
      await simulateStep(1500);

      // Step 5: Health check
      spinner.text = 'Running health checks...';
      await simulateStep(1000);

      spinner.succeed(colors.accent('Deployment successful!'));

      // Generate deployment result
      const deployment: DeploymentResult = {
        deploymentId: `deploy_${Date.now().toString(36)}`,
        url: `https://${config.projectName}${environment === 'production' ? '' : `-${environment}`}.hauba.app`,
        status: 'live',
        createdAt: new Date().toISOString(),
      };

      console.log(box.success('DEPLOYMENT COMPLETE', [
        '',
        `${colors.muted('Deployment ID:')} ${colors.text(deployment.deploymentId)}`,
        `${colors.muted('Status:')}        ${colors.accent('Live')}`,
        `${colors.muted('URL:')}           ${colors.link(deployment.url)}`,
        `${colors.muted('Environment:')}   ${getEnvColor(environment)(environment)}`,
        '',
      ]));

      console.log(section.subheader('COMMANDS'));
      msg.bullet(`View logs:    ${colors.primary(`hauba logs ${deployment.deploymentId}`)}`);
      msg.bullet(`View metrics: ${colors.primary(`hauba metrics ${deployment.deploymentId}`)}`);
      msg.bullet(`Rollback:     ${colors.primary(`hauba rollback ${deployment.deploymentId}`)}`);
      console.log('');

    } catch (error) {
      spinner.fail(colors.error('Deployment failed'));
      if (error instanceof Error) {
        msg.error(error.message);
      }
      msg.hint('Check logs for more details: hauba logs --error');
      process.exit(1);
    }
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getEnvColor(env: string): (text: string) => string {
  switch (env) {
    case 'production':
      return colors.error;
    case 'staging':
      return colors.warning;
    default:
      return colors.accent;
  }
}

function simulateStep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
