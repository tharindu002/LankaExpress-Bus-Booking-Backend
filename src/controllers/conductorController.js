import { Booking } from '../models/Booking.js';
import { Schedule } from '../models/Schedule.js';
import { BoardingLog } from '../models/BoardingLog.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

// Helper to check if a schedule is assigned to the current conductor
const isScheduleAssignedToConductor = (schedule, user) => {
  if (!schedule) return false;
  const userObjId = user._id ? user._id.toString() : '';
  const userStrId = user.userId || '';
  const empId = user.employeeId || '';
  
  const schedCondObjId = schedule.conductor ? schedule.conductor.toString() : '';
  const schedCondId = schedule.conductorId || '';

  const assignedBuses = user.assignedBuses || [];
  const scheduleBusId = schedule.busId || schedule.bus?.busId || schedule.bus?.busNo || '';

  return (
    user.role === 'admin' ||
    user.role === 'superadmin' ||
    (schedCondObjId && schedCondObjId === userObjId) ||
    (schedCondId && (schedCondId === userStrId || schedCondId === empId)) ||
    (assignedBuses.length > 0 && scheduleBusId && assignedBuses.includes(scheduleBusId))
  );
};

// @desc    Get Conductor Dashboard Overview
// @route   GET /api/conductor/dashboard
export const getConductorDashboard = async (req, res, next) => {
  try {
    const user = req.user;
    const userObjId = user._id;
    const userStrId = user.userId || '';
    const empId = user.employeeId || '';
    const assignedBuses = user.assignedBuses || [];

    // Find schedules assigned to conductor or assigned buses
    const query = {
      $or: [
        { conductor: userObjId },
        { conductorId: userStrId },
        { conductorId: empId },
        ...(assignedBuses.length > 0 ? [{ busId: { $in: assignedBuses } }] : []),
      ],
      status: 'Active',
    };

    const schedules = await Schedule.find(query)
      .populate('bus')
      .populate('route')
      .sort({ departureTime: 1 });

    const scheduleIds = schedules.map((s) => s.scheduleId);
    const scheduleObjIds = schedules.map((s) => s._id);

    const bookings = await Booking.find({
      $or: [{ scheduleId: { $in: scheduleIds } }, { schedule: { $in: scheduleObjIds } }],
    });

    const stats = {
      totalSchedules: schedules.length,
      totalBookings: bookings.length,
      paidBookings: bookings.filter((b) => b.paymentStatus === 'Paid' && b.status === 'Active').length,
      boardedCount: bookings.filter((b) => b.boardingStatus === 'Boarded').length,
      pendingBoardingCount: bookings.filter((b) => b.boardingStatus === 'Pending' && b.status === 'Active').length,
      cancelledCount: bookings.filter((b) => b.status === 'Cancelled').length,
      noShowCount: bookings.filter((b) => b.boardingStatus === 'No_Show').length,
    };

    const activeSchedule = schedules.length > 0 ? schedules[0] : null;

    res.json({
      success: true,
      conductor: {
        id: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        employeeId: user.employeeId || user.userId,
      },
      stats,
      activeSchedule,
      assignedSchedulesCount: schedules.length,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Conductor Assigned Schedules
// @route   GET /api/conductor/schedules
export const getConductorSchedules = async (req, res, next) => {
  try {
    const user = req.user;
    const userObjId = user._id;
    const userStrId = user.userId || '';
    const empId = user.employeeId || '';

    const assignedBuses = user.assignedBuses || [];
    const query = user.role === 'admin' || user.role === 'superadmin'
      ? { status: 'Active' }
      : {
          $or: [
            { conductor: userObjId },
            { conductorId: userStrId },
            { conductorId: empId },
            ...(assignedBuses.length > 0 ? [{ busId: { $in: assignedBuses } }] : []),
          ],
        };

    const schedules = await Schedule.find(query)
      .populate('bus')
      .populate('route')
      .sort({ createdAt: -1 });

    // Calculate booked & boarded counts for each schedule
    const scheduleIds = schedules.map((s) => s.scheduleId);
    const bookings = await Booking.find({
      scheduleId: { $in: scheduleIds },
      status: 'Active',
    });

    const enriched = schedules.map((sched) => {
      const schedBookings = bookings.filter((b) => b.scheduleId === sched.scheduleId);
      const bookedSeatsCount = schedBookings.reduce((sum, b) => sum + (b.seats ? b.seats.length : 0), 0);
      const boardedCount = schedBookings
        .filter((b) => b.boardingStatus === 'Boarded')
        .reduce((sum, b) => sum + (b.seats ? b.seats.length : 0), 0);

      return {
        ...sched.toObject(),
        bookedSeatsCount,
        boardedCount,
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

// @desc    Get Specific Schedule Details for Conductor
// @route   GET /api/conductor/schedules/:id
export const getConductorScheduleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findOne({
      $or: [{ scheduleId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    })
      .populate('bus')
      .populate('route');

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (!isScheduleAssignedToConductor(schedule, req.user)) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this schedule' });
    }

    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

// @desc    Get Bookings for Conductor's Assigned Schedule
// @route   GET /api/conductor/bookings
export const getConductorBookings = async (req, res, next) => {
  try {
    const user = req.user;
    const userObjId = user._id;
    const userStrId = user.userId || '';
    const empId = user.employeeId || '';
    const assignedBuses = user.assignedBuses || [];

    // Find assigned schedule IDs
    const assignedSchedules = await Schedule.find({
      $or: [
        { conductor: userObjId },
        { conductorId: userStrId },
        { conductorId: empId },
        ...(assignedBuses.length > 0 ? [{ busId: { $in: assignedBuses } }] : []),
      ],
    });

    const scheduleIds = assignedSchedules.map((s) => s.scheduleId);

    const { scheduleId, status, search } = req.query;

    let filter = {};

    if (scheduleId) {
      if (!scheduleIds.includes(scheduleId) && user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied to requested schedule bookings' });
      }
      filter.scheduleId = scheduleId;
    } else if (user.role !== 'admin') {
      filter.scheduleId = { $in: scheduleIds };
    }

    if (status) {
      if (status === 'Paid') {
        filter.paymentStatus = 'Paid';
        filter.status = 'Active';
      } else if (status === 'Pending') {
        filter.boardingStatus = 'Pending';
        filter.status = 'Active';
      } else if (status === 'Boarded') {
        filter.boardingStatus = 'Boarded';
      } else if (status === 'Cancelled') {
        filter.status = 'Cancelled';
      } else if (status === 'No_Show') {
        filter.boardingStatus = 'No_Show';
      }
    }

    let bookings = await Booking.find(filter).populate('schedule').sort({ createdAt: -1 });

    if (search) {
      const q = search.toLowerCase().trim();
      bookings = bookings.filter(
        (b) =>
          b.bookingRef.toLowerCase().includes(q) ||
          b.passengerName.toLowerCase().includes(q) ||
          b.passengerPhone.toLowerCase().includes(q) ||
          (b.seats && b.seats.join(',').toLowerCase().includes(q))
      );
    }

    res.json(bookings);
  } catch (err) {
    next(err);
  }
};

// @desc    Scan and Verify QR Ticket
// @route   POST /api/conductor/scan-ticket
export const scanTicket = async (req, res, next) => {
  try {
    const { bookingRef } = req.body;
    if (!bookingRef) {
      return res.status(400).json({ valid: false, reason: 'Booking reference is required for scanning' });
    }

    const cleanRef = bookingRef.trim().toUpperCase();

    const booking = await Booking.findOne({
      $or: [{ bookingRef: cleanRef }, { qrCodeData: { $regex: cleanRef, $options: 'i' } }],
    }).populate('schedule');

    if (!booking) {
      return res.json({
        valid: false,
        reason: 'Ticket not found. Invalid or unregistered booking reference.',
      });
    }

    const schedule = booking.schedule || (await Schedule.findOne({ scheduleId: booking.scheduleId }).populate('bus').populate('route'));

    // 1. Verify schedule assignment
    if (!isScheduleAssignedToConductor(schedule, req.user)) {
      await BoardingLog.create({
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        scheduleId: booking.scheduleId,
        conductorId: req.user.userId,
        conductor: req.user._id,
        passengerName: booking.passengerName,
        seats: booking.seats,
        action: 'QR_SCAN_FAILED',
        result: 'REJECTED: Ticket belongs to another bus/schedule',
      });

      return res.json({
        valid: false,
        reason: 'Ticket does not belong to your assigned schedule.',
        bookingRef: booking.bookingRef,
      });
    }

    // 2. Verify payment status
    if (booking.paymentStatus !== 'Paid') {
      await BoardingLog.create({
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        scheduleId: booking.scheduleId,
        conductorId: req.user.userId,
        conductor: req.user._id,
        passengerName: booking.passengerName,
        seats: booking.seats,
        action: 'QR_SCAN_FAILED',
        result: 'REJECTED: Payment not completed',
      });

      return res.json({
        valid: false,
        reason: `Payment not completed. Status: ${booking.paymentStatus}`,
        bookingRef: booking.bookingRef,
      });
    }

    // 3. Verify booking status
    if (booking.status === 'Cancelled') {
      await BoardingLog.create({
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        scheduleId: booking.scheduleId,
        conductorId: req.user.userId,
        conductor: req.user._id,
        passengerName: booking.passengerName,
        seats: booking.seats,
        action: 'QR_SCAN_FAILED',
        result: 'REJECTED: Ticket cancelled',
      });

      return res.json({
        valid: false,
        reason: 'Ticket cancelled and refunded.',
        bookingRef: booking.bookingRef,
      });
    }

    // 4. Verify duplicate boarding
    if (booking.boardingStatus === 'Boarded') {
      await BoardingLog.create({
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        scheduleId: booking.scheduleId,
        conductorId: req.user.userId,
        conductor: req.user._id,
        passengerName: booking.passengerName,
        seats: booking.seats,
        action: 'ALREADY_BOARDED',
        result: `REJECTED: Ticket already boarded at ${booking.boardedAt ? new Date(booking.boardedAt).toLocaleTimeString() : 'earlier'}`,
      });

      return res.json({
        valid: false,
        reason: `Passenger already boarded at ${booking.boardedAt ? new Date(booking.boardedAt).toLocaleTimeString() : 'earlier'}.`,
        bookingRef: booking.bookingRef,
        booking,
      });
    }

    // Valid scan log
    await BoardingLog.create({
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      scheduleId: booking.scheduleId,
      conductorId: req.user.userId,
      conductor: req.user._id,
      passengerName: booking.passengerName,
      seats: booking.seats,
      action: 'QR_SCAN_SUCCESS',
      result: 'VALID TICKET: Ready for boarding',
    });

    return res.json({
      valid: true,
      message: 'VALID TICKET',
      bookingRef: booking.bookingRef,
      bookingId: booking._id,
      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone,
      passengerNic: booking.passengerNic || 'N/A',
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      bookingDate: booking.bookingDate,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      boardingStatus: booking.boardingStatus,
      schedule: {
        scheduleId: schedule?.scheduleId,
        departureTime: schedule?.departureTime,
        arrivalTime: schedule?.arrivalTime,
        busName: schedule?.bus?.name || 'Express Bus',
        busRegNo: schedule?.bus?.registrationNumber || schedule?.busId,
        routeName: schedule?.route ? `${schedule.route.from} ➔ ${schedule.route.to}` : schedule?.routeId,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark Passenger as Boarded
// @route   POST /api/conductor/bookings/:id/board
export const markAsBoarded = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({
      $or: [{ bookingRef: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    }).populate('schedule');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const schedule = booking.schedule || (await Schedule.findOne({ scheduleId: booking.scheduleId }));

    if (!isScheduleAssignedToConductor(schedule, req.user)) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this schedule' });
    }

    if (booking.status !== 'Active' || booking.paymentStatus !== 'Paid') {
      return res.status(400).json({ error: 'Cannot board invalid or unpaid ticket' });
    }

    if (booking.boardingStatus === 'Boarded') {
      return res.status(400).json({
        error: `Passenger already marked as boarded at ${new Date(booking.boardedAt).toLocaleTimeString()}`,
      });
    }

    booking.boardingStatus = 'Boarded';
    booking.boardedAt = new Date();
    booking.verifiedBy = req.user._id;
    booking.verifiedByConductorId = req.user.userId;

    await booking.save();

    // Log boarding verification
    await BoardingLog.create({
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      scheduleId: booking.scheduleId,
      conductorId: req.user.userId,
      conductor: req.user._id,
      passengerName: booking.passengerName,
      seats: booking.seats,
      action: 'PASSENGER_BOARDED',
      result: `SUCCESS: Marked boarded by ${req.user.name} (${req.user.userId})`,
      verifiedAt: booking.boardedAt,
    });

    res.json({
      success: true,
      message: `Passenger ${booking.passengerName} (Seats: ${booking.seats.join(', ')}) successfully marked as BOARDED!`,
      booking,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Conductor Notifications
// @route   GET /api/conductor/notifications
export const getConductorNotifications = async (req, res, next) => {
  try {
    const user = req.user;
    const notifications = await Notification.find({
      $or: [{ recipient: user._id }, { recipientUserId: user.userId }],
    }).sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.read).length;

    res.json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark Conductor Notification as Read
// @route   PATCH /api/conductor/notifications/:id/read
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(id, { read: true }, { new: true });
    res.json(notification);
  } catch (err) {
    next(err);
  }
};
