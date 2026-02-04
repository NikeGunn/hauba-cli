// Quick test of Hauba gateway WebSocket connection
import WebSocket from 'ws';

const GATEWAY_URL = 'wss://ws.hauba.tech/ws';

console.log(`\n🔍 Testing Hauba Gateway Connection...`);
console.log(`📡 URL: ${GATEWAY_URL}\n`);

const ws = new WebSocket(GATEWAY_URL, {
  headers: {
    'User-Agent': 'Hauba-Test/1.0'
  }
});

ws.on('open', () => {
  console.log('✅ Connected to gateway!');
  
  // Send a test message
  const  testMessage = {
    type: 'chat',
    data: {
      message: 'Hello, can you help me create a website?',
      sessionId: 'test-session-' + Date.now()
    }
  };
  
  console.log('📤 Sending test message...');
  ws.send(JSON.stringify(testMessage));
  
  // Close after 10 seconds
  setTimeout(() => {
    console.log('\n⏱️ Test complete. Closing connection...');
    ws.close();
  }, 10000);
});

ws.on('message', (data) => {
  console.log('📥 Received:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('👋 Connection closed');
  process.exit(0);
});
