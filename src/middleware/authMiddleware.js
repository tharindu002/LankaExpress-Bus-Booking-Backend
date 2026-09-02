import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  const fallbackId = req.headers['x-user-id'] || req.body?.userId;

  if (!token) {
    if (fallbackId) {
      const isObjectId = typeof fallbackId === 'string' && fallbackId.match(/^[0-9a-fA-F]{24}$/);
      const user = await User.findOne({
        $or: [
          { userId: fallbackId },
          { email: fallbackId },
          ...(isObjectId ? [{ _id: fallbackId }] : [])
        ]
      });
      if (user) {
        req.user = user;
        return next();
      }
    }
    return res.status(401).json({ error: 'Not authorized, token missing. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'lankaexpressway_jwt_secret_key_2026_lk');
    let user = null;

    if (decoded && decoded.id) {
      const isObjectId = typeof decoded.id === 'string' && decoded.id.match(/^[0-9a-fA-F]{24}$/);
      if (isObjectId) {
        user = await User.findById(decoded.id).select('-password');
      }
      if (!user) {
        user = await User.findOne({ $or: [{ userId: decoded.id }, { email: decoded.id }] }).select('-password');
      }
    }

    if (!user && fallbackId) {
      const isObjectId = typeof fallbackId === 'string' && fallbackId.match(/^[0-9a-fA-F]{24}$/);
      user = await User.findOne({
        $or: [
          { userId: fallbackId },
          { email: fallbackId },
          ...(isObjectId ? [{ _id: fallbackId }] : [])
        ]
      }).select('-password');
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found in database. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (fallbackId) {
      const isObjectId = typeof fallbackId === 'string' && fallbackId.match(/^[0-9a-fA-F]{24}$/);
      const user = await User.findOne({
        $or: [
          { userId: fallbackId },
          { email: fallbackId },
          ...(isObjectId ? [{ _id: fallbackId }] : [])
        ]
      }).select('-password');
      if (user) {
        req.user = user;
        return next();
      }
    }
    return res.status(401).json({ error: 'Not authorized, session expired. Please log in again.' });
  }
};

export const adminOnly = (req, res, next) => {
  const role = req.user?.role?.toLowerCase();
  if (req.user && (role === 'admin' || role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Administrator privileges required' });
  }
};

export const superAdminOnly = (req, res, next) => {
  const role = req.user?.role?.toLowerCase();
  if (req.user && role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: SuperAdmin privileges required' });
  }
};

export const checkAdminPermission = (permissionKey) => {
  return (req, res, next) => {
    const role = req.user?.role?.toLowerCase();
    if (role === 'superadmin') return next();
    
    if (role === 'admin') {
      const permissions = req.user.adminPermissions || [];
      if (permissions.length === 0 || permissions.includes(permissionKey)) {
        return next();
      }
    }

    res.status(403).json({ error: `Access denied: Missing '${permissionKey}' permission` });
  };
};

export const requireConductor = (req, res, next) => {
  const role = req.user?.role?.toLowerCase();
  if (req.user && (role === 'conductor' || role === 'admin' || role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Conductor privileges required' });
  }
};


