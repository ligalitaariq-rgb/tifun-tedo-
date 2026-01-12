
// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");

// =====================
// DATABASE CONNECTION
// =====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// =====================
// SCHEMA & MODEL
// =====================
const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quarter: { type: Number, default: 0 },
    half: { type: Number, default: 0 },
    full: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

// =====================
// APP SETUP
// =====================
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =====================
// ROUTES
// =====================
app.post("/api/book", async (req, res) => {
  try {
    const { name, quarter = 0, half = 0, full = 0, total } = req.body;

    if (!name || total <= 0) {
      return res.status(400).json({ message: "Invalid booking data" });
    }

    const booking = await Booking.create({
      name,
      quarter,
      half,
      full,
      total
    });

    res.status(201).json({
      message: "Booking saved successfully",
      booking
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

});
