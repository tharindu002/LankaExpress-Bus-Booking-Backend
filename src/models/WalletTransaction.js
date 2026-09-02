import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userStrId: {
      type: String,
      required: true,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    reason: {
      type: String,
      enum: ['WALLET_TOPUP', 'TICKET_PAYMENT', 'BOOKING_REFUND', 'ADMIN_ADJUSTMENT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transaction amount must be at least 0.01'],
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    orderId: {
      type: String,
      index: true,
    },
    paymentId: {
      type: String,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    bookingRef: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    gateway: {
      type: String,
      enum: ['PAYHERE', 'INTERNAL_WALLET', 'NONE'],
      default: 'PAYHERE',
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for high performance and duplicate prevention lookup
walletTransactionSchema.index({ orderId: 1, status: 1 });

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
