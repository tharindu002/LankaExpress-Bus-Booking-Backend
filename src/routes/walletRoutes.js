import express from 'express';
import {
  getWallet,
  getWalletTransactions,
  createTopupOrder,
  payTicketWithWallet,
  verifySandboxTopup,
} from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All wallet endpoints require authenticated user JWT
router.get('/', protect, getWallet);
router.get('/transactions', protect, getWalletTransactions);
router.post('/topup', protect, createTopupOrder);
router.post('/pay-ticket', protect, payTicketWithWallet);
router.post('/verify-sandbox', protect, verifySandboxTopup);

export default router;
