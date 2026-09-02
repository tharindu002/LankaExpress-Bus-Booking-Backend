import express from 'express';
import {
  getBookings,
  getUserBookings,
  getBookingByRef,
  getBookingQrCode,
  createBooking,
  cancelBooking,
} from '../controllers/bookingController.js';

const router = express.Router();

router.route('/').get(getBookings).post(createBooking);
router.get('/user/:userId', getUserBookings);
router.get('/:ref', getBookingByRef);
router.get('/:ref/qr', getBookingQrCode);
router.put('/:ref/cancel', cancelBooking);

export default router;
