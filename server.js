// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// =====================
// DATABASE CONNECTION - SUPABASE
// =====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    global: {
      fetch: async (url, options) => {
        try {
          const response = await axios({
            url,
            method: options.method,
            data: options.body ? JSON.parse(options.body) : undefined,
            headers: options.headers,
            timeout: 30000 // 30 seconds
          });
          return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            headers: {
              get: (name) => response.headers[name.toLowerCase()]
            },
            json: async () => response.data,
            text: async () => JSON.stringify(response.data)
          };
        } catch (err) {
          return {
            ok: false,
            status: err.response?.status || 500,
            statusText: err.message,
            headers: {
              get: (name) => err.response?.headers?.[name.toLowerCase()]
            },
            json: async () => err.response?.data || { message: err.message },
            text: async () => JSON.stringify(err.response?.data || { message: err.message })
          };
        }
      }
    }
  }
);

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

// =====================
// ROUTES
// =====================
app.post("/api/book", async (req, res) => {
  try {
    const { name, quarter = 0, half = 0, full = 0, total } = req.body;

    if (!name || total <= 0) {
      return res.status(400).json({ message: "Invalid booking data" });
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          name,
          quarter_qty: quarter,
          half_qty: half,
          full_qty: full,
          total,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error("Booking Error Details:", error);
      return res.status(500).json({
        message: "Failed to save booking",
        error: error.message,
        details: error.details || "Check if the 'bookings' table exists in Supabase."
      });
    }

    res.status(201).json({
      message: "Booking saved successfully",
      booking: data[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
    }

    res.json(data);
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
