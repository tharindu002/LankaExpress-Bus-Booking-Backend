import mongoose from 'mongoose';

const boardingLogSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    bookingRef: {
      type: String,
      required: true,
      index: true,
    },
    scheduleId: {
      type: String,
      required: true,
      index: true,
    },
    conductorId: {
      type: String,
      required: true,
      index: true,
    },
    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    passengerName: {
      type: String,
      required: true,
    },
    seats: {
      type: [String],
      required: true,
    },
    action: {
      type: String,
      enum: ['QR_SCAN_SUCCESS', 'QR_SCAN_FAILED', 'PASSENGER_BOARDED', 'ALREADY_BOARDED'],
      required: true,
    },
    result: {
      type: String,
      required: true,
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

boardingLogSchema.index({ createdAt: -1 });

export const BoardingLog = mongoose.model('BoardingLog', boardingLogSchema);
