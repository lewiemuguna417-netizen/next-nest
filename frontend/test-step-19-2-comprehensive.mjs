// Step 19.2: Comprehensive Real-Time Appointment Status Updates Test
import { io } from 'socket.io-client';

console.log('🔄 === Step 19.2: Comprehensive Real-Time Appointment Status Updates Test ===');

const socket = io('https://datascrapex-job3-1070255625225.us-central1.run.app/appointments', {
  transports: ['websocket'],
  timeout: 5000
});

// Test tracking
let testResults = {
  connected: false,
  subscriptionConfirmed: false,
  statusChanges: [],
  appointmentUpdates: [],
  errors: []
};

let testAppointment = null;

// Connect and start tests
socket.on('connect', () => {
  testResults.connected = true;
  console.log('✅ WebSocket connected successfully!');
  console.log(`📡 Socket ID: ${socket.id}`);
  
  socket.emit('subscribe-appointments');
  console.log('📡 Subscribed to appointment updates');
});

// Listen for updates
socket.on('appointment-updated', (data) => {
  console.log('📡 Received update:', data.type);
  
  if (data.type === 'status-changed') {
    testResults.statusChanges.push({
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
      appointmentId: data.appointmentId,
      timestamp: new Date().toISOString()
    });
    console.log(`🔄 Status change: ${data.oldStatus} → ${data.newStatus}`);
  } else if (data.type === 'appointment-updated') {
    testResults.appointmentUpdates.push(data);
    console.log(`📋 General update: ${data.appointment?.name || 'Unknown'}`);
  }
});

socket.on('subscription-confirmed', (data) => {
  testResults.subscriptionConfirmed = true;
  console.log('✅ Subscription confirmed:', data.message);
});

socket.on('error', (data) => {
  testResults.errors.push(data.message);
  console.error('❌ Error:', data.message);
});

// Main test execution
setTimeout(async () => {
  if (!testResults.connected) {
    console.log('❌ Failed to connect to WebSocket');
    finishTest();
    return;
  }

  console.log('\n🚀 Starting comprehensive status update tests...');

  try {
    // Test 1: Create appointment
    console.log('\n1️⃣ Creating test appointment...');
    const createResponse = await fetch('https://datascrapex-job3-1070255625225.us-central1.run.app/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Step 19.2 Status Test User',
        email: 'status-test@example.com',
        appointmentDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Testing real-time status updates'
      })
    });

    if (createResponse.ok) {
      testAppointment = await createResponse.json();
      console.log(`✅ Created appointment: ${testAppointment.id}`);
    } else {
      console.log('❌ Failed to create appointment');
    }

    // Test 2: Update status multiple times
    if (testAppointment) {
      console.log('\n2️⃣ Testing multiple status changes...');
      const statusSequence = ['completed', 'cancelled', 'upcoming'];
      
      for (const newStatus of statusSequence) {
        console.log(`🔄 Updating status to: ${newStatus}`);
        
        const updateResponse = await fetch(`https://datascrapex-job3-1070255625225.us-central1.run.app/api/appointments/${testAppointment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            notes: `Updated status to ${newStatus}`
          })
        });

        if (updateResponse.ok) {
          console.log(`✅ Status updated to: ${newStatus}`);
          
          // Wait for WebSocket update
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          console.log(`❌ Failed to update status to: ${newStatus}`);
        }
      }
    }

    // Test 3: Test concurrent updates
    console.log('\n3️⃣ Testing concurrent appointment operations...');
    const concurrentTests = [];
    
    // Create multiple test appointments
    for (let i = 0; i < 2; i++) {
      const response = await fetch('https://datascrapex-job3-1070255625225.us-central1.run.app/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Concurrent Test User ${i}`,
          email: `concurrent${i}@example.com`,
          appointmentDateTime: new Date(Date.now() + (i + 2) * 60 * 60 * 1000).toISOString(),
          notes: 'Concurrent testing'
        })
      });

      if (response.ok) {
        const appointment = await response.json();
        concurrentTests.push(appointment);
        
        // Update status immediately
        const updateResponse = await fetch(`https://datascrapex-job3-1070255625225.us-central1.run.app/api/appointments/${appointment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: i % 2 === 0 ? 'completed' : 'cancelled'
          })
        });

        if (updateResponse.ok) {
          console.log(`✅ Concurrent update ${i + 1} completed`);
        }
      }
    }

    // Wait for all updates to propagate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Cleanup
    console.log('\n4️⃣ Cleaning up test data...');
    const allTestAppointments = [testAppointment, ...concurrentTests];
    
    for (const appointment of allTestAppointments) {
      if (appointment) {
        try {
          await fetch(`https://datascrapex-job3-1070255625225.us-central1.run.app/api/appointments/${appointment.id}`, {
            method: 'DELETE'
          });
          console.log(`🗑️ Cleaned up appointment: ${appointment.id}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cleanup appointment ${appointment.id}:`, error);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    finishTest();
  }
}, 2000);

function finishTest() {
  console.log('\n📊 === Step 19.2 Test Results ===');
  console.log(`🔗 WebSocket Connection: ${testResults.connected ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📡 Subscription: ${testResults.subscriptionConfirmed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔄 Status Changes Received: ${testResults.statusChanges.length} ${testResults.statusChanges.length >= 3 ? '✅' : '❌'}`);
  console.log(`📋 General Updates: ${testResults.appointmentUpdates.length} ✅`);
  console.log(`⚠️ Errors: ${testResults.errors.length} ${testResults.errors.length === 0 ? '✅' : '❌'}`);

  // Show detailed status changes
  if (testResults.statusChanges.length > 0) {
    console.log('\n📋 Status Changes Detected:');
    testResults.statusChanges.forEach((change, index) => {
      console.log(`  ${index + 1}. ${change.oldStatus} → ${change.newStatus} (${change.timestamp})`);
    });
  }

  const overallSuccess = testResults.connected && 
                        testResults.subscriptionConfirmed && 
                        testResults.statusChanges.length >= 3;

  console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (overallSuccess) {
    console.log('✅ Real-time appointment status updates are working correctly!');
    console.log('✅ WebSocket broadcasting is functional');
    console.log('✅ Status changes propagate in real-time');
  } else {
    console.log('⚠️ Some aspects may need attention. Check the logs above.');
  }

  // Disconnect
  setTimeout(() => {
    console.log('\n👋 Disconnecting...');
    socket.disconnect();
    process.exit(overallSuccess ? 0 : 1);
  }, 2000);
}

console.log('⏳ WebSocket connection and test execution in progress...');