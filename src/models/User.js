import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['deposit', 'charge'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
});

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'conductor', 'superadmin'],
      default: 'user',
    },
    adminPermissions: {
      type: [String],
      default: [
        'manage_users',
        'manage_buses',
        'manage_routes',
        'manage_schedules',
        'manage_conductors',
        'manage_bookings',
        'manage_finances',
        'view_reports',
        'view_logs',
      ],
    },
    assignedBuses: {
      type: [String],
      default: [],
    },
    conductorPermissions: {
      maxBusesAllowed: { type: Number, default: 2 },
      canScanQR: { type: Boolean, default: true },
      canIssueTickets: { type: Boolean, default: true },
      canCancelBoarding: { type: Boolean, default: true },
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '+94 77 000 0000',
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    walletTransactions: {
      type: [transactionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active',
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpire: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper
userSchema.methods.comparePassword = async function (enteredPassword) {
  // If plain text (for simple seed/dev compatibility) or hashed
  if (this.password === enteredPassword) return true;
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
