# Technology Stack Details

## Frontend
- **React 18** — UI library
- **Vite** — Build tool (fast dev server + HMR)
- **Tailwind CSS** — Utility-first CSS framework
- **React Router DOM v6** — Client-side routing
- **Lucide React** — Icon library
- **signature_pad** — Canvas-based signature capture
- **jsPDF** — PDF generation
- **html2canvas** — HTML to canvas for PDF
- **browser-image-compression** — Client-side image compression before Base64

## Backend / Infrastructure
- **Supabase (free tier)**
  - PostgreSQL database (500MB limit)
  - Auth (email-based, NIK mapped to fake email)
  - Realtime (WebSocket subscriptions, 200 concurrent limit)
  - Row Level Security (RLS) policies
- **Vercel** — Static hosting + deployment

## Key Constraints (Supabase Free Tier)
| Resource | Limit |
|---|---|
| Database | 500MB |
| Auth users | Unlimited |
| Realtime connections | 200 concurrent |
| API requests | 500K/month |
| File storage | 1GB (NOT USED — photos stored as Base64 in DB) |

## Image Compression Strategy
```
Camera capture → browser-image-compression →
  maxSizeMB: 0.15 (150KB)
  maxWidthOrHeight: 800
  useWebWorker: true
→ Canvas → toDataURL('image/jpeg', 0.6) → Base64 string → Store in DB
```

## NPM Dependencies
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "@supabase/supabase-js": "^2",
    "signature_pad": "^4",
    "jspdf": "^2",
    "html2canvas": "^1",
    "browser-image-compression": "^2",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "vite": "^5",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8",
    "@vitejs/plugin-react": "^4"
  }
}
```
