// ============================================================================
// HAUBA CLI - Login Commands
// File: tools/cli/src/commands/login.ts
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

interface AuthConfig {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    tenantName: string;
  };
  expiresAt: string;
}

// ============================================================================
// CONFIG PATHS
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.hauba');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');

// ============================================================================
// UTILITIES
// ============================================================================

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

async function saveAuth(auth: AuthConfig): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

async function loadAuth(): Promise<AuthConfig | null> {
  try {
    const content = await fs.readFile(AUTH_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function clearAuth(): Promise<void> {
  try {
    await fs.unlink(AUTH_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}

function isTokenExpired(auth: AuthConfig): boolean {
  return new Date(auth.expiresAt) < new Date();
}

// ============================================================================
// LOGIN COMMAND
// ============================================================================

export const loginCommand = new Command('login')
  .description('Authenticate with Hauba platform')
  .option('-e, --email <email>', 'Email address')
  .option('-t, --token <token>', 'API token (for CI/CD)')
  .action(async (options: { email?: string; token?: string }) => {
    console.log(ratLogoMini);
    console.log(section.header('AUTHENTICATION'));

    // Check if already logged in
    const existingAuth = await loadAuth();
    if (existingAuth && !isTokenExpired(existingAuth)) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Already logged in as ${colors.text(existingAuth.user.email)}. Re-authenticate?`,
          default: false,
        },
      ]);
      if (!confirm) {
        return;
      }
    }

    // Token-based auth (for CI/CD)
    if (options.token) {
      const spinner = uiSpinner.create('Validating token...').start();

      try {
        // In real implementation, would validate token against API
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Simulate token validation
        const auth: AuthConfig = {
          token: options.token,
          user: {
            id: 'user_ci_cd',
            email: 'ci@hauba.tech',
            name: 'CI/CD User',
            tenantId: 'tenant_123',
            tenantName: 'Default Workspace',
          },
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };

        await saveAuth(auth);
        spinner.succeed(colors.accent('Authenticated with API token'));
        return;
      } catch {
        spinner.fail(colors.error('Invalid token'));
        return;
      }
    }

    // Interactive auth
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        default: options.email,
        validate: (input: string) => {
          if (!input.includes('@')) {
            return 'Please enter a valid email';
          }
          return true;
        },
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
      },
    ]);

    const spinner = uiSpinner.create('Authenticating...').start();

    try {
      // In real implementation, would call auth API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate successful auth
      const auth: AuthConfig = {
        token: `hauba_${Buffer.from(answers.email).toString('base64')}_${Date.now()}`,
        refreshToken: `refresh_${Date.now()}`,
        user: {
          id: `user_${Date.now()}`,
          email: answers.email,
          name: answers.email.split('@')[0],
          tenantId: 'tenant_123',
          tenantName: 'My Workspace',
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await saveAuth(auth);

      spinner.succeed(colors.accent('Successfully authenticated!'));

      console.log(box.success('LOGGED IN', [
        '',
        `${colors.muted('Email:')}     ${colors.text(auth.user.email)}`,
        `${colors.muted('Workspace:')} ${colors.text(auth.user.tenantName)}`,
        '',
      ]));

      msg.hint('Run: hauba whoami to view your profile');
      console.log('');
    } catch (error) {
      spinner.fail(colors.error('Authentication failed'));
      if (error instanceof Error) {
        msg.error(error.message);
      }
    }
  });

// ============================================================================
// LOGOUT COMMAND
// ============================================================================

export const logoutCommand = new Command('logout')
  .description('Log out from Hauba platform')
  .option('-f, --force', 'Force logout without confirmation')
  .action(async (options: { force: boolean }) => {
    const auth = await loadAuth();

    if (!auth) {
      msg.warn('Not currently logged in.');
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Log out from ${colors.text(auth.user.email)}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        msg.info('Cancelled.');
        return;
      }
    }

    const spinner = uiSpinner.create('Logging out...').start();

    try {
      // In real implementation, would invalidate token on server
      await clearAuth();
      spinner.succeed(colors.accent('Successfully logged out'));
    } catch (error) {
      spinner.fail(colors.error('Logout failed'));
      if (error instanceof Error) {
        msg.error(error.message);
      }
    }
  });

// ============================================================================
// WHOAMI COMMAND
// ============================================================================

export const whoamiCommand = new Command('whoami')
  .description('Display current user information')
  .option('--json', 'Output as JSON')
  .action(async (options: { json: boolean }) => {
    const auth = await loadAuth();

    if (!auth) {
      msg.warn('Not logged in.');
      msg.hint('Run: hauba login');
      process.exit(1);
    }

    // Check token expiry
    if (isTokenExpired(auth)) {
      msg.warn('Session expired.');
      msg.hint('Run: hauba login');
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify({
        user: auth.user,
        expiresAt: auth.expiresAt,
      }, null, 2));
      return;
    }

    const expiresIn = Math.round(
      (new Date(auth.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    console.log(ratLogoMini);
    console.log(section.header('USER PROFILE'));

    console.log(`  ${colors.muted('ID:')}         ${colors.text(auth.user.id)}`);
    console.log(`  ${colors.muted('Email:')}      ${colors.text(auth.user.email)}`);
    console.log(`  ${colors.muted('Name:')}       ${colors.text(auth.user.name)}`);
    console.log(`  ${colors.muted('Workspace:')}  ${colors.text(auth.user.tenantName)}`);
    console.log(`  ${colors.muted('Tenant ID:')}  ${colors.dim(auth.user.tenantId)}`);
    console.log(`  ${colors.muted('Session:')}    ${colors.accent(`${expiresIn} days remaining`)}`);
    console.log('');
  });
