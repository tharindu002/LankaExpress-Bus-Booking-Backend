import crypto from 'crypto';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { User } from '../models/User.js';
import { Schedule } from '../models/Schedule.js';
import { Booking } from '../models/Booking.js';

// Helper to get or create wallet for authenticated user
const getOrCreateWallet = async (user) => {
  let wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: user._id,
      userStrId: user.userId || user._id.toString(),
      balance: 0,
      currency: 'LKR',
      status: 'ACTIVE',
    });
  } else {
    const hasCompletedTopup = await WalletTransaction.findOne({
      userId: user._id,
      status: 'COMPLETED',
      type: 'CREDIT',
    });
    if (!hasCompletedTopup && wallet.balance > 0) {
      wallet.balance = 0;
      await wallet.save();
    }
  }
  return wallet;
};

// @desc    Get user wallet balance
// @route   GET /api/wallet
// @access  Private
export const getWallet = async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user);
    res.json({
      success: true,
      balance: wallet.balance,
      currency: wallet.currency,
      status: wallet.status,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user wallet transaction history
// @route   GET /api/wallet/transactions
// @access  Private
export const getWalletTransactions = async (req, res, next) => {
  try {
    const transactions = await WalletTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initialize Wallet Top-Up via PayHere Checkout
// @route   POST /api/wallet/topup
// @access  Private
export const createTopupOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const topupAmount = parseFloat(amount);

    if (isNaN(topupAmount) || topupAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid top-up amount greater than 0', message: 'Please enter a valid top-up amount greater than 0' });
    }

    if (topupAmount < 100) {
      return res.status(400).json({ success: false, error: 'Minimum top-up amount is LKR 100.00', message: 'Minimum top-up amount is LKR 100.00' });
    }

    const wallet = await getOrCreateWallet(req.user);

    // Create unique order ID for PayHere
    const orderId = `TOPUP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const currency = 'LKR';
    const amountFormatted = topupAmount.toFixed(2);

    // PayHere Merchant configuration
    const merchantId = process.env.PAYHERE_MERCHANT_ID || '1220000';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || '4LankaExpresswaySecret2026';

    // Calculate PayHere MD5 Hash on Backend
    // Formula: UPPERCASE(MD5(merchant_id + order_id + amount + currency + UPPERCASE(MD5(merchant_secret))))
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashString = merchantId + orderId + amountFormatted + currency + hashedSecret;
    const payHereHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

    // Create PENDING Wallet Transaction Record
    await WalletTransaction.create({
      userId: req.user._id,
      userStrId: req.user.userId || req.user._id.toString(),
      walletId: wallet._id,
      type: 'CREDIT',
      reason: 'WALLET_TOPUP',
      amount: topupAmount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance, // will be updated upon completion
      orderId,
      status: 'PENDING',
      gateway: 'PAYHERE',
      notes: `PayHere Top-Up Order ${orderId}`,
    });

    const isSandbox = process.env.PAYHERE_SANDBOX === 'true' || true;
    const backendUrl = process.env.BACKEND_URL || 'https://lankaexpress-bus-booking-backend.onrender.com';
    const frontendUrl = process.env.FRONTEND_URL || 'https://lanka-express-bus-booking.vercel.app';
    const notifyUrl = `${backendUrl}/api/payhere/notify`;

    res.json({
      success: true,
      message: 'PayHere top-up order initialized',
      payHereData: {
        sandbox: isSandbox,
        merchant_id: merchantId,
        return_url: `${frontendUrl}/wallet?status=success&order_id=${orderId}`,
        cancel_url: `${frontendUrl}/wallet?status=cancelled`,
        notify_url: notifyUrl,
        order_id: orderId,
        items: 'LankaExpressway Digital Wallet Top-Up',
        amount: amountFormatted,
        currency,
        hash: payHereHash,
        first_name: req.user.name?.split(' ')[0] || 'Valued',
        last_name: req.user.name?.split(' ')[1] || 'Customer',
        email: req.user.email,
        phone: req.user.phone || '0770000000',
        address: 'Sri Lanka',
        city: 'Colombo',
        country: 'Sri Lanka',
        custom_1: req.user._id.toString(),
        custom_2: req.user.userId || req.user._id.toString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Pay for Bus Ticket using Wallet Balance
// @route   POST /api/wallet/pay-ticket
// @access  Private
export const payTicketWithWallet = async (req, res, next) => {
  try {
    const { scheduleId, seats, passengerName, passengerEmail, passengerPhone, passengerNic } = req.body;

    if (!scheduleId || !seats || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one seat to proceed with booking' });
    }

    const sched = await Schedule.findOne({
      $or: [{ scheduleId }, { _id: scheduleId.match(/^[0-9a-fA-F]{24}$/) ? scheduleId : null }],
    });

    if (!sched) {
      return res.status(404).json({ success: false, message: 'Selected bus schedule not found' });
    }

    // Check if any seat is already reserved
    const existingReserved = sched.reservedSeats || [];
    const unavailableSeats = seats.filter((seat) => existingReserved.includes(seat));
    if (unavailableSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Seat(s) ${unavailableSeats.join(', ')} are already booked. Please select available seats.`,
      });
    }

    const reqTotal = parseFloat(req.body.totalAmount);
    const totalAmount = (!isNaN(reqTotal) && reqTotal > 0) ? reqTotal : (sched.fare * seats.length);

    // Check user wallet balance
    const wallet = await getOrCreateWallet(req.user);
    if (wallet.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Total Required: LKR ${totalAmount.toFixed(2)}, Available Wallet Balance: LKR ${wallet.balance.toFixed(2)}. Please add money to your wallet to complete booking.`,
        requiredAmount: totalAmount,
        availableBalance: wallet.balance,
      });
    }

    // Perform atomic deduction
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - totalAmount;

    wallet.balance = balanceAfter;
    await wallet.save();

    // Reserve seats on schedule
    sched.reservedSeats = [...existingReserved, ...seats];
    await sched.save();

    // Create Booking Record
    const bookingRef = `BUS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const qrData = `LANKAEXPRESSWAY:${bookingRef}:SCHED-${sched.scheduleId}:SEATS-${seats.join(',')}:FARE-${totalAmount}:PAID_VIA_WALLET:VERIFIED`;

    const booking = await Booking.create({
      bookingRef,
      user: req.user._id,
      userId: req.user.userId || req.user._id.toString(),
      passengerName: passengerName || req.user.name,
      passengerEmail: passengerEmail || req.user.email,
      passengerPhone: passengerPhone || req.user.phone || '',
      passengerNic: passengerNic || '',
      schedule: sched._id,
      scheduleId: sched.scheduleId,
      seats,
      totalAmount,
      paymentMethod: 'Wallet',
      paymentStatus: 'Paid',
      bookingDate: new Date().toISOString().split('T')[0],
      qrCodeData: qrData,
      status: 'Active',
    });

    // Record DEBIT Wallet Transaction
    await WalletTransaction.create({
      userId: req.user._id,
      userStrId: req.user.userId || req.user._id.toString(),
      walletId: wallet._id,
      type: 'DEBIT',
      reason: 'TICKET_PAYMENT',
      amount: totalAmount,
      balanceBefore,
      balanceAfter,
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      status: 'COMPLETED',
      gateway: 'INTERNAL_WALLET',
      notes: `Ticket Payment for ${seats.length} seat(s) on ${sched.scheduleId} (${bookingRef})`,
    });

    res.status(201).json({
      success: true,
      message: 'Bus ticket successfully booked using Digital Wallet balance',
      data: {
        bookingRef: booking.bookingRef,
        bookingId: booking._id,
        seats: booking.seats,
        totalAmount: booking.totalAmount,
        newWalletBalance: balanceAfter,
        qrCodeData: booking.qrCodeData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Direct Verified Top-Up Simulator for PayHere Sandbox development testing
// @route   POST /api/wallet/verify-sandbox
// @access  Private
export const verifySandboxTopup = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const transaction = await WalletTransaction.findOne({ orderId });
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Top-up transaction order not found', message: 'Top-up transaction order not found' });
    }

    if (transaction.status === 'COMPLETED') {
      const wallet = await getOrCreateWallet(req.user);
      return res.json({
        success: true,
        message: 'Transaction already completed',
        balance: wallet.balance,
      });
    }

    // Complete transaction in Sandbox environment
    const wallet = await getOrCreateWallet(req.user);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + transaction.amount;

    wallet.balance = balanceAfter;
    await wallet.save();

    transaction.status = 'COMPLETED';
    transaction.paymentId = `PAYHERE-SANDBOX-${Date.now()}`;
    transaction.balanceBefore = balanceBefore;
    transaction.balanceAfter = balanceAfter;
    await transaction.save();

    res.json({
      success: true,
      message: `Successfully verified PayHere Sandbox Top-Up of LKR ${transaction.amount}`,
      balance: balanceAfter,
    });
  } catch (err) {
    next(err);
  }
};
