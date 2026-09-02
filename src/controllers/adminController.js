import { Operator } from '../models/Operator.js';
import { Bus } from '../models/Bus.js';
import { Route } from '../models/Route.js';
import { Schedule } from '../models/Schedule.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';

// Helper to record audit log defensively
const recordAuditLog = async (req, action, targetResource, targetId, reason, details = {}) => {
  try {
    await AuditLog.create({
      adminId: req.user?._id,
      adminName: req.user?.name || 'System Admin',
      adminEmail: req.user?.email || 'admin@lankaexpressway.lk',
      action,
      targetResource,
      targetId: targetId ? targetId.toString() : 'N/A',
      reason: reason || 'N/A',
      details,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
    });
  } catch (err) {
    console.error('❌ Failed to create audit log:', err.message);
  }
};

// ==========================================
// 1. DASHBOARD ANALYTICS
// ==========================================
export const getDashboardStats = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const totalUsers = (await User.countDocuments()) || 0;
    const totalBookings = (await Booking.countDocuments()) || 0;
    const todaysBookings =
      (await Booking.countDocuments({
        $or: [{ bookingDate: todayStr }, { createdAt: { $gte: new Date(todayStr) } }],
      })) || 0;

    const activeBookings = (await Booking.find({ status: 'Active', paymentStatus: 'Paid' })) || [];
    const ticketRevenue = activeBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const activeBuses = (await Bus.countDocuments({ status: 'Active' })) || 0;
    const pendingPayments = (await WalletTransaction.countDocuments({ status: 'PENDING' })) || 0;
    const cancelledBookings = (await Booking.countDocuments({ status: 'Cancelled' })) || 0;

    // Wallet Top-Up Stats (Separated from ticket revenue)
    const topupTransactions = (await WalletTransaction.find({ reason: 'WALLET_TOPUP', status: 'COMPLETED' })) || [];
    const walletTopUpStats = {
      totalTopUpsAmount: topupTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      topUpCount: topupTransactions.length,
    };

    // Booking & Revenue Analytics by Route
    const routes = (await Route.find()) || [];
    const routeStatsMap = {};

    for (const r of routes) {
      if (r && r.routeNo) {
        routeStatsMap[r.routeNo] = {
          routeNo: r.routeNo,
          routeName: `${r.fromCity || 'Origin'} ➔ ${r.toCity || 'Destination'}`,
          bookingCount: 0,
          revenue: 0,
        };
      }
    }

    const allBookings = (await Booking.find().populate('schedule')) || [];
    for (const b of allBookings) {
      if (b && b.status === 'Active') {
        const sched = b.schedule;
        const rId = sched && sched.routeId ? sched.routeId : b.scheduleId;
        if (rId && routeStatsMap[rId]) {
          routeStatsMap[rId].bookingCount += 1;
          routeStatsMap[rId].revenue += b.totalAmount || 0;
        }
      }
    }

    const popularRoutes = Object.values(routeStatsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const recentBookings = (await Booking.find().sort({ createdAt: -1 }).limit(10)) || [];
    const recentPayments =
      (await WalletTransaction.find({ status: 'COMPLETED' })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)) || [];

    res.json({
      success: true,
      data: {
        kpis: {
          totalUsers,
          totalBookings,
          todaysBookings,
          ticketRevenue,
          activeBuses,
          pendingPayments,
          cancelledBookings,
          walletTopUpAmount: walletTopUpStats.totalTopUpsAmount,
          walletTopUpCount: walletTopUpStats.topUpCount,
        },
        popularRoutes,
        recentBookings,
        recentPayments,
      },
    });
  } catch (err) {
    console.error('❌ Error in getDashboardStats:', err);
    next(err);
  }
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================
export const getUsersAdmin = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) query.role = role;
    if (status) query.status = status;

    const users = (await User.find(query).select('-password').sort({ createdAt: -1 })) || [];
    const wallets = (await Wallet.find()) || [];

    const transformedUsers = users.map((u) => {
      const userWallet = wallets.find((w) => w.userId && w.userId.toString() === u._id.toString());
      return {
        _id: u._id,
        userId: u.userId,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        walletBalance: userWallet ? userWallet.balance || 0 : 0,
        createdAt: u.createdAt,
      };
    });

    res.json({ success: true, data: transformedUsers });
  } catch (err) {
    console.error('❌ Error in getUsersAdmin:', err);
    next(err);
  }
};

export const getUserByIdAdmin = async (req, res, next) => {
  try {
    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const user = await User.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { userId: paramId }],
    }).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: user._id, userStrId: user.userId, balance: 0 });
    }

    const transactions = (await WalletTransaction.find({ userId: user._id }).sort({ createdAt: -1 })) || [];
    const bookings = (await Booking.find({ $or: [{ user: user._id }, { userId: user.userId }] }).sort({ createdAt: -1 })) || [];

    res.json({
      success: true,
      data: {
        user,
        wallet,
        transactions,
        bookings,
      },
    });
  } catch (err) {
    console.error('❌ Error in getUserByIdAdmin:', err);
    next(err);
  }
};

export const updateUserStatusAdmin = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['Active', 'Suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const user = await User.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { userId: paramId }],
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const prevStatus = user.status;
    user.status = status;
    await user.save();

    await recordAuditLog(
      req,
      status === 'Suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
      'User',
      user._id,
      reason || `User account status changed from ${prevStatus} to ${status}`,
      { prevStatus, newStatus: status, userId: user.userId, email: user.email }
    );

    res.json({ success: true, message: `User status updated to ${status}`, data: user });
  } catch (err) {
    console.error('❌ Error in updateUserStatusAdmin:', err);
    next(err);
  }
};

