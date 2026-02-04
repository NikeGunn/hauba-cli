// ============================================================================
// HAUBA CLI - Daemon Management Commands
// File: tools/cli/src/commands/daemon.ts
// Manage the Hauba daemon process (start, stop, status, logs)
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, status, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess, execSync } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

interface DaemonInfo {
  pid: number;
  startedAt: string;
  port: number;
  version: string;
  workDir: string;
}

interface DaemonHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  uptime: number;
  memory: {
    used: number;
    rss: number;
  };
  workers: {
    message: number;
    skill: number;
    browser: number;
  };
  queues: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const DAEMON_PID_FILE = path.join(HAUBA_DIR, 'daemon.pid');
const DAEMON_LOG_FILE = path.join(HAUBA_DIR, 'daemon.log');
const DEFAULT_HEALTH_PORT = 18790;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Ensure the .hauba directory exists
 */
async function ensureHaubaDir(): Promise<void> {
  try {
    await fs.mkdir(HAUBA_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

/**
 * Read daemon PID from file
 */
export async function readDaemonPid(): Promise<DaemonInfo | null> {
  try {
    const content = await fs.readFile(DAEMON_PID_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write daemon PID to file
 */
async function writeDaemonPid(info: DaemonInfo): Promise<void> {
  await ensureHaubaDir();
  await fs.writeFile(DAEMON_PID_FILE, JSON.stringify(info, null, 2));
}

/**
 * Remove daemon PID file
 */
async function removeDaemonPid(): Promise<void> {
  try {
    await fs.unlink(DAEMON_PID_FILE);
  } catch {
    // File doesn't exist
  }
}

/**
 * Check if a process with the given PID is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch daemon health from the health endpoint
 */
async function fetchDaemonHealth(port: number): Promise<DaemonHealth | null> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      return await response.json() as DaemonHealth;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format uptime in human readable form
 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

/**
 * Format bytes in human readable form
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Find the daemon executable path
 */
async function findDaemonPath(): Promise<string | null> {
  // Check common locations
  const possiblePaths = [
    // In monorepo
    path.join(process.cwd(), 'apps', 'daemon', 'dist', 'index.js'),
    path.join(process.cwd(), 'apps', 'daemon', 'src', 'index.ts'),
    // Installed globally
    path.join(os.homedir(), '.hauba', 'daemon', 'index.js'),
    // Via npx
    path.resolve('node_modules', '@hauba', 'daemon', 'dist', 'index.js'),
  ];

  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // Continue checking
    }
  }

  return null;
}

// ============================================================================
// DAEMON START COMMAND
// ============================================================================

const startCommand = new Command('start')
  .description('Start the Hauba daemon process')
  .option('-d, --dev', 'Run in development mode with hot reload')
  .option('-p, --port <port>', 'Health check port', String(DEFAULT_HEALTH_PORT))
  .option('-c, --concurrency <n>', 'Worker concurrency level', '10')
  .option('--foreground', 'Run in foreground (don\'t daemonize)')
  .option('--redis-url <url>', 'Redis connection URL', 'redis://localhost:6379')
  .action(async (options) => {
    console.log(ratLogoMini);
    msg.title('Starting Hauba Daemon', 'Background Service');

    // Check if daemon is already running
    const existingPid = await readDaemonPid();
    if (existingPid && isProcessRunning(existingPid.pid)) {
      console.log(box.warning('DAEMON ALREADY RUNNING', [
        '',
        `PID: ${colors.text(String(existingPid.pid))}`,
        `Port: ${colors.text(String(existingPid.port))}`,
        `Started: ${colors.muted(existingPid.startedAt)}`,
        '',
        `Run ${colors.primary('hauba daemon status')} for details`,
        '',
      ]));
      return;
    }

    // Find daemon path
    const daemonPath = await findDaemonPath();
    if (!daemonPath) {
      console.log(box.error('DAEMON NOT FOUND', [
        '',
        'Could not locate the Hauba daemon.',
        '',
        'Make sure you have built the daemon:',
        `  ${colors.primary('cd apps/daemon && pnpm build')}`,
        '',
        'Or install it globally:',
        `  ${colors.primary('pnpm add -g @hauba/daemon')}`,
        '',
      ]));
      process.exit(1);
    }

    const port = parseInt(options.port);
    const concurrency = parseInt(options.concurrency);

    // Environment variables for daemon
    const env = {
      ...process.env,
      DAEMON_PORT: String(port),
      DAEMON_CONCURRENCY: String(concurrency),
      REDIS_URL: options.redisUrl,
      NODE_ENV: options.dev ? 'development' : 'production',
    };

    if (options.foreground) {
      // Run in foreground
      msg.info('Running in foreground mode (Ctrl+C to stop)');
      console.log(section.divider());
      console.log('');

      const isTs = daemonPath.endsWith('.ts');
      const child = spawn(
        isTs ? 'npx' : 'node',
        isTs ? ['tsx', daemonPath] : [daemonPath],
        {
          env,
          stdio: 'inherit',
          cwd: process.cwd(),
        }
      );

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });

      // Handle signals
      process.on('SIGINT', () => {
        child.kill('SIGINT');
      });
      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
      });
      return;
    }

    // Daemonize the process
    const s = spinner.create('Starting daemon...');
    s.start();

    try {
      await ensureHaubaDir();

      // Open log file
      const logFd = await fs.open(DAEMON_LOG_FILE, 'a');

      const isTs = daemonPath.endsWith('.ts');
      const child = spawn(
        isTs ? 'npx' : 'node',
        isTs ? ['tsx', daemonPath] : [daemonPath],
        {
          env,
          detached: true,
          stdio: ['ignore', logFd.fd, logFd.fd],
          cwd: process.cwd(),
        }
      );

      // Unref so parent can exit
      child.unref();

      // Wait a bit for the daemon to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if it's running
      const health = await fetchDaemonHealth(port);
      if (health && health.status === 'healthy') {
        // Save PID info
        await writeDaemonPid({
          pid: child.pid!,
          startedAt: new Date().toISOString(),
          port,
          version: '0.1.0',
          workDir: process.cwd(),
        });

        s.succeed(colors.accent('Daemon started successfully!'));

        console.log(box.success('DAEMON RUNNING', [
          '',
          `PID:     ${colors.text(String(child.pid))}`,
          `Port:    ${colors.text(String(port))}`,
          `Workers: ${colors.text(String(concurrency))}`,
          `Mode:    ${colors.text(options.dev ? 'development' : 'production')}`,
          '',
          `Health:  ${colors.link(`http://localhost:${port}/health`)}`,
          `Logs:    ${colors.muted(DAEMON_LOG_FILE)}`,
          '',
        ]));

        console.log(`\n${section.subheader('NEXT STEPS')}`);
        msg.bullet(`Check status: ${colors.primary('hauba daemon status')}`);
        msg.bullet(`View logs: ${colors.primary('hauba daemon logs')}`);
        msg.bullet(`Stop daemon: ${colors.primary('hauba daemon stop')}`);
        console.log('');
      } else {
        s.fail(colors.error('Failed to start daemon'));

        // Try to get error from logs
        try {
          const logContent = await fs.readFile(DAEMON_LOG_FILE, 'utf-8');
          const lastLines = logContent.split('\n').slice(-10).join('\n');
          if (lastLines) {
            console.log(`\n${section.subheader('RECENT LOGS')}`);
            console.log(colors.muted(lastLines));
          }
        } catch {}

        console.log(`\n${colors.muted('Check full logs:')} ${colors.primary(DAEMON_LOG_FILE)}`);
        process.exit(1);
      }

      await logFd.close();
    } catch (error) {
      s.fail(colors.error('Failed to start daemon'));
      if (error instanceof Error) {
        msg.error(error.message);
      }
      process.exit(1);
    }
  });

