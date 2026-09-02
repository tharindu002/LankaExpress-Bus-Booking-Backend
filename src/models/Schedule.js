import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
    },
    busId: {
      type: String,
      required: true,
      trim: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
    },
    routeId: {
      type: String,
      required: true,
      trim: true,
    },
    departureTime: {
      type: String,
      required: [true, 'Departure time is required'],
      trim: true,
    },
    arrivalTime: {
      type: String,
      required: [true, 'Arrival time is required'],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    operatingDays: {
      type: String,
      default: 'Daily',
      trim: true,
    },
    fare: {
      type: Number,
      required: [true, 'Fare is required'],
    },
    currency: {
      type: String,
      default: 'LKR',
    },
    onlineBooking: {
      type: Boolean,
      default: true,
    },
    eTicketSupported: {
      type: Boolean,
      default: true,
    },
    qrTicketSupported: {
      type: Boolean,
      default: true,
    },
    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    conductorId: {
      type: String,
      trim: true,
    },
    reservedSeats: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    sourceName: {
      type: String,
      trim: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    lastVerifiedDate: {
      type: String,
    },
    dataStatus: {
      type: String,
      enum: ['Verified', 'Partially Verified', 'Unverified'],
      default: 'Verified',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

scheduleSchema.index({ busId: 1, routeId: 1 });

export const Schedule = mongoose.model('Schedule', scheduleSchema);
