import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientUserId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['NEW_BOOKING', 'BOOKING_CANCELLED', 'BOOKING_REFUNDED', 'SCHEDULE_ASSIGNED', 'SCHEDULE_CHANGED'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    bookingRef: {
      type: String,
    },
    scheduleId: {
      type: String,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientUserId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
