// ============================================================================
// HAUBA CLI - Gateway Command
// File: tools/cli/src/commands/gateway.ts
// Manage the Hauba gateway server
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, table } from '../ui.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

interface GatewayConfig {
  port: number;
  host: string;
  authToken?: string;
  cors: boolean;
  rateLimit: number;
  websocket: boolean;
  ssl?: {
    cert: string;
    key: string;
  };
}

interface GatewayStatus {
  running: boolean;
  pid?: number;
  port?: number;
  uptime?: number;
  connections?: number;
  messagesProcessed?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const GATEWAY_CONFIG = path.join(HAUBA_DIR, 'gateway.json');
const GATEWAY_PID = path.join(HAUBA_DIR, 'gateway.pid');
const DEFAULT_PORT = 18789;

// ============================================================================
// HELPERS
// ============================================================================

async function loadGatewayConfig(): Promise<GatewayConfig> {
  try {
    const content = await fs.readFile(GATEWAY_CONFIG, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      port: DEFAULT_PORT,
      host: '0.0.0.0',
      cors: true,
      rateLimit: 100,
      websocket: true,
    };
  }
}

async function saveGatewayConfig(config: GatewayConfig): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  await fs.writeFile(GATEWAY_CONFIG, JSON.stringify(config, null, 2));
}

