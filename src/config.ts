// ============================================================================
// HAUBA CLI - Global Configuration
// File: tools/cli/src/config.ts
// Centralized configuration for production vs development
// ============================================================================

export interface HaubaConfig {
  api: {
    url: string;
    timeout: number;
  };
  gateway: {
    url: string;
    wsUrl: string;
    timeout: number;
  };
  daemon: {
    url: string;
  };
  environment: 'production' | 'development' | 'local';
}

/**
 * Production configuration - Points to hosted Railway services
 */
export const productionConfig: HaubaConfig = {
  api: {
    url: 'https://api.hauba.tech',
    timeout: 30000,
  },
  gateway: {
    url: 'https://ws.hauba.tech',
    wsUrl: 'wss://ws.hauba.tech/ws',
    timeout: 30000,
  },
  daemon: {
    url: 'https://hauba-daemon-production.up.railway.app',
  },
  environment: 'production',
};

/**
 * Local development configuration - For contributors running locally
 */
export const developmentConfig: HaubaConfig = {
  api: {
    url: 'http://localhost:3001',
    timeout: 10000,
  },
  gateway: {
    url: 'http://localhost:18789',
    wsUrl: 'ws://localhost:18789/ws',
    timeout: 10000,
  },
  daemon: {
    url: 'http://localhost:18790',
  },
  environment: 'development',
};

/**
 * Get the active configuration based on environment
 * Users get PRODUCTION by default (connects to hosted services)
 * Developers can set HAUBA_ENV=local to test locally
 */
export function getConfig(): HaubaConfig {
  const env = process.env.HAUBA_ENV || process.env.NODE_ENV;
  
  // Only use local if explicitly set
  const useLocal = 
    env === 'local' || 
    env === 'development' || 
    process.env.HAUBA_USE_LOCAL === 'true';

  // Allow individual overrides
  const config = useLocal ? { ...developmentConfig } : { ...productionConfig };

  // Override with environment variables if present
  if (process.env.HAUBA_API_URL) {
    config.api.url = process.env.HAUBA_API_URL;
  }
  if (process.env.HAUBA_GATEWAY_URL) {
    config.gateway.url = process.env.HAUBA_GATEWAY_URL;
  }
  if (process.env.HAUBA_GATEWAY_WS_URL) {
    config.gateway.wsUrl = process.env.HAUBA_GATEWAY_WS_URL;
  }
  if (process.env.HAUBA_DAEMON_URL) {
    config.daemon.url = process.env.HAUBA_DAEMON_URL;
  }

  return config;
}

/**
 * Check if running in local development mode
 */
export function isLocalMode(): boolean {
  return getConfig().environment === 'development';
}

/**
 * Check if running in production mode
 */
export function isProductionMode(): boolean {
  return getConfig().environment === 'production';
}

/**
 * Get display string for current mode
 */
export function getEnvironmentDisplay(): string {
  const config = getConfig();
  if (config.environment === 'production') {
    return '🌐 Connected to Hauba Cloud';
  }
  return '🔧 Local Development Mode';
}
