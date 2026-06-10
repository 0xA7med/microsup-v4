# MicroSUB MicroPOS V1 — Project Map

> **Last Updated:** 2026-06-10
> **Stack:** React 18 + TypeScript + Vite + Supabase (PostgreSQL) + Zustand
> **Deployment:** Vercel (frontend) / Netlify (fallback)

---

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Data Flow Architecture](#6-data-flow-architecture)
7. [API Routes (Supabase)](#7-api-routes-supabase)
8. [UI Component Map](#8-ui-component-map)
9. [State Management](#9-state-management)
10. [Key Findings & Improvements](#10-key-findings--improvements)
11. [How to Contribute](#11-how-to-contribute)

---

## 1. Overview

**MicroSUB MicroPOS V1** is a point-of-sale and client management system for managing agents, clients, and their device subscriptions. It supports bilingual UI (Arabic/English) with RTL layout, role-based access (admin/agent), and subscription tracking.

### Core Business Flow

```
Admin creates Agents → Agents register Clients → Clients get Devices
                                                    ↓
                                        Subscription tracking (monthly/semi-annual/annual/permanent)
                                                    ↓
                                        Device approval workflow (pending → approved/rejected)
```

### Pages

| Route | Page | Access | Description |
|-------|------|--------|-------------|
| `/` | Dashboard | All | Stats, charts, expiring subscriptions |
| `/clients` | ClientsList | All | CRUD for clients with filters |
| `/add-client` | AddClient | All | New client form |
| `/agents` | AgentsList | Manager+ | Agent management |
| `/add-agent` | AddAgent | Admin only | New agent form |
| `/requests` | RequestsManagement | Manager+ | Pending device/agent approvals |
| `/backup-manager` | BackupManager | Admin only | JSON data backup/restore |

---

## 2. Tech Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | ^18.3.1 | UI framework |
| TypeScript | ^5.2.2 | Type safety |
| Vite | ^5.1.4 | Build tool |
| React Router | ^6.22.1 | Routing |
| Zustand | ^4.5.1 | State management |
| Tailwind CSS | ^3.4.1 | Styling |
| Ant Design | ^5.24.7 | UI components |
| Mantine | ^7.17.4 | UI components |
| Radix UI | Various | Headless primitives |
| i18next | ^23.10.0 | Internationalization (Ar/En) |
| Recharts | ^2.15.2 | Charts |
| react-hot-toast | ^2.5.2 | Notifications |
| date-fns | ^4.1.0 | Date utilities |
| xlsx | ^0.18.5 | Excel export/import |

### Backend / Database
| Service | Version | Purpose |
|---------|---------|---------|
| Supabase | ^2.49.4 | PostgreSQL DB + Auth + RLS |
| PostgreSQL | (Supabase) | Relational database |

### DevOps
| Tool | Purpose |
|------|---------|
| Vercel | Production hosting |
| Netlify | Fallback hosting |
| GitHub Actions | CI/CD + Keep-alive cron |

---

## 3. Directory Structure

```
MicroSUB MicroPOS V1/
├── .github/workflows/
│   └── supabase-keep-alive.yml     # Prevents Supabase auto-pause
│
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router + auth guard
│   ├── index.css                   # Global styles (Tailwind)
│   │
│   ├── components/
│   │   ├── Layout.tsx              # App shell (sidebar + header)
│   │   ├── LoginForm.tsx           # Auth form
│   │   ├── DashboardDataProvider.tsx
│   │   ├── ClientDetailsModal.tsx  # Client detail drawer
│   │   ├── ClientDetailsModal.tsx.new  # (stale - consider deleting)
│   │   ├── ClientDevicesSection.tsx / ClientDevicesForm.tsx
│   │   ├── DeviceModal.tsx / DevicesList.tsx
│   │   ├── ExcelImporter.tsx       # Bulk import via xlsx
│   │   ├── WhatsAppImporter.tsx    # WhatsApp data import
│   │   ├── RecentClientsList.tsx / StatCard.tsx
│   │   ├── AgentField.tsx / AgentInput.tsx / AgentSelect.tsx
│   │   ├── CustomerField.tsx / CustomerInput.tsx / CustomerSelect.tsx / CustomerTextArea.tsx
│   │   ├── LanguageToggle.tsx / ThemeToggle.tsx
│   │   ├── Spinner.tsx / PerformanceStats.tsx
│   │   ├── Button.tsx              # Shared button component
│   │   ├── agents/
│   │   ├── auth/                   # Auth-related UI
│   │   ├── clients/                # Client-specific components
│   │   └── ui/                     # Generic UI primitives
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx           # Main dashboard
│   │   ├── ClientsList.tsx / AddClient.tsx
│   │   ├── AgentsList.tsx / AddAgent.tsx
│   │   ├── BackupManager.tsx
│   │   ├── PendingAgents.tsx / PendingDevicesPage.tsx
│   │   ├── RequestsManagement.tsx
│   │   ├── SecuritySettings.tsx
│   │   ├── tabs/                   # Tabbed page components
│   │   └── api/                    # API route handlers
│   │       ├── backup/             # Backup endpoints
│   │       ├── clients/            # Client endpoints
│   │       └── templates/          # Template files
│   │
│   ├── store/
│   │   ├── authStore.ts            # Auth state (Zustand)
│   │   └── dataStore.ts            # Data fetching + caching (Zustand)
│   │
│   ├── types/
│   │   ├── database.types.ts       # Supabase type definitions (auto-generated style)
│   │   ├── client.types.ts         # Client + Agent interfaces
│   │   ├── device.types.ts         # Device interface + enums
│   │   ├── dashboard.types.ts      # Dashboard data interfaces
│   │   ├── whatsapp.types.ts       # WhatsApp import types
│   │   ├── file-saver.d.ts        # File-saver type declarations
│   │   ├── react-jsx.d.ts / jsx.d.ts  # JSX type overrides
│   │   └── types.ts                # Shared/utility types
│   │
│   ├── services/
│   │   ├── aiService.ts            # Google Generative AI integration
│   │   ├── backupService.ts        # Backup/restore operations
│   │   ├── importService.ts        # Data import logic
│   │   └── whatsappImportService.ts # WhatsApp extraction
│   │
│   ├── lib/
│   │   ├── supabase.ts             # Unified Supabase client
│   │   ├── utils.ts                # Shared utilities
│   │   └── database/               # DB helper functions
│   │
│   ├── i18n/                       # Internationalization config + locales
│   ├── data/                       # Static/reference data
│   ├── database/ / db/             # Local SQL migration files
│   ├── mocks/                      # Test/mock data
│   └── utils/                      # Utility functions
│
├── migrate_consolidated.sql        # 🔥 New: unified idempotent schema
├── keep_alive.js                   # Supabase keep-alive ping script
├── create_original_tables.sql      # Original base schema
├── fix_agents_table.sql            # Agents table fix
├── fix_relationships.sql           # Relationship fixes
├── setup_correct_tables.sql        # Alternative schema (auth.users ref)
├── setup_tables.sql                # Alternative schema (repairs + notifications)
├── export_tables_structure.sql     # Schema introspection query
│
├── supabase/migrations/            # 9 Supabase-format migration files
├── database/migrations/            # 11 alternative migration files
├── sql/                            # Additional SQL files
│
├── types/                          # Additional type definitions
├── public/                         # Static assets
│
├── vercel.json                     # Vercel deployment config
├── netlify.toml                    # Netlify deployment config
├── vite.config.ts                  # Vite configuration
├── tailwind.config.js              # Tailwind CSS config
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── package.json
```

---

## 4. Database Schema

### Entity Relationship (Consolidated)

```
┌────────────────────────────────────────────────────────────┐
│  agents                                       6 tables     │
│  ┌──────────────────────┐                                 │
│  │ id (PK, UUID)        │─────────────────┐               │
│  │ email (UNIQUE)       │                 │               │
│  │ name                 │                 │               │
│  │ full_name            │                 │               │
│  │ role (admin|agent)   │                 │               │
│  │ phone                │                 │               │
│  │ address              │                 │               │
│  │ password             │                 │               │
│  │ approval_status      │                 │               │
│  │ created_by (FK→agents)──self-ref       │               │
│  │ created_at           │                 │               │
│  │ updated_at           │                 │               │
│  └──────────────────────┘                 │               │
│          │                                │               │
│          │ 1:N                            │               │
│          ▼                                │               │
│  ┌──────────────────────┐                │               │
│  │ clients              │                │               │
│  │ id (PK, UUID)        │                │               │
│  │ client_name          │                │               │
│  │ organization_name    │                │               │
│  │ activity_type        │                │               │
│  │ phone / phone2       │                │               │
│  │ address              │                │               │
│  │ activation_code      │                │               │
│  │ device_count         │                │               │
│  │ active_devices_count │                │               │
│  │ subscription_*       │                │               │
│  │ agent_id (FK)        │────────────────┘               │
│  │ created_by (FK)      │────────────────┐               │
│  │ created_at           │                │               │
│  └──────────────────────┘                │               │
│          │                               │               │
│          │ 1:N                           │               │
│          ▼                               │               │
│  ┌──────────────────────┐                │               │
│  │ devices              │                │               │
│  │ id (PK, UUID)        │                │               │
│  │ client_id (FK)       │                │               │
│  │ activation_code      │                │               │
│  │ device_type          │                │               │
│  │ subscription_*       │                │               │
│  │ approval_status      │  N:1           │               │
│  │ approved_by (FK)─────┘                │               │
│  │ price  │  email  │  notes             │               │
│  │ created_at / updated_at               │               │
│  └──────────────────────┘                │               │
│          │                               │               │
│          │ 1:N                           │               │
│          ▼                               │               │
│  ┌──────────────────────┐                │               │
│  │ repairs              │                │               │
│  │ id (PK, UUID)        │                │               │
│  │ device_id (FK)       │                │               │
│  │ description          │                │               │
│  │ cost                 │                │               │
│  │ status (pending|...) │                │               │
│  │ completed_by (FK)────┘               │               │
│  └──────────────────────┘                │               │
│                                          │               │
│  ┌──────────────────────┐                │               │
│  │ backups              │                │               │
│  │ id (PK, SERIAL)      │                │               │
│  │ created_by (FK)──────┘               │               │
│  │ file_name   │  data (JSONB)          │               │
│  └──────────────────────┘                │               │
│                                          │               │
│  ┌──────────────────────┐                │               │
│  │ notifications        │                │               │
│  │ id (PK, UUID)        │                │               │
│  │ user_id (FK)─────────┘               │               │
│  │ title   │  message                   │               │
│  │ is_read │ created_at                 │               │
│  └──────────────────────┘               │               │
└──────────────────────────────────────────┘
```

### Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| agents | idx_agents_email | LOWER(email) | Fast login lookup |
| agents | idx_agents_role | role | Filter by role |
| clients | idx_clients_agent_id | agent_id | Agent's clients query |
| clients | idx_clients_created_by | created_by | Creator lookup |
| devices | idx_devices_client_id | client_id | Client's devices |
| devices | idx_devices_approval | approval_status | Filter pending devices |
| notifications | idx_notifications_user | user_id | User's notifications |
| notifications | idx_notifications_read | is_read | Unread count |
| repairs | idx_repairs_device_id | device_id | Device repairs |
| repairs | idx_repairs_status | status | Filter by status |

### RLS Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| agents | ✅ authenticated | ✅ authenticated | own / admin | admin only |
| clients | own / admin | own / admin | own / admin | admin only |
| devices | own client / admin | own client / admin | own client / admin | admin only |
| backups | admin only | admin only | ❌ | admin only |
| notifications | own / admin | own / admin | own / admin | own / admin |
| repairs | own device / admin | own device / admin | admin only | admin only |

---

## 5. Authentication & Authorization

### Auth Flow (Custom — no Supabase Auth used)

```
┌──────────┐     ┌────────────┐     ┌──────────┐
│  Login   │────▶│  agents    │────▶│ Zustand  │
│  Form    │     │  table     │     │ authStore│
└──────────┘     └────────────┘     └──────────┘
                      │                    │
                      ▼                    ▼
              password comparison    localStorage
              (plain text ⚠️)       "currentUser"
```

**⚠️ Security Note:** Passwords are stored as plain text in the `agents.password` column. Login compares `agentData.password !== password` directly. This is **not secure** — passwords should be hashed with bcrypt or use Supabase Auth.

### Roles
- **admin** — full access to all features, user management, backups
- **manager** — agent list + request management (no add-agent)
- **agent** — can only see own clients + devices

### Auth Guard in App.tsx
```typescript
const isAdmin = user.role === 'admin';
const isManager = user.role === 'manager' || isAdmin;
```
Routes are conditionally rendered via `<Navigate>` redirects.

---

## 6. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Components                     │
│  Dashboard │ ClientsList │ AgentsList │ AddClient │ ...  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Zustand Stores                          │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │   authStore.ts   │    │     dataStore.ts         │   │
│  │  user / loading  │    │ clients/devices/agents   │   │
│  │ signIn / signOut │    │ dashboardStats / caching │   │
│  └──────────────────┘    └──────────┬───────────────┘   │
│                                     │                    │
│   Caching Layer: localStorage       │                    │
│   microsup_clients / _devices /     │                    │
│   _agents (15min TTL)              │                    │
└─────────────────────────────────────┼───────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase Client                         │
│  src/lib/supabase.ts — createClient<Database>()         │
│  With RLS policies applied server-side                  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               PostgreSQL (Supabase)                      │
│  Tables: agents, clients, devices, backups,              │
│          notifications, repairs                          │
│  RLS: Row-level security per role                        │
└─────────────────────────────────────────────────────────┘
```

### Data Caching Strategy
- **15-minute TTL** for cached data in localStorage
- Two-tier cache: minimal (quick display) + full data
- Background refresh after cache hit
- Paginated fetching in batches of 1000
- Deduplication by ID

---

## 7. API Routes (Supabase)

Since this is a serverless/SPA app with direct Supabase client access, there are no traditional REST API routes. Instead, all data operations go through:

1. **Supabase JS SDK** — direct client queries from `src/lib/supabase.ts`
2. **Supabase RLS** — authorization enforced at database level
3. **Vercel serverless functions** — (in `src/pages/api/`) for backup I/O and client file operations

### API-like endpoints in `src/pages/api/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/backup/create` | POST | Create JSON backup |
| `/api/backup/restore` | POST | Restore from backup |
| `/api/backup/list` | GET | List backups |
| `/api/backup/download` | GET | Download backup file |
| `/api/clients/export` | GET | Export clients to Excel |
| `/api/templates/download` | GET | Download import templates |

---

## 8. UI Component Map

### Routes → Pages → Key Components

```
/login                  → LoginForm
/dashboard              → Dashboard
                          ├── StatCard (×6: stats overview)
                          ├── RecentClientsList
                          └── Charts (recharts)

/clients                → ClientsList
                          ├── ClientDetailsModal
                          │   ├── ClientDevicesSection
                          │   │   └── DeviceModal (add/edit)
                          │   └── Client form fields
                          ├── ExcelImporter
                          └── WhatsAppImporter

/add-client             → AddClient
                          ├── CustomerField / CustomerInput / CustomerSelect / CustomerTextArea
                          └── ClientDevicesForm

/agents                 → AgentsList
/add-agent              → AddAgent
                          ├── AgentField / AgentInput / AgentSelect
                          └── Button

/requests               → RequestsManagement
                          ├── PendingAgents
                          └── PendingDevicesPage

/backup-manager         → BackupManager
```

### Shared Components

| Component | Purpose |
|-----------|---------|
| `Layout.tsx` | App shell: sidebar navigation + top header |
| `Button.tsx` | Styled button with variants |
| `Spinner.tsx` | Loading spinner |
| `LanguageToggle.tsx` | Ar/En switch |
| `ThemeToggle.tsx` | Light/dark mode |
| `DashboardDataProvider.tsx` | Data hydration wrapper |
| `PerformanceStats.tsx` | Render performance monitor |

---

## 9. State Management

### Zustand Stores

**authStore** (`src/store/authStore.ts`)
```
State:    user (User | null), loading, sessionError
Actions:  initializeAuth, signIn, signOut, refreshSession, resetSessionError
Persistence: localStorage "currentUser"
```

**dataStore** (`src/store/dataStore.ts`)
```
State:    clients, devices, agents (arrays)
          dashboardStats (computed), loading*, error
          currentPage, hasMoreData, isInitialized
Actions:  fetchData, loadMoreData, loadAllDataInBackground
          getClients, getDevices, getAgents, getDashboardStats
Cache:    localStorage with 15min TTL
```

### Why Zustand (not Context)?
- Zero boilerplate vs React Context
- Built-in `shallow` selector for re-render optimization
- Persistent caching via localStorage integration
- No provider wrapper needed

---

## 10. Key Findings & Improvements

### ✅ Completed Improvements

1. **Unified Supabase client** — `supabaseClient.ts` deleted, all 17 imports redirected to `supabase.ts`
2. **Deleted orphaned files** — `AuthProvider.tsx`, `AuthContext.tsx`, unused `routes.tsx`
3. **Cleaned empty directories** — `routes/`, `hooks/`, `context/`, `contexts/`
4. **Fixed `.env` merge conflict** — removed leftover `>>>>>>> eba7bedd...`
5. **Consolidated SQL migration** — `migrate_consolidated.sql` with 6 tables, indexes, RLS
6. **Updated TypeScript types** — `database.types.ts` aligned with consolidated schema
7. **GitHub Actions keep-alive** — prevents Supabase free-tier auto-pause
8. **Project documentation** — this file

### 🔴 Critical Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| Plain-text passwords | 🔴 CRITICAL | `authStore.ts` compares passwords directly. Use bcrypt + Supabase Auth |
| Auth bypass via RLS | 🔴 HIGH | `agents` table allows INSERT for any authenticated user |
| Old hardcoded Supabase URL | 🟡 MEDIUM | `supabase.ts` has a dead project URL as fallback (DNS: NXDOMAIN) |
| Duplicate type definitions | 🟡 MEDIUM | Types split across 3 files (database, client, device) with overlap |
| Stale `.new` file | 🟢 LOW | `ClientDetailsModal.tsx.new` should be deleted |

### 🟡 Recommendations

1. **Migrate to Supabase Auth** — replace custom password auth with Supabase Auth + `auth.users` trigger (already exists in `setup_correct_tables.sql`)
2. **Remove dead Supabase fallback** — clean up the hardcoded old project URL in `supabase.ts`
3. **Consolidate type files** — define shared types in one place, re-export from others
4. **Add RLS for `INSERT` on `agents`** — restrict to admin only (currently any auth user can sign up as agent)
5. **Add database migration CI** — run `migrate_consolidated.sql` via GitHub Actions on deploy
6. **Delete `ClientDetailsModal.tsx.new`** — stale file, use `ClientDetailsModal.tsx`
7. **Clean up import SQL files** — 170+ sharded import files (import_public.*.sql) can be archived

### 📊 Database Status

| Table | Status | Notes |
|-------|--------|-------|
| agents | ✅ In consolidated SQL | Needs sync with auth.users |
| clients | ✅ In consolidated SQL | Core table |
| devices | ✅ In consolidated SQL | With approval workflow |
| backups | ✅ In consolidated SQL | JSON snapshot backup |
| notifications | ✅ In consolidated SQL | In-app notifications |
| repairs | ✅ In consolidated SQL | Device repair tracking |
| device_approval_status | ❌ Deprecated | Merged into devices.approval_status |

### 🔧 Supabase Auto-Pause Prevention

A GitHub Actions workflow (`.github/workflows/supabase-keep-alive.yml`) pings the database every 3 days to prevent the 7-day inactivity auto-pause on Supabase free tier.

**Setup required:**
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your `.env`

---

## 11. How to Contribute

### Local Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env   # (create if not exists)

# Start dev server
npm run dev            # → http://localhost:3000
```

### Database Changes

1. Edit `migrate_consolidated.sql` (single source of truth)
2. Run against Supabase SQL editor or via `supabase db push`
3. Update `src/types/database.types.ts` to match

### Code Style

- TypeScript strict mode
- Arabic comments (bilingual project)
- Prefer Zustand over Context for state
- Tailwind CSS for styling (utility-first)
- RTL-first layout (Arabic default)
