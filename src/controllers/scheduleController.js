import { Schedule } from '../models/Schedule.js';
import { Bus } from '../models/Bus.js';
import { Route } from '../models/Route.js';
import { Operator } from '../models/Operator.js';

// @desc    Get all active schedules (with bi-directional search filter support: from, to, date)
// @route   GET /api/schedules
export const getSchedules = async (req, res, next) => {
  try {
    const { from, to, date } = req.query;

    // Fetch all active paid bookings to merge real-time reserved seats
    const activeBookings = await Booking.find({ status: 'Active', paymentStatus: 'Paid' });
    const bookingSeatMap = {};
    activeBookings.forEach((b) => {
      const keys = [b.scheduleId, b.schedule?.toString()].filter(Boolean);
      keys.forEach((k) => {
        if (!bookingSeatMap[k]) bookingSeatMap[k] = [];
        bookingSeatMap[k].push(...(b.seats || []));
      });
    });

    let transformed = schedules.map((s) => {
      const bus = buses.find((b) => b.busId === s.busId || b._id.toString() === s.bus?.toString());
      const route = routes.find((r) => r.routeId === s.routeId || r._id.toString() === s.route?.toString());
      const op = operators.find((o) => o.operatorId === bus?.operatorId);

      const dynamicBookedSeats = bookingSeatMap[s.scheduleId] || bookingSeatMap[s._id.toString()] || [];
      const mergedReservedSeats = Array.from(new Set([...(s.reservedSeats || []), ...dynamicBookedSeats]));

      return {
        id: s.scheduleId,
        _id: s._id,
        busId: s.busId,
        routeId: s.routeId,
        departureTime: s.departureTime,
        arrivalTime: s.arrivalTime,
        duration: s.duration,
        operatingDays: s.operatingDays,
        fare: s.fare,
        currency: s.currency,
        onlineBooking: s.onlineBooking,
        eTicketSupported: s.eTicketSupported,
        qrTicketSupported: s.qrTicketSupported,
        reservedSeats: mergedReservedSeats,
        status: s.status,
        sourceName: s.sourceName,
        sourceUrl: s.sourceUrl,
        lastVerifiedDate: s.lastVerifiedDate,
        dataStatus: s.dataStatus,
        notes: s.notes,
        bus: bus
          ? {
              id: bus.busId,
              busNo: bus.busNo,
              name: bus.name,
              model: bus.model,
              type: bus.busType,
              serviceCategory: bus.serviceCategory,
              seatLayout: bus.seatLayout,
              totalSeats: bus.totalSeats,
              amenities: bus.facilities,
              rating: bus.rating,
              operator: op?.name || 'Verified Carrier',
              operatorDetails: op
                ? {
                    id: op.operatorId,
                    name: op.name,
                    contact: op.contactNumber,
                    email: op.email,
                    website: op.website,
                  }
                : null,
            }
          : null,
        route: route
          ? {
              id: route.routeId,
              routeNo: route.routeNo,
              name: route.name,
              from: route.fromCity,
              to: route.toCity,
              boardingPoints: route.boardingPoints,
              droppingPoints: route.droppingPoints,
              highwayRoute: route.highwayRoute,
              distance: route.distanceKm,
              tollFee: route.tollFee,
            }
          : null,
      };
    });

    if (from || to) {
      const searchFrom = (from || '').trim().toLowerCase();
      const searchTo = (to || '').trim().toLowerCase();

      transformed = transformed.filter((s) => {
        if (!s.route) return false;

        const routeFrom = (s.route.from || '').toLowerCase();
        const routeTo = (s.route.to || '').toLowerCase();
        const boardingPts = (s.route.boardingPoints || []).map((p) => p.toLowerCase());
        const droppingPts = (s.route.droppingPoints || []).map((p) => p.toLowerCase());

        // 1. Direct forward match
        const matchForwardFrom = !searchFrom || routeFrom.includes(searchFrom) || boardingPts.some((p) => p.includes(searchFrom));
        const matchForwardTo = !searchTo || routeTo.includes(searchTo) || droppingPts.some((p) => p.includes(searchTo));
        if (matchForwardFrom && matchForwardTo) return true;

        // 2. Reverse / Return match
        const matchReverseFrom = !searchFrom || routeTo.includes(searchFrom) || droppingPts.some((p) => p.includes(searchFrom));
        const matchReverseTo = !searchTo || routeFrom.includes(searchTo) || boardingPts.some((p) => p.includes(searchTo));
        if (matchReverseFrom && matchReverseTo) return true;

        return false;
      });

      // Swap route labels for reverse matches so display matches user search query
      transformed = transformed.map((s) => {
        const searchFrom = (from || '').trim().toLowerCase();
        const routeFrom = (s.route?.from || '').toLowerCase();
        const routeTo = (s.route?.to || '').toLowerCase();

        if (searchFrom && routeTo.includes(searchFrom) && !routeFrom.includes(searchFrom)) {
          return {
            ...s,
            route: {
              ...s.route,
              from: s.route.to,
              to: s.route.from,
              boardingPoints: s.route.droppingPoints,
              droppingPoints: s.route.boardingPoints,
            },
          };
        }
        return s;
      });
    }

    res.json(transformed);
  } catch (err) {
    next(err);
  }
};

