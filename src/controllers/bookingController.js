import { Booking } from '../models/Booking.js';
import { Schedule } from '../models/Schedule.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';

// Helper to parse departure date & time robustly
export const parseScheduleDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  try {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const rawTime = timeStr.trim();
    const timeParts = rawTime.split(' ');
    const timeNum = timeParts[0].split(':');
    let hours = parseInt(timeNum[0], 10);
    const minutes = parseInt(timeNum[1], 10) || 0;
    const modifier = timeParts[1] ? timeParts[1].toUpperCase() : '';

    if (hours <= 12) {
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
    }

    return new Date(year, month, day, hours, minutes, 0);
  } catch (err) {
    return null;
  }
};

export const isBookingCutoffClosed = (dateStr, timeStr) => {
  if (!timeStr) return false;

  const todayStr = new Date().toISOString().split('T')[0];
  const targetDateStr = dateStr || todayStr;

  if (targetDateStr > todayStr) {
    return false; // Future dates are always open
  }

  if (targetDateStr < todayStr) {
    return true; // Past dates are closed
  }

  const depDate = parseScheduleDateTime(targetDateStr, timeStr);
  if (!depDate) return false;

  const diffMs = depDate.getTime() - Date.now();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes < 30;
};

// @desc    Get all bookings (Admin)
// @route   GET /api/bookings
export const getBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find().populate('schedule').sort({ createdAt: -1 });
    const schedules = await Schedule.find();

    const transformed = bookings.map((b) => {
      const s = b.schedule || schedules.find((sched) => sched.scheduleId === b.scheduleId);
      return {
        id: b.bookingRef,
        _id: b._id,
        bookingRef: b.bookingRef,
        userId: b.userId,
        scheduleId: b.scheduleId,
        passengerName: b.passengerName,
        passengerEmail: b.passengerEmail,
        passengerPhone: b.passengerPhone,
        passengerNic: b.passengerNic,
        seats: b.seats,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        bookingDate: b.bookingDate,
        qrCodeData: b.qrCodeData,
        status: b.status,
        schedule: s,
      };
    });

    res.json(transformed);
  } catch (err) {
    next(err);
  }
};

// @desc    Get bookings by user ID
// @route   GET /api/bookings/user/:userId
export const getUserBookings = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const bookings = await Booking.find({ userId }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
};

