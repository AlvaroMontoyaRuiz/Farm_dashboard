# 🌾 Inventario Finca

Inventory management web app for a small farm. UI is in Spanish only (admin + workers are Spanish-speaking). 4 users max (1 admin + up to 3 workers). Tracks:

- Daily feed consumption per corral (20 corrales)
- Animal inventory per corral and ingreso / salida of animals
- Food inventory (bultos levante y finalizador) in storage
- Daily log tracker (admin sees everything that happened per day)
- Deletion log with confirmation (nothing is silently removed)

## Stack

- **Frontend**: React + Vite + Tailwind + Recharts
- **Backend**: Cloudflare Pages Functions (same project, under `functions/`)
- **Database**: Cloudflare D1 (SQLite, free tier)
- **Hosting**: Cloudflare Pages — **free** for your scale (unlimited static requests, 100k Function requests/day, 5 GB D1, 5M D1 reads/day). No credit card required.

## Yes — Cloudflare Pages is a great fit

For 4 users and ~20 corrales, you will likely never leave the free tier. You get:

- Global CDN for the frontend
- A real SQL database (D1)
- Automatic deploys from GitHub on every push
- Custom domain + free SSL

The only limitation vs. a traditional VPS is that D1 is SQLite (single-writer, eventually consistent across regions) — totally fine here.

---

## Folder layout

```
farm-inventory/
├── index.html, vite.config.js, tailwind.config.js, package.json
├── wrangler.toml                  # Cloudflare config (D1 binding, build dir)
├── migrations/
│   ├── 0001_init.sql              # schema
│   └── 0002_seed.sql              # 20 corrales (no users — see Setup below)
├── functions/                     # Pages Functions (your backend)
│   ├── _lib/auth.js
│   └── api/
│       ├── auth/{setup,login,logout,me}.js
│       ├── summary.js             # dashboard numbers
│       ├── corrales.js
│       ├── food-lots.js           # inventario bultos (admin writes)
│       ├── animals.js             # ingreso / salida
│       ├── consumption.js         # consumo por corral
│       ├── daily-log.js           # per-day tracker
│       ├── deletion-log.js        # audit of deleted rows
│       └── record/[table]/[id].js # DELETE endpoint (confirmed from UI)
└── src/                           # React frontend
    ├── main.jsx, App.jsx, index.css
    ├── lib/api.js
    ├── components/{Card,ConfirmDelete}.jsx
    └── pages/{Login,Setup,Dashboard,Consumo,Animales,Inventario,DailyLog,DeletionLog}.jsx
```

---

## Local development (optional, but recommended before deploying)

Prereqs: Node 18+, npm.

```bash
npm install

# 1) Create a local D1 database and apply the schema + seed:
npx wrangler d1 create farm-inventory-db
# Copy the printed database_id into wrangler.toml (replace REPLACE_WITH_YOUR_D1_DATABASE_ID)
npm run db:local:init
npm run db:local:seed

# 2) Terminal A — Vite dev server (frontend)
npm run dev
# 3) Terminal B — Pages Functions + local D1
npm run pages:dev
```

Open <http://localhost:5173> — Vite proxies `/api/*` to Pages Functions on :8788.

First visit: go to `/setup` to create the admin + up to 3 worker accounts (passwords of your choice). After that, `/setup` is disabled forever on this database.

---

## Deploy to Cloudflare Pages

### 1. Push this folder to GitHub

```bash
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/farm-inventory.git
git push -u origin main
```

### 2. Create the D1 database

From your laptop (one time):

```bash
npx wrangler login
npx wrangler d1 create farm-inventory-db
```

Copy the `database_id` it prints. Open `wrangler.toml` in your repo and paste it in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`, commit, push.

Apply the schema and seed to the **remote** database:

```bash
npm run db:remote:init
npm run db:remote:seed
```

### 3. Create the Pages project

1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Pick your `farm-inventory` repo.
3. Build settings:
   - **Framework preset**: None (or Vite)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: *(leave empty)*
4. Deploy.

### 4. Bind the D1 database to the Pages project

In the Pages project → **Settings → Bindings → D1 database bindings → Add binding**:

- Variable name: `DB`
- D1 database: `farm-inventory-db`

Save, then redeploy (Deployments → Retry deployment, or push a new commit).

### 5. First-time setup

Visit `https://your-project.pages.dev/setup`, enter your admin and worker credentials, press **Crear usuarios**. You'll be redirected to login.

### 6. Optional: custom domain

Pages → Custom domains → Add. Cloudflare manages SSL automatically if your domain is on Cloudflare DNS.

---

## Roles

- **admin**: can do everything — register food lots, see the deletion log, delete anyone's records.
- **worker**: records consumption and ingreso/salida; can delete only their own records.

## Deletion behavior

Workers must press the **Eliminar** button on a row and confirm in a modal. The deletion:

1. Copies the row (as JSON) into the `deletion_log` table with the user, timestamp, and optional reason.
2. Removes the row from its source table.

The admin can review all deletions under **Eliminados**.

## Security notes

- Passwords: SHA-256(salt || password). For a 4-user internal app behind Cloudflare, this is adequate. If you ever expose this publicly, swap to bcrypt or Argon2id (via `@noble/hashes`).
- Sessions: random 32-byte opaque tokens stored in D1, delivered as `HttpOnly; Secure; SameSite=Lax` cookies. 7-day lifetime.
- There is no CSRF token because we use SameSite=Lax cookies and all mutating endpoints are JSON POST/DELETE with no sensitive GETs.

## Costs

Expected: **$0/month** for your scale. If you ever exceed free limits, Pages Functions bills at $5 for 10M extra requests/month and D1 at $0.75/million reads.

## Troubleshooting

- `D1_ERROR: no such table: ...` → You skipped step 2.4 (binding) or step 2.3 (`db:remote:init`).
- `invalid_session` after login → Your custom domain and `*.pages.dev` are different origins; stay on one.
- Can't reach `/setup` → it's disabled once users exist. Reset by clearing the `users` table: `npx wrangler d1 execute farm-inventory-db --remote --command "DELETE FROM users;"`.
