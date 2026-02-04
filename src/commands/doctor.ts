// ============================================================================
// HAUBA CLI - Doctor Command (Health Diagnostics)
// File: tools/cli/src/commands/doctor.ts
// Run health checks and diagnose issues with auto-fix support
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, status, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: string;
  fix?: () => Promise<boolean>;
  fixDescription?: string;
}

interface DoctorOptions {
  fix: boolean;
  verbose: boolean;
  json: boolean;
  check?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const AUTH_FILE = path.join(HAUBA_DIR, 'auth.json');
const DAEMON_PID_FILE = path.join(HAUBA_DIR, 'daemon.pid');
const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const DEFAULT_API_URL = 'http://localhost:3001';
const DEFAULT_DAEMON_PORT = 18790;
const DEFAULT_GATEWAY_PORT = 18789;

// ============================================================================
// CHECK IMPLEMENTATIONS
// ============================================================================

/**
 * Check Node.js version
 */
async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  if (major >= 18) {
    return {
      name: 'Node.js Version',
      status: 'pass',
      message: `Node.js ${version} installed`,
    };
  } else if (major >= 16) {
    return {
      name: 'Node.js Version',
      status: 'warn',
      message: `Node.js ${version} (18+ recommended)`,
      details: 'Some features may not work on Node.js < 18',
    };
  } else {
    return {
      name: 'Node.js Version',
      status: 'fail',
      message: `Node.js ${version} is too old`,
      details: 'HAUBA requires Node.js 18 or higher',
      fixDescription: 'Install Node.js 18+ from https://nodejs.org',
    };
  }
}

/**
 * Check if Redis is available
 */