// ==========================================
// 3. ADMIN WALLET ADJUSTMENT
// ==========================================
export const adminWalletAdjustment = async (req, res, next) => {
  try {
    const { type, amount, reason } = req.body;
    const adjAmount = parseFloat(amount);

    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Adjustment type must be CREDIT or DEBIT' });
    }

    if (isNaN(adjAmount) || adjAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Reason for wallet adjustment is required' });
    }

    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const user = await User.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { userId: paramId }],
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: user._id, userStrId: user.userId, balance: 0 });
    }

    const balanceBefore = wallet.balance || 0;
    let balanceAfter = balanceBefore;

    if (type === 'CREDIT') {
      balanceAfter += adjAmount;
    } else {
      if (balanceBefore < adjAmount) {
        return res.status(400).json({
          success: false,
          message: `Cannot debit LKR ${adjAmount.toFixed(2)}. Current balance is only LKR ${balanceBefore.toFixed(2)}. Negative balances are forbidden.`,
        });
      }
      balanceAfter -= adjAmount;
    }

    wallet.balance = balanceAfter;
    await wallet.save();

    const transaction = await WalletTransaction.create({
      userId: user._id,
      userStrId: user.userId,
      walletId: wallet._id,
      type,
      reason: 'ADMIN_ADJUSTMENT',
      amount: adjAmount,
      balanceBefore,
      balanceAfter,
      status: 'COMPLETED',
      gateway: 'INTERNAL_WALLET',
      notes: `Admin Adjustment (${type}): ${reason} [By ${req.user?.email || 'Admin'}]`,
    });

    await recordAuditLog(req, 'ADMIN_ADJUSTMENT', 'Wallet', wallet._id, reason, {
      userId: user.userId,
      userEmail: user.email,
      adjustmentType: type,
      amount: adjAmount,
      balanceBefore,
      balanceAfter,
      transactionId: transaction._id,
    });

    res.json({
      success: true,
      message: `Successfully ${type === 'CREDIT' ? 'credited' : 'debited'} LKR ${adjAmount.toFixed(2)} ${type === 'CREDIT' ? 'to' : 'from'} user wallet`,
      data: {
        newBalance: balanceAfter,
        transaction,
      },
    });
  } catch (err) {
    console.error('❌ Error in adminWalletAdjustment:', err);
    next(err);
  }
};

// ==========================================
// 4. BUS MANAGEMENT
// ==========================================
export const getBusesAdmin = async (req, res, next) => {
  try {
    const buses = (await Bus.find().populate('operator').sort({ createdAt: -1 })) || [];
    res.json({ success: true, data: buses });
  } catch (err) {
    console.error('❌ Error in getBusesAdmin:', err);
    next(err);
  }
};

