# Coin Exchange Management System (Sistem Manajemen Tukar Koin)

## Project Overview
Sistem web untuk mengelola penukaran koin antara Tim Finance Indomaret (gudang) dengan tim toko. Petugas lapangan membawa stok koin dengan berbagai denominasi ke toko-toko menggunakan mobil operasional, menukar koin dengan uang besar (50.000/100.000), dan mencatat setiap transaksi secara digital.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database + Auth + Realtime**: Supabase (free tier)
- **PDF Generation**: jsPDF + html2canvas (client-side only, NEVER stored in DB)
- **Signature Pad**: signature_pad.js
- **WhatsApp Share**: wa.me deep link
- **Deploy**: Vercel
- **Realtime Tracking**: Supabase Realtime (WebSocket)

## Architecture
Single React SPA with role-based routing:
- `/login` — NIK + Password login (all roles)
- `/superadmin/*` — Account management
- `/dashboard/*` — Admin & Manager web dashboard (desktop-first)
- `/app/*` — Field officer webapp (mobile-first, kasir only)

## Auth Strategy
All users login with **NIK + Password**. Supabase Auth uses email-based auth internally, so NIK is mapped to `{NIK}@coin.internal` as a fake email behind the scenes. The `users` table in public schema stores the actual user profile with role.

## Role Hierarchy (5 roles)
1. **superadmin** — Manages all user accounts (CRUD). Does NOT handle operations.
2. **admin** — Master data (toko, mobil), stock management, creates task sessions.
3. **manager** — Approves/rejects sessions, realtime monitoring, reports.
4. **kasir** — Field officer who records transactions at stores via mobile webapp.
5. **driver** — Registered employee (has NIK), assigned to sessions. Does NOT login to use the app actively.

## Database (10 Tables — Supabase/PostgreSQL)
See `docs/ERD.md` for full schema. Key tables:
- `users`, `mobil`, `toko` — Master data
- `sesi_tugas`, `modal_koin`, `toko_assignment` — Session management
- `transaksi`, `rekonsiliasi` — Transaction & reconciliation
- `stok_gudang`, `stok_gudang_log` — Warehouse inventory

## Session State Machine
```
DRAFT → PENDING_APPROVAL → ACTIVE → PENDING_CLOSE → CLOSED
```
- DRAFT: Admin preparing
- PENDING_APPROVAL: Waiting manager approval to depart
- ACTIVE: Field operation in progress
- PENDING_CLOSE: Kasir submitted reconciliation, waiting manager approval
- CLOSED: Manager confirmed, warehouse stock auto-updated

## Critical Business Rules
1. **Per transaction**: total_koin_nilai MUST equal total_uang_diterima (selisih = 0)
2. **Reconciliation**: (Modal - Total Koin Keluar) MUST equal Sisa Koin Aktual
3. **1 kasir = max 1 active session** at any time
4. **1 toko = max 1 transaction per session**
5. **Modal koin cannot exceed warehouse stock**
6. **Photos stored as Base64 in DB** (compressed, ~100-200KB max per image)
7. **PDF generated client-side only**, never stored in DB (Supabase free tier storage constraint)
8. **Toko can be skipped** with mandatory reason

## File Structure
```
coin-management/
├── claude.md
├── docs/
│   ├── PRD.md
│   ├── ERD.md
│   └── TECH_STACK.md
├── tasks/
│   ├── phase-1-foundation.md
│   ├── phase-2-session-management.md
│   ├── phase-3-field-webapp.md
│   ├── phase-4-pdf-whatsapp.md
│   ├── phase-5-reconciliation.md
│   └── phase-6-dashboard-reports.md
├── supabase/
│   └── schema.sql
├── public/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── auth.js
│   │   └── utils.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useRealtime.js
│   │   └── useImageCompress.js
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   ├── layout/           # Layout wrappers
│   │   └── shared/           # Shared business components
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── superadmin/
│   │   ├── dashboard/        # Admin & Manager pages
│   │   └── app/              # Kasir mobile pages
│   └── contexts/
│       └── AuthContext.jsx
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env.example
```

## Code Style Guidelines
- Use functional components with hooks
- Use Tailwind CSS for all styling (no inline styles, no CSS modules)
- Indonesian language for user-facing text, English for code/comments
- Format currency with `Intl.NumberFormat('id-ID')`
- All monetary values in the DB are stored as BIGINT (no floating point)
- Use `react-router-dom` v6 for routing
- Use Supabase JS client v2
- Compress images client-side before converting to Base64 (max 800px width, JPEG quality 0.6)
