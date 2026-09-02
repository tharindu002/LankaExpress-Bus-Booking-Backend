import mongoose from 'mongoose';

const operatorSchema = new mongoose.Schema(
  {
    operatorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Operator name is required'],
      trim: true,
    },
    contactNumber: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    website: {
      type: String,
      trim: true,
    },
    operatorType: {
      type: String,
      enum: ['Private', 'Public', 'Franchise'],
      default: 'Private',
    },
    serviceCategory: {
      type: String,
      enum: ['Luxury', 'Super Luxury', 'Premium'],
      default: 'Super Luxury',
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

export const Operator = mongoose.model('Operator', operatorSchema);
