import { Route } from '../models/Route.js';

// @desc    Get all routes
// @route   GET /api/routes
export const getRoutes = async (req, res, next) => {
  try {
    const routes = await Route.find().sort({ routeNo: 1 });
    // Transform to friendly format
    const transformed = routes.map((r) => ({
      id: r.routeId,
      _id: r._id,
      routeNo: r.routeNo,
      route_no: r.routeNo,
      name: r.name,
      from: r.fromCity,
      fromCity: r.fromCity,
      from_city: r.fromCity,
      to: r.toCity,
      toCity: r.toCity,
      to_city: r.toCity,
      boardingPoints: r.boardingPoints,
      boarding_points: r.boardingPoints,
      droppingPoints: r.droppingPoints,
      dropping_points: r.droppingPoints,
      highwayRoute: r.highwayRoute,
      highway_route: r.highwayRoute,
      distance: r.distanceKm,
      distanceKm: r.distanceKm,
      distance_km: r.distanceKm,
      tollFee: r.tollFee,
      toll_fee: r.tollFee,
      status: r.status,
      sourceName: r.sourceName,
      source_name: r.sourceName,
      sourceUrl: r.sourceUrl,
      source_url: r.sourceUrl,
      lastVerifiedDate: r.lastVerifiedDate,
      last_verified_date: r.lastVerifiedDate,
      dataStatus: r.dataStatus,
      data_status: r.dataStatus,
      notes: r.notes,
    }));
    res.json(transformed);
  } catch (err) {
    next(err);
  }
};

// @desc    Get route by ID
// @route   GET /api/routes/:id
export const getRouteById = async (req, res, next) => {
  try {
    const r = await Route.findOne({
      $or: [{ routeId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!r) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json({
      id: r.routeId,
      _id: r._id,
      routeNo: r.routeNo,
      name: r.name,
      from: r.fromCity,
      to: r.toCity,
      boardingPoints: r.boardingPoints,
      droppingPoints: r.droppingPoints,
      highwayRoute: r.highwayRoute,
      distance: r.distanceKm,
      tollFee: r.tollFee,
      status: r.status,
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      lastVerifiedDate: r.lastVerifiedDate,
      dataStatus: r.dataStatus,
      notes: r.notes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new route
// @route   POST /api/routes
export const createRoute = async (req, res, next) => {
  try {
    const routeId = req.body.routeId || req.body.id || `R-${Math.floor(10 + Math.random() * 90)}`;
    const route = await Route.create({
      routeId,
      routeNo: req.body.routeNo || req.body.route_no,
      name: req.body.name || `${req.body.from || req.body.fromCity} to ${req.body.to || req.body.toCity}`,
      fromCity: req.body.fromCity || req.body.from || req.body.from_city,
      toCity: req.body.toCity || req.body.to || req.body.to_city,
      boardingPoints: req.body.boardingPoints || req.body.boarding_points || [],
      droppingPoints: req.body.droppingPoints || req.body.dropping_points || [],
      highwayRoute: req.body.highwayRoute || req.body.highway_route,
      distanceKm: req.body.distanceKm || req.body.distance || req.body.distance_km,
      tollFee: parseFloat(req.body.tollFee || req.body.toll_fee || 0),
      status: req.body.status || 'Active',
      sourceName: req.body.sourceName || req.body.source_name,
      sourceUrl: req.body.sourceUrl || req.body.source_url,
      lastVerifiedDate: req.body.lastVerifiedDate || req.body.last_verified_date || new Date().toISOString().split('T')[0],
      dataStatus: req.body.dataStatus || req.body.data_status || 'Verified',
      notes: req.body.notes,
    });
    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
};

// @desc    Update route
// @route   PUT /api/routes/:id
export const updateRoute = async (req, res, next) => {
  try {
    const updateData = {
      ...(req.body.routeNo && { routeNo: req.body.routeNo }),
      ...(req.body.name && { name: req.body.name }),
      ...((req.body.from || req.body.fromCity) && { fromCity: req.body.from || req.body.fromCity }),
      ...((req.body.to || req.body.toCity) && { toCity: req.body.to || req.body.toCity }),
      ...(req.body.boardingPoints && { boardingPoints: req.body.boardingPoints }),
      ...(req.body.droppingPoints && { droppingPoints: req.body.droppingPoints }),
      ...(req.body.highwayRoute && { highwayRoute: req.body.highwayRoute }),
      ...(req.body.distance && { distanceKm: req.body.distance }),
      ...(req.body.tollFee !== undefined && { tollFee: parseFloat(req.body.tollFee) }),
      ...(req.body.status && { status: req.body.status }),
      ...(req.body.sourceName && { sourceName: req.body.sourceName }),
      ...(req.body.sourceUrl && { sourceUrl: req.body.sourceUrl }),
      ...(req.body.dataStatus && { dataStatus: req.body.dataStatus }),
      ...(req.body.notes && { notes: req.body.notes }),
    };

    const route = await Route.findOneAndUpdate(
      { $or: [{ routeId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }] },
      updateData,
      { new: true, runValidators: true }
    );
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(route);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete route
// @route   DELETE /api/routes/:id
export const deleteRoute = async (req, res, next) => {
  try {
    const route = await Route.findOneAndDelete({
      $or: [{ routeId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err) {
    next(err);
  }
};
