import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema(
  {
    routeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    routeNo: {
      type: String,
      required: [true, 'Route number is required'],
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Route name is required'],
      trim: true,
    },
    fromCity: {
      type: String,
      required: [true, 'Origin city is required'],
      trim: true,
    },
    toCity: {
      type: String,
      required: [true, 'Destination city is required'],
      trim: true,
    },
    boardingPoints: {
      type: [String],
      default: [],
    },
    droppingPoints: {
      type: [String],
      default: [],
    },
    highwayRoute: {
      type: String,
      trim: true,
    },
    distanceKm: {
      type: String,
      trim: true,
    },
    tollFee: {
      type: Number,
      default: 0,
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

routeSchema.index({ fromCity: 1, toCity: 1 });

export const Route = mongoose.model('Route', routeSchema);
