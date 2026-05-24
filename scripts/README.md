# Scripts

Dev/migration scripts. **Jangan commit ke production.**

## Setup

Buat file `.env.local` di root project (di-gitignore):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

## Files

| File | Tujuan |
|---|---|
| `seed.js` | Seed akun test + master data (jalankan: `node scripts/seed.js`) |
| `test_rpc_rls.cjs` | Test RPC dan RLS policies |
| `apply_rpc.js` | Apply RPC migrations |
| `patch_*.cjs/js` | Historical patch scripts (sudah tidak aktif) |
| `replace_stok.*` | Historical stok migration (sudah tidak aktif) |

## Catatan Keamanan

- **JANGAN** hardcode service role key di file ini
- Key dibaca dari `.env.local` via `dotenv`
- Rotasi key di Supabase Dashboard jika ada kebocoran
