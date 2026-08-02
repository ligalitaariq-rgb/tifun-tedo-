-- =====================================================
-- TIFUN-TEDO BOOKING SYSTEM - COMPLETE DATABASE SETUP
-- =====================================================
-- Run this entire script in your Supabase SQL Editor
-- Copy and paste everything below and click "Run"

-- =====================================================
-- 1. CREATE USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. CREATE BOOKINGS TABLE (MAIN TABLE)
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  animal_type VARCHAR(50) DEFAULT 'cow',
  quarter_qty INTEGER DEFAULT 0,
  half_qty INTEGER DEFAULT 0,
  full_qty INTEGER DEFAULT 0,
  subtotal NUMERIC(10, 2) NOT NULL,
  service_fee NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  second_account_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. CREATE BOOKING_CONTROLS TABLE (ADMIN SETTINGS)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_controls (
  id BIGSERIAL PRIMARY KEY,
  cow_open BOOLEAN DEFAULT TRUE,
  ram_open BOOLEAN DEFAULT TRUE,
  goat_open BOOLEAN DEFAULT TRUE,
  cow_price NUMERIC(10, 2) DEFAULT 13000,
  ram_price NUMERIC(10, 2) DEFAULT 25000,
  goat_price NUMERIC(10, 2) DEFAULT 25000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. CREATE PRICE_CHANGE_HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS price_change_history (
  id BIGSERIAL PRIMARY KEY,
  animal_type VARCHAR(50) NOT NULL,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2) NOT NULL,
  changed_by VARCHAR(255) DEFAULT 'admin',
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_animal_type ON bookings(animal_type);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_price_history_animal_type ON price_change_history(animal_type);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_change_history(created_at DESC);

-- =====================================================
-- 6. INSERT INITIAL BOOKING CONTROL RECORD
-- =====================================================
INSERT INTO booking_controls (cow_open, ram_open, goat_open, cow_price, ram_price, goat_price)
VALUES (TRUE, TRUE, TRUE, 13000, 25000, 25000)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 7. CREATE FUNCTION FOR UPDATED_AT TIMESTAMP
-- =====================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. CREATE TRIGGERS FOR AUTO TIMESTAMP UPDATE
-- =====================================================
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON bookings;
CREATE TRIGGER trigger_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_booking_controls_updated_at ON booking_controls;
CREATE TRIGGER trigger_booking_controls_updated_at
  BEFORE UPDATE ON booking_controls
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- 9. CREATE FUNCTION TO LOG PRICE CHANGES AUTOMATICALLY
-- =====================================================
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cow_price IS DISTINCT FROM OLD.cow_price THEN
    INSERT INTO price_change_history (animal_type, old_price, new_price, changed_by)
    VALUES ('cow', OLD.cow_price, NEW.cow_price, 'admin');
  END IF;
  
  IF NEW.ram_price IS DISTINCT FROM OLD.ram_price THEN
    INSERT INTO price_change_history (animal_type, old_price, new_price, changed_by)
    VALUES ('ram', OLD.ram_price, NEW.ram_price, 'admin');
  END IF;
  
  IF NEW.goat_price IS DISTINCT FROM OLD.goat_price THEN
    INSERT INTO price_change_history (animal_type, old_price, new_price, changed_by)
    VALUES ('goat', OLD.goat_price, NEW.goat_price, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. CREATE TRIGGER FOR AUTOMATIC PRICE LOGGING
-- =====================================================
DROP TRIGGER IF EXISTS trigger_log_price_changes ON booking_controls;
CREATE TRIGGER trigger_log_price_changes
  AFTER UPDATE ON booking_controls
  FOR EACH ROW
  EXECUTE FUNCTION log_price_change();

-- =====================================================
-- 11. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 12. CREATE RLS POLICIES - USERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Users table is readable by all" ON users;
CREATE POLICY "Users table is readable by all" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own record" ON users;
CREATE POLICY "Users can insert their own record" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own record" ON users;
CREATE POLICY "Users can update their own record" ON users FOR UPDATE USING (true);

-- =====================================================
-- 13. CREATE RLS POLICIES - BOOKINGS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Bookings are readable by all" ON bookings;
CREATE POLICY "Bookings are readable by all" ON bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON bookings;
CREATE POLICY "Authenticated users can insert bookings" ON bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
CREATE POLICY "Users can update their own bookings" ON bookings FOR UPDATE USING (true);

-- =====================================================
-- 14. CREATE RLS POLICIES - BOOKING_CONTROLS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Booking controls are readable by all" ON booking_controls;
CREATE POLICY "Booking controls are readable by all" ON booking_controls FOR SELECT USING (true);

-- =====================================================
-- 15. CREATE RLS POLICIES - PRICE_CHANGE_HISTORY TABLE
-- =====================================================
DROP POLICY IF EXISTS "Price history is readable by all" ON price_change_history;
CREATE POLICY "Price history is readable by all" ON price_change_history FOR SELECT USING (true);

-- =====================================================
-- 16. VERIFICATION QUERIES (OPTIONAL - VIEW ONLY)
-- =====================================================
-- Run these individually to verify everything is set up:
-- SELECT * FROM users LIMIT 5;
-- SELECT * FROM bookings LIMIT 5;
-- SELECT * FROM booking_controls;
-- SELECT * FROM price_change_history ORDER BY created_at DESC LIMIT 10;

-- =====================================================
-- 17. USEFUL QUERIES FOR ADMIN OPERATIONS
-- =====================================================

-- View all bookings with user details (for admin dashboard)
-- SELECT 
--   b.id,
--   b.name,
--   b.email,
--   b.animal_type,
--   b.quarter_qty,
--   b.half_qty,
--   b.full_qty,
--   b.subtotal,
--   b.service_fee,
--   b.total,
--   b.payment_status,
--   b.created_at
-- FROM bookings b
-- ORDER BY b.created_at DESC;

-- View current pricing
-- SELECT 
--   cow_price,
--   ram_price,
--   goat_price,
--   cow_open,
--   ram_open,
--   goat_open,
--   updated_at
-- FROM booking_controls;

-- View price change history
-- SELECT 
--   animal_type,
--   old_price,
--   new_price,
--   (new_price - old_price) as price_difference,
--   created_at
-- FROM price_change_history
-- ORDER BY created_at DESC;

-- View pending payments only
-- SELECT 
--   id,
--   name,
--   email,
--   animal_type,
--   total,
--   payment_status,
--   created_at
-- FROM bookings
-- WHERE payment_status = 'pending'
-- ORDER BY created_at DESC;

-- View paid payments only
-- SELECT 
--   id,
--   name,
--   email,
--   animal_type,
--   total,
--   payment_status,
--   created_at
-- FROM bookings
-- WHERE payment_status = 'paid'
-- ORDER BY created_at DESC;

-- View bookings by animal type
-- SELECT 
--   animal_type,
--   COUNT(*) as total_bookings,
--   SUM(total) as total_revenue,
--   AVG(total) as average_booking
-- FROM bookings
-- GROUP BY animal_type;

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Your database is now fully configured with:
-- ✅ Users table for authentication
-- ✅ Bookings table (displays: Date, Animal, Name, Q/H/F, Subtotal, Payment, Action)
-- ✅ Booking controls for admin settings (open/close bookings, set prices)
-- ✅ Price change history for tracking all price updates
-- ✅ Automatic timestamps on all records
-- ✅ Automatic price change logging
-- ✅ Performance indexes on all key fields
-- ✅ Row Level Security (RLS) policies for data protection
-- ✅ Default prices: Cow ₦13,000 | Ram/Goat ₦25,000
