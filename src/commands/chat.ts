// ============================================================================
// HAUBA CLI - Chat Command
// File: tools/cli/src/commands/chat.ts
// Terminal-based interactive chat with AI agents
// ============================================================================

import { Command } from 'commander';
import { colors, ratLogoMini, msg, section, box, spinner, symbols } from '../ui.js';
import { getConfig, getEnvironmentDisplay } from '../config.js';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

// ============================================================================
// TYPES
// ============================================================================

interface ChatOptions {
  message?: string;
  agent?: string;
  persona?: string;
  stream: boolean;
  json: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCall?: ToolCall;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

interface WSMessage {
  type: 'message' | 'chunk' | 'tool_start' | 'tool_end' | 'error' | 'complete' | 'thinking' | 'welcome';
  content?: string;
  tool?: ToolCall;
  error?: string;
  message?: string; // Error message from gateway
  code?: string; // Error code from gateway
  messageId?: string;
}

interface AuthConfig {
  token: string;
  user?: {
    email?: string;
    name?: string;
  };
}

// WebSocket type for optional ws module
type WebSocketInstance = {
  onopen: (() => void) | null;
  onerror: ((error: Error) => void) | null;
  onclose: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  send: (data: string) => void;
  close: () => void;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const HAUBA_DIR = path.join(os.homedir(), '.hauba');
const CHAT_HISTORY_FILE = path.join(HAUBA_DIR, 'chat-history.json');
const AUTH_FILE = path.join(HAUBA_DIR, 'auth.json');
const MAX_HISTORY_MESSAGES = 100;

// Get gateway URLs from config
const config = getConfig();
const GATEWAY_WS_URL = config.gateway.wsUrl;
const GATEWAY_HTTP_URL = config.gateway.url;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load authentication token
 */
async function loadAuth(): Promise<AuthConfig | null> {
  try {
    const content = await fs.readFile(AUTH_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get the gateway WebSocket URL
 */
function getWebSocketUrl(): string {
  return GATEWAY_WS_URL;
}

/**
 * Check if gateway is running
 */
async function checkGatewayHealth(): Promise<boolean> {
  try {
    const healthUrl = `${GATEWAY_HTTP_URL}/health`;
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load chat history from file
 */
async function loadChatHistory(): Promise<ChatMessage[]> {
  try {
    const content = await fs.readFile(CHAT_HISTORY_FILE, 'utf-8');
    const messages = JSON.parse(content);
    return messages.map((m: ChatMessage) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

/**
 * Save chat history to file
 */
async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  await fs.mkdir(HAUBA_DIR, { recursive: true });
  // Keep only last N messages
  const toSave = messages.slice(-MAX_HISTORY_MESSAGES);
  await fs.writeFile(CHAT_HISTORY_FILE, JSON.stringify(toSave, null, 2));
}

/**
 * Clear chat history
 */
async function clearChatHistory(): Promise<void> {
  try {
    await fs.unlink(CHAT_HISTORY_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Display a user message
 */
function displayUserMessage(content: string): void {
  const time = formatTime(new Date());
  console.log(`\n${colors.dim(time)} ${colors.secondary('You')} ${symbols.arrow}`);
  console.log(colors.text(content));
}

/**
 * Display an assistant message
 */
function displayAssistantMessage(content: string, streaming: boolean = false): void {
  if (!streaming) {
    const time = formatTime(new Date());
    console.log(`\n${colors.dim(time)} ${colors.primary('Hauba')} ${symbols.arrow}`);
  }
  console.log(colors.textLight(content));
}

/**
 * Display a tool call box
 */
function displayToolCall(tool: ToolCall): void {
  const args = JSON.stringify(tool.arguments, null, 2)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
  
  console.log(box.cyber(`Tool: ${tool.name}`, [
    '',
    colors.muted('Arguments:'),
    colors.dim(args),
    '',
    ...(tool.result ? [colors.muted('Result:'), colors.textLight(tool.result.slice(0, 200) + (tool.result.length > 200 ? '...' : '')), ''] : []),
  ]));
}

/**
 * Display thinking indicator
 */
function createThinkingIndicator(): { update: (text?: string) => void; stop: () => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  let text = 'Thinking...';
  let intervalId: ReturnType<typeof setInterval>;

  const render = () => {
    process.stdout.write(`\r${colors.secondary(frames[frameIndex])} ${colors.muted(text)}   `);
    frameIndex = (frameIndex + 1) % frames.length;
  };

  intervalId = setInterval(render, 80);
  render();

  return {
    update: (newText?: string) => {
      if (newText) text = newText;
    },
    stop: () => {
      clearInterval(intervalId);
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
    },
  };
}

/**
 * Display help for chat commands
 */
function displayChatHelp(): void {
  console.log(section.subheader('CHAT COMMANDS'));
  msg.bullet(`${colors.primary('/new')}     - Start a new conversation`);
  msg.bullet(`${colors.primary('/clear')}   - Clear screen`);
  msg.bullet(`${colors.primary('/history')} - Show conversation history`);
  msg.bullet(`${colors.primary('/persona <name>')} - Switch to a different persona`);
  msg.bullet(`${colors.primary('/agent <name>')}   - Switch to a different agent`);
  msg.bullet(`${colors.primary('/help')}    - Show this help`);
  msg.bullet(`${colors.primary('/exit')}    - Exit chat`);
  console.log('');
}

/**
 * Stream response character by character
 */
async function streamText(text: string, delay: number = 10): Promise<void> {
  for (const char of text) {
    process.stdout.write(colors.textLight(char));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ============================================================================
// WEBSOCKET CHAT CLIENT
// ============================================================================

class ChatClient {
  private ws: WebSocketInstance | null = null;
  private messageHistory: ChatMessage[] = [];
  private currentAgent: string | undefined;
  private currentPersona: string | undefined;
  private onMessage: ((msg: WSMessage) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private authToken: string | null = null;

  constructor(
    private wsUrl: string,
    private options: { agent?: string; persona?: string; stream: boolean },
    authToken?: string | null
  ) {
    this.currentAgent = options.agent;
    this.currentPersona = options.persona;
    this.authToken = authToken || null;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Dynamic import for WebSocket (optional dependency)
        // @ts-ignore - ws is an optional dependency
        import('ws').then((wsModule: { default: new (url: string) => WebSocketInstance }) => {
          const WebSocketClass = wsModule.default;
          this.ws = new WebSocketClass(this.wsUrl);

          this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            resolve();
          };

          this.ws.onerror = (error: Error) => {
            reject(error);
          };

          this.ws.onclose = () => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              setTimeout(() => {
                this.connect().catch(() => {});
              }, 1000 * this.reconnectAttempts);
            }
          };

          this.ws.onmessage = (event: { data: string }) => {
            try {
              const message = JSON.parse(event.data) as WSMessage;
              if (this.onMessage) {
                this.onMessage(message);
              }
            } catch {
              // Invalid JSON, ignore
            }
          };
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(content: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('Not connected'));
        return;
      }

      let fullResponse = '';
      let thinking = createThinkingIndicator();
      let hasStartedResponse = false;

      this.onMessage = (msg: WSMessage) => {
        switch (msg.type) {
          case 'thinking':
            thinking.update(msg.content || 'Thinking...');
            break;

          case 'chunk':
            if (!hasStartedResponse) {
              thinking.stop();
              const time = formatTime(new Date());
              console.log(`\n${colors.dim(time)} ${colors.primary('Hauba')} ${symbols.arrow}`);
              hasStartedResponse = true;
            }
            if (msg.content) {
              process.stdout.write(colors.textLight(msg.content));
              fullResponse += msg.content;
            }
            break;

          case 'message':
            thinking.stop();
            if (!hasStartedResponse && msg.content) {
              displayAssistantMessage(msg.content);
              fullResponse = msg.content;
            }
            break;

          case 'tool_start':
            thinking.stop();
            if (msg.tool) {
              console.log('');
              console.log(box.simple([
                `${colors.primary(symbols.arrow)} Calling tool: ${colors.accent(msg.tool.name)}`,
              ], 50));
            }
            thinking = createThinkingIndicator();
            thinking.update('Executing...');
            break;

          case 'tool_end':
            thinking.stop();
            if (msg.tool) {
              displayToolCall(msg.tool);
            }
            thinking = createThinkingIndicator();
            break;

          case 'complete':
            thinking.stop();
            console.log('');
            this.onMessage = null;
            resolve(fullResponse || msg.content || '');
            break;

          case 'error':
            thinking.stop();
            console.log('');
            this.onMessage = null;
            const errorMsg = msg.message || msg.error || 'Unknown error';
            
            if (msg.code === 'AUTHENTICATION_REQUIRED') {
              console.log(box.warning('AUTHENTICATION REQUIRED', [
                '',
                'Please login to use chat functionality:',
                '',
                `  ${colors.primary('hauba login')}`,
                '',
                'Or use the web dashboard:',
                `  ${colors.accent('https://app.hauba.tech')}`,
                ''
              ]));
            }
            
            reject(new Error(errorMsg));
            break;
        }
      };

      // Add to message history
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date(),
      };
      this.messageHistory.push(userMessage);

      // Send message
      const payload = {
        type: 'message',
        content,
        agent: this.currentAgent,
        persona: this.currentPersona,
        stream: this.options.stream,
        history: this.messageHistory.slice(-10), // Send last 10 messages for context
        ...(this.authToken && { token: this.authToken }),
      };

      this.ws.send(JSON.stringify(payload));
    });
  }

  setAgent(agent: string): void {
    this.currentAgent = agent;
    msg.success(`Switched to agent: ${colors.accent(agent)}`);
  }

  setPersona(persona: string): void {
    this.currentPersona = persona;
    msg.success(`Switched to persona: ${colors.accent(persona)}`);
  }

  getHistory(): ChatMessage[] {
    return this.messageHistory;
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// ============================================================================
// MOCK CHAT (when gateway not available)
// ============================================================================

async function mockChat(content: string, options: ChatOptions): Promise<string> {
  // This is a fallback when WebSocket isn't available
  // It makes an HTTP request instead
  const gatewayUrl = GATEWAY_HTTP_URL;
  
  try {
    const response = await fetch(`${gatewayUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        agent: options.agent,
        persona: options.persona,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: any = await response.json();
    return data.response || data.content || data.message || 'No response';
  } catch {
    // Return demo response
    return `I received your message: "${content}"\n\nNote: The gateway is not fully connected. This is a demo response.\n\nTo get real AI responses, ensure:\n1. Gateway is running: hauba gateway start\n2. API keys are configured: hauba config set-key`;
  }
}

// ============================================================================
// INTERACTIVE CHAT MODE
// ============================================================================

async function runInteractiveChat(options: ChatOptions): Promise<void> {
  console.log(ratLogoMini);
  console.log(section.header('HAUBA CHAT'));

  // Check gateway status
  const gatewayHealthy = await checkGatewayHealth();
  
  if (!gatewayHealthy) {
    console.log(box.warning('GATEWAY NOT RUNNING', [
      '',
      'The Hauba gateway is not running.',
      '',
      `Start it with: ${colors.primary('hauba start')}`,
      '',
      colors.muted('Chat will work in reduced mode.'),
      '',
    ]));
  }

  let client: ChatClient | null = null;
  let useWebSocket = gatewayHealthy;

  if (gatewayHealthy) {
    try {
      const wsUrl = getWebSocketUrl();
      const auth = await loadAuth();
      client = new ChatClient(wsUrl, {
        agent: options.agent,
        persona: options.persona,
        stream: options.stream,
      }, auth?.token);
      
      const s = spinner.create('Connecting to gateway...');
      s.start();
      
      await client.connect();
      s.succeed('Connected to Hauba gateway');
    } catch (error) {
      msg.warn('WebSocket connection failed, using HTTP fallback');
      useWebSocket = false;
    }
  }

  // Load history
  const history = await loadChatHistory();
  if (history.length > 0) {
    msg.muted(`Loaded ${history.length} messages from history`);
  }

  // Display commands
  displayChatHelp();

  // Set up prompt
  const { default: inquirer } = await import('inquirer');

  // Main chat loop
  let running = true;
  
  while (running) {
    try {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: colors.secondary('You') + colors.dim(':'),
          prefix: '',
        },
      ]);

      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        continue;
      }

      // Handle chat commands
      if (trimmedInput.startsWith('/')) {
        const [command, ...args] = trimmedInput.slice(1).split(' ');
        
        switch (command.toLowerCase()) {
          case 'exit':
          case 'quit':
          case 'q':
            running = false;
            msg.info('Goodbye!');
            break;

          case 'new':
            if (client) {
              client.clearHistory();
            }
            await clearChatHistory();
            console.clear();
            console.log(ratLogoMini);
            msg.success('Started new conversation');
            break;

          case 'clear':
            console.clear();
            console.log(ratLogoMini);
            break;

          case 'history':
            const chatHistory = client?.getHistory() || history;
            if (chatHistory.length === 0) {
              msg.info('No messages in history');
            } else {
              console.log(section.subheader('CONVERSATION HISTORY'));
              chatHistory.slice(-10).forEach(m => {
                const time = formatTime(m.timestamp);
                const role = m.role === 'user' ? colors.secondary('You') : colors.primary('Hauba');
                console.log(`${colors.dim(time)} ${role}: ${colors.muted(m.content.slice(0, 60))}${m.content.length > 60 ? '...' : ''}`);
              });
              console.log('');
            }
            break;

          case 'persona':
            const personaName = args.join(' ').trim();
            if (!personaName) {
              msg.warn('Usage: /persona <name>');
            } else if (client) {
              client.setPersona(personaName);
            } else {
              options.persona = personaName;
              msg.success(`Persona set to: ${colors.accent(personaName)}`);
            }
            break;

          case 'agent':
            const agentName = args.join(' ').trim();
            if (!agentName) {
              msg.warn('Usage: /agent <name>');
            } else if (client) {
              client.setAgent(agentName);
            } else {
              options.agent = agentName;
              msg.success(`Agent set to: ${colors.accent(agentName)}`);
            }
            break;

          case 'help':
          case 'h':
          case '?':
            displayChatHelp();
            break;

          default:
            msg.warn(`Unknown command: /${command}`);
            msg.hint('Type /help for available commands');
        }
        
        continue;
      }

      // Send message
      displayUserMessage(trimmedInput);
      
      try {
        let response: string;
        
        if (useWebSocket && client) {
          response = await client.send(trimmedInput);
        } else {
          const thinking = createThinkingIndicator();
          response = await mockChat(trimmedInput, options);
          thinking.stop();
          displayAssistantMessage(response);
        }

        // Save to history
        history.push(
          { role: 'user', content: trimmedInput, timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date() }
        );
        await saveChatHistory(history);

      } catch (error) {
        if (error instanceof Error) {
          msg.error(`Error: ${error.message}`);
        }
      }

    } catch (error) {
      // Handle Ctrl+C or other interrupts gracefully
      if ((error as any)?.name === 'ExitPromptError') {
        running = false;
        console.log('');
        msg.info('Goodbye!');
      }
    }
  }

  // Cleanup
  if (client) {
    client.close();
  }
}

// ============================================================================
// SINGLE MESSAGE MODE
// ============================================================================

async function runSingleMessage(message: string, options: ChatOptions): Promise<void> {
  // Check gateway
  const gatewayHealthy = await checkGatewayHealth();
  
  if (!gatewayHealthy) {
    if (!options.json) {
      msg.warn('Gateway not running. Starting with reduced functionality...');
    }
  }

  if (options.json) {
    // JSON output mode
    try {
      const response = await mockChat(message, options);
      console.log(JSON.stringify({
        success: true,
        message: {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        },
        response: {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        },
      }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, null, 2));
      process.exit(1);
    }
  } else {
    // Normal output mode
    displayUserMessage(message);
    
    const thinking = createThinkingIndicator();
    
    try {
      let response: string;
      
      if (gatewayHealthy && options.stream) {
        // Try WebSocket for streaming
        try {
          const wsUrl = getWebSocketUrl();
          const auth = await loadAuth();
          const client = new ChatClient(wsUrl, {
            agent: options.agent,
            persona: options.persona,
            stream: options.stream,
          }, auth?.token);
          await client.connect();
          thinking.stop();
          response = await client.send(message);
          client.close();
        } catch (wsError) {
          thinking.stop();
          response = await mockChat(message, options);
          displayAssistantMessage(response);
        }
      } else {
        response = await mockChat(message, options);
        thinking.stop();
        displayAssistantMessage(response);
      }

      // Save to history
      const history = await loadChatHistory();
      history.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date() }
      );
      await saveChatHistory(history);

    } catch (error) {
      thinking.stop();
      if (error instanceof Error) {
        msg.error(error.message);
      }
      process.exit(1);
    }
    
    console.log('');
  }
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

export const chatCommand = new Command('chat')
  .description('Interactive chat with Hauba AI')
  .argument('[message]', 'Single message to send (non-interactive mode)')
  .option('-m, --message <message>', 'Message to send (alternative to positional argument)')
  .option('-a, --agent <name>', 'Use a specific agent')
  .option('-p, --persona <name>', 'Use a specific persona')
  .option('--no-stream', 'Wait for complete response instead of streaming')
  .option('--json', 'Output in JSON format (for piping)')
  .addHelpText('after', `
${section.subheader('EXAMPLES')}

  ${colors.muted('# Interactive chat mode')}
  ${colors.primary('$')} hauba chat

  ${colors.muted('# Single message')}
  ${colors.primary('$')} hauba chat "What is the weather today?"

  ${colors.muted('# With specific agent')}
  ${colors.primary('$')} hauba chat --agent "research" "Find info about Nepal"

  ${colors.muted('# With persona')}
  ${colors.primary('$')} hauba chat --persona "friendly" "Hello!"

  ${colors.muted('# Non-streaming mode')}
  ${colors.primary('$')} hauba chat --no-stream "Tell me a joke"

  ${colors.muted('# JSON output for piping')}
  ${colors.primary('$')} hauba chat --json "Hello" | jq .

${section.subheader('CHAT COMMANDS')}

  ${colors.primary('/new')}              Start a new conversation
  ${colors.primary('/clear')}            Clear the screen
  ${colors.primary('/history')}          Show conversation history
  ${colors.primary('/persona <name>')}   Switch to a different persona  
  ${colors.primary('/agent <name>')}     Switch to a different agent
  ${colors.primary('/help')}             Show available commands
  ${colors.primary('/exit')}             Exit the chat
`)
  .action(async (messageArg: string | undefined, options: ChatOptions) => {
    // Determine the message to send
    const message = messageArg || options.message;

    if (message) {
      // Single message mode
      await runSingleMessage(message, options);
    } else {
      // Interactive mode
      await runInteractiveChat(options);
    }
  });

export default chatCommand;
