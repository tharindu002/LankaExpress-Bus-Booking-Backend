import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, closeDB } from '../config/db.js';
import { Operator } from '../models/Operator.js';
import { Route } from '../models/Route.js';
import { Bus } from '../models/Bus.js';
import { Schedule } from '../models/Schedule.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import {
  verifiedOperators,
  verifiedRoutes,
  verifiedBuses,
  verifiedSchedules,
  verifiedUsers,
} from './verifiedData.js';

dotenv.config();

export const seedDatabase = async () => {
  try {
    console.log('🌱 Starting MongoDB database seeding for LankaExpressway...');

    // Clear existing collections
    await Operator.deleteMany({});
    await Route.deleteMany({});
    await Bus.deleteMany({});
    await Schedule.deleteMany({});
    await Booking.deleteMany({});
    await User.deleteMany({});

    console.log('🧹 Existing collection data cleared.');

    // Seed Operators
    const createdOperators = await Operator.insertMany(verifiedOperators);
    console.log(`✅ Seeded ${createdOperators.length} Operators.`);

    // Seed Routes
    const createdRoutes = await Route.insertMany(verifiedRoutes);
    console.log(`✅ Seeded ${createdRoutes.length} Routes.`);

    // Seed Buses (mapping ObjectId of operators)
    const busDocs = verifiedBuses.map((b) => {
      const opDoc = createdOperators.find((op) => op.operatorId === b.operatorId);
      return {
        ...b,
        operator: opDoc ? opDoc._id : null,
      };
    });
    const createdBuses = await Bus.insertMany(busDocs);
    console.log(`✅ Seeded ${createdBuses.length} Buses.`);

    // Seed Users first so conductor IDs are available
    const createdUsers = [];
    for (const u of verifiedUsers) {
      const user = new User(u);
      await user.save();
      createdUsers.push(user);
    }
    console.log(`✅ Seeded ${createdUsers.length} Users.`);

    const conductor1 = createdUsers.find((u) => u.userId === 'cond_301');
    const conductor2 = createdUsers.find((u) => u.userId === 'cond_302');

    // Seed Schedules (mapping ObjectId of bus, route, and conductor)
    const scheduleDocs = verifiedSchedules.map((s, index) => {
      const busDoc = createdBuses.find((b) => b.busId === s.busId);
      const routeDoc = createdRoutes.find((r) => r.routeId === s.routeId);
      const assignedConductor = index % 2 === 0 ? conductor1 : conductor2;

      return {
        ...s,
        bus: busDoc ? busDoc._id : null,
        route: routeDoc ? routeDoc._id : null,
        conductor: assignedConductor ? assignedConductor._id : null,
        conductorId: assignedConductor ? assignedConductor.userId : null,
      };
    });
    const createdSchedules = await Schedule.insertMany(scheduleDocs);
    console.log(`✅ Seeded ${createdSchedules.length} Schedules.`);

    // Seed Sample Bookings
    const sampleBookings = [
      {
        bookingRef: 'SLB-2026-X8F9',
        userId: 'cust_241',
        user: createdUsers.find((u) => u.userId === 'cust_241')?._id,
        scheduleId: 'S-01',
        schedule: createdSchedules.find((s) => s.scheduleId === 'S-01')?._id,
        passengerName: 'Hasini Sithara',
        passengerEmail: 'hasini@gmail.com',
        passengerPhone: '+94 77 456 7890',
        passengerNic: '199854120341',
        seats: ['A1', 'A2'],
        totalAmount: 840,
        paymentMethod: 'Card',
        paymentStatus: 'Paid',
        bookingDate: '2026-08-26',
        qrCodeData: 'LANKAEXPRESSWAY:REF:SLB-2026-X8F9:SCHED:S-01:SEATS:A1,A2:PAID',
        status: 'Active',
      },
      {
        bookingRef: 'SLB-2026-W9K2',
        userId: 'cust_200',
        user: createdUsers.find((u) => u.userId === 'cust_200')?._id,
        scheduleId: 'S-10',
        schedule: createdSchedules.find((s) => s.scheduleId === 'S-10')?._id,
        passengerName: 'Tharidu Silva',
        passengerEmail: 'customer@gmail.com',
        passengerPhone: '+94 71 987 6543',
        passengerNic: '199587410293',
        seats: ['A1', 'A2'],
        totalAmount: 7000,
        paymentMethod: 'LankaQR',
        paymentStatus: 'Paid',
        bookingDate: '2026-08-26',
        qrCodeData: 'LANKAEXPRESSWAY:REF:SLB-2026-W9K2:SCHED:S-10:SEATS:A1,A2:PAID',
        status: 'Active',
      },
    ];

    const createdBookings = await Booking.insertMany(sampleBookings);
    console.log(`✅ Seeded ${createdBookings.length} Bookings.`);

    console.log('🎉 MongoDB Database Seeding Complete!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  }
};

// If run directly from CLI (`node src/seed/seed.js`)
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    await connectDB();
    await seedDatabase();
    await closeDB();
    process.exit(0);
  })();
}
