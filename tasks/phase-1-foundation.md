# Phase 1: Foundation
## Setup Project, Auth, & Master Data

---

### Task 1.1: Project Scaffolding
**Goal**: Initialize Vite + React + Tailwind project

**Steps**:
1. `npx -y create-vite@latest ./ --template react`
2. Install dependencies: tailwindcss, postcss, autoprefixer, react-router-dom, @supabase/supabase-js, lucide-react
3. Configure tailwind.config.js with custom colors (dark blue/teal finance theme)
4. Create `.env.example` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
5. Setup folder structure as defined in claude.md

**Files to create**:
- `vite.config.js`
- `tailwind.config.js`
- `postcss.config.js`
- `src/index.css` — Tailwind directives + global styles
- `src/main.jsx`
- `src/App.jsx` — Router setup
- `src/lib/supabase.js` — Supabase client init
- `.env.example`

**Design System** (define in tailwind.config.js):
```
Colors:
  primary: dark blue (#1e3a5f → finance/professional feel)
  secondary: teal (#0d9488)
  accent: amber (#f59e0b → for alerts/warnings)
  success: emerald
  danger: rose
  background: slate-50 (light) / slate-900 (dark sections)

Font: Inter (Google Fonts)
```

---

### Task 1.2: Supabase Setup
**Goal**: Create all tables and RLS policies

**Steps**:
1. Create Supabase project
2. Run schema.sql from `docs/ERD.md` in Supabase SQL editor
3. Configure Auth settings (disable email confirmation for dev)
4. Enable Realtime on `toko_assignment` and `sesi_tugas` tables

**RLS Policies** (implement in Supabase):
```sql
-- Users: authenticated users can read users they need
-- Superadmin: full CRUD on users
-- Admin: read kasir/driver
-- Manager: read all
-- Kasir: read own profile

-- Sesi tugas: 
-- Admin: CRUD on all
-- Manager: read all, update (approve/reject)
-- Kasir: read own sessions only

-- Transaksi:
-- Kasir: insert/read own, cannot delete
-- Admin/Manager: read all

-- Stok gudang:
-- Admin: read/update
-- Manager: read only
```

**Files to create**:
- `supabase/schema.sql` (copy from ERD.md)
- `supabase/rls_policies.sql`
- `supabase/seed.sql` — Seed superadmin + sample data

---

### Task 1.3: Auth System
**Goal**: NIK + Password login with role-based redirect

**Implementation**:
- Login page with NIK + password fields
- On login: sign in via Supabase Auth using `{NIK}@coin.internal` as email
- After auth: fetch user profile from `users` table to get role
- Redirect based on role:
  - superadmin → `/superadmin`
  - admin → `/dashboard`
  - manager → `/dashboard`
  - kasir → `/app`
  - driver → show "Akun tidak memiliki akses webapp" message

**Files to create**:
- `src/contexts/AuthContext.jsx` — Auth provider with login/logout/role
- `src/hooks/useAuth.js` — Hook to access auth context
- `src/lib/auth.js` — Auth helper functions (signIn, signOut, getProfile)
- `src/pages/Login.jsx` — Login page (responsive, works on mobile & desktop)
- `src/components/layout/ProtectedRoute.jsx` — Route guard by role
- `src/components/layout/DashboardLayout.jsx` — Sidebar + topbar for admin/manager
- `src/components/layout/MobileLayout.jsx` — Bottom nav for kasir mobile

**Login Page Design**:
- Clean, professional, centered card
- Logo/title "Sistem Tukar Koin" at top
- NIK input (number, 16 digit)
- Password input (with show/hide toggle)
- Login button with loading state
- Error message display

---

### Task 1.4: Super Admin — Account Management
**Goal**: CRUD all user accounts

**Pages**:
- `/superadmin` — List all users (table with filter by role)
- `/superadmin/tambah` — Add new user form
- `/superadmin/edit/:id` — Edit user form

**Form Fields**:
- NIK (text, 16 digit, unique validation)
- Nama Lengkap (text)
- Role (dropdown: admin, manager, kasir, driver)
- Password (text, min 6 char — only on create or reset)
- Status (toggle: Aktif/Nonaktif)

**Logic**:
- Create: Insert to Supabase Auth (as `{NIK}@coin.internal`) + insert to `users` table
- Edit: Update `users` table, optionally reset password in Auth
- Deactivate: Set `is_active = false` in `users`, disable in Auth

**Files to create**:
- `src/pages/superadmin/UserList.jsx`
- `src/pages/superadmin/UserForm.jsx` (create + edit)

---

### Task 1.5: Admin — Master Data Toko
**Goal**: CRUD toko data

**Pages**:
- `/dashboard/toko` — List all toko (searchable table)
- `/dashboard/toko/tambah` — Add toko form
- `/dashboard/toko/edit/:id` — Edit toko form

**Form Fields**:
- Kode Toko (text, unique, e.g., "IDFM-042")
- Nama Toko (text)
- Alamat (textarea)
- Area (text, e.g., "Jakarta Selatan")
- Status (toggle: Aktif/Nonaktif)

**Files to create**:
- `src/pages/dashboard/toko/TokoList.jsx`
- `src/pages/dashboard/toko/TokoForm.jsx`

---

### Task 1.6: Admin — Master Data Mobil
**Goal**: CRUD mobil data

**Pages**:
- `/dashboard/mobil` — List all mobil (simple table)
- Add/Edit via modal (simple form, only nopol)

**Form Fields**:
- Nopol (text, unique, e.g., "B 1234 XYZ")
- Status (toggle: Aktif/Nonaktif)

**Files to create**:
- `src/pages/dashboard/mobil/MobilList.jsx`
- `src/components/shared/MobilModal.jsx`

---

### Task 1.7: Reusable UI Components
**Goal**: Build shared UI component library

**Components to create**:
- `src/components/ui/Button.jsx` — Primary, secondary, danger, ghost variants
- `src/components/ui/Input.jsx` — Text, number, with label and error state
- `src/components/ui/Select.jsx` — Dropdown select
- `src/components/ui/Modal.jsx` — Dialog overlay
- `src/components/ui/Table.jsx` — Data table with search
- `src/components/ui/Badge.jsx` — Status badges (colored)
- `src/components/ui/Card.jsx` — Content card
- `src/components/ui/Alert.jsx` — Success/error/warning alerts
- `src/components/ui/Loading.jsx` — Spinner/skeleton
- `src/components/ui/EmptyState.jsx` — Empty data placeholder

**Acceptance Criteria**:
- [ ] Vite dev server runs without error
- [ ] Login works with NIK + password
- [ ] Role-based redirect works correctly
- [ ] Superadmin can CRUD user accounts
- [ ] Admin can CRUD toko & mobil
- [ ] All pages responsive (mobile & desktop)
- [ ] Design looks professional (dark blue theme, Inter font)
