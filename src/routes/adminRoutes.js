import express from 'express';
import { protect, adminOnly, superAdminOnly } from '../middleware/authMiddleware.js';
import {
  getDashboardStats,
  getUsersAdmin,
  getUserByIdAdmin,
  updateUserStatusAdmin,
  adminWalletAdjustment,
  getBusesAdmin,
  createBusAdmin,
  updateBusAdmin,
  deleteBusAdmin,
  getOperatorsAdmin,
  createOperatorAdmin,
  updateOperatorAdmin,
  deleteOperatorAdmin,
  getRoutesAdmin,
  createRouteAdmin,
  updateRouteAdmin,
  deleteRouteAdmin,
  getSchedulesAdmin,
  createScheduleAdmin,
  updateScheduleAdmin,
  deleteScheduleAdmin,
  getScheduleSeatsAdmin,
  updateScheduleSeatsAdmin,
  getBookingsAdmin,
  getBookingByIdAdmin,
  cancelBookingAdmin,
  getWalletsAdmin,
  getWalletTransactionsAdmin,
  getPaymentsAdmin,
  getRefundsAdmin,
  getReportsAdmin,
  getNotificationsAdmin,
  getAuditLogsAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  getConductorsAdmin,
  createConductorAdmin,
  updateConductorAdmin,
  updateConductorStatusAdmin,
  assignConductorToScheduleAdmin,
  removeConductorFromScheduleAdmin,
  getBoardingMonitoringAdmin,
  getAdminUsersAdmin,
  createAdminAccountAdmin,
  updateAdminPermissionsAdmin,
} from '../controllers/adminController.js';

const router = express.Router();

// Apply protect & adminOnly middleware to ALL admin routes
router.use(protect);
router.use(adminOnly);

// SuperAdmin Admin Access Management
router.get('/admins', superAdminOnly, getAdminUsersAdmin);
router.post('/admins', superAdminOnly, createAdminAccountAdmin);
router.patch('/admins/:id/permissions', superAdminOnly, updateAdminPermissionsAdmin);

// Dashboard Analytics
router.get('/dashboard', getDashboardStats);
router.get('/stats', getDashboardStats); // legacy compatibility

// User Management & Wallet Adjustment
router.get('/users', getUsersAdmin);
router.get('/users/:id', getUserByIdAdmin);
router.patch('/users/:id/status', updateUserStatusAdmin);
router.post('/users/:id/wallet-adjust', adminWalletAdjustment);

// Conductor Management
router.get('/conductors', getConductorsAdmin);
router.post('/conductors', createConductorAdmin);
router.patch('/conductors/:id', updateConductorAdmin);
router.patch('/conductors/:id/status', updateConductorStatusAdmin);

// Bus Management
router.get('/buses', getBusesAdmin);
router.post('/buses', createBusAdmin);
router.patch('/buses/:id', updateBusAdmin);
router.delete('/buses/:id', deleteBusAdmin);

// Operator Management
router.get('/operators', getOperatorsAdmin);
router.post('/operators', createOperatorAdmin);
router.patch('/operators/:id', updateOperatorAdmin);
router.delete('/operators/:id', deleteOperatorAdmin);

// Route Management
router.get('/routes', getRoutesAdmin);
router.post('/routes', createRouteAdmin);
router.patch('/routes/:id', updateRouteAdmin);
router.delete('/routes/:id', deleteRouteAdmin);

// Schedule & Seat Management
router.get('/schedules', getSchedulesAdmin);
router.post('/schedules', createScheduleAdmin);
router.patch('/schedules/:id', updateScheduleAdmin);
router.delete('/schedules/:id', deleteScheduleAdmin);
router.get('/schedules/:id/seats', getScheduleSeatsAdmin);
router.patch('/schedules/:id/seats', updateScheduleSeatsAdmin);
router.post('/schedules/:id/assign-conductor', assignConductorToScheduleAdmin);
router.delete('/schedules/:id/conductor', removeConductorFromScheduleAdmin);

// Boarding Operations
router.get('/boarding', getBoardingMonitoringAdmin);

// Booking Management & Refunds
router.get('/bookings', getBookingsAdmin);
router.get('/bookings/:id', getBookingByIdAdmin);
router.post('/bookings/:id/cancel', cancelBookingAdmin);

// Finance & Ledger
router.get('/wallets', getWalletsAdmin);
router.get('/wallet-transactions', getWalletTransactionsAdmin);
router.get('/payments', getPaymentsAdmin);
router.get('/refunds', getRefundsAdmin);

// Reports
router.get('/reports', getReportsAdmin);

// System Notifications & Audit Logs
router.get('/notifications', getNotificationsAdmin);
router.get('/audit-logs', getAuditLogsAdmin);

// Admin Profile
router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);
router.put('/change-password', changeAdminPassword);

export default router;
