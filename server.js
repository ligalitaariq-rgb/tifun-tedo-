// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

// =====================
// DATABASE CONNECTION - SUPABASE
// =====================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "default-admin-secret";

// Test connection
supabase.auth.getSession()
  .then(() => console.log("✅ Supabase connected"))
  .catch(err => console.error("❌ Supabase error:", err));

// =====================
// APP SETUP
// =====================
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

async function ensureBookingControlRow() {
  const { data, error } = await supabase
    .from("booking_controls")
    .select("*")
    .limit(1);

  if (error) throw error;
  if (data.length === 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("booking_controls")
      .insert([{ cow_open: true, ram_open: true, goat_open: true }])
      .select()
      .single();
    if (insertError) throw insertError;
    return inserted;
  }

  return data[0];
}

async function setAnimalBookingState(animalType, isOpen) {
  const row = await ensureBookingControlRow();
  const updateData = {};
  if (animalType === 'cow') updateData.cow_open = isOpen;
  if (animalType === 'ram') updateData.ram_open = isOpen;
  if (animalType === 'goat') updateData.goat_open = isOpen;

  const { data, error } = await supabase
    .from("booking_controls")
    .update(updateData)
    .eq("id", row.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function setAnimalPrice(animalType, fullPrice) {
  const row = await ensureBookingControlRow();
  const updateData = {};
  const priceNum = Number(fullPrice);
  if (isNaN(priceNum) || priceNum <= 0) throw new Error("Invalid price value");

  if (animalType === 'cow') updateData.cow_price = priceNum;
  if (animalType === 'ram') updateData.ram_price = priceNum;
  if (animalType === 'goat') updateData.goat_price = priceNum;

  const { data, error } = await supabase
    .from("booking_controls")
    .update(updateData)
    .eq("id", row.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getBookingControlState() {
  return await ensureBookingControlRow();
}

function isAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function isAdminRequest(req) {
  return req.headers["x-admin-secret"] === ADMIN_SECRET;
}

// =====================
// ROUTES
// =====================
// =====================
// AUTH ROUTES
// =====================
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username and password required" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ username, password: hashedPassword }])
      .select();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: "Username already exists" });
      return res.status(500).json({ message: "Signup failed", error: error.message });
    }

    res.status(201).json({ message: "Account created successfully", user: { id: data[0].id, username: data[0].username } });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (isAdminCredentials(username, password)) {
      return res.json({
        message: "Login successful",
        user: {
          id: "admin",
          username: ADMIN_USERNAME,
          isAdmin: true,
          adminSecret: ADMIN_SECRET
        }
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !user) return res.status(401).json({ message: "Invalid username or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid username or password" });

    res.json({ message: "Login successful", user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/admin/bookings", async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Admin credentials required" });

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: "Failed to load bookings" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/admin/booking-status", async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Admin credentials required" });

    const state = await getBookingControlState();
    res.json({
      cow_open: state.cow_open !== false,
      ram_open: state.ram_open !== false,
      goat_open: state.goat_open !== false
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/admin/booking-toggle", async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Admin credentials required" });

    const { animalType, action } = req.body;
    if (!['cow', 'ram', 'goat'].includes(animalType)) {
      return res.status(400).json({ message: "Invalid animal type" });
    }
    if (action !== "open" && action !== "close") {
      return res.status(400).json({ message: "Invalid action" });
    }

    const isOpen = action === "open";
    const state = await setAnimalBookingState(animalType, isOpen);
    res.json({ message: `${animalType} bookings are now ${isOpen ? 'open' : 'closed'}`, state });
  } catch (err) {
    res.status(500).json({ message: err.message || "Database update required. Please run setup_database.sql in Supabase." });
  }
});

// Public Endpoint to get current pricing for cow, ram, goat
app.get("/api/prices", async (req, res) => {
  try {
    const state = await getBookingControlState().catch(() => ({}));
    const cowFull = Number(state.cow_price) || 13000;
    const ramFull = Number(state.ram_price) || 25000;
    const goatFull = Number(state.goat_price) || 25000;

    res.json({
      cow: {
        full: cowFull,
        half: Math.round(cowFull / 2),
        quarter: Math.round(cowFull / 4)
      },
      ram: {
        full: ramFull,
        half: Math.round(ramFull / 2),
        quarter: Math.round(ramFull / 4)
      },
      goat: {
        full: goatFull,
        half: Math.round(goatFull / 2),
        quarter: Math.round(goatFull / 4)
      }
    });
  } catch (err) {
    res.json({
      cow: { full: 13000, half: 6500, quarter: 3250 },
      ram: { full: 25000, half: 12250, quarter: 6250 },
      goat: { full: 25000, half: 12250, quarter: 6250 }
    });
  }
});

