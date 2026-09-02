import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Initialize SQLite database instance
export const db = new DatabaseSync(DB_PATH);

// Run initial migrations
export function initDB() {
  db.exec('PRAGMA foreign_keys = ON;');
  const schemaSQL = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schemaSQL);
  console.log('✅ SQLite Database schema initialized successfully at:', DB_PATH);
}

// Database helper utilities
export const queryHelpers = {
  // Operators
  getOperators: () => {
    return db.prepare('SELECT * FROM operators ORDER BY name ASC').all();
  },
  getOperatorById: (id) => {
    return db.prepare('SELECT * FROM operators WHERE id = ?').get(id);
  },
  createOperator: (op) => {
    const stmt = db.prepare(`
      INSERT INTO operators (id, name, contact_number, email, website, operator_type, service_category, status, source_name, source_url, last_verified_date, data_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      op.id, op.name, op.contact_number || null, op.email || null, op.website || null,
      op.operator_type || 'Private', op.service_category || 'Super Luxury',
      op.status || 'Active', op.source_name || null, op.source_url || null,
      op.last_verified_date || null, op.data_status || 'Verified', op.notes || null
    );
    return queryHelpers.getOperatorById(op.id);
  },
  updateOperator: (op) => {
    const stmt = db.prepare(`
      UPDATE operators SET 
        name = ?, contact_number = ?, email = ?, website = ?, operator_type = ?, 
        service_category = ?, status = ?, source_name = ?, source_url = ?, 
        last_verified_date = ?, data_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      op.name, op.contact_number || null, op.email || null, op.website || null,
      op.operator_type || 'Private', op.service_category || 'Super Luxury',
      op.status || 'Active', op.source_name || null, op.source_url || null,
      op.last_verified_date || null, op.data_status || 'Verified', op.notes || null,
      op.id
    );
    return queryHelpers.getOperatorById(op.id);
  },
  deleteOperator: (id) => {
    db.prepare('DELETE FROM operators WHERE id = ?').run(id);
    return true;
  },

  // Routes
  getRoutes: () => {
    const rows = db.prepare('SELECT * FROM routes ORDER BY route_no ASC').all();
    return rows.map(r => ({
      ...r,
      boarding_points: r.boarding_points ? JSON.parse(r.boarding_points) : [],
      dropping_points: r.dropping_points ? JSON.parse(r.dropping_points) : []
    }));
  },
  getRouteById: (id) => {
    const r = db.prepare('SELECT * FROM routes WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...r,
      boarding_points: r.boarding_points ? JSON.parse(r.boarding_points) : [],
      dropping_points: r.dropping_points ? JSON.parse(r.dropping_points) : []
    };
  },
  createRoute: (route) => {
    const stmt = db.prepare(`
      INSERT INTO routes (id, route_no, name, from_city, to_city, boarding_points, dropping_points, highway_route, distance_km, toll_fee, status, source_name, source_url, last_verified_date, data_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      route.id, route.route_no, route.name, route.from_city, route.to_city,
      JSON.stringify(route.boarding_points || []),
      JSON.stringify(route.dropping_points || []),
      route.highway_route || null, route.distance_km || null,
      parseFloat(route.toll_fee || 0), route.status || 'Active',
      route.source_name || null, route.source_url || null,
      route.last_verified_date || null, route.data_status || 'Verified', route.notes || null
    );
    return queryHelpers.getRouteById(route.id);
  },
  updateRoute: (route) => {
    const stmt = db.prepare(`
      UPDATE routes SET 
        route_no = ?, name = ?, from_city = ?, to_city = ?, 
        boarding_points = ?, dropping_points = ?, highway_route = ?, 
        distance_km = ?, toll_fee = ?, status = ?, source_name = ?, 
        source_url = ?, last_verified_date = ?, data_status = ?, notes = ?, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      route.route_no, route.name, route.from_city, route.to_city,
      JSON.stringify(route.boarding_points || []),
      JSON.stringify(route.dropping_points || []),
      route.highway_route || null, route.distance_km || null,
      parseFloat(route.toll_fee || 0), route.status || 'Active',
      route.source_name || null, route.source_url || null,
      route.last_verified_date || null, route.data_status || 'Verified', route.notes || null,
      route.id
    );
    return queryHelpers.getRouteById(route.id);
  },
  deleteRoute: (id) => {
    db.prepare('DELETE FROM routes WHERE id = ?').run(id);
    return true;
  },

  // Buses
  getBuses: () => {
    const rows = db.prepare(`
      SELECT b.*, o.name as operator_name, o.contact_number as operator_contact, o.email as operator_email, o.website as operator_website
      FROM buses b
      LEFT JOIN operators o ON b.operator_id = o.id
      ORDER BY b.name ASC
    `).all();
    return rows.map(b => ({
      ...b,
      facilities: b.facilities ? JSON.parse(b.facilities) : []
    }));
  },
  getBusById: (id) => {
    const b = db.prepare(`
      SELECT b.*, o.name as operator_name, o.contact_number as operator_contact, o.email as operator_email, o.website as operator_website
      FROM buses b
      LEFT JOIN operators o ON b.operator_id = o.id
      WHERE b.id = ?
    `).get(id);
    if (!b) return null;
    return {
      ...b,
      facilities: b.facilities ? JSON.parse(b.facilities) : []
    };
  },
  createBus: (bus) => {
    const stmt = db.prepare(`
      INSERT INTO buses (id, operator_id, bus_no, name, model, bus_type, service_category, seat_layout, total_seats, facilities, rating, status, source_name, source_url, last_verified_date, data_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      bus.id, bus.operator_id, bus.bus_no || null, bus.name, bus.model || null,
      bus.bus_type, bus.service_category || 'Super Luxury',
      bus.seat_layout || '2+2', parseInt(bus.total_seats || 40, 10),
      JSON.stringify(bus.facilities || []), parseFloat(bus.rating || 4.7),
      bus.status || 'Active', bus.source_name || null, bus.source_url || null,
      bus.last_verified_date || null, bus.data_status || 'Verified', bus.notes || null
    );
    return queryHelpers.getBusById(bus.id);
  },
  updateBus: (bus) => {
    const stmt = db.prepare(`
      UPDATE buses SET 
        operator_id = ?, bus_no = ?, name = ?, model = ?, bus_type = ?, 
        service_category = ?, seat_layout = ?, total_seats = ?, facilities = ?, 
        rating = ?, status = ?, source_name = ?, source_url = ?, 
        last_verified_date = ?, data_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      bus.operator_id, bus.bus_no || null, bus.name, bus.model || null,
      bus.bus_type, bus.service_category || 'Super Luxury',
      bus.seat_layout || '2+2', parseInt(bus.total_seats || 40, 10),
      JSON.stringify(bus.facilities || []), parseFloat(bus.rating || 4.7),
      bus.status || 'Active', bus.source_name || null, bus.source_url || null,
      bus.last_verified_date || null, bus.data_status || 'Verified', bus.notes || null,
      bus.id
    );
    return queryHelpers.getBusById(bus.id);
  },
  deleteBus: (id) => {
    db.prepare('DELETE FROM buses WHERE id = ?').run(id);
    return true;
  },

  // Schedules
  getSchedules: (from, to, date) => {
    let query = `
      SELECT s.*, 
        b.bus_no, b.name as bus_name, b.model as bus_model, b.bus_type, b.service_category, b.seat_layout, b.total_seats, b.facilities, b.rating as bus_rating,
        o.id as operator_id, o.name as operator_name, o.contact_number as operator_contact, o.email as operator_email, o.website as operator_website,
        r.route_no, r.name as route_name, r.from_city, r.to_city, r.boarding_points, r.dropping_points, r.highway_route, r.distance_km, r.toll_fee
      FROM schedules s
      JOIN buses b ON s.bus_id = b.id
      JOIN operators o ON b.operator_id = o.id
      JOIN routes r ON s.route_id = r.id
      WHERE s.status = 'Active'
    `;
    const params = [];

    if (from) {
      query += ` AND LOWER(r.from_city) LIKE LOWER(?)`;
      params.push(`%${from}%`);
    }
    if (to) {
      query += ` AND LOWER(r.to_city) LIKE LOWER(?)`;
      params.push(`%${to}%`);
    }

    query += ` ORDER BY s.departure_time ASC`;

    const rows = db.prepare(query).all(...params);
    return rows.map(r => ({
      id: r.id,
      busId: r.bus_id,
      routeId: r.route_id,
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
      duration: r.duration,
      operatingDays: r.operating_days,
      fare: r.fare,
      currency: r.currency,
      onlineBooking: Boolean(r.online_booking),
      eTicketSupported: Boolean(r.e_ticket_supported),
      qrTicketSupported: Boolean(r.qr_ticket_supported),
      reservedSeats: r.reserved_seats ? JSON.parse(r.reserved_seats) : [],
      status: r.status,
      sourceName: r.source_name,
      sourceUrl: r.source_url,
      lastVerifiedDate: r.last_verified_date,
      dataStatus: r.data_status,
      notes: r.notes,
      bus: {
        id: r.bus_id,
        busNo: r.bus_no,
        name: r.bus_name,
        model: r.bus_model,
        type: r.bus_type,
        serviceCategory: r.service_category,
        seatLayout: r.seat_layout,
        totalSeats: r.total_seats,
        amenities: r.facilities ? JSON.parse(r.facilities) : [],
        rating: r.bus_rating,
        operator: r.operator_name,
        operatorDetails: {
          id: r.operator_id,
          name: r.operator_name,
          contact: r.operator_contact,
          email: r.operator_email,
          website: r.operator_website
        }
      },
      route: {
        id: r.route_id,
        routeNo: r.route_no,
        name: r.route_name,
        from: r.from_city,
        to: r.to_city,
        boardingPoints: r.boarding_points ? JSON.parse(r.boarding_points) : [],
        droppingPoints: r.dropping_points ? JSON.parse(r.dropping_points) : [],
        highwayRoute: r.highway_route,
        distance: r.distance_km,
        tollFee: r.toll_fee
      }
    }));
  },
  getScheduleById: (id) => {
    const query = `
      SELECT s.*, 
        b.bus_no, b.name as bus_name, b.model as bus_model, b.bus_type, b.service_category, b.seat_layout, b.total_seats, b.facilities, b.rating as bus_rating,
        o.id as operator_id, o.name as operator_name, o.contact_number as operator_contact, o.email as operator_email, o.website as operator_website,
        r.route_no, r.name as route_name, r.from_city, r.to_city, r.boarding_points, r.dropping_points, r.highway_route, r.distance_km, r.toll_fee
      FROM schedules s
      JOIN buses b ON s.bus_id = b.id
      JOIN operators o ON b.operator_id = o.id
      JOIN routes r ON s.route_id = r.id
      WHERE s.id = ?
    `;
    const r = db.prepare(query).get(id);
    if (!r) return null;
    return {
      id: r.id,
      busId: r.bus_id,
      routeId: r.route_id,
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
      duration: r.duration,
      operatingDays: r.operating_days,
      fare: r.fare,
      currency: r.currency,
      onlineBooking: Boolean(r.online_booking),
      eTicketSupported: Boolean(r.e_ticket_supported),
      qrTicketSupported: Boolean(r.qr_ticket_supported),
      reservedSeats: r.reserved_seats ? JSON.parse(r.reserved_seats) : [],
      status: r.status,
      sourceName: r.source_name,
      sourceUrl: r.source_url,
      lastVerifiedDate: r.last_verified_date,
      dataStatus: r.data_status,
      notes: r.notes,
      bus: {
        id: r.bus_id,
        busNo: r.bus_no,
        name: r.bus_name,
        model: r.bus_model,
        type: r.bus_type,
        serviceCategory: r.service_category,
        seatLayout: r.seat_layout,
        totalSeats: r.total_seats,
        amenities: r.facilities ? JSON.parse(r.facilities) : [],
        rating: r.bus_rating,
        operator: r.operator_name,
        operatorDetails: {
          id: r.operator_id,
          name: r.operator_name,
          contact: r.operator_contact,
          email: r.operator_email,
          website: r.operator_website
        }
      },
      route: {
        id: r.route_id,
        routeNo: r.route_no,
        name: r.route_name,
        from: r.from_city,
        to: r.to_city,
        boardingPoints: r.boarding_points ? JSON.parse(r.boarding_points) : [],
        droppingPoints: r.dropping_points ? JSON.parse(r.dropping_points) : [],
        highwayRoute: r.highway_route,
        distance: r.distance_km,
        tollFee: r.toll_fee
      }
    };
  },
  createSchedule: (schedule) => {
    const stmt = db.prepare(`
      INSERT INTO schedules (id, bus_id, route_id, departure_time, arrival_time, duration, operating_days, fare, currency, online_booking, e_ticket_supported, qr_ticket_supported, reserved_seats, status, source_name, source_url, last_verified_date, data_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      schedule.id, schedule.bus_id || schedule.busId, schedule.route_id || schedule.routeId,
      schedule.departure_time || schedule.departureTime, schedule.arrival_time || schedule.arrivalTime,
      schedule.duration, schedule.operating_days || schedule.operatingDays || 'Daily',
      parseFloat(schedule.fare), schedule.currency || 'LKR',
      schedule.online_booking ?? 1, schedule.e_ticket_supported ?? 1, schedule.qr_ticket_supported ?? 1,
      JSON.stringify(schedule.reserved_seats || schedule.reservedSeats || []),
      schedule.status || 'Active', schedule.source_name || schedule.sourceName || null,
      schedule.source_url || schedule.sourceUrl || null,
      schedule.last_verified_date || schedule.lastVerifiedDate || null,
      schedule.data_status || schedule.dataStatus || 'Verified',
      schedule.notes || null
    );
    return queryHelpers.getScheduleById(schedule.id);
  },
  updateSchedule: (schedule) => {
    const stmt = db.prepare(`
      UPDATE schedules SET 
        bus_id = ?, route_id = ?, departure_time = ?, arrival_time = ?, 
        duration = ?, operating_days = ?, fare = ?, currency = ?, 
        online_booking = ?, e_ticket_supported = ?, qr_ticket_supported = ?, 
        reserved_seats = ?, status = ?, source_name = ?, source_url = ?, 
        last_verified_date = ?, data_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      schedule.bus_id || schedule.busId, schedule.route_id || schedule.routeId,
      schedule.departure_time || schedule.departureTime, schedule.arrival_time || schedule.arrivalTime,
      schedule.duration, schedule.operating_days || schedule.operatingDays || 'Daily',
      parseFloat(schedule.fare), schedule.currency || 'LKR',
      schedule.online_booking ?? 1, schedule.e_ticket_supported ?? 1, schedule.qr_ticket_supported ?? 1,
      JSON.stringify(schedule.reserved_seats || schedule.reservedSeats || []),
      schedule.status || 'Active', schedule.source_name || schedule.sourceName || null,
      schedule.source_url || schedule.sourceUrl || null,
      schedule.last_verified_date || schedule.lastVerifiedDate || null,
      schedule.data_status || schedule.dataStatus || 'Verified',
      schedule.notes || null,
      schedule.id
    );
    return queryHelpers.getScheduleById(schedule.id);
  },
  deleteSchedule: (id) => {
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return true;
  },

  // Bookings
  createBooking: (b) => {
    const stmt = db.prepare(`
      INSERT INTO bookings (id, booking_ref, user_id, schedule_id, passenger_name, passenger_email, passenger_phone, passenger_nic, seats, total_amount, payment_method, payment_status, booking_date, qr_code_data, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      b.id, b.booking_ref || b.bookingRef, b.user_id || b.userId || 'guest',
      b.schedule_id || b.scheduleId, b.passenger_name || b.name,
      b.passenger_email || b.email, b.passenger_phone || b.phone,
      b.passenger_nic || b.nic || null,
      JSON.stringify(b.seats || []), parseFloat(b.total_amount || b.totalAmount),
      b.payment_method || b.paymentMethod || 'Card',
      b.payment_status || b.paymentStatus || 'Paid',
      b.booking_date || b.bookingDate || new Date().toISOString().split('T')[0],
      b.qr_code_data || b.qrCodeData || null,
      b.status || 'Active'
    );

    // Reserve seats on schedule
    const sched = queryHelpers.getScheduleById(b.schedule_id || b.scheduleId);
    if (sched) {
      const currentReserved = sched.reservedSeats || [];
      const updatedReserved = Array.from(new Set([...currentReserved, ...b.seats]));
      db.prepare('UPDATE schedules SET reserved_seats = ? WHERE id = ?')
        .run(JSON.stringify(updatedReserved), sched.id);
    }

    return queryHelpers.getBookingByRef(b.booking_ref || b.bookingRef);
  },
  getBookingByRef: (ref) => {
    const b = db.prepare('SELECT * FROM bookings WHERE booking_ref = ?').get(ref);
    if (!b) return null;
    const schedule = queryHelpers.getScheduleById(b.schedule_id);
    return {
      id: b.id,
      bookingRef: b.booking_ref,
      userId: b.user_id,
      passengerName: b.passenger_name,
      passengerEmail: b.passenger_email,
      passengerPhone: b.passenger_phone,
      passengerNic: b.passenger_nic,
      scheduleId: b.schedule_id,
      seats: b.seats ? JSON.parse(b.seats) : [],
      totalAmount: b.total_amount,
      paymentMethod: b.payment_method,
      paymentStatus: b.payment_status,
      bookingDate: b.booking_date,
      qrCodeData: b.qr_code_data,
      status: b.status,
      schedule
    };
  },
  getBookings: () => {
    const rows = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
    return rows.map(b => {
      const schedule = queryHelpers.getScheduleById(b.schedule_id);
      return {
        id: b.id,
        bookingRef: b.booking_ref,
        userId: b.user_id,
        passengerName: b.passenger_name,
        passengerEmail: b.passenger_email,
        passengerPhone: b.passenger_phone,
        passengerNic: b.passenger_nic,
        scheduleId: b.schedule_id,
        seats: b.seats ? JSON.parse(b.seats) : [],
        totalAmount: b.total_amount,
        paymentMethod: b.payment_method,
        paymentStatus: b.payment_status,
        bookingDate: b.booking_date,
        qrCodeData: b.qr_code_data,
        status: b.status,
        schedule
      };
    });
  },
  getUserBookings: (userId) => {
    const rows = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return rows.map(b => {
      const schedule = queryHelpers.getScheduleById(b.schedule_id);
      return {
        id: b.id,
        bookingRef: b.booking_ref,
        userId: b.user_id,
        passengerName: b.passenger_name,
        passengerEmail: b.passenger_email,
        passengerPhone: b.passenger_phone,
        passengerNic: b.passenger_nic,
        scheduleId: b.schedule_id,
        seats: b.seats ? JSON.parse(b.seats) : [],
        totalAmount: b.total_amount,
        paymentMethod: b.payment_method,
        paymentStatus: b.payment_status,
        bookingDate: b.booking_date,
        qrCodeData: b.qr_code_data,
        status: b.status,
        schedule
      };
    });
  },
  cancelBooking: (ref) => {
    const b = db.prepare('SELECT * FROM bookings WHERE booking_ref = ?').get(ref);
    if (!b) return false;

    db.prepare("UPDATE bookings SET status = 'Cancelled' WHERE booking_ref = ?").run(ref);

    // Release seats
    const sched = queryHelpers.getScheduleById(b.schedule_id);
    if (sched) {
      const seatsToRelease = b.seats ? JSON.parse(b.seats) : [];
      const updatedReserved = (sched.reservedSeats || []).filter(s => !seatsToRelease.includes(s));
      db.prepare('UPDATE schedules SET reserved_seats = ? WHERE id = ?')
        .run(JSON.stringify(updatedReserved), sched.id);
    }
    return true;
  },

  // Users
  getUsers: () => {
    return db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY name ASC').all();
  },
  updateUserStatus: (userId, status) => {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    return true;
  },
  toggleUserRole: (userId) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (!user) return false;
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);
    return true;
  },

  // Admin Stats
  getAdminStats: () => {
    const bookings = queryHelpers.getBookings();
    const activeBookings = bookings.filter(b => b.status === 'Active');
    const totalRevenue = activeBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const busCount = db.prepare('SELECT COUNT(*) as count FROM buses').get().count;
    const routeCount = db.prepare('SELECT COUNT(*) as count FROM routes').get().count;
    const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules').get().count;
    const operatorCount = db.prepare('SELECT COUNT(*) as count FROM operators').get().count;
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const routes = queryHelpers.getRoutes();
    const revenueByRoute = routes.map(r => {
      const routeBookings = activeBookings.filter(b => b.schedule?.routeId === r.id);
      const revenue = routeBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      return {
        routeNo: r.route_no,
        label: `${r.from_city.split(' ')[0]} - ${r.to_city.split(' ')[0]}`,
        revenue
      };
    });

    return {
      kpis: {
        totalRevenue,
        activeBookings: activeBookings.length,
        busCount,
        routeCount,
        scheduleCount,
        operatorCount,
        userCount
      },
      revenueByRoute,
      recentBookings: bookings.slice(0, 5)
    };
  }
};
