import { io as Client } from 'socket.io-client';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runEndToEndVerification() {
  console.log('========================================================================');
  console.log('⚡ REAL END-TO-END CONDUCTOR BOOKING NOTIFICATION VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Conductor A (Assigned to Schedule 1)
    console.log('📋 1. Authenticating Conductor A (Nimal Perera / cond_301)...');
    const condALogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'conductor@lankaexpressway.lk', password: 'password123' }),
    });
    const condAData = await condALogin.json();
    assert(condAData.token && (condAData.role === 'conductor' || condAData.role === 'CONDUCTOR'), 'Conductor A authenticated (conductor@lankaexpressway.lk)');

    // 2. Authenticate Conductor B (Assigned to Schedule 2)
    console.log('\n📋 2. Authenticating Conductor B (Sunil Shantha / cond_302)...');
    const condBLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sunil.conductor@lankaexpressway.lk', password: 'password123' }),
    });
    const condBData = await condBLogin.json();
    assert(condBData.token && (condBData.role === 'conductor' || condBData.role === 'CONDUCTOR'), 'Conductor B authenticated (sunil.conductor@lankaexpressway.lk)');

    const condAId = condAData.userId || condAData._id || 'cond_301';
    const condBId = condBData.userId || condBData._id || 'cond_302';

    // 3. Connect Real Socket Clients
    console.log('\n📋 3. Connecting Conductor Socket Clients & Joining Private Rooms...');
    
    const socketA = Client(SOCKET_URL, { transports: ['websocket', 'polling'] });
    const socketB = Client(SOCKET_URL, { transports: ['websocket', 'polling'] });

    let condAReceivedEvents = [];
    let condBReceivedEvents = [];

    await new Promise((resolve) => {
      let connectedCount = 0;
      const onConnect = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };

      socketA.on('connect', () => {
        socketA.emit('join_conductor', condAId);
        if (condAData._id) socketA.emit('join_conductor', condAData._id);
        onConnect();
      });

      socketB.on('connect', () => {
        socketB.emit('join_conductor', condBId);
        if (condBData._id) socketB.emit('join_conductor', condBData._id);
        onConnect();
      });
    });

    assert(socketA.connected && socketB.connected, 'Both Conductor A and Conductor B socket clients connected');

    socketA.on('NEW_BOOKING', (event) => condAReceivedEvents.push({ socket: 'A', type: 'NEW_BOOKING', data: event }));
    socketA.on('BOOKING_CANCELLED', (event) => condAReceivedEvents.push({ socket: 'A', type: 'BOOKING_CANCELLED', data: event }));

    socketB.on('NEW_BOOKING', (event) => condBReceivedEvents.push({ socket: 'B', type: 'NEW_BOOKING', data: event }));
    socketB.on('BOOKING_CANCELLED', (event) => condBReceivedEvents.push({ socket: 'B', type: 'BOOKING_CANCELLED', data: event }));

    // Generate random seat numbers to avoid conflict
    const seat1 = `X${Math.floor(Math.random() * 80 + 10)}`;
    const seat2 = `Y${Math.floor(Math.random() * 80 + 10)}`;
    const seatOffline = `Z${Math.floor(Math.random() * 80 + 10)}`;

    // 4. Create New Booking for Schedule 1 (Assigned to Conductor A)
    console.log('\n📋 4. Triggering Real User Booking for Schedule S-01 (Assigned to Conductor A)...');
    const bookingRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId: 'S-01',
        userId: 'cust_241',
        passengerName: 'Kasun Perera',
        passengerEmail: 'kasun@gmail.com',
        passengerPhone: '+94 77 123 9988',
        passengerNic: '199512345678',
        seats: [seat1, seat2],
        totalAmount: 1680,
        paymentMethod: 'Card',
        bookingDate: '2026-08-31',
      }),
    });
    const bookingData = await bookingRes.json();
    assert(bookingData.success === true && bookingData.bookingRef, `Booking created successfully (${bookingData.bookingRef})`);

    // Wait 1.5 seconds for socket event propagation
    await new Promise((r) => setTimeout(r, 1500));

    // 5. Verify Targeted Real-Time Socket Event Delivery
    console.log('\n📋 5. Verifying Real-Time Socket Event Delivery to Conductor A...');
    assert(condAReceivedEvents.length === 1, 'Conductor A received exactly 1 real-time socket event');
    
    if (condAReceivedEvents.length > 0) {
      const evt = condAReceivedEvents[0].data;
      assert(evt.type === 'NEW_BOOKING', 'Event type is NEW_BOOKING');
      assert(evt.bookingRef === bookingData.bookingRef, `Payload bookingRef matches (${evt.bookingRef})`);
      assert(evt.passengerName === 'Kasun Perera', `Payload passengerName matches (${evt.passengerName})`);
      assert(Array.isArray(evt.seats) && evt.seats.includes(seat1), `Payload seats match (${evt.seats.join(', ')})`);
      assert(evt.paymentStatus === 'PAID', 'Payload paymentStatus = PAID');
      assert(evt.departureTime !== undefined, `Payload contains departureTime (${evt.departureTime})`);
    }

    console.log('\n📋 6. Verifying Wrong Conductor Room Isolation (Conductor B)...');
    assert(condBReceivedEvents.length === 0, 'Conductor B received 0 events (STRICT ROOM ISOLATION GUARANTEED)');

    // 7. Test Booking Cancellation Event
    console.log('\n📋 7. Triggering Booking Cancellation for Schedule S-01...');
    const cancelRes = await fetch(`${API_URL}/bookings/${bookingData.bookingRef}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    const cancelData = await cancelRes.json();
    assert(cancelData.success === true, `Booking ${bookingData.bookingRef} cancelled successfully`);

    await new Promise((r) => setTimeout(r, 1500));

    assert(condAReceivedEvents.length === 2, 'Conductor A received second socket event (BOOKING_CANCELLED)');
    if (condAReceivedEvents.length === 2) {
      const cancelEvt = condAReceivedEvents[1].data;
      assert(cancelEvt.type === 'BOOKING_CANCELLED', 'Event type is BOOKING_CANCELLED');
      assert(cancelEvt.bookingRef === bookingData.bookingRef, `Cancelled bookingRef matches (${cancelEvt.bookingRef})`);
    }
    assert(condBReceivedEvents.length === 0, 'Conductor B still received 0 events for Conductor A cancellation');

    // 8. Test Offline Persistence (Conductor offline during booking)
    console.log('\n📋 8. Testing Conductor Offline MongoDB Notification Persistence...');
    socketA.disconnect();
    assert(!socketA.connected, 'Conductor A disconnected (simulating offline device)');

    const offlineBookingRes = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId: 'S-01',
        userId: 'cust_241',
        passengerName: 'Nimali Fernando',
        passengerEmail: 'nimali@gmail.com',
        passengerPhone: '+94 77 999 1122',
        passengerNic: '199788112233',
        seats: [seatOffline],
        totalAmount: 840,
        paymentMethod: 'Card',
        bookingDate: '2026-08-31',
      }),
    });
    const offlineBookingData = await offlineBookingRes.json();
    assert(offlineBookingData.success === true && offlineBookingData.bookingRef, `Offline booking created (${offlineBookingData.bookingRef})`);

    // Conductor A reconnects & fetches notifications via API
    console.log('   Conductor A reconnects & fetches unread notifications via REST API...');
    const notifRes = await fetch(`${API_URL}/conductor/notifications`, {
      headers: { Authorization: `Bearer ${condAData.token}` },
    });
    const notifData = await notifRes.json();
    assert(Array.isArray(notifData.notifications), 'Conductor fetched notifications list');
    const persistentNotif = (notifData.notifications || []).find((n) => n.bookingRef === offlineBookingData.bookingRef);
    assert(persistentNotif !== undefined, `Offline booking notification persisted in MongoDB for Conductor A (${offlineBookingData.bookingRef})`);
    assert(persistentNotif?.read === false, 'Notification status is UNREAD (read = false)');

    socketB.disconnect();

    console.log('\n========================================================================');
    console.log(`🏁 REAL E2E NOTIFICATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ CRITICAL ERROR IN E2E VERIFICATION:', err.message);
  }
}

runEndToEndVerification();