// Admin Endpoint to update price for an animal
app.post("/api/admin/price-update", async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Admin credentials required" });

    const { animalType, fullPrice } = req.body;
    if (!['cow', 'ram', 'goat'].includes(animalType)) {
      return res.status(400).json({ message: "Invalid animal type" });
    }
    const priceNum = Number(fullPrice);
    if (!priceNum || priceNum <= 0) {
      return res.status(400).json({ message: "Please enter a valid positive price" });
    }

    const state = await setAnimalPrice(animalType, priceNum);
    const updatedFull = priceNum;
    res.json({
      message: `${animalType.toUpperCase()} price updated successfully to ₦${updatedFull.toLocaleString()}!`,
      pricing: {
        full: updatedFull,
        half: Math.round(updatedFull / 2),
        quarter: Math.round(updatedFull / 4)
      },
      state
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update price in database." });
  }
});

app.post("/api/admin/confirm-payment/:id", async (req, res) => {
  try {
    if (!isAdminRequest(req)) return res.status(403).json({ message: "Admin credentials required" });

    const { id } = req.params;
    const { data, error } = await supabase
      .from("bookings")
      .update({ payment_status: 'paid' })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ message: "Failed to update payment status", error: error.message });
    res.json({ message: "Payment confirmed", booking: data });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// BOOKING ROUTES
// =====================
app.post("/api/book", async (req, res) => {
  try {
    const { userId, name, email, animalType, quarter = 0, half = 0, full = 0, subtotal: reqSubtotal, service_fee: reqServiceFee, total } = req.body;

    if (!userId || !name || !email || total <= 0) {
      return res.status(400).json({ message: "Invalid booking data (Name and Email are required)" });
    }

    const computedSubtotal = reqSubtotal || total;
    const computedServiceFee = reqServiceFee !== undefined ? reqServiceFee : Math.round(computedSubtotal * 0.0077);

    const controlState = await getBookingControlState();
    const animalToCheck = animalType || 'cow';
    const isOpen = controlState[`${animalToCheck}_open`] !== false;
    if (!isOpen) {
      return res.status(403).json({
        message: `Booking is currently closed for ${animalToCheck}s`
      });
    }

    let dbUserId = null;
    if (userId !== "admin") {
      dbUserId = parseInt(userId, 10);
      if (isNaN(dbUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
    }

    const insertPayload = {
      user_id: dbUserId,
      name,
      email,
      animal_type: animalType || 'cow',
      quarter_qty: quarter,
      half_qty: half,
      full_qty: full,
      subtotal: computedSubtotal,
      service_fee: computedServiceFee,
      total,
      second_account_note: 'UBA - 2233156875',
      payment_status: 'pending',
      created_at: new Date().toISOString()
    };

    let { data, error } = await supabase
      .from("bookings")
      .insert([insertPayload])
      .select();

    // If Supabase table doesn't have the new fee columns yet, fallback to core fields so booking always succeeds
    if (error && (error.code === 'PGRST204' || (error.message && error.message.toLowerCase().includes('column')))) {
      console.warn("Supabase missing fee columns, falling back to core schema:", error.message);
      delete insertPayload.subtotal;
      delete insertPayload.service_fee;
      delete insertPayload.second_account_note;

      const fallbackRes = await supabase
        .from("bookings")
        .insert([insertPayload])
        .select();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      if (error.code === '23503') {
        return res.status(400).json({ message: "User account not found. Please log out and sign up again." });
      }
      return res.status(500).json({ message: "Failed to save booking: " + error.message, error: error.message });
    }

    res.status(201).json({ message: "Booking saved successfully", booking: data[0] });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let query = supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (userId === "admin") {
      query = query.is("user_id", null);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ message: "Failed to fetch history" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
