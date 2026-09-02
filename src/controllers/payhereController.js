import crypto from 'crypto';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { User } from '../models/User.js';

// @desc    Handle PayHere Server Webhook Notification
// @route   POST /api/payhere/notify
// @access  Public (PayHere Server to Server)
export const handlePayHereNotification = async (req, res, next) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      custom_1, // userId
      custom_2, // userStrId
    } = req.body;

    console.log(`💳 PayHere Webhook received for Order: ${order_id}, Status: ${status_code}, Amount: ${payhere_amount}`);

    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    if (!merchantSecret) {
      console.error('❌ PAYHERE_MERCHANT_SECRET is not configured in .env');
      return res.status(500).json({ success: false, message: 'Merchant configuration error' });
    }

    // 1. Verify Merchant ID
    if (merchant_id !== merchantId) {
      console.error(`❌ PayHere Notification Rejected: Merchant ID mismatch (${merchant_id} !== ${merchantId})`);
      return res.status(400).json({ success: false, message: 'Invalid Merchant ID' });
    }

    // 2. Calculate local MD5 Signature
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashString = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
    const calculatedHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

    if (calculatedHash !== md5sig?.toUpperCase()) {
      console.error(`❌ PayHere Notification Signature Mismatch! Received: ${md5sig}, Calculated: ${calculatedHash}`);
      return res.status(400).json({ success: false, message: 'Invalid PayHere signature' });
    }

    // 3. Find corresponding PENDING transaction
    const transaction = await WalletTransaction.findOne({ orderId: order_id });
    if (!transaction) {
      console.error(`❌ Wallet Transaction not found for Order ID: ${order_id}`);
      return res.status(404).json({ success: false, message: 'Transaction order not found' });
    }

    // 4. Idempotency Guard: Check if transaction has already been completed
    if (transaction.status === 'COMPLETED') {
      console.log(`ℹ️ Transaction ${order_id} has ALREADY been processed and completed. Skipping duplicate credit.`);
      return res.status(200).send('Transaction already processed');
    }

    // 5. Verify payment status code (2 = SUCCESS)
    if (status_code === '2' || status_code === 2) {
      const topupAmount = parseFloat(payhere_amount);

      // Fetch or create user's wallet
      let wallet = await Wallet.findOne({ userId: transaction.userId });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: transaction.userId,
          userStrId: transaction.userStrId,
          balance: 0,
          currency: payhere_currency || 'LKR',
        });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + topupAmount;

      // Update wallet balance atomically
      wallet.balance = balanceAfter;
      await wallet.save();

      // Update transaction status
      transaction.status = 'COMPLETED';
      transaction.paymentId = payment_id;
      transaction.balanceBefore = balanceBefore;
      transaction.balanceAfter = balanceAfter;
      await transaction.save();

      console.log(`✅ SUCCESS: Credited LKR ${topupAmount} to User ${transaction.userStrId}. New Balance: LKR ${balanceAfter}`);
      return res.status(200).send('OK');
    } else {
      // Payment Failed or Cancelled by user
      transaction.status = status_code === '-1' || status_code === -1 ? 'CANCELLED' : 'FAILED';
      transaction.paymentId = payment_id || '';
      await transaction.save();

      console.warn(`⚠️ PayHere Payment Failed/Cancelled for Order ${order_id} with status code ${status_code}`);
      return res.status(200).send('Payment status recorded as not completed');
    }
  } catch (err) {
    console.error('❌ Error handling PayHere Notification:', err);
    next(err);
  }
};
