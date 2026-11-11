# AGENTS.md

Guidance for coding agents in this repository. The product is a single Dockerized Next.js app with SQLite. Keep changes inside that shape.

## Run and verify

- App root is this directory. `docker compose up` publishes port 3000 and mounts volume `cs-data` at `/data`.
- `DATABASE_PATH` defaults to `data/cs.db`. In the container it is `/data/cs.db`.
- Do not delete or recreate the Docker volume. It holds the owner's login and their book of business.
- Verify web changes in the browser: sign in, then click, type, and submit. Use a fresh `DATABASE_PATH` under `/tmp` for that check so the volume is untouched.
- Rebuild the image with `docker compose up --build` when the running container should serve the change.

## Layout

- Next.js App Router. Signed-in pages live in `src/app/(workspace)/`. The root layout does not check auth.
- `src/app/(workspace)/layout.tsx` redirects to `/setup` when there are no users, otherwise to `/login`.
- Do not add `src/middleware.ts`. A middleware auth header is not visible to `headers()` here and will redirect `/setup` onto itself.
- Server actions are in `src/lib/actions.ts`. Reads are in `src/lib/queries.ts`. The database opens in `src/lib/db.ts`.
- Session cookie is `cs_session`, `httpOnly`, `sameSite=lax`, path `/`, 30 days. Do not set `Secure`. The app is served over local HTTP.

## Product rules

- Health labels are only Healthy, Needs attention, and At risk. Calculate them in `src/lib/health.ts` on read. The `customers.health` column is a placeholder, not the value shown in the UI.
- The worst factor wins. Factors are renewal date, open renewal risk, success plan, last past meeting, and overdue open tasks. Future meetings do not count.
- Alerts are one open row per account per non-healthy factor. Sync them when customers are read. Dismiss keeps the row until the factor clears, or reopens it if the factor gets worse.
- Closed won starts the next renewal one year later and moves the account renewal date. Closed lost sets the account stage to Churned, clears the renewal date, and Home leaves that account out of the active book.
- Contacts are the people on an account. The primary contact is copied onto `customers.primary_contact` and `customers.contact_email`. Calendar and mail matching uses every contact email.
- New accounts start with the six phases in `PHASES`. Seed accounts are Northwind, Acme, and Globex. The UI can delete them.
- Do not add a rules engine, score builder, surveys, product-usage analytics, people maps, journey automation, AI, or CRM sync.

## Data and git

- `data/*.db`, the SQLite sidecars, and `data/secret` are gitignored. Do not commit them.
- `data/secret` is the AES-256-GCM key for mailbox passwords. It is created beside the database with mode `0600`.
- `package.json` `"private": true` means do not publish this to npm. The GitHub repository is public.
- Commit only when the user asks. Do not force-push `main`.
