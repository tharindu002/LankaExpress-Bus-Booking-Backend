import express from 'express';
import {
  getOperators,
  getOperatorById,
  createOperator,
  updateOperator,
  deleteOperator,
} from '../controllers/operatorController.js';

const router = express.Router();

router.route('/').get(getOperators).post(createOperator);
router.route('/:id').get(getOperatorById).put(updateOperator).delete(deleteOperator);

export default router;
