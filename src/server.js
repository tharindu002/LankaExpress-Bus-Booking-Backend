import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { seedDatabase } from './seed/seed.js';
import { Operator } from './models/Operator.js';
import { User } from './models/User.js';
import { Wallet } from './models/Wallet.js';
import { WalletTransaction } from './models/WalletTransaction.js';

// Import routers
import authRoutes from './routes/authRoutes.js';
import operatorRoutes from './routes/operatorRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import busRoutes from './routes/busRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import payhereRoutes from './routes/payhereRoutes.js';

// Import middleware
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

import http from 'http';
import { Server } from 'socket.io';
import conductorRoutes from './routes/conductorRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  socket.on('join_conductor', (conductorId) => {
    if (conductorId) {
      console.log(`🔌 Conductor socket ${socket.id} joined room: conductor_${conductorId}`);
      socket.join(`conductor_${conductorId}`);
    }
  });
});

// Attach io to app for optional request access
app.set('io', io);

// Enable CORS & JSON Parsing
const allowedOrigins = [
  'https://lanka-express-bus-booking.vercel.app',
  'https://lankaexpress-bus-booking.vercel.app',
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'x-user-id',
      'X-User-Id',
      'x-user-role',
      'X-User-Role',
      'Origin',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers'
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root endpoint for Render health check ping
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'LankaExpressway API Running' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'LankaExpressway API',
    database: 'MongoDB Atlas',
    payhereSandbox: process.env.PAYHERE_SANDBOX === 'true',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // mounts /api/users
app.use('/api/operators', operatorRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conductor', conductorRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payhere', payhereRoutes);

// Error Middleware
app.use(notFound);
app.use(errorHandler);

// Connect DB & Start Server
const startServer = async () => {
  try {
    await connectDB();

    // Check if initial seeding is needed
    const opCount = await Operator.countDocuments();
    if (opCount === 0) {
      console.log('🌱 Empty database detected. Auto-seeding initial Sri Lankan bus dataset...');
      await seedDatabase();
    } else {
      console.log(`ℹ️ Database already contains ${opCount} operators. Auto-seed skipped.`);
    }

    // Cleanse any unfunded wallets in existing database so all un-topped-up users have strictly 0.00 balance
    try {
      const unfundedWallets = await Wallet.find({ balance: { $gt: 0 } });
      for (const w of unfundedWallets) {
        const topup = await WalletTransaction.findOne({
          $or: [{ walletId: w._id }, { userId: w.userId }],
          status: 'COMPLETED',
          type: 'CREDIT',
        });
        if (!topup) {
          console.log(`🧹 Resetting unfunded wallet balance for user ${w.userId} to 0`);
          w.balance = 0;
          await w.save();
          await User.findByIdAndUpdate(w.userId, { walletBalance: 0 });
        }
      }
      const unfundedUsers = await User.find({ walletBalance: { $gt: 0 } });
      for (const u of unfundedUsers) {
        const topup = await WalletTransaction.findOne({
          userId: u._id,
          status: 'COMPLETED',
          type: 'CREDIT',
        });
        if (!topup) {
          console.log(`🧹 Resetting unfunded user document balance for ${u.email} to 0`);
          u.walletBalance = 0;
          await u.save();
          await Wallet.findOneAndUpdate({ userId: u._id }, { balance: 0 });
        }
      }
      // Refund excess 950 LKR deduction to nihalperera02@gmail.com
      const targetUser = await User.findOne({ email: 'nihalperera02@gmail.com' });
      if (targetUser) {
        const wallet = await Wallet.findOne({ userId: targetUser._id });
        if (wallet && wallet.balance < 500) {
          console.log('💰 Adjusting excess deduction for nihalperera02@gmail.com. New balance: 1010 LKR');
          wallet.balance = 1010;
          await wallet.save();
          targetUser.walletBalance = 1010;
          await targetUser.save();
        }
      }
    } catch (e) {
      console.warn('⚠️ Wallet audit error:', e.message);
    }

    server.listen(PORT, () => {
      console.log(`🚀 LankaExpressway MongoDB Express Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
// LankaExpressway Server Ready
