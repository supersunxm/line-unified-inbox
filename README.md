# OPPO LINE OA Monitor

Development prototype with a Next.js frontend, NestJS REST API, Prisma ORM, and PostgreSQL. Seed records are fictional and intended only for local development.

> Pilot authentication uses backend-managed HTTP-only sessions. Production still requires HTTPS, managed secrets, monitoring, and a deployment-specific backup policy.

## Pilot administrator and safety

The normal first-run flow is web-based. After applying migrations, open the frontend. When no active administrator exists, the application asks for administrator details and verifies the email with a six-digit OTP. Public setup closes permanently as soon as the first active administrator is created.

### Option A: real email OTP with Resend

1. Create a Resend account and API key.
2. Configure a verified sender address.
3. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and optionally `EMAIL_FROM_NAME` in `backend/.env`.
4. Restart the backend and open the website.
5. Enter the first administrator details and the OTP received by email.

### Option B: local console OTP

1. Set `EMAIL_PROVIDER=console` in `backend/.env` while `NODE_ENV` is not `production`.
2. Restart the backend and request the OTP in the browser.
3. Read the OTP from the local backend terminal only.
4. Never use console OTP in production.

The following CLI remains an emergency development fallback:

```bash
cd backend
ADMIN_EMAIL="admin@example.com" ADMIN_DISPLAY_NAME="Pilot Admin" ADMIN_PASSWORD="use-a-long-unique-password" npm run user:create-admin
```

Run `npm run security:check` before every commit. Use `npm run db:backup` for a timestamped local backup and `npm run db:restore -- backups/<file>.dump` to restore after typing `RESTORE`. Backups may contain customer data and are ignored by Git.

Create an empty **private** GitHub repository, run the security check, confirm `.env`, `.env.local`, dumps, logs, CSV files, and ngrok configuration are absent from `git status`, then add the remote and push. Never commit LINE credentials or database URLs.

## Local setup (macOS Terminal)

Run commands from the repository root unless a step says otherwise.

1. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

2. Configure the backend:

   ```bash
   cp backend/.env.example backend/.env
   ```

3. Install backend dependencies:

   ```bash
   cd backend
   npm install
   ```

4. Generate Prisma and apply migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. Seed fictional development data:

   ```bash
   npm run prisma:seed
   ```

6. Start the API at `http://localhost:3001`:

   ```bash
   npm run start:dev
   ```

7. In a second Terminal window, configure and install the frontend:

   ```bash
   cd frontend
   cp .env.local.example .env.local
   npm install
   ```

   Local frontend configuration uses `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` and `NEXT_PUBLIC_APP_ENV=development`. Railway production configuration is documented in `docs/RAILWAY_DEPLOYMENT.md`.

8. Start the frontend:

   ```bash
   npm run dev
   ```

9. Open [http://localhost:3000](http://localhost:3000). Verify the API separately at [http://localhost:3001/health](http://localhost:3001/health).

10. Run checks:

   ```bash
   cd backend
   npm run lint
   npm run build
   cd ../frontend
   npm run lint
   npm run build
   ```

Useful database command:

```bash
cd backend
npm run prisma:studio
```

## Data and localStorage

PostgreSQL is the source of truth for conversations, statuses, notes, and activity. The frontend keeps only UI preferences in `oppo-line-oa-monitor-ui-preferences`.

On first load after upgrading, data under the old `oppo-line-oa-conversation-states` key is copied to `oppo-line-oa-conversation-states-legacy` and the active old key is removed. Legacy data is never written to PostgreSQL and never overrides API data. “Reset UI Filters” clears only UI preferences; it does not delete database records.

## Current scope

Authentication, outbound LINE Messaging API features, real translation, AI tagging, roles, and production deployment are intentionally not included.

## LINE inbound webhook pilot

The receive-only pilot accepts signed inbound events only at `POST /webhook/:webhookKey`, where `webhookKey` is the persisted key shown in LINE OA Management. It never sends replies, push messages, or broadcasts. NestJS raw-body mode is enabled so signature verification uses the exact request bytes rather than `JSON.stringify()` output.

Backend environment variables:

- `LINE_WEBHOOK_ENABLED`: set `true` only when the pilot is configured.
- `PUBLIC_WEBHOOK_BASE_URL`: public HTTPS tunnel origin used for documentation/configuration.
- `LINE_CREDENTIAL_ENCRYPTION_KEY`: required 32-byte Base64 master key used only by the backend for AES-256-GCM credential encryption. Generate a development key with `openssl rand -base64 32`. Store it in `backend/.env`; never commit or send it to the frontend.

### Connect the first real LINE OA

1. Generate and configure `LINE_CREDENTIAL_ENCRYPTION_KEY`, then restart the backend.
2. Start an HTTPS tunnel and configure `PUBLIC_WEBHOOK_BASE_URL`.
3. Open **LINE OA Management** in the application and click **Connect LINE OA**.
4. Select or create the store and enter the Messaging API Channel ID and Channel Secret. The access token is optional for receive-only monitoring.
5. Save the account. Secrets are encrypted with AES-256-GCM before PostgreSQL storage and are never returned by list/detail APIs.
6. Copy the account’s webhook URL from the management page.
7. In LINE Developers Console, select the Messaging API channel, paste the URL, click **Verify**, and enable **Use webhook**.
8. Disable automatic response messages if appropriate for the pilot, send a test message, then click **Test Connection** in the management page.

To test locally without LINE Developers Console, enable the webhook, store the OA credentials through LINE OA Management, start the backend, then run the signed per-OA verification with its persisted key:

```bash
cd backend
npm run test:line-verify -- --webhook-key YOUR_PERSISTED_KEY
```

For a real pilot using ngrok:

1. Start PostgreSQL with `docker compose up -d postgres`.
2. Start the backend with `cd backend && npm run start:dev`.
3. Start the frontend with `cd frontend && npm run dev`.
4. In another terminal, run `ngrok http 3001` (install ngrok separately).
5. Put the generated HTTPS origin in `PUBLIC_WEBHOOK_BASE_URL` and restart the backend.
6. Copy the exact per-OA URL shown in LINE OA Management, `https://YOUR_PUBLIC_HOST/webhook/YOUR_PERSISTED_KEY`, into LINE Developers Console.
7. Click **Verify** in LINE Developers Console.
8. Enable **Use webhook**.
9. Add the pilot OA as a friend.
10. Send a customer test message.
11. Within about 12 seconds, verify that the conversation appears in OPPO LINE OA Monitor.

The current pilot reuses the most recent conversation for the same customer and OA. The schema does not yet have an archived-conversation flag, so explicit conversation lifecycle boundaries remain a later enhancement.
# Store Master import

Store Master data is imported independently from connected stores. Importing rows never creates a real Store or LINE OA connection.

Set `STORE_MASTER_GOOGLE_SHEET_URL` in `backend/.env`, then run:

```bash
cd backend
npm run store-master:import
npm run store-master:validate
```

To import an exported CSV without Google access:

```bash
npm run store-master:import -- /absolute/path/store-master.csv
```

`POST /store-master/import` is a development convenience only. It is disabled when `NODE_ENV=production`, but it does not yet implement administrator authentication and must not be exposed publicly. Production deployments should run the CLI importer from a trusted environment.
