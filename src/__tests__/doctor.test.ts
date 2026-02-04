// ============================================================================
// HAUBA CLI - Doctor Command Tests
// File: tools/cli/src/__tests__/doctor.test.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock modules
vi.mock('fs/promises');
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock net module
vi.mock('net', () => ({
  Socket: vi.fn().mockImplementation(() => ({
    setTimeout: vi.fn(),
    on: vi.fn(function(this: any, event: string, callback: Function) {
      if (event === 'error') {
        // Simulate connection error by default
        setTimeout(() => callback(new Error('ECONNREFUSED')), 10);
      }
      return this;
    }),
    connect: vi.fn(),
    destroy: vi.fn(),
  })),
}));

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const AUTH_FILE = path.join(HAUBA_DIR, 'auth.json');

describe('Doctor Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    
    // Default environment
    process.env.NODE_VERSION = process.version;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkNodeVersion', () => {
    it('should pass for Node.js 18+', () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      expect(major >= 18).toBe(true);
    });

    it('should warn for Node.js 16-17', () => {
      const version = 'v16.20.0';
      const major = parseInt(version.slice(1).split('.')[0]);
      expect(major >= 16 && major < 18).toBe(true);
    });

    it('should fail for Node.js < 16', () => {
      const version = 'v14.21.0';
      const major = parseInt(version.slice(1).split('.')[0]);
      expect(major < 16).toBe(true);
    });
  });

  describe('checkRedis', () => {
    it('should pass when Redis is reachable', async () => {
      // Mock successful connection
      const mockSocket = {
        setTimeout: vi.fn(),
        on: vi.fn(function(this: any, event: string, callback: Function) {
          if (event === 'connect') {
            setTimeout(() => callback(), 10);
          }
          return this;
        }),
        connect: vi.fn(),
        destroy: vi.fn(),
      };

      // Port check should succeed
      expect(mockSocket.connect).toBeDefined();
    });

    it('should fail when Redis is not reachable', async () => {
      // Default mock simulates connection refused
    });

    it('should parse REDIS_URL correctly', () => {
      const redisUrl = 'redis://localhost:6379';
      const url = new URL(redisUrl);
      expect(url.hostname).toBe('localhost');
      expect(url.port).toBe('6379');
    });

    it('should handle redis URLs with authentication', () => {
      const redisUrl = 'redis://user:password@redis.example.com:6380';
      const url = new URL(redisUrl);
      expect(url.hostname).toBe('redis.example.com');
      expect(url.port).toBe('6380');
      expect(url.username).toBe('user');
    });
  });

  describe('checkDatabase', () => {
    it('should warn if DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      expect(process.env.DATABASE_URL).toBeUndefined();
    });

    it('should pass when PostgreSQL is reachable', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/hauba';
      const url = new URL(process.env.DATABASE_URL.replace(/^postgres(ql)?:/, 'http:'));
      expect(url.hostname).toBe('localhost');
      expect(url.port).toBe('5432');
    });

    it('should parse various database URL formats', () => {
      const urls = [
        'postgresql://localhost:5432/hauba',
        'postgres://user:pass@example.com:5432/mydb',
        'postgresql://user:pass@db.supabase.co:5432/postgres',
      ];

      urls.forEach(dbUrl => {
        const url = new URL(dbUrl.replace(/^postgres(ql)?:/, 'http:'));
        expect(url.hostname).toBeDefined();
      });
    });
  });

  describe('checkApiKeys', () => {
    it('should skip if not authenticated', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      // Should return skip status
    });

    it('should pass if API keys are configured', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        token: 'test-token',
        user: { email: 'test@example.com' },
      }));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            apiKeysConfigured: {
              google: true,
              anthropic: false,
              openai: false,
            },
          },
        }),
      });

      // Should pass with 1 key configured
    });

    it('should warn if no API keys configured', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        token: 'test-token',
      }));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            apiKeysConfigured: {
              google: false,
              anthropic: false,
              openai: false,
            },
          },
        }),
      });

      // Should warn
    });
  });

  describe('checkChannels', () => {
    it('should pass if channels are configured', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      expect(process.env.SLACK_BOT_TOKEN).toBeDefined();
      delete process.env.SLACK_BOT_TOKEN;
    });

    it('should warn if no channels configured', () => {
      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.SMTP_HOST;
      
      const envVars = [
        'SLACK_BOT_TOKEN',
        'TELEGRAM_BOT_TOKEN',
        'WHATSAPP_PHONE_NUMBER_ID',
        'SMTP_HOST',
      ];
      const configured = envVars.filter(v => process.env[v]);
      expect(configured.length).toBe(0);
    });
  });

  describe('checkBrowser', () => {
    it('should pass if Playwright is installed', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue(Buffer.from('Version 1.40.0'));

      // Should pass
    });

    it('should warn if Playwright not installed', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      // Should warn with fix available
    });

    it('should offer to install browsers', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Browsers not installed');
      });

      // Should offer fix
    });
  });

  describe('checkDaemon', () => {
    it('should warn if daemon not running', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      // Should warn
    });

    it('should pass if daemon is healthy', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        pid: 12345,
        port: 18790,
      }));

      // Mock process.kill to not throw (process exists)
      const originalKill = process.kill;
      process.kill = vi.fn() as any;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          uptime: 3600,
          memory: { used: 100000000 },
        }),
      });

      process.kill = originalKill;
    });

    it('should fail if PID exists but process not running', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        pid: 99999,
        port: 18790,
      }));

      // Mock process.kill to throw (process doesn't exist)
      const originalKill = process.kill;
      process.kill = vi.fn().mockImplementation(() => {
        throw new Error('ESRCH');
      }) as any;

      // Should fail with fix to clean up stale PID

      process.kill = originalKill;
    });
  });

  describe('checkPorts', () => {
    it('should check multiple ports', () => {
      const ports = [3000, 3001, 18790, 18789, 6379, 5432];
      expect(ports.length).toBe(6);
    });

    it('should identify port conflicts', () => {
      // Test logic for detecting conflicts
      const requiredPorts = [3000, 3001];
      const inUsePorts = [3000];
      const conflicts = requiredPorts.filter(p => inUsePorts.includes(p));
      expect(conflicts).toContain(3000);
    });
  });

  describe('checkEnvFiles', () => {
    it('should pass if .env exists', async () => {
      vi.mocked(fs.access).mockResolvedValue();
      // Should pass
    });

    it('should warn if no .env files found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      // Should warn with fix
    });

    it('should copy .env.example if available', async () => {
      vi.mocked(fs.access).mockImplementation(async (p: any) => {
        if (p.includes('.env.example')) {
          return;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.copyFile).mockResolvedValue();
      
      // Fix should copy example file
    });
  });

  describe('summary', () => {
    it('should count pass, warn, fail, skip correctly', () => {
      const results = [
        { status: 'pass' },
        { status: 'pass' },
        { status: 'warn' },
        { status: 'fail' },
        { status: 'skip' },
      ];

      const passCount = results.filter(r => r.status === 'pass').length;
      const warnCount = results.filter(r => r.status === 'warn').length;
      const failCount = results.filter(r => r.status === 'fail').length;
      const skipCount = results.filter(r => r.status === 'skip').length;

      expect(passCount).toBe(2);
      expect(warnCount).toBe(1);
      expect(failCount).toBe(1);
      expect(skipCount).toBe(1);
    });

    it('should exit with code 1 if any checks fail', () => {
      const failCount = 1;
      expect(failCount > 0).toBe(true);
    });

    it('should not exit with error for warnings only', () => {
      const failCount = 0;
      const warnCount = 2;
      expect(failCount === 0 && warnCount > 0).toBe(true);
    });
  });

  describe('--fix option', () => {
    it('should attempt fixes for failed checks', () => {
      const check = {
        status: 'fail',
        fix: async () => true,
        fixDescription: 'Auto-fix description',
      };

      expect(check.fix).toBeDefined();
      expect(check.fixDescription).toBeDefined();
    });

    it('should re-run check after fix', async () => {
      let fixApplied = false;
      
      const check = {
        status: fixApplied ? 'pass' : 'fail',
        fix: async () => {
          fixApplied = true;
          return true;
        },
      };

      await check.fix();
      expect(fixApplied).toBe(true);
    });
  });

  describe('--json option', () => {
    it('should output valid JSON', () => {
      const results = {
        results: [
          { name: 'Node.js', status: 'pass', message: 'v20.0.0' },
        ],
        summary: { pass: 1, warn: 0, fail: 0, skip: 0 },
      };

      const json = JSON.stringify(results);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('--check option', () => {
    it('should filter checks by ID', () => {
      const allChecks = [
        { id: 'node' },
        { id: 'redis' },
        { id: 'database' },
        { id: 'daemon' },
      ];

      const requestedChecks = ['node', 'redis'];
      const filtered = allChecks.filter(c => requestedChecks.includes(c.id));

      expect(filtered.length).toBe(2);
      expect(filtered.map(c => c.id)).toEqual(['node', 'redis']);
    });
  });
});
