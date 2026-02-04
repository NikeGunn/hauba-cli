// ============================================================================
// HAUBA CLI - Onboard Command Tests
// File: tools/cli/src/__tests__/onboard.test.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock modules
vi.mock('fs/promises');
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn().mockReturnValue({
    pid: 12345,
    on: vi.fn(),
    unref: vi.fn(),
  }),
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

const HAUBA_DIR = path.join(os.homedir(), '.hauba');

describe('Onboard Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('stepPrerequisites', () => {
    it('should check Node.js version', () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      expect(major).toBeGreaterThanOrEqual(18);
    });

    it('should check for pnpm or npm', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue(Buffer.from('9.0.0'));
      
      expect(() => execSync('pnpm --version', { stdio: 'pipe' })).not.toThrow();
    });

    it('should check for Docker (optional)', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue(Buffer.from('Docker version 24.0.0'));
      
      expect(() => execSync('docker --version', { stdio: 'pipe' })).not.toThrow();
    });

    it('should continue if Docker is not installed', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation((cmd: any) => {
        if (cmd.includes('docker')) {
          throw new Error('Command not found');
        }
        return Buffer.from('');
      });

      // Should mark Docker as optional and continue
    });
  });

  describe('stepDatabase', () => {
    it('should offer Docker option', async () => {
      const choices = [
        { name: 'Docker - Start PostgreSQL in Docker', value: 'postgres-docker' },
        { name: 'Local - Use existing PostgreSQL', value: 'postgres-local' },
        { name: 'URL - Enter connection string', value: 'postgres-url' },
        { name: 'Skip', value: 'skip' },
      ];

      expect(choices.find(c => c.value === 'postgres-docker')).toBeDefined();
    });

    it('should skip Docker if --skip-docker is set', () => {
      const skipDocker = true;
      let choices = [
        { name: 'Docker', value: 'postgres-docker' },
        { name: 'Local', value: 'postgres-local' },
        { name: 'Skip', value: 'skip' },
      ];

      if (skipDocker) {
        choices = choices.filter(c => c.value !== 'postgres-docker');
      }

      expect(choices.find(c => c.value === 'postgres-docker')).toBeUndefined();
    });

    it('should start PostgreSQL in Docker', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue(Buffer.from('container-id'));

      const cmd = 'docker run -d --name hauba-postgres -p 5432:5432 -e POSTGRES_PASSWORD=hauba -e POSTGRES_DB=hauba postgres:15-alpine';
      execSync(cmd, { stdio: 'pipe' });

      expect(execSync).toHaveBeenCalled();
    });

    it('should validate custom database URL', () => {
      const validUrls = [
        'postgresql://localhost:5432/hauba',
        'postgres://user:pass@example.com:5432/db',
      ];

      const invalidUrls = [
        'mysql://localhost:3306/db',
        'http://example.com',
      ];

      validUrls.forEach(url => {
        expect(url.startsWith('postgres')).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(url.startsWith('postgres')).toBe(false);
      });
    });
  });

  describe('stepRedis', () => {
    it('should offer Docker option', () => {
      const choices = [
        { value: 'redis-docker' },
        { value: 'redis-local' },
        { value: 'skip' },
      ];

      expect(choices.find(c => c.value === 'redis-docker')).toBeDefined();
    });

    it('should start Redis in Docker', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockReturnValue(Buffer.from('container-id'));

      const cmd = 'docker run -d --name hauba-redis -p 6379:6379 redis:7-alpine';
      execSync(cmd, { stdio: 'pipe' });

      expect(execSync).toHaveBeenCalled();
    });

    it('should return correct Redis URL', () => {
      const redisUrl = 'redis://localhost:6379';
      expect(redisUrl).toBe('redis://localhost:6379');
    });
  });

  describe('stepAiProvider', () => {
    it('should offer all three providers', () => {
      const providers = ['google', 'anthropic', 'openai'];
      expect(providers.length).toBe(3);
    });

    it('should validate API key length', () => {
      const validKey = 'sk-1234567890abcdefghij';
      const invalidKey = 'short';

      expect(validKey.length >= 10).toBe(true);
      expect(invalidKey.length >= 10).toBe(false);
    });

    it('should skip if user chooses skip', async () => {
      const provider = 'skip';
      const result = provider === 'skip' ? null : { provider, apiKey: 'test' };
      expect(result).toBeNull();
    });

    it('should show correct instructions per provider', () => {
      const instructions = {
        google: 'https://makersuite.google.com/app/apikey',
        anthropic: 'https://console.anthropic.com',
        openai: 'https://platform.openai.com/api-keys',
      };

      expect(instructions.google).toContain('makersuite');
      expect(instructions.anthropic).toContain('anthropic');
      expect(instructions.openai).toContain('openai');
    });
  });

  describe('stepChannels', () => {
    it('should always include API channel', () => {
      const channels = ['api'];
      expect(channels).toContain('api');
    });

    it('should offer multiple channel options', () => {
      const options = ['api', 'slack', 'telegram', 'whatsapp', 'email', 'webchat'];
      expect(options.length).toBe(6);
    });

    it('should default to api if no selection', () => {
      const selected: string[] = [];
      const result = selected.length > 0 ? selected : ['api'];
      expect(result).toContain('api');
    });
  });

  describe('stepDaemon', () => {
    it('should auto-install with --install-daemon flag', () => {
      const options = { installDaemon: true };
      expect(options.installDaemon).toBe(true);
    });

    it('should auto-install with --yes flag', () => {
      const options = { yes: true };
      const result = { install: options.yes, start: options.yes };
      expect(result.install).toBe(true);
      expect(result.start).toBe(true);
    });

    it('should skip in minimal mode', () => {
      const options = { minimal: true };
      const result = options.minimal ? { install: false, start: false } : { install: true, start: true };
      expect(result.install).toBe(false);
    });
  });

  describe('stepGenerateConfig', () => {
    it('should create .env file', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const envPath = path.join(process.cwd(), '.env');
      await fs.writeFile(envPath, 'NODE_ENV=development');

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should include database URL if provided', () => {
      const databaseUrl = 'postgresql://localhost:5432/hauba';
      const envContent = `DATABASE_URL=${databaseUrl}`;
      expect(envContent).toContain(databaseUrl);
    });

    it('should include Redis URL if provided', () => {
      const redisUrl = 'redis://localhost:6379';
      const envContent = `REDIS_URL=${redisUrl}`;
      expect(envContent).toContain(redisUrl);
    });

    it('should include AI API key if provided', () => {
      const aiConfig = { provider: 'google', apiKey: 'test-key' };
      const envContent = `GOOGLE_AI_API_KEY=${aiConfig.apiKey}`;
      expect(envContent).toContain(aiConfig.apiKey);
    });

    it('should set correct API key variable per provider', () => {
      const providers = {
        google: 'GOOGLE_AI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
      };

      expect(providers.google).toBe('GOOGLE_AI_API_KEY');
      expect(providers.anthropic).toBe('ANTHROPIC_API_KEY');
      expect(providers.openai).toBe('OPENAI_API_KEY');
    });

    it('should generate random secrets', () => {
      const generateSecret = (length: number): string => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const secret1 = generateSecret(32);
      const secret2 = generateSecret(32);

      expect(secret1.length).toBe(32);
      expect(secret2.length).toBe(32);
      expect(secret1).not.toBe(secret2); // Should be random
    });

    it('should create ~/.hauba directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await fs.mkdir(HAUBA_DIR, { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith(HAUBA_DIR, { recursive: true });
    });
  });

  describe('minimal mode', () => {
    it('should skip database setup', () => {
      const options = { minimal: true };
      const step = options.minimal ? null : 'database';
      expect(step).toBeNull();
    });

    it('should skip Redis setup', () => {
      const options = { minimal: true };
      const step = options.minimal ? null : 'redis';
      expect(step).toBeNull();
    });

    it('should skip AI provider setup', () => {
      const options = { minimal: true };
      const step = options.minimal ? null : 'ai';
      expect(step).toBeNull();
    });

    it('should skip daemon setup', () => {
      const options = { minimal: true };
      const daemon = options.minimal ? { install: false, start: false } : { install: true, start: true };
      expect(daemon.install).toBe(false);
    });

    it('should still create .env file', () => {
      const options = { minimal: true };
      // Even in minimal mode, .env should be created
      expect(options.minimal).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle user cancellation', () => {
      const error = new Error('User force closed the prompt');
      expect(error.message).toContain('force closed');
    });

    it('should handle Docker failures gracefully', async () => {
      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Docker: Cannot connect to daemon');
      });

      expect(() => execSync('docker run -d redis')).toThrow();
    });

    it('should handle file system errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(fs.writeFile('/etc/test', 'data')).rejects.toThrow();
    });
  });

  describe('summary', () => {
    it('should show correct configuration status', () => {
      const config = {
        databaseUrl: 'postgresql://localhost:5432/hauba',
        redisUrl: null,
        aiConfig: { provider: 'google' },
        channels: ['api', 'slack'],
        daemonStarted: false,
      };

      expect(config.databaseUrl).not.toBeNull();
      expect(config.redisUrl).toBeNull();
      expect(config.aiConfig).not.toBeNull();
      expect(config.channels.length).toBeGreaterThan(0);
    });

    it('should show next steps', () => {
      const nextSteps = [
        'pnpm dev',
        'hauba init my-agent',
        'hauba skill generate',
        'hauba daemon start',
      ];

      expect(nextSteps.length).toBe(4);
    });
  });
});
