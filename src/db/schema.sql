-- LankaExpressway Relational Database Schema
-- Sri Lanka Online Luxury Bus Reservation System

PRAGMA foreign_keys = ON;

-- 1. Bus Operators Table
CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  website TEXT,
  operator_type TEXT DEFAULT 'Private', -- 'Private', 'Public', 'Franchise'
  service_category TEXT DEFAULT 'Super Luxury', -- 'Luxury', 'Super Luxury', 'Premium'
  status TEXT DEFAULT 'Active', -- 'Active', 'Inactive'
  source_name TEXT,
  source_url TEXT,
  last_verified_date TEXT,
  data_status TEXT DEFAULT 'Verified', -- 'Verified', 'Partially Verified', 'Unverified'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bus Routes Table
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  route_no TEXT NOT NULL,
  name TEXT NOT NULL,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  boarding_points TEXT, -- JSON array of strings: e.g. ["Makumbura MMC", "Kottawa Interchange"]
  dropping_points TEXT, -- JSON array of strings: e.g. ["Galle MMC", "Karapitiya"]
  highway_route TEXT,   -- e.g. 'Southern Expressway (E01)', 'Central Expressway (E04)', 'A9 Highway'
  distance_km TEXT,     -- e.g. '116 km'
  toll_fee REAL DEFAULT 0,
  status TEXT DEFAULT 'Active',
  source_name TEXT,
  source_url TEXT,
  last_verified_date TEXT,
  data_status TEXT DEFAULT 'Verified',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Buses Table
CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  bus_no TEXT,          -- Real plate e.g. 'WP ND-4582' or NULL if unverified
  name TEXT NOT NULL,   -- e.g. 'Superline Royal Cruiser'
  model TEXT,           -- e.g. 'Volvo B11R Multi-Axle', 'Yutong ZK6122H', 'Ashok Leyland Viking AC'
  bus_type TEXT NOT NULL, -- e.g. 'Super Luxury Volvo', 'Luxury AC', 'Super Luxury Sleeper (2+1)'
  service_category TEXT DEFAULT 'Super Luxury', -- 'Luxury', 'Super Luxury', 'Premium'
  seat_layout TEXT DEFAULT '2+2', -- '2+2', '2+1'
  total_seats INTEGER NOT NULL DEFAULT 40,
  facilities TEXT,      -- JSON array of strings: e.g. ["Air Conditioning", "Reclining Seats", "USB Charging", "Wi-Fi", "TV"]
  rating REAL DEFAULT 4.7,
  status TEXT DEFAULT 'Active',
  source_name TEXT,
  source_url TEXT,
  last_verified_date TEXT,
  data_status TEXT DEFAULT 'Verified',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE
);

-- 4. Bus Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  bus_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  departure_time TEXT NOT NULL, -- e.g. '06:30 AM', '20:30 PM'
  arrival_time TEXT NOT NULL,   -- e.g. '08:00 AM', '05:30 AM'
  duration TEXT NOT NULL,       -- e.g. '1h 30m', '9h 00m'
  operating_days TEXT DEFAULT 'Daily', -- 'Daily', 'Mon-Fri', 'Weekends'
  fare REAL NOT NULL,           -- Ticket price in LKR
  currency TEXT DEFAULT 'LKR',
  online_booking INTEGER DEFAULT 1, -- 1: Yes, 0: No
  e_ticket_supported INTEGER DEFAULT 1,
  qr_ticket_supported INTEGER DEFAULT 1,
  reserved_seats TEXT DEFAULT '[]', -- JSON array of seat codes: e.g. ["A1", "A2"]
  status TEXT DEFAULT 'Active',
  source_name TEXT,
  source_url TEXT,
  last_verified_date TEXT,
  data_status TEXT DEFAULT 'Verified',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- 5. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_ref TEXT UNIQUE NOT NULL, -- e.g. 'SLB-2026-X8F9'
  user_id TEXT DEFAULT 'guest',
  schedule_id TEXT NOT NULL,
  passenger_name TEXT NOT NULL,
  passenger_email TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  passenger_nic TEXT,
  seats TEXT NOT NULL,         -- JSON array: e.g. ["A1", "A2"]
  total_amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'Card', -- 'Card', 'LankaQR', 'EzCash'
  payment_status TEXT DEFAULT 'Paid', -- 'Paid', 'Pending', 'Refunded'
  booking_date TEXT NOT NULL,
  qr_code_data TEXT,
  status TEXT DEFAULT 'Active', -- 'Active', 'Cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT
);

-- 6. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'user',   -- 'admin', 'user'
  phone TEXT,
  status TEXT DEFAULT 'Active', -- 'Active', 'Suspended'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal querying
CREATE INDEX IF NOT EXISTS idx_buses_operator ON buses(operator_id);
CREATE INDEX IF NOT EXISTS idx_schedules_bus ON schedules(bus_id);
CREATE INDEX IF NOT EXISTS idx_schedules_route ON schedules(route_id);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_routes_cities ON routes(from_city, to_city);
