import { Bus } from '../models/Bus.js';
import { Operator } from '../models/Operator.js';

// @desc    Get all buses
// @route   GET /api/buses
export const getBuses = async (req, res, next) => {
  try {
    const buses = await Bus.find().populate('operator').sort({ name: 1 });
    const operators = await Operator.find();

    const transformed = buses.map((b) => {
      const op = b.operator || operators.find((o) => o.operatorId === b.operatorId);
      return {
        id: b.busId,
        _id: b._id,
        operatorId: b.operatorId,
        operator: op?.name || 'Assigned Operator',
        operatorDetails: op
          ? {
              id: op.operatorId,
              name: op.name,
              contact: op.contactNumber,
              email: op.email,
              website: op.website,
            }
          : null,
        busNo: b.busNo,
        name: b.name,
        model: b.model,
        type: b.busType,
        busType: b.busType,
        serviceCategory: b.serviceCategory,
        seatLayout: b.seatLayout,
        totalSeats: b.totalSeats,
        amenities: b.facilities,
        facilities: b.facilities,
        rating: b.rating,
        status: b.status,
        sourceName: b.sourceName,
        sourceUrl: b.sourceUrl,
        lastVerifiedDate: b.lastVerifiedDate,
        dataStatus: b.dataStatus,
        notes: b.notes,
      };
    });
    res.json(transformed);
  } catch (err) {
    next(err);
  }
};

// @desc    Get bus by ID
// @route   GET /api/buses/:id
export const getBusById = async (req, res, next) => {
  try {
    const b = await Bus.findOne({
      $or: [{ busId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    }).populate('operator');
    if (!b) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    const op = b.operator || (await Operator.findOne({ operatorId: b.operatorId }));
    res.json({
      id: b.busId,
      _id: b._id,
      operatorId: b.operatorId,
      operator: op?.name || 'Assigned Operator',
      operatorDetails: op
        ? {
            id: op.operatorId,
            name: op.name,
            contact: op.contactNumber,
            email: op.email,
            website: op.website,
          }
        : null,
      busNo: b.busNo,
      name: b.name,
      model: b.model,
      type: b.busType,
      busType: b.busType,
      serviceCategory: b.serviceCategory,
      seatLayout: b.seatLayout,
      totalSeats: b.totalSeats,
      amenities: b.facilities,
      facilities: b.facilities,
      rating: b.rating,
      status: b.status,
      sourceName: b.sourceName,
      sourceUrl: b.sourceUrl,
      lastVerifiedDate: b.lastVerifiedDate,
      dataStatus: b.dataStatus,
      notes: b.notes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new bus
// @route   POST /api/buses
export const createBus = async (req, res, next) => {
  try {
    const busId = req.body.busId || req.body.id || `B-${Math.floor(10 + Math.random() * 90)}`;
    const operatorId = req.body.operatorId || req.body.operator_id || 'OP-01';
    const opDoc = await Operator.findOne({ operatorId });

    const bus = await Bus.create({
      busId,
      operator: opDoc ? opDoc._id : null,
      operatorId,
      busNo: req.body.busNo || req.body.bus_no,
      name: req.body.name,
      model: req.body.model,
      busType: req.body.busType || req.body.type || 'Super Luxury Volvo',
      serviceCategory: req.body.serviceCategory || req.body.service_category || 'Super Luxury',
      seatLayout: req.body.seatLayout || req.body.seat_layout || '2+2',
      totalSeats: parseInt(req.body.totalSeats || req.body.total_seats || 40, 10),
      facilities: req.body.facilities || req.body.amenities || ['Air Conditioning', 'Reclining Seats'],
      rating: parseFloat(req.body.rating || 4.7),
      status: req.body.status || 'Active',
      sourceName: req.body.sourceName || req.body.source_name,
      sourceUrl: req.body.sourceUrl || req.body.source_url,
      lastVerifiedDate: req.body.lastVerifiedDate || req.body.last_verified_date || new Date().toISOString().split('T')[0],
      dataStatus: req.body.dataStatus || req.body.data_status || 'Verified',
      notes: req.body.notes,
    });
    res.status(201).json(bus);
  } catch (err) {
    next(err);
  }
};

// @desc    Update bus
// @route   PUT /api/buses/:id
export const updateBus = async (req, res, next) => {
  try {
    const updateData = {
      ...(req.body.operatorId && { operatorId: req.body.operatorId }),
      ...(req.body.busNo !== undefined && { busNo: req.body.busNo }),
      ...(req.body.name && { name: req.body.name }),
      ...(req.body.model !== undefined && { model: req.body.model }),
      ...(req.body.type && { busType: req.body.type }),
      ...(req.body.busType && { busType: req.body.busType }),
      ...(req.body.serviceCategory && { serviceCategory: req.body.serviceCategory }),
      ...(req.body.seatLayout && { seatLayout: req.body.seatLayout }),
      ...(req.body.totalSeats && { totalSeats: parseInt(req.body.totalSeats, 10) }),
      ...(req.body.amenities && { facilities: req.body.amenities }),
      ...(req.body.facilities && { facilities: req.body.facilities }),
      ...(req.body.rating && { rating: parseFloat(req.body.rating) }),
      ...(req.body.status && { status: req.body.status }),
      ...(req.body.sourceName && { sourceName: req.body.sourceName }),
      ...(req.body.sourceUrl && { sourceUrl: req.body.sourceUrl }),
      ...(req.body.dataStatus && { dataStatus: req.body.dataStatus }),
      ...(req.body.notes && { notes: req.body.notes }),
    };

    if (updateData.operatorId) {
      const opDoc = await Operator.findOne({ operatorId: updateData.operatorId });
      if (opDoc) updateData.operator = opDoc._id;
    }

    const bus = await Bus.findOneAndUpdate(
      { $or: [{ busId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }] },
      updateData,
      { new: true, runValidators: true }
    );
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json(bus);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete bus
// @route   DELETE /api/buses/:id
export const deleteBus = async (req, res, next) => {
  try {
    const bus = await Bus.findOneAndDelete({
      $or: [{ busId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (err) {
    next(err);
  }
};
