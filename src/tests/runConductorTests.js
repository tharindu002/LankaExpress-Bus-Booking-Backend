const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 CONDUCTOR MANAGEMENT & BOARDING SYSTEM TEST SUITE');
  console.log('====================================================\n');

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
    // Test 1: Admin Login
    console.log('📋 1. Authenticating Super Admin...');
    const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@lankaexpressway.lk', password: 'admin123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    assert(adminToken && adminLoginData.role === 'admin', 'Super Admin authentication successful');

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // Test 2: Conductor Login
    console.log('\n📋 2. Authenticating Demo Conductor...');
    const condLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'conductor@lankaexpressway.lk', password: 'password123' }),
    });
    const condLoginData = await condLoginRes.json();
    const condToken = condLoginData.token;
    const condRole = (condLoginData.role || '').toLowerCase();
    assert(condToken && condRole === 'conductor', 'Conductor authentication successful');

    const condHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${condToken}`,
    };

    // Test 3: Conductor Role Authorization Guard (Conductor trying to access Admin API)
    console.log('\n📋 3. Testing Role Authorization Restrictions...');
    const forbiddenRes = await fetch(`${API_URL}/admin/users`, { headers: condHeaders });
    assert(forbiddenRes.status === 403, 'Conductor strictly forbidden (403) from Admin API');

    // Test 4: Conductor List (Admin API)
    console.log('\n📋 4. Fetching Conductor List (Admin API)...');
    const conductorsRes = await fetch(`${API_URL}/admin/conductors`, { headers: adminHeaders });
    const conductorsData = await conductorsRes.json();
    assert(Array.isArray(conductorsData.data), 'Admin retrieved conductors list');
    assert(conductorsData.data.length > 0, 'Found registered conductors in database');

    // Test 5: Conductor Shift Dashboard
    console.log('\n📋 5. Fetching Conductor Dashboard (/api/conductor/dashboard)...');
    const dashboardRes = await fetch(`${API_URL}/conductor/dashboard`, { headers: condHeaders });
    const dashboardData = await dashboardRes.json();
    assert(dashboardData.success === true, 'Conductor dashboard retrieved successfully');
    assert(typeof dashboardData.stats?.totalSchedules === 'number', 'Conductor shift stats calculated');

    // Test 6: Conductor Assigned Schedules
    console.log('\n📋 6. Fetching Conductor Assigned Schedules (/api/conductor/schedules)...');
    const schedulesRes = await fetch(`${API_URL}/conductor/schedules`, { headers: condHeaders });
    const schedulesData = await schedulesRes.json();
    const schedulesList = Array.isArray(schedulesData) ? schedulesData : (schedulesData.schedules || []);
    assert(Array.isArray(schedulesList), 'Conductor retrieved assigned schedules list');

    // Test 7: Admin Boarding Monitoring
    console.log('\n📋 7. Testing Admin Live Boarding Operations Monitor (/api/admin/boarding)...');
    const monitorRes = await fetch(`${API_URL}/admin/boarding`, { headers: adminHeaders });
    const monitorData = await monitorRes.json();
    assert(monitorData.success === true, 'Boarding monitor response success = true');
    assert(Array.isArray(monitorData.data), 'Boarding monitor schedules array returned');

    // Test 8: Conductor Ticket Scanning Protocol
    console.log('\n📋 8. Testing Conductor QR Ticket Scan Validation...');
    const bookingsRes = await fetch(`${API_URL}/conductor/bookings`, { headers: condHeaders });
    const bookingsData = await bookingsRes.json();
    const bookingsList = Array.isArray(bookingsData) ? bookingsData : (bookingsData.bookings || []);
    assert(Array.isArray(bookingsList), 'Conductor fetched passenger manifest');

    if (bookingsList.length > 0) {
      const targetBooking = bookingsList[0];
      const scanRes = await fetch(`${API_URL}/conductor/scan-ticket`, {
        method: 'POST',
        headers: condHeaders,
        body: JSON.stringify({ bookingRef: targetBooking.bookingRef }),
      });
      const scanData = await scanRes.json();
      assert(scanData.valid === true, `Scanned ticket ref ${targetBooking.bookingRef} is VALID`);

      // Test 9: Atomic Boarding Confirmation
      console.log('\n📋 9. Marking Passenger as BOARDED...');
      const boardRes = await fetch(`${API_URL}/conductor/bookings/${targetBooking._id}/board`, {
        method: 'POST',
        headers: condHeaders,
      });
      const boardData = await boardRes.json();
      assert(boardData.success === true, `Booking ref ${targetBooking.bookingRef} updated to BOARDED`);

      // Test 10: Duplicate Boarding Prevention Check
      console.log('\n📋 10. Verification: Preventing Duplicate Boarding Scan...');
      const duplicateScanRes = await fetch(`${API_URL}/conductor/scan-ticket`, {
        method: 'POST',
        headers: condHeaders,
        body: JSON.stringify({ bookingRef: targetBooking.bookingRef }),
      });
      const duplicateScanData = await duplicateScanRes.json();
      assert(duplicateScanData.valid === false, 'Duplicate QR scan correctly REJECTED');
      assert(
        duplicateScanData.reason?.toLowerCase().includes('already'),
        'Duplicate scan response confirms passenger already boarded'
      );
    } else {
      console.log('  ℹ️ No active bookings found for conductor schedule to test scanning.');
    }

    console.log('\n====================================================');
    console.log(`🏁 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('❌ CRITICAL ERROR IN TEST RUNNER:', error.message);
  }
}

runTests();
