import express from 'express';
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../controllers/scheduleController.js';

const router = express.Router();

router.route('/').get(getSchedules).post(createSchedule);
router.route('/:id').get(getScheduleById).put(updateSchedule).delete(deleteSchedule);

export default router;