// @desc    Get schedule by ID
// @route   GET /api/schedules/:id
export const getScheduleById = async (req, res, next) => {
  try {
    const s = await Schedule.findOne({
      $or: [{ scheduleId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!s) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const bus = await Bus.findOne({
      $or: [{ busId: s.busId }, { _id: s.bus?.match(/^[0-9a-fA-F]{24}$/) ? s.bus : null }],
    });
    const route = await Route.findOne({
      $or: [{ routeId: s.routeId }, { _id: s.route?.match(/^[0-9a-fA-F]{24}$/) ? s.route : null }],
    });
    const op = bus ? await Operator.findOne({ operatorId: bus.operatorId }) : null;

    // Fetch active paid bookings for this schedule to merge real-time reserved seats
    const activeBookings = await Booking.find({
      $or: [{ scheduleId: s.scheduleId }, { schedule: s._id }],
      status: 'Active',
      paymentStatus: 'Paid',
    });
    const bookedSeats = activeBookings.flatMap((b) => b.seats || []);
    const mergedReservedSeats = Array.from(new Set([...(s.reservedSeats || []), ...bookedSeats]));

    res.json({
      id: s.scheduleId,
      _id: s._id,
      busId: s.busId,
      routeId: s.routeId,
      departureTime: s.departureTime,
      arrivalTime: s.arrivalTime,
      duration: s.duration,
      operatingDays: s.operatingDays,
      fare: s.fare,
      currency: s.currency,
      onlineBooking: s.onlineBooking,
      eTicketSupported: s.eTicketSupported,
      qrTicketSupported: s.qrTicketSupported,
      reservedSeats: mergedReservedSeats,
      status: s.status,
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      lastVerifiedDate: s.lastVerifiedDate,
      dataStatus: s.dataStatus,
      notes: s.notes,
      bus: bus
        ? {
            id: bus.busId,
            busNo: bus.busNo,
            name: bus.name,
            model: bus.model,
            type: bus.busType,
            serviceCategory: bus.serviceCategory,
            seatLayout: bus.seatLayout,
            totalSeats: bus.totalSeats,
            amenities: bus.facilities,
            rating: bus.rating,
            operator: op?.name || 'Verified Carrier',
            operatorDetails: op
              ? {
                  id: op.operatorId,
                  name: op.name,
                  contact: op.contactNumber,
                  email: op.email,
                  website: op.website,
                }
              : null,
          }
        : null,
      route: route
        ? {
            id: route.routeId,
            routeNo: route.routeNo,
            name: route.name,
            from: route.fromCity,
            to: route.toCity,
            boardingPoints: route.boardingPoints,
            droppingPoints: route.droppingPoints,
            highwayRoute: route.highwayRoute,
            distance: route.distanceKm,
            tollFee: route.tollFee,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new schedule
// @route   POST /api/schedules
export const createSchedule = async (req, res, next) => {
  try {
    const scheduleId = req.body.scheduleId || req.body.id || `S-${Math.floor(10 + Math.random() * 90)}`;
    const busId = req.body.busId || req.body.bus_id;
    const routeId = req.body.routeId || req.body.route_id;

    const busDoc = await Bus.findOne({ busId });
    const routeDoc = await Route.findOne({ routeId });

    const sched = await Schedule.create({
      scheduleId,
      bus: busDoc ? busDoc._id : null,
      busId,
      route: routeDoc ? routeDoc._id : null,
      routeId,
      departureTime: req.body.departureTime || req.body.departure_time,
      arrivalTime: req.body.arrivalTime || req.body.arrival_time,
      duration: req.body.duration,
      operatingDays: req.body.operatingDays || req.body.operating_days || 'Daily',
      fare: parseFloat(req.body.fare),
      currency: req.body.currency || 'LKR',
      reservedSeats: req.body.reservedSeats || req.body.reserved_seats || [],
      status: req.body.status || 'Active',
      sourceName: req.body.sourceName || req.body.source_name,
      sourceUrl: req.body.sourceUrl || req.body.source_url,
      lastVerifiedDate: req.body.lastVerifiedDate || req.body.last_verified_date || new Date().toISOString().split('T')[0],
      dataStatus: req.body.dataStatus || req.body.data_status || 'Verified',
      notes: req.body.notes,
    });

    res.status(201).json(sched);
  } catch (err) {
    next(err);
  }
};

// @desc    Update schedule
// @route   PUT /api/schedules/:id
export const updateSchedule = async (req, res, next) => {
  try {
    const updateData = {
      ...((req.body.busId || req.body.bus_id) && { busId: req.body.busId || req.body.bus_id }),
      ...((req.body.routeId || req.body.route_id) && { routeId: req.body.routeId || req.body.route_id }),
      ...((req.body.departureTime || req.body.departure_time) && { departureTime: req.body.departureTime || req.body.departure_time }),
      ...((req.body.arrivalTime || req.body.arrival_time) && { arrivalTime: req.body.arrivalTime || req.body.arrival_time }),
      ...(req.body.duration && { duration: req.body.duration }),
      ...((req.body.operatingDays || req.body.operating_days) && { operatingDays: req.body.operatingDays || req.body.operating_days }),
      ...(req.body.fare !== undefined && { fare: parseFloat(req.body.fare) }),
      ...(req.body.reservedSeats && { reservedSeats: req.body.reservedSeats }),
      ...(req.body.status && { status: req.body.status }),
      ...(req.body.sourceName && { sourceName: req.body.sourceName }),
      ...(req.body.sourceUrl && { sourceUrl: req.body.sourceUrl }),
      ...(req.body.dataStatus && { dataStatus: req.body.dataStatus }),
      ...(req.body.notes && { notes: req.body.notes }),
    };

    const sched = await Schedule.findOneAndUpdate(
      { $or: [{ scheduleId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }] },
      updateData,
      { new: true, runValidators: true }
    );
    if (!sched) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(sched);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete schedule
// @route   DELETE /api/schedules/:id
export const deleteSchedule = async (req, res, next) => {
  try {
    const sched = await Schedule.findOneAndDelete({
      $or: [{ scheduleId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!sched) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (err) {
    next(err);
  }
};
