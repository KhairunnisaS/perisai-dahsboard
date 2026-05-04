# Perisai Agent Acquisition Dashboard

Dashboard untuk monitoring dan manajemen rekrutmen agen Perisai per kecamatan.

## Tech Stack

| Layer | Tool | Alasan |
|---|---|---|
| Framework | React 18 + TypeScript | Industry standard, type-safe |
| Build | Vite | Cepat, DX terbaik saat ini |
| Styling | Tailwind CSS | Utility-first, konsisten |
| Server state | TanStack Query v5 | Caching, refetch, loading state otomatis |
| Data source | Google Sheets API v4 | Data dikelola non-developer via spreadsheet |
| Icons | Lucide React | Ringan, konsisten |

## Struktur Project

```
src/
├── types/          # Domain models (Candidate, Officer, dll)
├── services/       # Sheets API adapter — satu-satunya tempat parsing row
├── hooks/          # React Query hooks — komponen tidak fetch langsung
├── lib/            # Utilities (cn, formatters)
└── components/
    ├── layout/     # Sidebar, Topbar
    ├── dashboard/  # StatsBar, FieldOfficerRow, DashboardPage
    └── candidates/ # CandidateCard, CandidateGrid
```

## Setup Google Sheets

1. Buat spreadsheet dengan 3 tab:
   - **Candidates** — kolom: `id, name, neighborhood, subDistrict, status, perisaiForm, legalContracts, exam, gdriveFolder, assignedOfficerId, createdAt, updatedAt`
   - **Officers** — kolom: `id, name, subDistrict, zones, contact`
   - **ProjectMeta** — kolom: `key, value`

2. Aktifkan **Google Sheets API** di Google Cloud Console

3. Buat API Key, batasi ke Sheets API saja

4. Copy `.env.example` → `.env` dan isi nilainya

5. Share spreadsheet sebagai **"Anyone with the link can view"**

## Menjalankan

```bash
npm install
cp .env.example .env   # isi API key & spreadsheet ID
npm run dev
```

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run typecheck  # cek TypeScript tanpa build
npm run lint       # ESLint
```
