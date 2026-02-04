// ============================================================================
// HAUBA CLI - Start Command
// File: tools/cli/src/commands/start.ts
// Launch the entire Hauba service and open the browser
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn, exec } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

interface ServiceStatus {
  running: boolean;
  pid?: number;
  port?: number;
  healthy?: boolean;
}

interface StartOptions {
  noBrowser: boolean;
  port: string;
  daemonOnly: boolean;
  gatewayOnly: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const CONFIG_FILE = path.join(HAUBA_DIR, 'config.json');
const DAEMON_PID_FILE = path.join(HAUBA_DIR, 'daemon.pid');
const GATEWAY_PID_FILE = path.join(HAUBA_DIR, 'gateway.pid');
const DEFAULT_GATEWAY_PORT = 18789;
const DEFAULT_DAEMON_PORT = 18790;
const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 500; // 500ms

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if configuration exists
 */
async function checkConfigExists(): Promise<boolean> {
  try {
    await fs.access(CONFIG_FILE);
    return true;
  } catch {
    // Also check for .env file as alternative config
    try {
      await fs.access(path.join(process.cwd(), '.env'));
      return true;
    } catch {
      // Check auth file as indicator of setup
      try {
        await fs.access(path.join(HAUBA_DIR, 'auth.json'));
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Check if a process with given PID is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read PID file and check if process is running
 */
async function readPidFile(pidFile: string): Promise<{ pid: number; running: boolean } | null> {
  try {
    const content = await fs.readFile(pidFile, 'utf-8');
    const data = JSON.parse(content);
    const pid = data.pid || parseInt(content.trim(), 10);
    return {
      pid,
      running: isProcessRunning(pid),
    };
  } catch {
    return null;
  }
}

/**
 * Check daemon health endpoint
 */
async function checkDaemonHealth(port: number = DEFAULT_DAEMON_PORT): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data: any = await response.json();
      return data.status === 'healthy' || data.status === 'ok';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check gateway health endpoint
 */
async function checkGatewayHealth(port: number = DEFAULT_GATEWAY_PORT): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for a service to become healthy
 */
async function waitForHealth(
  checkFn: () => Promise<boolean>,
  serviceName: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await checkFn()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }
  
  return false;
}

/**
 * Find the daemon executable path
 */
async function findDaemonPath(): Promise<string | null> {
  const possiblePaths = [
    path.join(process.cwd(), 'apps', 'daemon', 'dist', 'index.js'),
    path.join(process.cwd(), 'apps', 'daemon', 'src', 'index.ts'),
    path.join(process.cwd(), 'hauba', 'apps', 'daemon', 'dist', 'index.js'),
    path.join(process.cwd(), 'hauba', 'apps', 'daemon', 'src', 'index.ts'),
    path.join(os.homedir(), '.hauba', 'daemon', 'index.js'),
    path.resolve('node_modules', '@hauba', 'daemon', 'dist', 'index.js'),
  ];

  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Find the gateway executable path
 */
async function findGatewayPath(): Promise<string | null> {
  const possiblePaths = [
    path.join(process.cwd(), 'apps', 'gateway', 'dist', 'index.js'),
    path.join(process.cwd(), 'apps', 'gateway', 'src', 'index.ts'),
    path.join(process.cwd(), 'hauba', 'apps', 'gateway', 'dist', 'index.js'),
    path.join(process.cwd(), 'hauba', 'apps', 'gateway', 'src', 'index.ts'),
    path.join(os.homedir(), '.hauba', 'gateway', 'index.js'),
    path.resolve('node_modules', '@hauba', 'gateway', 'dist', 'index.js'),
  ];

  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Start the daemon process
 */
async function startDaemon(port: number = DEFAULT_DAEMON_PORT): Promise<{ success: boolean; pid?: number; error?: string }> {
  const daemonPath = await findDaemonPath();
  
  if (!daemonPath) {
    return { success: false, error: 'Daemon executable not found. Run `pnpm build` in apps/daemon first.' };
  }

  try {
    await fs.mkdir(HAUBA_DIR, { recursive: true });
    
    const logFile = path.join(HAUBA_DIR, 'daemon.log');
    const logFd = await fs.open(logFile, 'a');
    
    const isTs = daemonPath.endsWith('.ts');
    const env = {
      ...process.env,
      DAEMON_PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || 'development',
    };

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

    child.unref();
    await logFd.close();

    // Save PID
    const pidInfo = {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      port,
      version: '1.1.0',
      workDir: process.cwd(),
    };
    await fs.writeFile(DAEMON_PID_FILE, JSON.stringify(pidInfo, null, 2));

    return { success: true, pid: child.pid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Start the gateway process
 */
async function startGateway(port: number = DEFAULT_GATEWAY_PORT): Promise<{ success: boolean; pid?: number; error?: string }> {
  const gatewayPath = await findGatewayPath();
  
  if (!gatewayPath) {
    return { success: false, error: 'Gateway executable not found. Run `pnpm build` in apps/gateway first.' };
  }

  try {
    await fs.mkdir(HAUBA_DIR, { recursive: true });
    
    const logFile = path.join(HAUBA_DIR, 'gateway.log');
    const logFd = await fs.open(logFile, 'a');
    
    const isTs = gatewayPath.endsWith('.ts');
    const env = {
      ...process.env,
      PORT: String(port),
      GATEWAY_PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || 'development',
    };

    const child = spawn(
      isTs ? 'npx' : 'node',
      isTs ? ['tsx', gatewayPath] : [gatewayPath],
      {
        env,
        detached: true,
        stdio: ['ignore', logFd.fd, logFd.fd],
        cwd: process.cwd(),
      }
    );

    child.unref();
    await logFd.close();

    // Save PID
    await fs.writeFile(GATEWAY_PID_FILE, String(child.pid));

    return { success: true, pid: child.pid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Open URL in default browser based on platform
 */
function openBrowser(url: string): void {
  const platform = os.platform();
  
  let command: string;
  let args: string[];

  switch (platform) {
    case 'win32':
      command = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    case 'darwin':
      command = 'open';
      args = [url];
      break;
    default:
      // Linux and others
      command = 'xdg-open';
      args = [url];
      break;
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

/**
 * Format uptime in human readable form
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// ============================================================================
// MAIN START COMMAND
// ============================================================================

export const startCommand = new Command('start')
  .description('Start the Hauba platform and open the browser')
  .option('--no-browser', "Start services but don't open browser")
  .option('-p, --port <port>', 'Override default gateway port', String(DEFAULT_GATEWAY_PORT))
  .option('--daemon-only', 'Only start the background daemon')
  .option('--gateway-only', 'Only start the gateway server')
  .addHelpText('after', `
${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba start
  ${colors.muted('    Start all services and open browser')}

  ${colors.primary('$')} hauba start --no-browser
  ${colors.muted('    Start services without opening browser')}

  ${colors.primary('$')} hauba start --port 8080
  ${colors.muted('    Start gateway on custom port')}

  ${colors.primary('$')} hauba start --daemon-only
  ${colors.muted('    Only start the background daemon')}
`)
  .action(async (options: StartOptions) => {
    console.log(ratLogoMini);
    msg.title('Starting Hauba Platform');

    // ========================================================================
    // Step 1: Check Prerequisites
    // ========================================================================
    
    const configExists = await checkConfigExists();
    
    if (!configExists) {
      console.log(box.warning('NOT CONFIGURED', [
        '',
        'Hauba has not been configured yet.',
        '',
        'Please run the onboarding wizard first:',
        `  ${colors.primary('hauba onboard')}`,
        '',
        'This will help you set up:',
        `  ${colors.muted('•')} Database connection`,
        `  ${colors.muted('•')} Redis connection`,
        `  ${colors.muted('•')} AI provider API keys`,
        `  ${colors.muted('•')} Communication channels`,
        '',
      ]));
      process.exit(1);
    }

    const gatewayPort = parseInt(options.port, 10) || DEFAULT_GATEWAY_PORT;
    const daemonPort = DEFAULT_DAEMON_PORT;

    // Track what we're starting
    const startDaemonService = !options.gatewayOnly;
    const startGatewayService = !options.daemonOnly;

    console.log(section.subheader('CHECKING SERVICES'));

    // ========================================================================
    // Step 2: Check and Start Daemon
    // ========================================================================

    let daemonPid: number | undefined;
    let daemonHealthy = false;

    if (startDaemonService) {
      // Check if daemon is already running
      const daemonPidInfo = await readPidFile(DAEMON_PID_FILE);
      
      if (daemonPidInfo?.running) {
        // Check health
        daemonHealthy = await checkDaemonHealth(daemonPort);
        if (daemonHealthy) {
          msg.success(`Daemon already running (PID: ${daemonPidInfo.pid})`);
          daemonPid = daemonPidInfo.pid;
        } else {
          msg.warn(`Daemon process exists but not healthy (PID: ${daemonPidInfo.pid})`);
        }
      }

      if (!daemonHealthy) {
        const s = spinner.create('Starting daemon...');
        s.start();

        const result = await startDaemon(daemonPort);
        
        if (!result.success) {
          s.fail(`Failed to start daemon: ${result.error}`);
          if (!options.gatewayOnly) {
            msg.hint(`Try running: ${colors.primary('hauba daemon start --foreground')} to see detailed errors`);
          }
        } else {
          daemonPid = result.pid;
          
          // Wait for daemon to be healthy
          const healthy = await waitForHealth(
            () => checkDaemonHealth(daemonPort),
            'daemon',
            15000
          );

          if (healthy) {
            s.succeed(`Daemon started (PID: ${daemonPid})`);
            daemonHealthy = true;
          } else {
            s.warn(`Daemon started but health check pending (PID: ${daemonPid})`);
          }
        }
      }
    }

    // ========================================================================
    // Step 3: Check and Start Gateway
    // ========================================================================

    let gatewayPid: number | undefined;
    let gatewayHealthy = false;

    if (startGatewayService) {
      // Check if gateway is already running
      const gatewayPidInfo = await readPidFile(GATEWAY_PID_FILE);
      
      if (gatewayPidInfo?.running) {
        gatewayHealthy = await checkGatewayHealth(gatewayPort);
        if (gatewayHealthy) {
          msg.success(`Gateway already running (PID: ${gatewayPidInfo.pid})`);
          gatewayPid = gatewayPidInfo.pid;
        } else {
          msg.warn(`Gateway process exists but not responding (PID: ${gatewayPidInfo.pid})`);
        }
      }

      if (!gatewayHealthy) {
        const s = spinner.create('Starting gateway...');
        s.start();

        const result = await startGateway(gatewayPort);
        
        if (!result.success) {
          s.fail(`Failed to start gateway: ${result.error}`);
          if (!options.daemonOnly) {
            msg.hint(`Try running: ${colors.primary('hauba gateway start --foreground')} to see detailed errors`);
          }
        } else {
          gatewayPid = result.pid;
          
          // Wait for gateway to be healthy
          const healthy = await waitForHealth(
            () => checkGatewayHealth(gatewayPort),
            'gateway',
            15000
          );

          if (healthy) {
            s.succeed(`Gateway started (PID: ${gatewayPid})`);
            gatewayHealthy = true;
          } else {
            s.warn(`Gateway started but health check pending (PID: ${gatewayPid})`);
          }
        }
      }
    }

    // ========================================================================
    // Step 4: Display Status
    // ========================================================================

    console.log('');
    
    const statusRows: string[][] = [];
    
    if (startDaemonService) {
      statusRows.push([
        'Daemon',
        daemonHealthy ? colors.accent('Running') : colors.warning('Starting...'),
        daemonPid ? String(daemonPid) : '-',
        String(daemonPort),
      ]);
    }
    
    if (startGatewayService) {
      statusRows.push([
        'Gateway',
        gatewayHealthy ? colors.accent('Running') : colors.warning('Starting...'),
        gatewayPid ? String(gatewayPid) : '-',
        String(gatewayPort),
      ]);
    }

    if (statusRows.length > 0) {
      console.log(section.subheader('SERVICE STATUS'));
      table.rows(['Service', 'Status', 'PID', 'Port'], statusRows);
    }

    // ========================================================================
    // Step 5: Open Browser
    // ========================================================================

    const gatewayUrl = `http://localhost:${gatewayPort}`;

    if (startGatewayService && gatewayHealthy && options.noBrowser !== false) {
      console.log('');
      const s = spinner.create('Opening browser...');
      s.start();
      
      // Small delay to ensure gateway is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      openBrowser(gatewayUrl);
      s.succeed(`Opened ${colors.link(gatewayUrl)} in browser`);
    }

    // ========================================================================
    // Step 6: Display Summary and Next Steps
    // ========================================================================

    console.log('');
    
    const servicesStarted = (startDaemonService && daemonHealthy) || (startGatewayService && gatewayHealthy);
    
    if (servicesStarted) {
      console.log(box.success('HAUBA IS RUNNING', [
        '',
        startGatewayService ? `Gateway:  ${colors.link(gatewayUrl)}` : '',
        startDaemonService ? `Daemon:   ${colors.link(`http://localhost:${daemonPort}/health`)}` : '',
        '',
        `Logs:     ${colors.muted(path.join(HAUBA_DIR, '*.log'))}`,
        '',
      ].filter(Boolean)));

      console.log(section.subheader('USEFUL COMMANDS'));
      msg.bullet(`${colors.primary('hauba daemon status')} - Check daemon health`);
      msg.bullet(`${colors.primary('hauba gateway status')} - Check gateway status`);
      msg.bullet(`${colors.primary('hauba daemon logs -f')} - Stream daemon logs`);
      msg.bullet(`${colors.primary('hauba stop')} - Stop all services`);
      console.log('');

      if (!options.noBrowser && startGatewayService) {
        msg.hint(`Dashboard available at ${colors.link(gatewayUrl)}`);
      }
    } else {
      console.log(box.warning('STARTUP INCOMPLETE', [
        '',
        'Some services may not have started correctly.',
        '',
        'Try these troubleshooting steps:',
        `  ${colors.muted('1.')} Check logs: ${colors.primary('hauba daemon logs')}`,
        `  ${colors.muted('2.')} Run doctor: ${colors.primary('hauba doctor')}`,
        `  ${colors.muted('3.')} Re-run onboard: ${colors.primary('hauba onboard')}`,
        '',
      ]));
    }

    console.log('');
  });

export default startCommand;