export const createBusAdmin = async (req, res, next) => {
  try {
    const { busNo, name, model, busType, serviceCategory, seatLayout, totalSeats, facilities, operatorId, status } = req.body;

    if (!name || !busType || !operatorId) {
      return res.status(400).json({ success: false, message: 'Name, Bus Type, and Operator are required' });
    }

    const busId = `B-${Math.floor(100 + Math.random() * 900)}`;

    const bus = await Bus.create({
      busId,
      busNo: busNo || `NC-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      model: model || 'Volvo 9400 B11R',
      busType,
      serviceCategory: serviceCategory || 'Super Luxury',
      seatLayout: seatLayout || '2+2',
      totalSeats: totalSeats ? parseInt(totalSeats) : 40,
      facilities: facilities || ['Air Conditioning', 'Reclining Seats'],
      operatorId,
      status: status || 'Active',
    });

    await recordAuditLog(req, 'CREATE_BUS', 'Bus', bus._id, `Created new bus ${bus.name} (${bus.busId})`, { bus });

    res.status(201).json({ success: true, message: 'Bus created successfully', data: bus });
  } catch (err) {
    console.error('❌ Error in createBusAdmin:', err);
    next(err);
  }
};

export const updateBusAdmin = async (req, res, next) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    await recordAuditLog(req, 'UPDATE_BUS', 'Bus', bus._id, `Updated bus ${bus.name}`, { updatedFields: req.body });

    res.json({ success: true, message: 'Bus updated successfully', data: bus });
  } catch (err) {
    console.error('❌ Error in updateBusAdmin:', err);
    next(err);
  }
};

export const deleteBusAdmin = async (req, res, next) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    await recordAuditLog(req, 'DELETE_BUS', 'Bus', bus._id, `Deleted bus ${bus.name} (${bus.busId})`, { bus });

    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (err) {
    console.error('❌ Error in deleteBusAdmin:', err);
    next(err);
  }
};

// ==========================================
// 5. OPERATOR MANAGEMENT
// ==========================================
export const getOperatorsAdmin = async (req, res, next) => {
  try {
    const operators = (await Operator.find().sort({ createdAt: -1 })) || [];
    res.json({ success: true, data: operators });
  } catch (err) {
    console.error('❌ Error in getOperatorsAdmin:', err);
    next(err);
  }
};

export const createOperatorAdmin = async (req, res, next) => {
  try {
    const { name, contactNumber, email, website, operatorType, serviceCategory, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Operator name is required' });

    const operatorId = `OP-${Math.floor(100 + Math.random() * 900)}`;

    const operator = await Operator.create({
      operatorId,
      name,
      contactNumber: contactNumber || '+94 11 200 0000',
      email: email || 'contact@operator.lk',
      website: website || 'https://operator.lk',
      operatorType: operatorType || 'Private',
      serviceCategory: serviceCategory || 'Super Luxury',
      status: status || 'Active',
    });

    await recordAuditLog(req, 'CREATE_OPERATOR', 'Operator', operator._id, `Created operator ${operator.name}`, { operator });

    res.status(201).json({ success: true, message: 'Operator created successfully', data: operator });
  } catch (err) {
    console.error('❌ Error in createOperatorAdmin:', err);
    next(err);
  }
};

export const updateOperatorAdmin = async (req, res, next) => {
  try {
    const operator = await Operator.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!operator) return res.status(404).json({ success: false, message: 'Operator not found' });

    await recordAuditLog(req, 'UPDATE_OPERATOR', 'Operator', operator._id, `Updated operator ${operator.name}`, { updatedFields: req.body });

    res.json({ success: true, message: 'Operator updated successfully', data: operator });
  } catch (err) {
    console.error('❌ Error in updateOperatorAdmin:', err);
    next(err);
  }
};

export const deleteOperatorAdmin = async (req, res, next) => {
  try {
    const operator = await Operator.findByIdAndDelete(req.params.id);
    if (!operator) return res.status(404).json({ success: false, message: 'Operator not found' });

    await recordAuditLog(req, 'DELETE_OPERATOR', 'Operator', operator._id, `Deleted operator ${operator.name}`, { operator });

    res.json({ success: true, message: 'Operator deleted successfully' });
  } catch (err) {
    console.error('❌ Error in deleteOperatorAdmin:', err);
    next(err);
  }
};

// ==========================================
// 6. ROUTE MANAGEMENT
// ==========================================
export const getRoutesAdmin = async (req, res, next) => {
  try {
    const routes = (await Route.find().sort({ createdAt: -1 })) || [];
    res.json({ success: true, data: routes });
  } catch (err) {
    console.error('❌ Error in getRoutesAdmin:', err);
    next(err);
  }
};

export const createRouteAdmin = async (req, res, next) => {
  try {
    const { routeNo, name, fromCity, toCity, boardingPoints, droppingPoints, highwayRoute, distanceKm, tollFee, status } = req.body;

    if (!routeNo || !fromCity || !toCity) {
      return res.status(400).json({ success: false, message: 'Route Number, From City, and To City are required' });
    }

    const routeId = `R-${Math.floor(100 + Math.random() * 900)}`;

    const route = await Route.create({
      routeId,
      routeNo,
      name: name || `${fromCity} - ${toCity} Expressway`,
      fromCity,
      toCity,
      boardingPoints: boardingPoints || [fromCity],
      droppingPoints: droppingPoints || [toCity],
      highwayRoute: highwayRoute || 'E01 Southern Expressway',
      distanceKm: distanceKm || '120 km',
      tollFee: tollFee || 500,
      status: status || 'Active',
    });

    await recordAuditLog(req, 'CREATE_ROUTE', 'Route', route._id, `Created route ${route.routeNo} (${fromCity} ➔ ${toCity})`, { route });

    res.status(201).json({ success: true, message: 'Route created successfully', data: route });
  } catch (err) {
    console.error('❌ Error in createRouteAdmin:', err);
    next(err);
  }
};

export const updateRouteAdmin = async (req, res, next) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    await recordAuditLog(req, 'UPDATE_ROUTE', 'Route', route._id, `Updated route ${route.routeNo}`, { updatedFields: req.body });

    res.json({ success: true, message: 'Route updated successfully', data: route });
  } catch (err) {
    console.error('❌ Error in updateRouteAdmin:', err);
    next(err);
  }
};

export const deleteRouteAdmin = async (req, res, next) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    await recordAuditLog(req, 'DELETE_ROUTE', 'Route', route._id, `Deleted route ${route.routeNo}`, { route });

    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err) {
    console.error('❌ Error in deleteRouteAdmin:', err);
    next(err);
  }
};

// ==========================================
// 7. SCHEDULE & SEAT MANAGEMENT
// ==========================================
export const getSchedulesAdmin = async (req, res, next) => {
  try {
    const schedules = (await Schedule.find().populate('bus route').sort({ createdAt: -1 })) || [];
    res.json({ success: true, data: schedules });
  } catch (err) {
    console.error('❌ Error in getSchedulesAdmin:', err);
    next(err);
  }
};

export const createScheduleAdmin = async (req, res, next) => {
  try {
    const { busId, routeId, departureTime, arrivalTime, duration, operatingDays, fare, status } = req.body;

    if (!busId || !routeId || !departureTime || !fare) {
      return res.status(400).json({ success: false, message: 'Bus, Route, Departure Time, and Fare are required' });
    }

    const scheduleId = `S-${Math.floor(100 + Math.random() * 900)}`;

    const schedule = await Schedule.create({
      scheduleId,
      busId,
      routeId,
      departureTime,
      arrivalTime: arrivalTime || '12:00 PM',
      duration: duration || '2h 30m',
      operatingDays: operatingDays || 'Daily',
      fare: parseFloat(fare),
      reservedSeats: [],
      status: status || 'Active',
    });

    await recordAuditLog(req, 'CREATE_SCHEDULE', 'Schedule', schedule._id, `Created schedule ${schedule.scheduleId}`, { schedule });

    res.status(201).json({ success: true, message: 'Schedule created successfully', data: schedule });
  } catch (err) {
    console.error('❌ Error in createScheduleAdmin:', err);
    next(err);
  }
};

export const updateScheduleAdmin = async (req, res, next) => {
  try {
    const prevSched = await Schedule.findById(req.params.id);
    if (!prevSched) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (req.body.fare && req.body.fare !== prevSched.fare) {
      await recordAuditLog(req, 'UPDATE_FARE', 'Schedule', schedule._id, `Updated fare for ${schedule.scheduleId} from ${prevSched.fare} to ${req.body.fare}`, {
        oldFare: prevSched.fare,
        newFare: req.body.fare,
      });
    } else {
      await recordAuditLog(req, 'UPDATE_SCHEDULE', 'Schedule', schedule._id, `Updated schedule ${schedule.scheduleId}`, { updatedFields: req.body });
    }

    res.json({ success: true, message: 'Schedule updated successfully', data: schedule });
  } catch (err) {
    console.error('❌ Error in updateScheduleAdmin:', err);
    next(err);
  }
};

export const deleteScheduleAdmin = async (req, res, next) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    await recordAuditLog(req, 'DELETE_SCHEDULE', 'Schedule', schedule._id, `Deleted schedule ${schedule.scheduleId}`, { schedule });

    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (err) {
    console.error('❌ Error in deleteScheduleAdmin:', err);
    next(err);
  }
};

export const getScheduleSeatsAdmin = async (req, res, next) => {
  try {
    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const schedule = await Schedule.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { scheduleId: paramId }],
    }).populate('bus');

    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const activeBookings = (await Booking.find({ scheduleId: schedule.scheduleId, status: 'Active' })) || [];

    const bookedSeatsMap = {};
    activeBookings.forEach((b) => {
      if (Array.isArray(b.seats)) {
        b.seats.forEach((seat) => {
          bookedSeatsMap[seat] = {
            bookingRef: b.bookingRef,
            passengerName: b.passengerName || 'Passenger',
            passengerPhone: b.passengerPhone || '',
          };
        });
      }
    });

    res.json({
      success: true,
      data: {
        scheduleId: schedule.scheduleId,
        bus: schedule.bus,
        reservedSeats: schedule.reservedSeats || [],
        bookedSeatsMap,
      },
    });
  } catch (err) {
    console.error('❌ Error in getScheduleSeatsAdmin:', err);
    next(err);
  }
};

export const updateScheduleSeatsAdmin = async (req, res, next) => {
  try {
    const { action, seat } = req.body;
    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const schedule = await Schedule.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { scheduleId: paramId }],
    });

    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    let currentReserved = schedule.reservedSeats || [];

    if (action === 'RESERVE') {
      if (currentReserved.includes(seat)) {
        return res.status(400).json({ success: false, message: `Seat ${seat} is already reserved or booked.` });
      }
      currentReserved.push(seat);
    } else if (action === 'RELEASE') {
      const activeBooking = await Booking.findOne({ scheduleId: schedule.scheduleId, seats: seat, status: 'Active' });
      if (activeBooking) {
        return res.status(400).json({
          success: false,
          message: `Cannot manually release seat ${seat} because it belongs to an active paid booking (${activeBooking.bookingRef}). Cancel the booking first to safely release seats.`,
        });
      }
      currentReserved = currentReserved.filter((s) => s !== seat);
    }

    schedule.reservedSeats = currentReserved;
    await schedule.save();

    await recordAuditLog(req, 'UPDATE_SEATS', 'Schedule', schedule._id, `Admin ${action.toLowerCase()}d seat ${seat} on schedule ${schedule.scheduleId}`, { seat, action });

    res.json({ success: true, message: `Seat ${seat} ${action.toLowerCase()}d successfully`, reservedSeats: schedule.reservedSeats });
  } catch (err) {
    console.error('❌ Error in updateScheduleSeatsAdmin:', err);
    next(err);
  }
};

// ==========================================
// 8. BOOKINGS & REFUNDS MANAGEMENT
// ==========================================
export const getBookingsAdmin = async (req, res, next) => {
  try {
    const { search, status, paymentStatus, startDate, endDate } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { bookingRef: { $regex: search, $options: 'i' } },
        { passengerName: { $regex: search, $options: 'i' } },
        { passengerEmail: { $regex: search, $options: 'i' } },
        { passengerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) query.bookingDate.$gte = startDate;
      if (endDate) query.bookingDate.$lte = endDate;
    }

    const bookings = (await Booking.find(query).populate('schedule user').sort({ createdAt: -1 })) || [];

    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('❌ Error in getBookingsAdmin:', err);
    next(err);
  }
};

export const getBookingByIdAdmin = async (req, res, next) => {
  try {
    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const booking = await Booking.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { bookingRef: paramId }],
    }).populate('schedule user');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('❌ Error in getBookingByIdAdmin:', err);
    next(err);
  }
};

export const cancelBookingAdmin = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const paramId = req.params.id;
    const isObjectId = paramId && paramId.match(/^[0-9a-fA-F]{24}$/);

    const booking = await Booking.findOne({
      $or: [{ _id: isObjectId ? paramId : null }, { bookingRef: paramId }],
    });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled and processed' });
    }

    // Guard: Prevent duplicate refund
    const existingRefund = await WalletTransaction.findOne({
      bookingRef: booking.bookingRef,
      reason: 'BOOKING_REFUND',
      status: 'COMPLETED',
    });

    if (existingRefund) {
      return res.status(400).json({ success: false, message: 'Refund for this booking has already been completed' });
    }

    booking.status = 'Cancelled';
    booking.paymentStatus = 'Refunded';
    await booking.save();

    // Release seats from Schedule
    const schedule = await Schedule.findOne({
      $or: [{ scheduleId: booking.scheduleId }, { _id: booking.schedule }],
    });

    if (schedule) {
      const remainingSeats = (schedule.reservedSeats || []).filter((seat) => !(booking.seats || []).includes(seat));
      await Schedule.findByIdAndUpdate(schedule._id, { reservedSeats: remainingSeats });
    }

    // Process refund to user wallet if user exists
    let refundMessage = `Booking ${booking.bookingRef} cancelled by admin`;
    const userDoc = booking.user ? await User.findById(booking.user) : await User.findOne({ userId: booking.userId });

    if (userDoc) {
      let wallet = await Wallet.findOne({ userId: userDoc._id });
      if (!wallet) {
        wallet = await Wallet.create({ userId: userDoc._id, userStrId: userDoc.userId, balance: 0 });
      }

      const balanceBefore = wallet.balance || 0;
      const refundAmount = booking.totalAmount || 0;
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
        notes: `Admin refund for cancelled booking ${booking.bookingRef} (${reason || 'Admin Action'})`,
      });

      refundMessage += `. LKR ${refundAmount.toFixed(2)} refunded to user digital wallet.`;
    }

    await recordAuditLog(req, 'CANCEL_BOOKING', 'Booking', booking._id, reason || 'Admin cancelled booking & processed refund', {
      bookingRef: booking.bookingRef,
      refundAmount: booking.totalAmount,
    });

    res.json({ success: true, message: refundMessage, data: booking });
  } catch (err) {
    console.error('❌ Error in cancelBookingAdmin:', err);
    next(err);
  }
};

// ==========================================
// 9. WALLET & FINANCIAL LEDGER
// ==========================================
export const getWalletsAdmin = async (req, res, next) => {
  try {
    const wallets = (await Wallet.find().populate('userId', 'name email role phone status').sort({ balance: -1 })) || [];
    const allTx = (await WalletTransaction.find({ status: 'COMPLETED' })) || [];

    const transformedWallets = wallets.map((w) => {
      const wIdStr = w.userId?._id ? w.userId._id.toString() : (w.userId ? w.userId.toString() : '');
      const userTx = allTx.filter((t) => {
        const tIdStr = t.userId ? t.userId.toString() : '';
        return tIdStr && wIdStr && tIdStr === wIdStr;
      });

      const totalTopUps = userTx.filter((t) => t.reason === 'WALLET_TOPUP').reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalTicketSpending = userTx.filter((t) => t.reason === 'TICKET_PAYMENT').reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRefunds = userTx.filter((t) => t.reason === 'BOOKING_REFUND').reduce((sum, t) => sum + (t.amount || 0), 0);

      return {
        _id: w._id,
        user: w.userId,
        userStrId: w.userStrId || 'N/A',
        balance: w.balance || 0,
        currency: w.currency || 'LKR',
        status: w.status || 'ACTIVE',
        totalTopUps,
        totalTicketSpending,
        totalRefunds,
        updatedAt: w.updatedAt,
      };
    });

    res.json({ success: true, data: transformedWallets });
  } catch (err) {
    console.error('❌ Error in getWalletsAdmin:', err);
    next(err);
  }
};

export const getWalletTransactionsAdmin = async (req, res, next) => {
  try {
    const transactions =
      (await WalletTransaction.find()
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(300)) || [];

    res.json({ success: true, data: transactions });
  } catch (err) {
    console.error('❌ Error in getWalletTransactionsAdmin:', err);
    next(err);
  }
};

export const getPaymentsAdmin = async (req, res, next) => {
  try {
    const payments =
      (await WalletTransaction.find({ gateway: 'PAYHERE' })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })) || [];

    res.json({ success: true, data: payments });
  } catch (err) {
    console.error('❌ Error in getPaymentsAdmin:', err);
    next(err);
  }
};

export const getRefundsAdmin = async (req, res, next) => {
  try {
    const refunds =
      (await WalletTransaction.find({ reason: 'BOOKING_REFUND' })
        .populate('userId bookingId', 'name email bookingRef totalAmount')
        .sort({ createdAt: -1 })) || [];

    res.json({ success: true, data: refunds });
  } catch (err) {
    console.error('❌ Error in getRefundsAdmin:', err);
    next(err);
  }
};

// ==========================================
// 10. REPORTS GENERATOR
// ==========================================
export const getReportsAdmin = async (req, res, next) => {
  try {
    const { startDate, endDate, month } = req.query;
    let dateFilter = {};

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const mIndex = parseInt(monthStr, 10) - 1;
      const startOfMonth = new Date(year, mIndex, 1);
      const endOfMonth = new Date(year, mIndex + 1, 0, 23, 59, 59);
      dateFilter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const bookings = (await Booking.find(dateFilter).populate({
      path: 'schedule',
      populate: [{ path: 'route' }, { path: 'bus' }],
    })) || [];

    const transactions = (await WalletTransaction.find(dateFilter)) || [];

    const activeBookings = bookings.filter((b) => b.status === 'Active' && b.paymentStatus === 'Paid');
    const totalTicketRevenue = activeBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const topups = transactions.filter((t) => t.reason === 'WALLET_TOPUP' && t.status === 'COMPLETED');
    const totalWalletTopUps = topups.reduce((sum, t) => sum + (t.amount || 0), 0);

    const refunds = transactions.filter((t) => t.reason === 'BOOKING_REFUND' && t.status === 'COMPLETED');
    const totalRefunds = refunds.reduce((sum, t) => sum + (t.amount || 0), 0);

    const netRevenue = totalTicketRevenue + totalWalletTopUps - totalRefunds;

    // Route-wise revenue breakdown
    const routeBreakdownMap = {};
    activeBookings.forEach((b) => {
      let routeName = 'Expressway Route';
      if (b.schedule && typeof b.schedule === 'object' && b.schedule.route) {
        routeName = `${b.schedule.route.from} ➔ ${b.schedule.route.to}`;
      } else if (b.routeId) {
        routeName = b.routeId;
      }

      if (!routeBreakdownMap[routeName]) {
        routeBreakdownMap[routeName] = { routeName, bookingsCount: 0, passengersCount: 0, revenue: 0 };
      }
      routeBreakdownMap[routeName].bookingsCount += 1;
      routeBreakdownMap[routeName].passengersCount += (b.seats ? b.seats.length : 1);
      routeBreakdownMap[routeName].revenue += (b.totalAmount || 0);
    });

    const routeBreakdown = Object.values(routeBreakdownMap).sort((a, b) => b.revenue - a.revenue);

    // Payment method breakdown
    const paymentMethodMap = { Wallet: 0, Card: 0, LankaQR: 0, Online: 0 };
    activeBookings.forEach((b) => {
      const method = b.paymentMethod || 'Online';
      paymentMethodMap[method] = (paymentMethodMap[method] || 0) + (b.totalAmount || 0);
    });

    // Departure time popularity
    const departureTimeCountMap = {};
    activeBookings.forEach((b) => {
      const time = (typeof b.schedule === 'object' && b.schedule?.departureTime) ? b.schedule.departureTime : '08:00 AM';
      departureTimeCountMap[time] = (departureTimeCountMap[time] || 0) + 1;
    });

    const popularTravelTimes = Object.entries(departureTimeCountMap)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => b.count - a.count);

    // Recent detailed bookings for report view
    const reportBookings = activeBookings.slice(0, 50).map((b) => ({
      ref: b.bookingRef,
      date: b.bookingDate || new Date(b.createdAt).toISOString().split('T')[0],
      passenger: b.passengerName,
      route: b.schedule?.route ? `${b.schedule.route.from} ➔ ${b.schedule.route.to}` : 'Expressway',
      seats: b.seats ? b.seats.join(', ') : 'N/A',
      amount: b.totalAmount,
      method: b.paymentMethod || 'Online',
      status: b.boardingStatus || 'Pending',
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalBookings: bookings.length,
          activeBookingsCount: activeBookings.length,
          totalTicketRevenue,
          totalWalletTopUps,
          totalRefunds,
          netRevenue,
        },
        routeBreakdown,
        paymentMethodBreakdown: paymentMethodMap,
        popularTravelTimes,
        reportBookings,
        topupsCount: topups.length,
        refundsCount: refunds.length,
      },
    });
  } catch (err) {
    console.error('❌ Error in getReportsAdmin:', err);
    next(err);
  }
};

// ==========================================
// 11. NOTIFICATIONS FEED & AUDIT LOGS
// ==========================================
export const getNotificationsAdmin = async (req, res, next) => {
  try {
    const recentBookings = (await Booking.find().sort({ createdAt: -1 }).limit(5)) || [];
    const recentRefunds = (await WalletTransaction.find({ reason: 'BOOKING_REFUND' }).sort({ createdAt: -1 }).limit(5)) || [];
    const recentTopups = (await WalletTransaction.find({ reason: 'WALLET_TOPUP', status: 'COMPLETED' }).sort({ createdAt: -1 }).limit(5)) || [];

    const notifications = [
      ...recentBookings.map((b) => ({
        id: `notif_b_${b._id}`,
        title: 'New Ticket Booking',
        message: `Booking ${b.bookingRef} reserved by ${b.passengerName || 'Passenger'} (LKR ${b.totalAmount || 0})`,
        type: 'booking',
        timestamp: b.createdAt,
      })),
      ...recentRefunds.map((r) => ({
        id: `notif_r_${r._id}`,
        title: 'Ticket Refund Processed',
        message: `LKR ${r.amount || 0} refunded for booking ${r.bookingRef || 'Ref'}`,
        type: 'refund',
        timestamp: r.createdAt,
      })),
      ...recentTopups.map((t) => ({
        id: `notif_t_${t._id}`,
        title: 'Wallet Top-Up Success',
        message: `User ${t.userStrId || 'User'} topped up LKR ${t.amount || 0} via PayHere`,
        type: 'payment',
        timestamp: t.createdAt,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('❌ Error in getNotificationsAdmin:', err);
    next(err);
  }
};

export const getAuditLogsAdmin = async (req, res, next) => {
  try {
    const { action, targetResource } = req.query;
    let query = {};
    if (action) query.action = action;
    if (targetResource) query.targetResource = targetResource;

    const logs = (await AuditLog.find(query).sort({ createdAt: -1 }).limit(200)) || [];
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('❌ Error in getAuditLogsAdmin:', err);
    next(err);
  }
};

// ==========================================
// 12. ADMIN PROFILE & AUTH
// ==========================================
export const getAdminProfile = async (req, res, next) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (err) {
    console.error('❌ Error in getAdminProfile:', err);
    next(err);
  }
};

export const updateAdminProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    user.name = name || user.name;
    user.phone = phone || user.phone;
    await user.save();

    await recordAuditLog(req, 'UPDATE_PROFILE', 'System', user._id, 'Admin updated profile information');

    res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (err) {
    console.error('❌ Error in updateAdminProfile:', err);
    next(err);
  }
};

export const changeAdminPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    await recordAuditLog(req, 'UPDATE_PROFILE', 'System', user._id, 'Admin changed account password');

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Error in changeAdminPassword:', err);
    next(err);
  }
};

// ==========================================
// 13. CONDUCTOR MANAGEMENT & BOARDING MONITORING
// ==========================================
export const getConductorsAdmin = async (req, res, next) => {
  try {
    const conductors = await User.find({ role: 'conductor' }).select('-password').sort({ createdAt: -1 });
    const schedules = await Schedule.find({ status: 'Active' }).populate('bus').populate('route');

    const transformed = conductors.map((c) => {
      const assignedSchedules = schedules.filter(
        (s) => (s.conductor && s.conductor.toString() === c._id.toString()) || s.conductorId === c.userId || s.conductorId === c.employeeId
      );

      return {
        _id: c._id,
        id: c.userId,
        userId: c.userId,
        employeeId: c.employeeId || c.userId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
        role: c.role,
        assignedBuses: c.assignedBuses || [],
        conductorPermissions: c.conductorPermissions || {
          maxBusesAllowed: 2,
          canScanQR: true,
          canIssueTickets: true,
          canCancelBoarding: true,
        },
        assignedSchedules,
        assignedCount: assignedSchedules.length,
        createdAt: c.createdAt,
      };
    });

    res.json({ success: true, data: transformed });
  } catch (err) {
    console.error('❌ Error in getConductorsAdmin:', err);
    next(err);
  }
};

export const createConductorAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone, employeeId, assignedBuses, conductorPermissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userId = `cond_${Math.floor(1000 + Math.random() * 9000)}`;
    const empId = employeeId || `EMP-${Math.floor(100 + Math.random() * 900)}`;

    const conductor = await User.create({
      userId,
      employeeId: empId,
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || '+94 77 000 0000',
      role: 'conductor',
      status: 'Active',
      assignedBuses: Array.isArray(assignedBuses) ? assignedBuses : [],
      conductorPermissions: conductorPermissions || {
        maxBusesAllowed: 2,
        canScanQR: true,
        canIssueTickets: true,
        canCancelBoarding: true,
      },
    });

    await recordAuditLog(req, 'CREATE_CONDUCTOR', 'Conductor', conductor._id, `Created conductor account ${conductor.name} (${empId})`);

    res.status(201).json({
      success: true,
      message: 'Conductor created successfully',
      data: {
        _id: conductor._id,
        userId: conductor.userId,
        employeeId: conductor.employeeId,
        name: conductor.name,
        email: conductor.email,
        phone: conductor.phone,
        status: conductor.status,
        assignedBuses: conductor.assignedBuses,
        conductorPermissions: conductor.conductorPermissions,
      },
    });
  } catch (err) {
    console.error('❌ Error in createConductorAdmin:', err);
    next(err);
  }
};

export const updateConductorAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, employeeId, password, assignedBuses, conductorPermissions } = req.body;

    const conductor = await User.findOne({
      $or: [{ userId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
      role: 'conductor',
    });

    if (!conductor) {
      return res.status(404).json({ success: false, message: 'Conductor not found' });
    }

    if (name !== undefined) conductor.name = name;
    if (phone !== undefined) conductor.phone = phone;
    if (employeeId !== undefined) conductor.employeeId = employeeId;
    if (password) conductor.password = password;
    if (assignedBuses !== undefined) conductor.assignedBuses = assignedBuses;
    if (conductorPermissions !== undefined) {
      conductor.conductorPermissions = {
        ...conductor.conductorPermissions,
        ...conductorPermissions,
      };
    }

    await conductor.save();

    await recordAuditLog(req, 'UPDATE_CONDUCTOR', 'Conductor', conductor._id, `Updated conductor details for ${conductor.name}`);

    res.json({ success: true, message: 'Conductor updated successfully', data: conductor });
  } catch (err) {
    console.error('❌ Error in updateConductorAdmin:', err);
    next(err);
  }
};

export const updateConductorStatusAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const conductor = await User.findOne({
      $or: [{ userId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!conductor) {
      return res.status(404).json({ success: false, message: 'Conductor not found' });
    }

    conductor.status = status;
    await conductor.save();

    const action = status === 'Active' ? 'ACTIVATE_CONDUCTOR' : 'SUSPEND_CONDUCTOR';
    await recordAuditLog(req, action, 'Conductor', conductor._id, `Set conductor ${conductor.name} status to ${status}`);

    res.json({ success: true, message: `Conductor status updated to ${status}`, data: conductor });
  } catch (err) {
    console.error('❌ Error in updateConductorStatusAdmin:', err);
    next(err);
  }
};

export const assignConductorToScheduleAdmin = async (req, res, next) => {
  try {
    const { id } = req.params; // scheduleId
    const { conductorId } = req.body; // conductor Mongo _id or userId

    const schedule = await Schedule.findOne({
      $or: [{ scheduleId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (!conductorId) {
      // Remove conductor
      schedule.conductor = undefined;
      schedule.conductorId = undefined;
      await schedule.save();
      await recordAuditLog(req, 'REMOVE_CONDUCTOR', 'Schedule', schedule._id, `Removed conductor assignment from schedule ${schedule.scheduleId}`);
      return res.json({ success: true, message: 'Conductor removed from schedule', data: schedule });
    }

    const conductor = await User.findOne({
      $or: [{ userId: conductorId }, { _id: conductorId.match(/^[0-9a-fA-F]{24}$/) ? conductorId : null }],
      role: 'conductor',
    });

    if (!conductor) {
      return res.status(404).json({ success: false, message: 'Conductor not found' });
    }

    schedule.conductor = conductor._id;
    schedule.conductorId = conductor.userId;
    await schedule.save();

    await recordAuditLog(req, 'ASSIGN_CONDUCTOR', 'Schedule', schedule._id, `Assigned conductor ${conductor.name} (${conductor.userId}) to schedule ${schedule.scheduleId}`);

    // Create Notification for Conductor
    await Notification.create({
      recipient: conductor._id,
      recipientUserId: conductor.userId,
      type: 'SCHEDULE_ASSIGNED',
      title: 'New Schedule Assigned',
      message: `You have been assigned to schedule ${schedule.scheduleId} (${schedule.departureTime}).`,
      scheduleId: schedule.scheduleId,
    });

    res.json({ success: true, message: `Assigned ${conductor.name} to schedule ${schedule.scheduleId}`, data: schedule });
  } catch (err) {
    console.error('❌ Error in assignConductorToScheduleAdmin:', err);
    next(err);
  }
};

export const removeConductorFromScheduleAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findOne({
      $or: [{ scheduleId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    schedule.conductor = undefined;
    schedule.conductorId = undefined;
    await schedule.save();

    await recordAuditLog(req, 'REMOVE_CONDUCTOR', 'Schedule', schedule._id, `Unassigned conductor from schedule ${schedule.scheduleId}`);

    res.json({ success: true, message: 'Conductor unassigned from schedule', data: schedule });
  } catch (err) {
    console.error('❌ Error in removeConductorFromScheduleAdmin:', err);
    next(err);
  }
};

export const getBoardingMonitoringAdmin = async (req, res, next) => {
  try {
    const schedules = await Schedule.find({ status: 'Active' })
      .populate('bus')
      .populate('route')
      .populate('conductor', 'name email phone employeeId userId');

    const scheduleIds = schedules.map((s) => s.scheduleId);
    const bookings = await Booking.find({ scheduleId: { $in: scheduleIds } });

    const monitoringData = schedules.map((sched) => {
      const schedBookings = bookings.filter((b) => b.scheduleId === sched.scheduleId);
      const totalBookings = schedBookings.length;
      const paidBookings = schedBookings.filter((b) => b.paymentStatus === 'Paid' && b.status === 'Active').length;
      const boarded = schedBookings.filter((b) => b.boardingStatus === 'Boarded').length;
      const pending = schedBookings.filter((b) => b.boardingStatus === 'Pending' && b.status === 'Active').length;
      const cancelled = schedBookings.filter((b) => b.status === 'Cancelled').length;
      const noShow = schedBookings.filter((b) => b.boardingStatus === 'No_Show').length;

      return {
        scheduleId: sched.scheduleId,
        _id: sched._id,
        departureTime: sched.departureTime,
        arrivalTime: sched.arrivalTime,
        busName: sched.bus?.name || 'Express Bus',
        busRegNo: sched.bus?.registrationNumber || sched.busId,
        routeName: sched.route ? `${sched.route.from} ➔ ${sched.route.to}` : sched.routeId,
        conductor: sched.conductor ? {
          _id: sched.conductor._id,
          name: sched.conductor.name,
          employeeId: sched.conductor.employeeId || sched.conductor.userId,
          phone: sched.conductor.phone,
        } : null,
        totalBookings,
        paidBookings,
        boarded,
        pending,
        cancelled,
        noShow,
      };
    });

    res.json({ success: true, data: monitoringData });
  } catch (err) {
    console.error('❌ Error in getBoardingMonitoringAdmin:', err);
    next(err);
  }
};

// ==========================================
// 14. SUPERADMIN ADMIN ACCESS MANAGEMENT
// ==========================================
export const getAdminUsersAdmin = async (req, res, next) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } })
      .select('-password')
      .sort({ createdAt: -1 });

    const transformed = admins.map((a) => ({
      _id: a._id,
      id: a.userId,
      userId: a.userId,
      name: a.name,
      email: a.email,
      phone: a.phone,
      role: a.role,
      status: a.status,
      adminPermissions: a.adminPermissions || [
        'manage_users',
        'manage_buses',
        'manage_routes',
        'manage_schedules',
        'manage_conductors',
        'manage_bookings',
        'manage_finances',
        'view_reports',
        'view_logs',
      ],
      createdAt: a.createdAt,
    }));

    res.json({ success: true, data: transformed });
  } catch (err) {
    console.error('❌ Error in getAdminUsersAdmin:', err);
    next(err);
  }
};

export const createAdminAccountAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, adminPermissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userId = `admin_${Math.floor(100 + Math.random() * 900)}`;

    const newAdmin = await User.create({
      userId,
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || '+94 77 000 0000',
      role: role === 'superadmin' ? 'superadmin' : 'admin',
      adminPermissions: Array.isArray(adminPermissions)
        ? adminPermissions
        : [
            'manage_users',
            'manage_buses',
            'manage_routes',
            'manage_schedules',
            'manage_conductors',
            'manage_bookings',
            'manage_finances',
            'view_reports',
            'view_logs',
          ],
      status: 'Active',
    });

    await recordAuditLog(
      req,
      'CREATE_ADMIN',
      'User',
      newAdmin._id,
      `SuperAdmin created new admin account ${newAdmin.name} (${newAdmin.email})`
    );

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      data: newAdmin,
    });
  } catch (err) {
    console.error('❌ Error in createAdminAccountAdmin:', err);
    next(err);
  }
};

export const updateAdminPermissionsAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, role, status, adminPermissions, password } = req.body;

    const adminUser = await User.findOne({
      $or: [{ userId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
      role: { $in: ['admin', 'superadmin'] },
    });

    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    if (name !== undefined) adminUser.name = name;
    if (phone !== undefined) adminUser.phone = phone;
    if (role !== undefined) adminUser.role = role;
    if (status !== undefined) adminUser.status = status;
    if (adminPermissions !== undefined && Array.isArray(adminPermissions)) {
      adminUser.adminPermissions = adminPermissions;
    }
    if (password) adminUser.password = password;

    await adminUser.save();

    await recordAuditLog(
      req,
      'UPDATE_ADMIN_PERMISSIONS',
      'User',
      adminUser._id,
      `SuperAdmin updated permissions for admin ${adminUser.name} (${adminUser.email})`
    );

    res.json({
      success: true,
      message: 'Admin permissions updated successfully',
      data: adminUser,
    });
  } catch (err) {
    console.error('❌ Error in updateAdminPermissionsAdmin:', err);
    next(err);
  }
};


