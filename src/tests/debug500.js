import dotenv from 'dotenv';
import { connectDB, closeDB } from '../config/db.js';
import { User } from '../models/User.js';
import {
  getDashboardStats,
  getUsersAdmin,
  getBusesAdmin,
  getOperatorsAdmin,
  getRoutesAdmin,
  getSchedulesAdmin,
  getBookingsAdmin,
  getWalletsAdmin,
  getWalletTransactionsAdmin,
  getPaymentsAdmin,
  getRefundsAdmin,
  getReportsAdmin,
  getNotificationsAdmin,
  getAuditLogsAdmin,
} from '../controllers/adminController.js';

dotenv.config();

async function debugEndpoints() {
  await connectDB();
  const adminUser = await User.findOne({ role: 'admin' });

  const mockReq = {
    user: adminUser,
    query: {},
    params: {},
    body: {},
    ip: '127.0.0.1',
    headers: {},
  };

  const mockRes = {
    json: (d) => {
      // console.log('Success response');
    },
    status: (code) => {
      console.log('Status code set:', code);
      return mockRes;
    },
  };

  const mockNext = (err) => {
    if (err) {
      console.error('❌ NEXT CALLED WITH ERROR:', err);
    }
  };

  const endpoints = [
    { name: 'getDashboardStats', fn: getDashboardStats },
    { name: 'getUsersAdmin', fn: getUsersAdmin },
    { name: 'getBusesAdmin', fn: getBusesAdmin },
    { name: 'getOperatorsAdmin', fn: getOperatorsAdmin },
    { name: 'getRoutesAdmin', fn: getRoutesAdmin },
    { name: 'getSchedulesAdmin', fn: getSchedulesAdmin },
    { name: 'getBookingsAdmin', fn: getBookingsAdmin },
    { name: 'getWalletsAdmin', fn: getWalletsAdmin },
    { name: 'getWalletTransactionsAdmin', fn: getWalletTransactionsAdmin },
    { name: 'getPaymentsAdmin', fn: getPaymentsAdmin },
    { name: 'getRefundsAdmin', fn: getRefundsAdmin },
    { name: 'getReportsAdmin', fn: getReportsAdmin },
    { name: 'getNotificationsAdmin', fn: getNotificationsAdmin },
    { name: 'getAuditLogsAdmin', fn: getAuditLogsAdmin },
  ];

  for (const ep of endpoints) {
    try {
      console.log(`Testing endpoint function: ${ep.name}`);
      await ep.fn(mockReq, mockRes, mockNext);
      console.log(`✅ ${ep.name} OK`);
    } catch (e) {
      console.error(`💥 EXCEPTION IN ${ep.name}:`, e);
    }
  }

  await closeDB();
  process.exit(0);
}

debugEndpoints();