async function checkRedis(): Promise<CheckResult> {
  const redisUrl = process.env.REDIS_URL || DEFAULT_REDIS_URL;

  try {
    // Try to connect via TCP
    const { hostname, port } = new URL(redisUrl);
    const portNum = parseInt(port) || 6379;

    const isOpen = await checkPort(hostname, portNum);

    if (isOpen) {
      return {
        name: 'Redis Connection',
        status: 'pass',
        message: `Redis available at ${hostname}:${portNum}`,
      };
    }

    return {
      name: 'Redis Connection',
      status: 'fail',
      message: `Redis not reachable at ${hostname}:${portNum}`,
      details: 'The queue system requires Redis to be running',
      fix: async () => {
        // Try to start Redis via Docker
        try {
          msg.info('Attempting to start Redis via Docker...');
          execSync('docker run -d --name hauba-redis -p 6379:6379 redis:7-alpine', {
            stdio: 'pipe',
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          return await checkPort(hostname, portNum);
        } catch {
          return false;
        }
      },
      fixDescription: 'Start Redis via Docker',
    };
  } catch (error) {
    return {
      name: 'Redis Connection',
      status: 'fail',
      message: 'Invalid Redis URL',
      details: `REDIS_URL: ${redisUrl}`,
    };
  }
}

/**
 * Check if PostgreSQL database is available
 */
async function checkDatabase(): Promise<CheckResult> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return {
      name: 'Database Connection',
      status: 'warn',
      message: 'DATABASE_URL not set',
      details: 'Set DATABASE_URL in your environment or .env file',
      fix: async () => {
        // Create .env file with example
        const envPath = path.join(process.cwd(), '.env');
        try {
          const existing = await fs.readFile(envPath, 'utf-8').catch(() => '');
          if (!existing.includes('DATABASE_URL')) {
            await fs.appendFile(envPath, '\nDATABASE_URL=postgresql://localhost:5432/hauba\n');
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      fixDescription: 'Add DATABASE_URL to .env file',
    };
  }

  try {
    const { hostname, port } = new URL(dbUrl.replace(/^postgres(ql)?:/, 'http:'));
    const portNum = parseInt(port) || 5432;

    const isOpen = await checkPort(hostname, portNum);

    if (isOpen) {
      return {
        name: 'Database Connection',
        status: 'pass',
        message: `PostgreSQL available at ${hostname}:${portNum}`,
      };
    }

    return {
      name: 'Database Connection',
      status: 'fail',
      message: `PostgreSQL not reachable at ${hostname}:${portNum}`,
      details: 'Make sure PostgreSQL is running',
      fix: async () => {
        try {
          msg.info('Attempting to start PostgreSQL via Docker...');
          execSync('docker run -d --name hauba-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hauba postgres:15-alpine', {
            stdio: 'pipe',
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
          return await checkPort(hostname, portNum);
        } catch {
          return false;
        }
      },
      fixDescription: 'Start PostgreSQL via Docker',
    };
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: 'Invalid DATABASE_URL',
      details: 'Check your database connection string format',
    };
  }
}

/**
 * Check API keys configuration
 */
async function checkApiKeys(): Promise<CheckResult> {
  // Check for auth file
  try {
    const auth = JSON.parse(await fs.readFile(AUTH_FILE, 'utf-8'));

    // Try to fetch settings
    const apiUrl = process.env.HAUBA_API_URL || DEFAULT_API_URL;
    try {
      const response = await fetch(`${apiUrl}/api/settings`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data: any = await response.json();
        const keys = data.data?.apiKeysConfigured || {};
        const configured = Object.values(keys).filter(Boolean).length;

        if (configured > 0) {
          return {
            name: 'AI API Keys',
            status: 'pass',
            message: `${configured} API key(s) configured`,
            details: Object.entries(keys)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(', '),
          };
        }

        return {
          name: 'AI API Keys',
          status: 'warn',
          message: 'No AI API keys configured',
          details: 'You need an API key from Google, Anthropic, or OpenAI',
          fixDescription: `Run ${colors.primary('hauba config set-key')} to configure`,
        };
      }
    } catch {
      return {
        name: 'AI API Keys',
        status: 'skip',
        message: 'Could not check API keys (API unavailable)',
      };
    }
  } catch {
    return {
      name: 'AI API Keys',
      status: 'skip',
      message: 'Not authenticated (run hauba login)',
    };
  }

  return {
    name: 'AI API Keys',
    status: 'skip',
    message: 'Could not determine API key status',
  };
}

/**
 * Check if channels are configured
 */
async function checkChannels(): Promise<CheckResult> {
  const envVars = [
    'SLACK_BOT_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'SMTP_HOST',
  ];

  const configured = envVars.filter(v => process.env[v]);

  if (configured.length > 0) {
    return {
      name: 'Channel Configuration',
      status: 'pass',
      message: `${configured.length} channel(s) configured`,
      details: configured.join(', ').replace(/_TOKEN|_HOST|_PHONE_NUMBER_ID/g, ''),
    };
  }

  return {
    name: 'Channel Configuration',
    status: 'warn',
    message: 'No channels configured',
    details: 'Configure at least one channel (Slack, Telegram, WhatsApp, Email)',
    fixDescription: 'Add channel credentials to your .env file',
  };
}

/**
 * Check if browser (Playwright) is available
 */
async function checkBrowser(): Promise<CheckResult> {
  try {
    // Check if playwright is installed
    const playwrightPath = path.join(process.cwd(), 'node_modules', 'playwright');
    await fs.access(playwrightPath);

    // Check if browsers are installed
    try {
      execSync('npx playwright --version', { stdio: 'pipe' });
      return {
        name: 'Browser (Playwright)',
        status: 'pass',
        message: 'Playwright installed',
      };
    } catch {
      return {
        name: 'Browser (Playwright)',
        status: 'warn',
        message: 'Playwright installed but browsers not set up',
        fix: async () => {
          try {
            msg.info('Installing Playwright browsers...');
            execSync('npx playwright install chromium', { stdio: 'inherit' });
            return true;
          } catch {
            return false;
          }
        },
        fixDescription: 'Install Playwright browsers',
      };
    }
  } catch {
    return {
      name: 'Browser (Playwright)',
      status: 'warn',
      message: 'Playwright not installed',
      details: 'Browser automation requires Playwright',
      fix: async () => {
        try {
          msg.info('Installing Playwright...');
          execSync('pnpm add playwright', { stdio: 'inherit' });
          execSync('npx playwright install chromium', { stdio: 'inherit' });
          return true;
        } catch {
          return false;
        }
      },
      fixDescription: 'Install Playwright and Chromium',
    };
  }
}

/**
 * Check daemon status
 */
async function checkDaemon(): Promise<CheckResult> {
  try {
    const pidContent = await fs.readFile(DAEMON_PID_FILE, 'utf-8');
    const pidInfo = JSON.parse(pidContent);

    // Check if process is running
    try {
      process.kill(pidInfo.pid, 0);

      // Check health endpoint
      try {
        const response = await fetch(`http://localhost:${pidInfo.port}/health`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const health: any = await response.json();
          return {
            name: 'Daemon Status',
            status: health.status === 'healthy' ? 'pass' : 'warn',
            message: `Daemon running (PID: ${pidInfo.pid})`,
            details: `Uptime: ${formatUptime(health.uptime)}, Memory: ${formatBytes(health.memory?.used || 0)}`,
          };
        }
      } catch {
        return {
          name: 'Daemon Status',
          status: 'warn',
          message: 'Daemon running but health check failed',
        };
      }
    } catch {
      return {
        name: 'Daemon Status',
        status: 'fail',
        message: 'Daemon PID file exists but process not running',
        fix: async () => {
          await fs.unlink(DAEMON_PID_FILE);
          return true;
        },
        fixDescription: 'Clean up stale PID file',
      };
    }
  } catch {
    return {
      name: 'Daemon Status',
      status: 'warn',
      message: 'Daemon not running',
      details: 'The daemon is required for background processing',
      fixDescription: `Run ${colors.primary('hauba daemon start')} to start`,
    };
  }

  return {
    name: 'Daemon Status',
    status: 'warn',
    message: 'Could not determine daemon status',
  };
}

/**
 * Check port availability
 */
async function checkPorts(): Promise<CheckResult> {
  const ports = [
    { port: 3000, name: 'Web UI' },
    { port: 3001, name: 'API Server' },
    { port: DEFAULT_DAEMON_PORT, name: 'Daemon Health' },
    { port: DEFAULT_GATEWAY_PORT, name: 'Gateway WebSocket' },
    { port: 6379, name: 'Redis' },
    { port: 5432, name: 'PostgreSQL' },
  ];

  const results: string[] = [];
  const issues: string[] = [];

  for (const { port, name } of ports) {
    const inUse = await checkPort('localhost', port);
    if (inUse) {
      results.push(`${name} (${port}): ${colors.accent('in use')}`);
    } else {
      results.push(`${name} (${port}): ${colors.muted('available')}`);
    }
  }

  // Check for port conflicts
  const conflictPorts = [3000, 3001];
  for (const port of conflictPorts) {
    const inUse = await checkPort('localhost', port);
    if (!inUse) {
      issues.push(`Port ${port} is available`);
    }
  }

  return {
    name: 'Port Availability',
    status: 'pass',
    message: 'Checked 6 ports',
    details: results.join(', '),
  };
}

/**
 * Check environment files
 */
async function checkEnvFiles(): Promise<CheckResult> {
  const envFiles = ['.env', '.env.local', '.env.development'];
  const found: string[] = [];

  for (const file of envFiles) {
    try {
      await fs.access(path.join(process.cwd(), file));
      found.push(file);
    } catch {
      // File doesn't exist
    }
  }

  if (found.length > 0) {
    return {
      name: 'Environment Files',
      status: 'pass',
      message: `Found ${found.length} env file(s)`,
      details: found.join(', '),
    };
  }

  return {
    name: 'Environment Files',
    status: 'warn',
    message: 'No .env files found',
    fix: async () => {
      const examplePath = path.join(process.cwd(), '.env.example');
      const envPath = path.join(process.cwd(), '.env');
      try {
        await fs.access(examplePath);
        await fs.copyFile(examplePath, envPath);
        return true;
      } catch {
        // Create basic .env
        await fs.writeFile(envPath, `# HAUBA Environment Configuration
# Generated by hauba doctor

NODE_ENV=development

# Database
DATABASE_URL=postgresql://localhost:5432/hauba

# Redis
REDIS_URL=redis://localhost:6379

# API
API_PORT=3001
GATEWAY_PORT=18789

# Add your API keys below
# GOOGLE_AI_API_KEY=
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
`);
        return true;
      }
    },
    fixDescription: 'Create .env file from template',
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if a port is in use
 */
async function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();

    socket.setTimeout(2000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Format uptime
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================================================
// MAIN DOCTOR COMMAND
// ============================================================================

export const doctorCommand = new Command('doctor')
  .description('Run health checks and diagnose issues')
  .option('--fix', 'Attempt to auto-fix issues')
  .option('-v, --verbose', 'Show detailed output')
  .option('-j, --json', 'Output results as JSON')
  .option('-c, --check <checks...>', 'Run specific checks only')
  .action(async (options: DoctorOptions) => {
    if (!options.json) {
      console.log(ratLogoMini);
      msg.title('HAUBA Health Check', 'Diagnosing your setup');
    }

    // All available checks
    const allChecks = [
      { id: 'node', fn: checkNodeVersion },
      { id: 'env', fn: checkEnvFiles },
      { id: 'redis', fn: checkRedis },
      { id: 'database', fn: checkDatabase },
      { id: 'apikeys', fn: checkApiKeys },
      { id: 'channels', fn: checkChannels },
      { id: 'browser', fn: checkBrowser },
      { id: 'daemon', fn: checkDaemon },
      { id: 'ports', fn: checkPorts },
    ];

    // Filter checks if specific ones requested
    const checksToRun = options.check
      ? allChecks.filter(c => options.check!.includes(c.id))
      : allChecks;

    const results: CheckResult[] = [];
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;
    let skipCount = 0;

    if (!options.json) {
      console.log(section.subheader('RUNNING CHECKS'));
    }

    for (const check of checksToRun) {
      const s = !options.json ? spinner.create(check.id) : null;
      s?.start();

      try {
        const result = await check.fn();
        results.push(result);

        // Update counts
        if (result.status === 'pass') passCount++;
        else if (result.status === 'warn') warnCount++;
        else if (result.status === 'fail') failCount++;
        else skipCount++;

        if (!options.json) {
          const icon = result.status === 'pass' ? colors.accent('✓')
            : result.status === 'warn' ? colors.warning('!')
            : result.status === 'fail' ? colors.error('✗')
            : colors.muted('○');

          s?.stopAndPersist({
            symbol: icon,
            text: `${result.name}: ${result.message}`,
          });

          if (options.verbose && result.details) {
            console.log(`     ${colors.muted(result.details)}`);
          }
        }

        // Try to fix if requested
        if (options.fix && result.fix && (result.status === 'fail' || result.status === 'warn')) {
          if (!options.json) {
            msg.info(`Attempting fix: ${result.fixDescription || 'auto-fix'}`);
          }
          const fixed = await result.fix();
          if (fixed) {
            if (!options.json) {
              msg.success('Fixed!');
            }
            // Re-run check
            const recheck = await check.fn();
            if (recheck.status === 'pass') {
              passCount++;
              if (result.status === 'fail') failCount--;
              else if (result.status === 'warn') warnCount--;
            }
          } else {
            if (!options.json) {
              msg.error('Fix failed');
            }
          }
        }
      } catch (error) {
        const errorResult: CheckResult = {
          name: check.id,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Check failed',
        };
        results.push(errorResult);
        failCount++;

        s?.fail(`${check.id}: ${errorResult.message}`);
      }
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify({
        results,
        summary: { pass: passCount, warn: warnCount, fail: failCount, skip: skipCount },
      }));
      return;
    }

    // Summary
    console.log(section.subheader('SUMMARY'));

    const total = results.length;
    const summaryLines = [
      `${colors.accent(String(passCount))} passed`,
      warnCount > 0 ? `${colors.warning(String(warnCount))} warnings` : null,
      failCount > 0 ? `${colors.error(String(failCount))} failed` : null,
      skipCount > 0 ? `${colors.muted(String(skipCount))} skipped` : null,
    ].filter(Boolean);

    console.log(`  ${summaryLines.join(' | ')} out of ${total} checks\n`);

    // Show fixes needed
    const needsFix = results.filter(r => 
      (r.status === 'fail' || r.status === 'warn') && r.fixDescription
    );

    if (needsFix.length > 0 && !options.fix) {
      console.log(section.subheader('RECOMMENDED FIXES'));
      needsFix.forEach((r, i) => {
        console.log(`  ${colors.muted(`${i + 1}.`)} ${r.name}: ${r.fixDescription}`);
      });
      console.log('');
      msg.hint(`Run ${colors.primary('hauba doctor --fix')} to attempt auto-fixes`);
      console.log('');
    }

    // Final status
    if (failCount === 0 && warnCount === 0) {
      console.log(box.success('ALL SYSTEMS GO', [
        '',
        'Your HAUBA setup is healthy!',
        '',
        'Ready to build AI agents.',
        '',
      ]));
    } else if (failCount > 0) {
      console.log(box.error('ISSUES FOUND', [
        '',
        `${failCount} critical issue(s) need attention.`,
        '',
        'Fix the issues above to ensure HAUBA works correctly.',
        '',
      ]));
      process.exit(1);
    } else {
      console.log(box.warning('WARNINGS', [
        '',
        `${warnCount} warning(s) found.`,
        '',
        'HAUBA will work, but some features may be limited.',
        '',
      ]));
    }
  });

export default doctorCommand;
