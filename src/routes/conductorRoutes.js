import express from 'express';
import {
  getConductorDashboard,
  getConductorSchedules,
  getConductorScheduleById,
  getConductorBookings,
  scanTicket,
  markAsBoarded,
  getConductorNotifications,
  markNotificationRead,
} from '../controllers/conductorController.js';
import { protect, requireConductor } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all conductor routes
router.use(protect, requireConductor);

router.get('/dashboard', getConductorDashboard);
router.get('/schedules', getConductorSchedules);
router.get('/schedules/:id', getConductorScheduleById);
router.get('/bookings', getConductorBookings);

router.post('/scan-ticket', scanTicket);
router.post('/bookings/:id/board', markAsBoarded);

router.get('/notifications', getConductorNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;
