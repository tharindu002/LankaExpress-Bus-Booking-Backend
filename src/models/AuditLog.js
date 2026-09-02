import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE_BUS',
        'UPDATE_BUS',
        'DELETE_BUS',
        'CREATE_OPERATOR',
        'UPDATE_OPERATOR',
        'DELETE_OPERATOR',
        'CREATE_ROUTE',
        'UPDATE_ROUTE',
        'DELETE_ROUTE',
        'CREATE_SCHEDULE',
        'UPDATE_SCHEDULE',
        'DELETE_SCHEDULE',
        'UPDATE_FARE',
        'UPDATE_SEATS',
        'SUSPEND_USER',
        'ACTIVATE_USER',
        'CANCEL_BOOKING',
        'REFUND_BOOKING',
        'ADMIN_ADJUSTMENT',
        'UPDATE_PROFILE',
        'CREATE_CONDUCTOR',
        'UPDATE_CONDUCTOR',
        'SUSPEND_CONDUCTOR',
        'ACTIVATE_CONDUCTOR',
        'ASSIGN_CONDUCTOR',
        'REMOVE_CONDUCTOR',
        'BOARD_PASSENGER',
      ],
      index: true,
    },
    targetResource: {
      type: String,
      required: true,
      enum: ['User', 'Conductor', 'Bus', 'Operator', 'Route', 'Schedule', 'Booking', 'Wallet', 'Payment', 'System'],
      index: true,
    },
    targetId: {
      type: String,
      default: 'N/A',
      index: true,
    },
    reason: {
      type: String,
      default: 'N/A',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