// ============================================================================
// DAEMON STOP COMMAND
// ============================================================================

const stopCommand = new Command('stop')
  .description('Stop the Hauba daemon gracefully')
  .option('-f, --force', 'Force kill the daemon')
  .option('--timeout <seconds>', 'Grace period before force kill', '10')
  .action(async (options) => {
    console.log(ratLogoMini);
    msg.title('Stopping Hauba Daemon');

    const daemonInfo = await readDaemonPid();
    if (!daemonInfo) {
      console.log(box.warning('NO DAEMON FOUND', [
        '',
        'No daemon PID file found.',
        'The daemon may not be running.',
        '',
        `Run ${colors.primary('hauba daemon status')} to check.`,
        '',
      ]));
      return;
    }

    if (!isProcessRunning(daemonInfo.pid)) {
      msg.warn('Daemon process not running (stale PID file)');
      await removeDaemonPid();
      msg.success('Cleaned up stale PID file');
      return;
    }

    const s = spinner.create('Stopping daemon...');
    s.start();

    try {
      // Send graceful shutdown signal
      if (options.force) {
        process.kill(daemonInfo.pid, 'SIGKILL');
        s.succeed(colors.accent('Daemon force killed'));
      } else {
        process.kill(daemonInfo.pid, 'SIGTERM');

        // Wait for graceful shutdown
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();

        while (isProcessRunning(daemonInfo.pid)) {
          if (Date.now() - startTime > timeout) {
            s.text = 'Grace period exceeded, force killing...';
            process.kill(daemonInfo.pid, 'SIGKILL');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        s.succeed(colors.accent('Daemon stopped gracefully'));
      }

      await removeDaemonPid();

      console.log(box.success('DAEMON STOPPED', [
        '',
        `PID ${daemonInfo.pid} has been terminated.`,
        '',
        `To restart: ${colors.primary('hauba daemon start')}`,
        '',
      ]));
    } catch (error) {
      s.fail(colors.error('Failed to stop daemon'));
      if (error instanceof Error) {
        msg.error(error.message);
      }
      process.exit(1);
    }
  });

// ============================================================================
// DAEMON STATUS COMMAND
// ============================================================================

const statusCommand = new Command('status')
  .description('Show daemon health and status')
  .option('-j, --json', 'Output as JSON')
  .option('-w, --watch', 'Watch mode with live updates')
  .action(async (options) => {
    if (!options.json) {
      console.log(ratLogoMini);
      msg.title('Daemon Status');
    }

    const daemonInfo = await readDaemonPid();

    if (!daemonInfo) {
      if (options.json) {
        console.log(JSON.stringify({ running: false }));
        return;
      }

      console.log(box.warning('DAEMON NOT RUNNING', [
        '',
        'The Hauba daemon is not currently running.',
        '',
        `To start: ${colors.primary('hauba daemon start')}`,
        '',
      ]));
      return;
    }

    const isRunning = isProcessRunning(daemonInfo.pid);

    if (!isRunning) {
      if (options.json) {
        console.log(JSON.stringify({ running: false, stalePid: daemonInfo.pid }));
        return;
      }

      msg.warn('Daemon process not running (stale PID file)');
      msg.hint(`Run ${colors.primary('hauba daemon stop')} to clean up`);
      return;
    }

    // Fetch health info
    const health = await fetchDaemonHealth(daemonInfo.port);

    if (options.json) {
      console.log(JSON.stringify({
        running: true,
        pid: daemonInfo.pid,
        port: daemonInfo.port,
        startedAt: daemonInfo.startedAt,
        health,
      }));
      return;
    }

    // Display status
    const statusIcon = health?.status === 'healthy' 
      ? colors.accent('●') 
      : health?.status === 'unhealthy' 
        ? colors.error('●') 
        : colors.warning('●');

    const statusText = health?.status === 'healthy'
      ? colors.accent('Healthy')
      : health?.status === 'unhealthy'
        ? colors.error('Unhealthy')
        : colors.warning('Unknown');

    console.log(section.subheader('PROCESS'));
    table.keyValue([
      ['Status', `${statusIcon} ${statusText}`],
      ['PID', String(daemonInfo.pid)],
      ['Port', String(daemonInfo.port)],
      ['Started', new Date(daemonInfo.startedAt).toLocaleString()],
      ['Uptime', health ? formatUptime(health.uptime) : 'Unknown'],
    ], 12);

    if (health) {
      console.log(section.subheader('MEMORY'));
      table.keyValue([
        ['Used', formatBytes(health.memory.used)],
        ['RSS', formatBytes(health.memory.rss)],
      ], 12);

      console.log(section.subheader('WORKERS'));
      table.keyValue([
        ['Message', String(health.workers.message)],
        ['Skill', String(health.workers.skill)],
        ['Browser', String(health.workers.browser)],
      ], 12);

      console.log(section.subheader('QUEUE STATS'));
      table.keyValue([
        ['Pending', String(health.queues.pending)],
        ['Active', String(health.queues.active)],
        ['Completed', colors.accent(String(health.queues.completed))],
        ['Failed', health.queues.failed > 0 ? colors.error(String(health.queues.failed)) : String(health.queues.failed)],
      ], 12);
    }

    console.log('');
    msg.hint(`Health endpoint: ${colors.link(`http://localhost:${daemonInfo.port}/health`)}`);
    console.log('');

    // Watch mode
    if (options.watch) {
      msg.info('Watching... (Ctrl+C to stop)');
      const interval = setInterval(async () => {
        const h = await fetchDaemonHealth(daemonInfo.port);
        if (h) {
          process.stdout.write(`\r${statusIcon} Uptime: ${formatUptime(h.uptime)} | Memory: ${formatBytes(h.memory.used)} | Queued: ${h.queues.pending} | Active: ${h.queues.active}     `);
        }
      }, 1000);

      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log('\n');
        process.exit(0);
      });
    }
  });

// ============================================================================
// DAEMON LOGS COMMAND
// ============================================================================

const logsCommand = new Command('logs')
  .description('Stream daemon logs')
  .option('-n, --lines <n>', 'Number of lines to show', '50')
  .option('-f, --follow', 'Follow log output (tail -f)')
  .option('--clear', 'Clear the log file')
  .action(async (options) => {
    console.log(ratLogoMini);

    if (options.clear) {
      try {
        await fs.writeFile(DAEMON_LOG_FILE, '');
        msg.success('Log file cleared');
      } catch {
        msg.error('Failed to clear log file');
      }
      return;
    }

    msg.title('Daemon Logs', DAEMON_LOG_FILE);

    try {
      const content = await fs.readFile(DAEMON_LOG_FILE, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const numLines = parseInt(options.lines);
      const displayLines = lines.slice(-numLines);

      console.log(section.divider());
      displayLines.forEach(line => {
        // Color code log lines
        if (line.includes('[ERROR]') || line.includes('error')) {
          console.log(colors.error(line));
        } else if (line.includes('[WARN]') || line.includes('warn')) {
          console.log(colors.warning(line));
        } else if (line.includes('[INFO]')) {
          console.log(colors.textLight(line));
        } else if (line.includes('[DEBUG]')) {
          console.log(colors.muted(line));
        } else {
          console.log(line);
        }
      });
      console.log(section.divider());

      if (options.follow) {
        msg.info('Following logs... (Ctrl+C to stop)\n');

        // Use fs.watch for follow mode
        const watcher = fs.watch(DAEMON_LOG_FILE);
        let lastSize = (await fs.stat(DAEMON_LOG_FILE)).size;

        for await (const event of watcher) {
          if (event.eventType === 'change') {
            const stat = await fs.stat(DAEMON_LOG_FILE);
            if (stat.size > lastSize) {
              const fd = await fs.open(DAEMON_LOG_FILE, 'r');
              const buffer = Buffer.alloc(stat.size - lastSize);
              await fd.read(buffer, 0, buffer.length, lastSize);
              await fd.close();
              process.stdout.write(buffer.toString());
              lastSize = stat.size;
            }
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        msg.warn('No log file found. The daemon may not have been started yet.');
        msg.hint(`Start the daemon: ${colors.primary('hauba daemon start')}`);
      } else {
        msg.error('Failed to read log file');
        if (error instanceof Error) {
          console.log(colors.error(error.message));
        }
      }
    }
  });

// ============================================================================
// DAEMON INSTALL COMMAND (for production)
// ============================================================================

const installCommand = new Command('install')
  .description('Install daemon as a system service')
  .option('--name <name>', 'Service name', 'hauba-daemon')
  .option('--user <user>', 'User to run as', os.userInfo().username)
  .action(async (options) => {
    console.log(ratLogoMini);
    msg.title('Install Daemon Service');

    const platform = os.platform();

    if (platform === 'linux') {
      // Generate systemd service file
      const daemonPath = await findDaemonPath();
      if (!daemonPath) {
        msg.error('Daemon not found. Build it first.');
        process.exit(1);
      }

      const serviceContent = `[Unit]
Description=Hauba Daemon - AI Agent Background Service
After=network.target redis.service

[Service]
Type=simple
User=${options.user}
WorkingDirectory=${process.cwd()}
ExecStart=/usr/bin/node ${daemonPath}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${options.name}
Environment=NODE_ENV=production
Environment=REDIS_URL=redis://localhost:6379
Environment=DAEMON_PORT=18790

[Install]
WantedBy=multi-user.target
`;

      const servicePath = `/etc/systemd/system/${options.name}.service`;

      console.log(box.titled('SYSTEMD SERVICE FILE', [
        '',
        colors.muted(serviceContent),
        '',
      ]));

      msg.info('To install this service, run:');
      console.log('');
      msg.bullet(`${colors.primary(`sudo tee ${servicePath}`)} < <(hauba daemon install --print)`);
      msg.bullet(`${colors.primary('sudo systemctl daemon-reload')}`);
      msg.bullet(`${colors.primary(`sudo systemctl enable ${options.name}`)}`);
      msg.bullet(`${colors.primary(`sudo systemctl start ${options.name}`)}`);
      console.log('');

    } else if (platform === 'win32') {
      msg.info('On Windows, use Windows Services or NSSM:');
      console.log('');
      msg.bullet('Download NSSM: https://nssm.cc/');
      msg.bullet(`${colors.primary('nssm install hauba-daemon')}`);
      console.log('');
    } else if (platform === 'darwin') {
      msg.info('On macOS, use launchd:');
      console.log('');
      msg.bullet('Create a plist file in ~/Library/LaunchAgents/');
      msg.bullet('Use launchctl to load the service');
      console.log('');
    }

    msg.hint('Or use PM2 for cross-platform support:');
    msg.bullet(`${colors.primary('pnpm add -g pm2')}`);
    msg.bullet(`${colors.primary('pm2 start apps/daemon/dist/index.js --name hauba-daemon')}`);
    msg.bullet(`${colors.primary('pm2 save && pm2 startup')}`);
    console.log('');
  });

// ============================================================================
// MAIN DAEMON COMMAND
// ============================================================================

export const daemonCommand = new Command('daemon')
  .description('Manage the Hauba background daemon')
  .addCommand(startCommand)
  .addCommand(stopCommand)
  .addCommand(statusCommand)
  .addCommand(logsCommand)
  .addCommand(installCommand);

export default daemonCommand;