// @desc    Get booking by reference
// @route   GET /api/bookings/:ref
export const getBookingByRef = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ bookingRef: req.params.ref });
    if (!booking) {
      return res.status(404).json({ error: 'Booking ref not found' });
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

// @desc    Get QR Ticket Data for verified booking
// @route   GET /api/bookings/:ref/qr
export const getBookingQrCode = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ bookingRef: req.params.ref }).populate('schedule');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking reference not found' });
    }

    const sched = booking.schedule || (await Schedule.findOne({ scheduleId: booking.scheduleId }));

    res.json({
      success: true,
      bookingRef: booking.bookingRef,
      passengerName: booking.passengerName,
      passengerEmail: booking.passengerEmail,
      passengerPhone: booking.passengerPhone,
      passengerNic: booking.passengerNic,
      route: sched ? `${sched.routeId} (${sched.departureTime})` : 'Intercity Express',
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      bookingDate: booking.bookingDate,
      status: booking.status,
      qrCodeData: booking.qrCodeData,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new booking & reserve seats
// @route   POST /api/bookings
export const createBooking = async (req, res, next) => {
  try {
    const {
      scheduleId,
      userId = 'guest',
      passengerName,
      passengerEmail,
      passengerPhone,
      passengerNic,
      seats,
      totalAmount,
      paymentMethod = 'Card',
      bookingDate = new Date().toISOString().split('T')[0],
    } = req.body;

    if (!scheduleId || !passengerName || !passengerPhone || !seats || !seats.length) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    const schedule = await Schedule.findOne({
      $or: [{ scheduleId }, { _id: scheduleId.match(/^[0-9a-fA-F]{24}$/) ? scheduleId : null }],
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Selected schedule not found' });
    }

    // Enforce strict 30-minute booking cutoff rule
    if (isBookingCutoffClosed(bookingDate, schedule.departureTime)) {
      return res.status(400).json({
        error: 'Booking closed. Tickets can only be booked until 30 minutes before departure.',
      });
    }

    // Check for seat conflicts
    const alreadyReserved = seats.filter((seat) => (schedule.reservedSeats || []).includes(seat));
    if (alreadyReserved.length > 0) {
      return res.status(409).json({
        error: `Seats ${alreadyReserved.join(', ')} are already booked. Please choose other seats.`,
      });
    }

    // Generate unique reference ID: SLB-2026-XXXX
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bookingRef = `SLB-2026-${randomHex}`;
    const qrCodeData = `LANKAEXPRESSWAY:REF:${bookingRef}:SCHED:${scheduleId}:SEATS:${seats.join(',')}:PAID`;

    // Save booking
    const booking = await Booking.create({
      bookingRef,
      userId,
      schedule: schedule._id,
      scheduleId: schedule.scheduleId,
      passengerName,
      passengerEmail: passengerEmail || `${userId}@lankaexpressway.lk`,
      passengerPhone,
      passengerNic: passengerNic || 'N/A',
      seats,
      totalAmount: parseFloat(totalAmount || schedule.fare * seats.length),
      paymentMethod,
      paymentStatus: 'Paid',
      bookingDate,
      qrCodeData,
      status: 'Active',
    });

    // Update schedule reservedSeats
    const updatedReserved = [...(schedule.reservedSeats || []), ...seats];
    await Schedule.findByIdAndUpdate(schedule._id, { reservedSeats: updatedReserved });

    // Create Notification & emit Socket.IO event for assigned conductor
    if (schedule.conductor || schedule.conductorId) {
      const conductorUser = (await User.findById(schedule.conductor)) || (await User.findOne({ userId: schedule.conductorId }));
      if (conductorUser) {
        const notif = await Notification.create({
          recipient: conductorUser._id,
          recipientUserId: conductorUser.userId,
          type: 'NEW_BOOKING',
          title: 'New Booking Received',
          message: `Passenger ${passengerName} reserved seat(s) ${seats.join(', ')} for schedule ${schedule.scheduleId} (${bookingRef}).`,
          bookingRef,
          scheduleId: schedule.scheduleId,
        });

        // Emit Socket.IO Event exclusively to the assigned Conductor's private room
        const io = req.app.get('io');
        if (io) {
          const payload = {
            type: 'NEW_BOOKING',
            title: 'New Booking Received',
            message: `Passenger ${passengerName} reserved seat(s) ${seats.join(', ')} for schedule ${schedule.scheduleId} (${bookingRef}).`,
            bookingRef,
            passengerName,
            seats,
            scheduleId: schedule.scheduleId,
            departureTime: schedule.departureTime,
            totalAmount: booking.totalAmount,
            paymentStatus: 'PAID',
            route: schedule.route ? `${schedule.route.from || ''} ➔ ${schedule.route.to || ''}` : schedule.routeId,
            bus: schedule.bus ? schedule.bus.name : schedule.busId,
            createdAt: booking.createdAt,
            notificationId: notif._id,
          };

          io.to(`conductor_${conductorUser._id}`).emit('NEW_BOOKING', payload);
          io.to(`conductor_${conductorUser.userId}`).emit('NEW_BOOKING', payload);
          if (conductorUser.employeeId) {
            io.to(`conductor_${conductorUser.employeeId}`).emit('NEW_BOOKING', payload);
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      bookingRef,
      booking,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel booking, release seats, and refund to wallet
// @route   PUT /api/bookings/:ref/cancel
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ bookingRef: req.params.ref });
    if (!booking) {
      return res.status(404).json({ error: 'Booking ref not found' });
    }

    if (booking.status === 'Cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled and refunded' });
    }

    const schedule = await Schedule.findOne({
      $or: [{ scheduleId: booking.scheduleId }, { _id: booking.schedule }],
    });

    if (schedule && isBookingCutoffClosed(booking.bookingDate, schedule.departureTime)) {
      return res.status(400).json({
        error: 'Cancellation closed. Tickets can only be cancelled up to 30 minutes before bus departure.',
      });
    }

    // Idempotency check: Check if refund transaction was already recorded
    const existingRefund = await WalletTransaction.findOne({
      bookingRef: booking.bookingRef,
      reason: 'BOOKING_REFUND',
      status: 'COMPLETED',
    });

    if (existingRefund) {
      return res.status(400).json({ error: 'Refund for this booking has already been processed into wallet' });
    }

    booking.status = 'Cancelled';
    booking.paymentStatus = 'Refunded';
    await booking.save();

    // Release seats from Schedule
    if (schedule) {
      const remainingSeats = (schedule.reservedSeats || []).filter((seat) => !booking.seats.includes(seat));
      await Schedule.findByIdAndUpdate(schedule._id, { reservedSeats: remainingSeats });

      if (schedule.conductor || schedule.conductorId) {
        const conductorUser = (await User.findById(schedule.conductor)) || (await User.findOne({ userId: schedule.conductorId }));
        if (conductorUser) {
          const notif = await Notification.create({
            recipient: conductorUser._id,
            recipientUserId: conductorUser.userId,
            type: 'BOOKING_CANCELLED',
            title: 'Booking Cancelled',
            message: `Booking ${booking.bookingRef} (Seats: ${booking.seats.join(', ')}) has been cancelled.`,
            bookingRef: booking.bookingRef,
            scheduleId: schedule.scheduleId,
          });

          // Emit Socket.IO Event exclusively to the assigned Conductor's private room
          const io = req.app.get('io');
          if (io) {
            const payload = {
              type: 'BOOKING_CANCELLED',
              title: 'Booking Cancelled',
              message: `Booking ${booking.bookingRef} (Seats: ${booking.seats.join(', ')}) has been cancelled.`,
              bookingRef: booking.bookingRef,
              scheduleId: schedule.scheduleId,
              createdAt: new Date(),
              notificationId: notif._id,
            };

            io.to(`conductor_${conductorUser._id}`).emit('BOOKING_CANCELLED', payload);
            io.to(`conductor_${conductorUser.userId}`).emit('BOOKING_CANCELLED', payload);
            if (conductorUser.employeeId) {
              io.to(`conductor_${conductorUser.employeeId}`).emit('BOOKING_CANCELLED', payload);
            }
          }
        }
      }
    }

    // Refund ticket amount to user's wallet
    let walletCreditMessage = 'Booking cancelled and seats released';

    // Find target user by ObjectId or userStrId
    const userDoc = (await User.findById(booking.user)) || (await User.findOne({ userId: booking.userId }));
    if (userDoc) {
      let wallet = await Wallet.findOne({ userId: userDoc._id });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: userDoc._id,
          userStrId: userDoc.userId || userDoc._id.toString(),
          balance: 0,
          currency: 'LKR',
        });
      }

      const balanceBefore = wallet.balance;
      const refundAmount = booking.totalAmount;
      const balanceAfter = balanceBefore + refundAmount;

      wallet.balance = balanceAfter;
      await wallet.save();

      await WalletTransaction.create({
        userId: userDoc._id,
        userStrId: userDoc.userId || userDoc._id.toString(),
        walletId: wallet._id,
        type: 'CREDIT',
        reason: 'BOOKING_REFUND',
        amount: refundAmount,
        balanceBefore,
        balanceAfter,
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        status: 'COMPLETED',
        gateway: 'INTERNAL_WALLET',
        notes: `Refund for cancelled booking ${booking.bookingRef}`,
      });

      walletCreditMessage = `Booking cancelled successfully. LKR ${refundAmount.toFixed(2)} refunded to user's Digital Wallet. New Wallet Balance: LKR ${balanceAfter.toFixed(2)}`;
    }

    res.json({
      success: true,
      message: walletCreditMessage,
      booking,
    });
  } catch (err) {
    next(err);
  }
};
