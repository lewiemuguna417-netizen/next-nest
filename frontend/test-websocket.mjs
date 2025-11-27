// WebSocket test using ES modules
import { io } from 'socket.io-client';

console.log('🔌 Testing WebSocket connection to Paxform backend...');

const socket = io('https://datascrapex-job3-1070255625225.us-central1.run.app/appointments', {
  transports: ['websocket'],
  timeout: 5000
});

let connected = false;

socket.on('connect', () => {
  connected = true;
  console.log('✅ WebSocket connected successfully!');
  console.log(`📡 Socket ID: ${socket.id}`);
  
  // Subscribe to appointment updates
  socket.emit('subscribe-appointments');
  console.log('📡 Subscribed to appointment updates');
});

socket.on('subscription-confirmed', (data) => {
  console.log('✅ Subscription confirmed:', data.message);
});

socket.on('initial-data', (data) => {
  console.log('📊 Received initial data:', data.type);
  console.log(`📋 Appointments count: ${data.appointments?.length || 0}`);
  
  // Exit after receiving initial data
  setTimeout(() => {
    console.log('👋 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 WebSocket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Test timeout
setTimeout(() => {
  if (!connected) {
    console.log('⏰ Connection timeout');
    process.exit(1);
  }
}, 10000);

console.log('⏳ Waiting for connection...');