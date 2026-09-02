import dotenv from 'dotenv';
import { connectDB, closeDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Bus } from '../models/Bus.js';
import { Operator } from '../models/Operator.js';
import { Route } from '../models/Route.js';
import { Schedule } from '../models/Schedule.js';
import { Booking } from '../models/Booking.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  getDashboardStats,
  updateUserStatusAdmin,
  adminWalletAdjustment,
  createBusAdmin,
  cancelBookingAdmin,
  getAuditLogsAdmin,
} from '../controllers/adminController.js';

dotenv.config();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

async function runAdminTests() {
  console.log('🧪 Starting LankaExpressway Admin Panel Automated Test Suite...\n');
  await connectDB();

  // 1. Setup Admin User & Regular User
  console.log('--- Test 1: Admin Setup & Authentication Verification ---');
  let adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) {
    adminUser = await User.create({
      userId: 'admin_test_01',
      name: 'System Admin',
      email: 'admin_test@lankaexpressway.lk',
      password: 'adminpassword123',
      role: 'admin',
      phone: '+94 77 111 2222',
    });
  }

  let regularUser = await User.findOne({ role: 'user' });
  if (!regularUser) {
    regularUser = await User.create({
      userId: 'user_test_01',
      name: 'Regular Passenger',
      email: 'passenger_test@lankaexpressway.lk',
      password: 'passengerpassword123',
      role: 'user',
      phone: '+94 77 333 4444',
    });
  }

  assert(adminUser && adminUser.role === 'admin', 'Admin user account exists with role=admin');
  assert(regularUser && regularUser.role === 'user', 'Regular user account exists with role=user');

  // 2. Admin Dashboard Stats Test
  console.log('\n--- Test 2: Admin Dashboard Analytics ---');
  let mockRes = {
    json: (data) => data,
    status: () => mockRes,
  };
  let req = { user: adminUser, ip: '127.0.0.1', headers: {} };

  await getDashboardStats(req, {
    json: (resData) => {
      assert(resData.success === true, 'Dashboard API returned success=true');
      assert(typeof resData.data.kpis.totalUsers === 'number', `Total users counted: ${resData.data.kpis.totalUsers}`);
      assert(typeof resData.data.kpis.ticketRevenue === 'number', `Ticket revenue calculated: LKR ${resData.data.kpis.ticketRevenue}`);
      assert(typeof resData.data.kpis.walletTopUpAmount === 'number', `Wallet top-ups separated from revenue: LKR ${resData.data.kpis.walletTopUpAmount}`);
    },
  }, (err) => console.error(err));

  // 3. User Suspension & Audit Log Test
  console.log('\n--- Test 3: User Status Suspension & Audit Log Recording ---');
  const reqSuspend = {
    user: adminUser,
    params: { id: regularUser._id.toString() },
    body: { status: 'Suspended', reason: 'Violation of terms' },
    ip: '127.0.0.1',
    headers: {},
  };

  await updateUserStatusAdmin(reqSuspend, {
    json: (resData) => {
      assert(resData.success === true && resData.data.status === 'Suspended', 'User status updated to Suspended');
    },
  }, (err) => console.error(err));

  const suspendLog = await AuditLog.findOne({ action: 'SUSPEND_USER', targetId: regularUser._id.toString() });
  assert(suspendLog !== null, `AuditLog entry recorded for SUSPEND_USER action (Reason: ${suspendLog?.reason})`);

  // Re-activate user
  const reqActivate = {
    user: adminUser,
    params: { id: regularUser._id.toString() },
    body: { status: 'Active', reason: 'Account reinstated' },
    ip: '127.0.0.1',
    headers: {},
  };
  await updateUserStatusAdmin(reqActivate, { json: () => {} }, (err) => console.error(err));

  // 4. Admin Wallet Adjustment Test (Credit & Debit)
  console.log('\n--- Test 4: Admin Wallet Adjustment (Atomic & Ledger Tracked) ---');
  let userWallet = await Wallet.findOne({ userId: regularUser._id });
  if (!userWallet) {
    userWallet = await Wallet.create({ userId: regularUser._id, userStrId: regularUser.userId, balance: 1000 });
  }

  const initialBal = userWallet.balance;
  const creditReq = {
    user: adminUser,
    params: { id: regularUser._id.toString() },
    body: { type: 'CREDIT', amount: 1500, reason: 'Goodwill compensation for delayed bus' },
    ip: '127.0.0.1',
    headers: {},
  };

  await adminWalletAdjustment(creditReq, {
    json: (resData) => {
      assert(resData.success === true, `Admin wallet CREDIT of LKR 1,500 successful`);
      assert(resData.data.newBalance === initialBal + 1500, `New Wallet Balance: LKR ${resData.data.newBalance}`);
    },
  }, (err) => console.error(err));

  const adjTx = await WalletTransaction.findOne({ userId: regularUser._id, reason: 'ADMIN_ADJUSTMENT', type: 'CREDIT' });
  assert(adjTx !== null, 'WalletTransaction recorded with type CREDIT and reason ADMIN_ADJUSTMENT');

  const adjLog = await AuditLog.findOne({ action: 'ADMIN_ADJUSTMENT', targetId: userWallet._id.toString() });
  assert(adjLog !== null, 'AuditLog entry recorded for ADMIN_ADJUSTMENT action');

  // Test Negative Balance Rejection
  const overDebitReq = {
    user: adminUser,
    params: { id: regularUser._id.toString() },
    body: { type: 'DEBIT', amount: 999999, reason: 'Test excessive debit' },
    ip: '127.0.0.1',
    headers: {},
  };

  await adminWalletAdjustment(overDebitReq, {
    status: (code) => {
      assert(code === 400, 'System rejected debit causing negative wallet balance with status 400');
      return { json: () => {} };
    },
  }, (err) => console.error(err));

  // 5. Bus CRUD Test
  console.log('\n--- Test 5: Bus Management & Audit Trail ---');
  let sampleOp = await Operator.findOne();
  if (!sampleOp) {
    sampleOp = await Operator.create({ operatorId: 'OP-TEST-01', name: 'Test Expressway Lines' });
  }

  const createBusReq = {
    user: adminUser,
    body: {
      busNo: 'ND-9999',
      name: 'Super Express Deluxe',
      model: 'Volvo B11R',
      busType: 'Super Luxury',
      serviceCategory: 'Super Luxury',
      seatLayout: '2+2',
      totalSeats: 44,
      facilities: ['WiFi', 'AC', 'USB Charging'],
      operatorId: sampleOp.operatorId,
      status: 'Active',
    },
    ip: '127.0.0.1',
    headers: {},
  };

  let createdBusId;
  await createBusAdmin(createBusReq, {
    status: () => ({
      json: (resData) => {
        createdBusId = resData.data._id;
        assert(resData.success === true && resData.data.name === 'Super Express Deluxe', 'Bus created successfully by Admin');
      },
    }),
  }, (err) => console.error(err));

  const busLog = await AuditLog.findOne({ action: 'CREATE_BUS', targetId: createdBusId.toString() });
  assert(busLog !== null, 'AuditLog entry recorded for CREATE_BUS');

  // Cleanup created bus
  await Bus.findByIdAndDelete(createdBusId);

  // 6. Booking Cancellation & Duplicate Refund Guard
  console.log('\n--- Test 6: Booking Cancellation & Refund Idempotency Guard ---');
  const bookingRefTest = `SLB-TEST-ADM-${Date.now()}`;
  const testBooking = await Booking.create({
    bookingRef: bookingRefTest,
    user: regularUser._id,
    userId: regularUser.userId,
    scheduleId: 'S-01',
    passengerName: 'Test Cancel Passenger',
    passengerEmail: 'cancel@test.com',
    passengerPhone: '0770001122',
    seats: ['B3', 'B4'],
    totalAmount: 1200,
    paymentMethod: 'Wallet',
    paymentStatus: 'Paid',
    bookingDate: '2026-08-29',
    status: 'Active',
  });

  const cancelReq = {
    user: adminUser,
    params: { id: testBooking.bookingRef },
    body: { reason: 'Passenger requested cancellation' },
    ip: '127.0.0.1',
    headers: {},
  };

  await cancelBookingAdmin(cancelReq, {
    json: (resData) => {
      assert(resData.success === true && resData.data.status === 'Cancelled', 'Booking cancelled and status updated to Cancelled');
    },
  }, (err) => console.error(err));

  // Test duplicate cancel/refund attempt
  await cancelBookingAdmin(cancelReq, {
    status: (code) => {
      assert(code === 400, 'Duplicate refund attempt blocked with HTTP 400 status');
      return { json: () => {} };
    },
  }, (err) => console.error(err));

  // Final Summary
  console.log(`\n========================================`);
  console.log(`📊 ADMIN TEST RESULTS: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} tests`);
  console.log(`========================================\n`);

  await closeDB();
  process.exit(failed === 0 ? 0 : 1);
}

runAdminTests().catch((err) => {
  console.error('❌ Admin Test Suite Exception:', err);
  process.exit(1);
});
