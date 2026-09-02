import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingRef: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: String,
      default: 'guest',
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    scheduleId: {
      type: String,
      required: true,
      trim: true,
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
    },
    passengerName: {
      type: String,
      required: [true, 'Passenger name is required'],
      trim: true,
    },
    passengerEmail: {
      type: String,
      required: [true, 'Passenger email is required'],
      trim: true,
      lowercase: true,
    },
    passengerPhone: {
      type: String,
      required: [true, 'Passenger phone is required'],
      trim: true,
    },
    passengerNic: {
      type: String,
      trim: true,
    },
    seats: {
      type: [String],
      required: true,
      validate: [v => Array.isArray(v) && v.length > 0, 'At least one seat must be selected'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
    },
    paymentMethod: {
      type: String,
      enum: ['Card', 'LankaQR', 'EzCash', 'Wallet'],
      default: 'Card',
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Refunded'],
      default: 'Paid',
    },
    bookingDate: {
      type: String,
      required: true,
    },
    qrCodeData: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Cancelled'],
      default: 'Active',
    },
    boardingStatus: {
      type: String,
      enum: ['Pending', 'Boarded', 'No_Show', 'Not_Applicable'],
      default: 'Pending',
    },
    boardedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedByConductorId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ bookingRef: 1, userId: 1, scheduleId: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
