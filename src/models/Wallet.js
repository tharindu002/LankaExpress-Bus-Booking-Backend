import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    userStrId: {
      type: String,
      required: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    currency: {
      type: String,
      default: 'LKR',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model('Wallet', walletSchema);
