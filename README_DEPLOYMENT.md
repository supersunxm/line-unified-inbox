# OPPO LINE OA Monitor — Deployment & Production Guide

This guide covers deployment setup, environment variables, database migrations, demo seeding, and production commands for the **OPPO LINE OA Monitoring & Daily Operation Control Center**.

---

## 1. Environment Variables Configuration

### Backend Environment (`backend/.env`)

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/line_unified_inbox?schema=public"

# Application Server
PORT=3001
FRONTEND_URL="http://localhost:3000" # Or production frontend origin

# Authentication & Security Secrets
COOKIE_SECRET="super-secret-production-cookie-key"
SESSION_SECRET="super-secret-production-session-key"
ENCRYPTION_KEY="32-byte-hex-string-for-line-credentials"

# Pilot & RBAC Settings
PILOT_ALLOWLIST_EMAILS="admin@oppo.com,head-office@oppo.com"
MESSAGE_TRANSLATION_ENABLED="false"
```

### Frontend Environment (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:3001" # Or production backend API origin
```

---

## 2. Database Setup & Demo Seed

### Run Database Migrations

```bash
cd backend
npx prisma migrate deploy
```

### Seed Production Catalog & Master File

```bash
npm run store-master:import
npm run product-catalog:seed
```

### Seed Demo Data (142 Stores & 5,000 Conversations)

For demonstrations and staging validation:

```bash
cd backend
npm run prisma:seed:demo
```

---

## 3. Building & Starting Services

### Backend Service (NestJS API on port 3001)

```bash
cd backend
npm run build
npm run start:prod
```

Health Check Endpoint:
```
GET http://localhost:3001/health
```

### Frontend Web App (Next.js on port 3000)

```bash
cd frontend
npm run build
npm run start
```

---

## 4. Production Deployment Checklist (Railway / Docker / Cloud)

1. **Database**: Managed PostgreSQL instance (e.g., Railway PostgreSQL, AWS RDS).
2. **Environment Variables**: Configure all secrets (`DATABASE_URL`, `COOKIE_SECRET`, `ENCRYPTION_KEY`, `FRONTEND_URL`) in deployment target.
3. **CORS & Cookies**: Ensure `FRONTEND_URL` matches the deployed web domain.
4. **Health Check Routing**: Wire container health probes to `GET /health`.

---

## 5. Security & RBAC Enforcement

- **Head Office (`HEAD_OFFICE`)**: Full access across all 142 network stores.
- **Area Manager (`AREA_MANAGER`)**: Restricted to assigned regional stores.
- **Store Manager (`STORE_MANAGER`)**: Restricted strictly to own store ID. Unauthorized access attempts return `403 Forbidden`.
