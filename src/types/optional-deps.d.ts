// ============================================================================
// Type declarations for optional dependencies
// ============================================================================

declare module 'qrcode-terminal' {
  export function generate(text: string, options?: { small?: boolean }): void;
  const qrcode: { generate: typeof generate };
  export default qrcode;
}

declare module '@whiskeysockets/baileys' {
  export interface ConnectionState {
    connection: 'open' | 'close' | 'connecting';
    lastDisconnect?: {
      error?: {
        output?: {
          statusCode?: number;
        };
      };
    };
    qr?: string;
  }
  
  export interface WASocket {
    ev: {
      on(event: 'connection.update', listener: (update: ConnectionState) => void): void;
      on(event: 'creds.update', listener: () => void): void;
    };
    end(reason: any): void;
  }
  
  export interface AuthenticationState {
    state: any;
    saveCreds: () => Promise<void>;
  }
  
  export function useMultiFileAuthState(folder: string): Promise<AuthenticationState>;
  export function makeWASocket(config: any): WASocket;
  export default makeWASocket;
  
  export const DisconnectReason: {
    loggedOut: number;
    restartRequired: number;
  };
}
