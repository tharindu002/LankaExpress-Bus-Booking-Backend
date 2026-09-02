import { Operator } from '../models/Operator.js';

// @desc    Get all operators
// @route   GET /api/operators
export const getOperators = async (req, res, next) => {
  try {
    const operators = await Operator.find().sort({ name: 1 });
    res.json(operators);
  } catch (err) {
    next(err);
  }
};

// @desc    Get operator by ID
// @route   GET /api/operators/:id
export const getOperatorById = async (req, res, next) => {
  try {
    const operator = await Operator.findOne({
      $or: [{ operatorId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json(operator);
  } catch (err) {
    next(err);
  }
};

// @desc    Create new operator
// @route   POST /api/operators
export const createOperator = async (req, res, next) => {
  try {
    const operatorId = req.body.operatorId || req.body.id || `OP-${Math.floor(10 + Math.random() * 90)}`;
    const operator = await Operator.create({
      ...req.body,
      operatorId,
      lastVerifiedDate: req.body.lastVerifiedDate || new Date().toISOString().split('T')[0],
    });
    res.status(201).json(operator);
  } catch (err) {
    next(err);
  }
};

// @desc    Update operator
// @route   PUT /api/operators/:id
export const updateOperator = async (req, res, next) => {
  try {
    const operator = await Operator.findOneAndUpdate(
      { $or: [{ operatorId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }] },
      req.body,
      { new: true, runValidators: true }
    );
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json(operator);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete operator
// @route   DELETE /api/operators/:id
export const deleteOperator = async (req, res, next) => {
  try {
    const operator = await Operator.findOneAndDelete({
      $or: [{ operatorId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!operator) {
      return res.status(404).json({ error: 'Operator not found' });
    }
    res.json({ success: true, message: 'Operator deleted successfully' });
  } catch (err) {
    next(err);
  }
};