async function getGatewayStatus(): Promise<GatewayStatus> {
  try {
    const pidContent = await fs.readFile(GATEWAY_PID, 'utf-8');
    const pid = parseInt(pidContent.trim(), 10);

    // Check if process is running
    try {
      process.kill(pid, 0);
      
      // Try to get stats from gateway API
      const config = await loadGatewayConfig();
      try {
        const response = await fetch(`http://localhost:${config.port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const data: any = await response.json();
          return {
            running: true,
            pid,
            port: config.port,
            uptime: data.uptime,
            connections: data.connections,
            messagesProcessed: data.messagesProcessed,
          };
        }
      } catch {
        // Gateway running but not responding to health check
      }

      return { running: true, pid, port: config.port };
    } catch {
      // Process not running, clean up PID file
      await fs.unlink(GATEWAY_PID).catch(() => {});
      return { running: false };
    }
  } catch {
    return { running: false };
  }
}

function generateAuthToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'hgw_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// COMMAND: hauba gateway
// ============================================================================

export const gatewayCommand = new Command('gateway')
  .description('Manage the Hauba gateway server')
  .addHelpText('after', `
${section.subheader('EXAMPLES')}

  ${colors.primary('$')} hauba gateway start
  ${colors.primary('$')} hauba gateway stop
  ${colors.primary('$')} hauba gateway status
  ${colors.primary('$')} hauba gateway config --port 8080
  ${colors.primary('$')} hauba gateway logs -f
`);

// ============================================================================
// SUBCOMMAND: hauba gateway start
// ============================================================================

gatewayCommand
  .command('start')
  .description('Start the gateway server')
  .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('--foreground', 'Run in foreground (don\'t daemonize)')
  .option('--no-websocket', 'Disable WebSocket support')
  .action(async (options) => {
    console.log(ratLogoMini);
    
    const status = await getGatewayStatus();
    if (status.running) {
      msg.warn(`Gateway already running on port ${status.port} (PID: ${status.pid})`);
      msg.hint(`Stop it with: ${colors.primary('hauba gateway stop')}`);
      return;
    }

    const config = await loadGatewayConfig();
    config.port = parseInt(options.port, 10) || config.port;
    config.websocket = options.websocket !== false;

    // Generate auth token if not exists
    if (!config.authToken) {
      config.authToken = generateAuthToken();
      msg.info(`Generated auth token: ${colors.muted(config.authToken.slice(0, 12) + '...')}`);
    }

    await saveGatewayConfig(config);

    const s = spinner.create('Starting gateway...');
    s.start();

    try {
      if (options.foreground) {
        s.stop();
        console.log(section.header('GATEWAY SERVER'));
        msg.info(`Starting on port ${config.port}...`);
        
        // Run gateway in foreground
        await runGatewayForeground(config);
      } else {
        // Start in background
        const { spawn } = await import('child_process');
        
        const child = spawn(process.execPath, [
          '--experimental-specifier-resolution=node',
          path.join(__dirname, '../gateway/server.js'),
        ], {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            HAUBA_GATEWAY_PORT: String(config.port),
            HAUBA_GATEWAY_AUTH: config.authToken,
          },
        });

        // Save PID
        if (child.pid) {
          await fs.writeFile(GATEWAY_PID, String(child.pid));
          child.unref();

          // Wait for startup
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Verify it started
          const newStatus = await getGatewayStatus();
          if (newStatus.running) {
            s.succeed(`Gateway started on port ${config.port}`);
            
            console.log('\n' + box.simple([
              '',
              `${colors.text('Gateway URL:')} ${colors.link('http://localhost:' + config.port)}`,
              `${colors.text('Auth Token:')}  ${colors.muted(config.authToken?.slice(0, 20) + '...')}`,
              '',
              `${colors.muted('Use this token in the Authorization header:')}`,
              `${colors.dim('Authorization: Bearer ' + config.authToken?.slice(0, 12) + '...')}`,
              '',
            ], 55));
          } else {
            s.fail('Gateway failed to start');
            msg.hint(`Try: ${colors.primary('hauba gateway start --foreground')} to see errors`);
          }
        }
      }
    } catch (error) {
      s.fail('Failed to start gateway');
      if (error instanceof Error) {
        msg.error(error.message);
      }
    }
  });

// Simple foreground gateway for testing
async function runGatewayForeground(config: GatewayConfig): Promise<void> {
  const http = await import('http');
  
  const server = http.createServer((req, res) => {
    // CORS
    if (config.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check
    if (config.authToken) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${config.authToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    // Health endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        connections: 0,
        messagesProcessed: 0,
      }));
      return;
    }

    // Default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Hauba Gateway',
      version: '1.1.0',
      endpoints: ['/health', '/webhook', '/ws'],
    }));
  });

  server.listen(config.port, config.host, () => {
    msg.success(`Gateway listening on ${config.host}:${config.port}`);
    msg.hint('Press Ctrl+C to stop');
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    msg.info('Shutting down...');
    server.close();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

// ============================================================================
// SUBCOMMAND: hauba gateway stop
// ============================================================================

gatewayCommand
  .command('stop')
  .description('Stop the gateway server')
  .action(async () => {
    console.log(ratLogoMini);

    const status = await getGatewayStatus();
    if (!status.running) {
      msg.info('Gateway is not running');
      return;
    }

    const s = spinner.create('Stopping gateway...');
    s.start();

    try {
      process.kill(status.pid!, 'SIGTERM');
      await fs.unlink(GATEWAY_PID).catch(() => {});
      
      // Wait for shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      s.succeed('Gateway stopped');
    } catch (error) {
      s.fail('Failed to stop gateway');
      if (error instanceof Error) {
        msg.error(error.message);
      }
    }
  });

// ============================================================================
// SUBCOMMAND: hauba gateway status
// ============================================================================

gatewayCommand
  .command('status')
  .description('Check gateway status')
  .action(async () => {
    console.log(ratLogoMini);
    console.log(section.header('GATEWAY STATUS'));

    const s = spinner.create('Checking gateway...');
    s.start();

    const status = await getGatewayStatus();
    s.stop();

    if (!status.running) {
      console.log(box.simple([
        '',
        `${colors.error('●')} Gateway is ${colors.error('stopped')}`,
        '',
        `Start with: ${colors.primary('hauba gateway start')}`,
        '',
      ], 45));
      return;
    }

    const config = await loadGatewayConfig();

    console.log(box.success('GATEWAY RUNNING', [
      '',
      `${colors.muted('PID:')}          ${colors.text(String(status.pid))}`,
      `${colors.muted('Port:')}         ${colors.text(String(status.port))}`,
      `${colors.muted('Uptime:')}       ${colors.text(status.uptime ? formatUptime(status.uptime) : 'N/A')}`,
      `${colors.muted('Connections:')}  ${colors.text(String(status.connections ?? 0))}`,
      `${colors.muted('Messages:')}     ${colors.text(String(status.messagesProcessed ?? 0))}`,
      '',
      `${colors.muted('URL:')} ${colors.link('http://localhost:' + status.port)}`,
      '',
    ]));
  });

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

// ============================================================================
// SUBCOMMAND: hauba gateway config
// ============================================================================

gatewayCommand
  .command('config')
  .description('Configure gateway settings')
  .option('-p, --port <port>', 'Set port number')
  .option('--host <host>', 'Set host address')
  .option('--cors', 'Enable CORS')
  .option('--no-cors', 'Disable CORS')
  .option('--rate-limit <limit>', 'Set rate limit (requests/minute)')
  .option('--regenerate-token', 'Generate new auth token')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    console.log(ratLogoMini);

    const config = await loadGatewayConfig();

    if (options.show) {
      console.log(section.header('GATEWAY CONFIGURATION'));
      table.keyValue([
        ['Port', String(config.port)],
        ['Host', config.host],
        ['CORS', config.cors ? 'Enabled' : 'Disabled'],
        ['Rate Limit', `${config.rateLimit}/min`],
        ['WebSocket', config.websocket ? 'Enabled' : 'Disabled'],
        ['Auth Token', config.authToken ? config.authToken.slice(0, 16) + '...' : 'Not set'],
      ], 15);
      console.log('');
      return;
    }

    let changed = false;

    if (options.port) {
      config.port = parseInt(options.port, 10);
      changed = true;
    }

    if (options.host) {
      config.host = options.host;
      changed = true;
    }

    if (options.cors !== undefined) {
      config.cors = options.cors;
      changed = true;
    }

    if (options.rateLimit) {
      config.rateLimit = parseInt(options.rateLimit, 10);
      changed = true;
    }

    if (options.regenerateToken) {
      config.authToken = generateAuthToken();
      msg.success(`New auth token: ${colors.muted(config.authToken)}`);
      changed = true;
    }

    if (changed) {
      await saveGatewayConfig(config);
      msg.success('Configuration updated');
      msg.hint(`Restart gateway to apply: ${colors.primary('hauba gateway stop && hauba gateway start')}`);
    } else {
      msg.info('No changes made. Use --show to view current config.');
    }
  });

// ============================================================================
// SUBCOMMAND: hauba gateway logs
// ============================================================================

gatewayCommand
  .command('logs')
  .description('View gateway logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <n>', 'Number of lines to show', '50')
  .action(async (options) => {
    console.log(ratLogoMini);

    const logFile = path.join(HAUBA_DIR, 'gateway.log');

    try {
      await fs.access(logFile);
    } catch {
      msg.info('No logs found');
      return;
    }

    if (options.follow) {
      msg.info('Following logs... (Ctrl+C to exit)');
      const { spawn } = await import('child_process');
      
      // Cross-platform tail
      const isWindows = process.platform === 'win32';
      const child = isWindows
        ? spawn('powershell', ['-Command', `Get-Content -Path "${logFile}" -Wait -Tail ${options.lines}`], { stdio: 'inherit' })
        : spawn('tail', ['-f', '-n', options.lines, logFile], { stdio: 'inherit' });

      process.on('SIGINT', () => {
        child.kill();
        process.exit(0);
      });
    } else {
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.split('\n').slice(-parseInt(options.lines, 10));
      console.log(lines.join('\n'));
    }
  });

export default gatewayCommand;
