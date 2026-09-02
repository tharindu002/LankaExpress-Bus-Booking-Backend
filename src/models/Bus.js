import mongoose from 'mongoose';

const busSchema = new mongoose.Schema(
  {
    busId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Operator',
    },
    operatorId: {
      type: String,
      required: true,
      trim: true,
    },
    busNo: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Bus name is required'],
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    busType: {
      type: String,
      required: [true, 'Bus type is required'],
      trim: true,
    },
    serviceCategory: {
      type: String,
      enum: ['Luxury', 'Super Luxury', 'Premium'],
      default: 'Super Luxury',
    },
    seatLayout: {
      type: String,
      enum: ['2+2', '2+1'],
      default: '2+2',
    },
    totalSeats: {
      type: Number,
      required: true,
      default: 40,
    },
    facilities: {
      type: [String],
      default: ['Air Conditioning', 'Reclining Seats'],
    },
    rating: {
      type: Number,
      default: 4.7,
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

busSchema.index({ operatorId: 1 });

export const Bus = mongoose.model('Bus', busSchema);
