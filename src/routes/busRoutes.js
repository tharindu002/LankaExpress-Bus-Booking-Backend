import express from 'express';
import {
  getBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
} from '../controllers/busController.js';

const router = express.Router();

router.route('/').get(getBuses).post(createBus);
router.route('/:id').get(getBusById).put(updateBus).delete(deleteBus);

export default router;
