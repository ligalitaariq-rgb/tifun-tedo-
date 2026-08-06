# Admin server for Tifun-Tedo

This small server provides secure admin endpoints that use the Supabase service_role key to perform updates that would otherwise be blocked by Row Level Security (RLS).

Files added:
- package.json
- server.js (Express app with admin endpoints)
- .env.example (example env vars — DO NOT commit secrets)
- db/migrations/add_cow_price.sql (SQL to add cow_price column and copy existing price)

How to use
1. Add environment variables to your host (SUPABASE_URL, SUPABASE_SERVICE_ROLE, ADMIN_SECRET).
2. Run the migration SQL in Supabase SQL editor.
3. Deploy this server to your platform (Vercel serverless, Render, Heroku, etc.) or run locally with `npm install` and `npm run dev`.
4. Call the endpoints from a protected admin UI, passing header `x-admin-secret` with your ADMIN_SECRET value.

Endpoints
- GET /api/admin/booking-controls  -> returns the booking_controls row
- POST /api/admin/set-cow-price   -> body: { price }
- POST /api/admin/set-payment-status -> body: { booking_id, payment_status }

Security
- Never store SUPABASE_SERVICE_ROLE in client-side code.
- Use ADMIN_SECRET only between your admin UI and this server; don’t hardcode it into public pages.
