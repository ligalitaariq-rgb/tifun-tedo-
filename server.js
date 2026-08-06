const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // service role key - server only
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-to-a-strong-secret';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

// Ensure there is always exactly one booking_controls row. If none exists, create one.
async function ensureBookingControlRow() {
  const { data, error } = await supabaseAdmin
    .from('booking_controls')
    .select('*')
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('booking_controls')
      .insert([{ cow_open: true, ram_open: true, goat_open: true, cow_price: 13000 }])
      .select()
      .single();
    if (insertError) throw insertError;
    return inserted;
  }

  return data[0];
}

// Update cow price only (no price_change_history)
async function updateCowPrice(newPrice) {
  const priceNum = Number(newPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) throw new Error('Invalid price');

  const row = await ensureBookingControlRow();
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('booking_controls')
    .update({ cow_price: priceNum, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

// Public endpoints for admin usage (server-side only)
app.get('/api/admin/booking-controls', async (req, res) => {
  try {
    const row = await ensureBookingControlRow();
    res.json({ ok: true, row });
  } catch (err) {
    console.error('GET booking-controls error:', err);
    res.status(500).json({ ok: false, message: String(err) });
  }
});

app.post('/api/admin/set-cow-price', async (req, res) => {
  const clientSecret = req.headers['x-admin-secret'];
  if (!clientSecret || clientSecret !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { price } = req.body;
  if (!price) return res.status(400).json({ ok: false, message: 'price is required in body' });

  try {
    const updated = await updateCowPrice(price);
    res.json({ ok: true, updated });
  } catch (err) {
    console.error('set-cow-price error:', err);
    res.status(500).json({ ok: false, message: String(err) });
  }
});

// Example endpoint to update booking payment status using service role (fixes RLS issues)
app.post('/api/admin/set-payment-status', async (req, res) => {
  const clientSecret = req.headers['x-admin-secret'];
  if (!clientSecret || clientSecret !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const { booking_id, payment_status } = req.body;
  if (!booking_id || !payment_status) return res.status(400).json({ ok: false, message: 'booking_id and payment_status are required' });

  try {
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update({ payment_status, updated_at: new Date().toISOString() })
      .eq('id', booking_id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    res.json({ ok: true, updated });
  } catch (err) {
    console.error('set-payment-status error:', err);
    res.status(500).json({ ok: false, message: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Admin API running on port ${PORT}`));
