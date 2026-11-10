# ApunBazar 🌿

**Assamese culture ko celebrate karne wala premium ecommerce platform.**
500+ local artisans ko India bhar ke buyers se connect karta hai.

---

## Tech Stack.

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | 19 / 7 |
| Styling | Tailwind CSS v4 + shadcn/ui | v4 |
| State | TanStack Query | v5 |
| Routing | Wouter | 3.x |
| Backend | Express.js | 5.x |
| Database | PostgreSQL + Drizzle ORM | — |
| Payments | Razorpay | 2.9.x |
| Package Manager | pnpm workspaces | 9.x |

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+  (`npm install -g pnpm`)
- PostgreSQL 15+

### 1. Install
```bash
cd apunbazar-work
pnpm install
```

### 2. Environment Setup
```bash
copy artifacts\api-server\.env.example  artifacts\api-server\.env
copy artifacts\assam-bazaar\.env.example  artifacts\assam-bazaar\.env
```
Then `artifacts/api-server/.env` mein apna `DATABASE_URL` daalo.

### 3. Database
```bash
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/db run seed
```

### 4. Run (2 terminals)
```bash
# Terminal 1 — API Server
cd artifacts\api-server
pnpm run dev:build

# Terminal 2 — Frontend
cd artifacts\assam-bazaar
pnpm run dev
```

- 🌐 Frontend: http://localhost:3000
- 🔧 API: http://localhost:8080
- 👤 Admin: http://localhost:3000/admin/login

---

## Admin Login
Credentials `.env` file se manage hote hain:
- Email: `ADMIN_EMAIL` value
- Password: `ADMIN_PASSWORD` value

---

## Deployment

| Service | Platform |
|---------|---------|
| Frontend | Vercel |
| API | Railway |
| Database | Railway PostgreSQL / Neon / Supabase |

Detailed guide: `DEPLOYMENT.md`

---

## Security Notes
- ❌ `.env` files git mein commit mat karo
- ✅ Production mein strong `ADMIN_PASSWORD` use karo
- ✅ `ALLOWED_ORIGINS` mein apna Vercel domain daalo
- ✅ `DISABLE_ADMIN_AUTH=false` production mein

---

## Project Structure
```
apunbazar-work/
├── artifacts/
│   ├── assam-bazaar/     # React frontend
│   └── api-server/       # Express API
├── lib/
│   ├── db/               # Drizzle schema
│   ├── api-client-react/ # Generated hooks
│   └── api-zod/          # Zod validators
├── vercel.json           # Vercel deploy config
├── DEPLOYMENT.md         # Full deploy guide
└── README.md
```
