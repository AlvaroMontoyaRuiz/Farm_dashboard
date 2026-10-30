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
│   ├── _lib/auth.js, time.js      # time.js = Colombia time (UTC-5) for "today"
│   └── api/
│       ├── auth/{setup,login,logout,me}.js
│       ├── dashboard.js           # everything the Panel page shows (one request)
│       ├── inventory.js           # bultos ledger (kardex) + stock history
│       ├── _middleware.js         # clear errors if DB binding / tables are missing
│       ├── summary.js             # (legacy) basic totals
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

## Screens

- **Panel**: animals, corrales fed today, today's consumption, stock per feed type with an estimate of
  how many days it will last, daily consumption chart (7/14/30 days), recent activity, and a grid of
  all corrales. Tapping a corral opens "Consumo" with that corral already selected.
- **Bultos**: *Resumen* (stock, this month's in/out, stock-over-time chart), *Movimientos* (every ingreso
  and consumo with the balance after each one, filterable), *Ingresos* (admin registers deliveries).
- Stock is never stored; it is always `received - consumed`, so deleting or fixing a record corrects
  every balance automatically. "Days left" uses the average of the last 7 full days (today is excluded
  because it is still in progress).
- "Today" is always Colombia time (UTC-5), not UTC, so entries made after 7 pm land on the right day.

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

(The rest of the structure is created by the app itself the first time you open it.)

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

## Inventory rules (no negative stock)

The app never lets the inventory go below zero:

- **Feeding** can't use more bultos than are in storage (received − consumed, per food type).
- **Animal exits** can't take out more animals than the corral has.
- **Backdated entries** are refused if they would leave a negative balance on any past day.
- **Deleting a delivery of bultos or an animal entry** is refused if those units were already used. Deleting a consumption or an exit is always allowed (it gives stock back).
- Checks run on the server in a single atomic statement, so two workers saving at the same moment can't both slip through. The forms also show what is available and disable *Guardar* when the amount is too high.

## Weights and feed conversion (conversión alimenticia)

- In **Animales**, every entry and exit asks for the **total weight of the group** in kg (weigh them together).
- In **Bultos → Tipos de bulto** the administrator sets the **kg per bulto** of each feed (demo value: 40 kg). The value is copied onto each feeding when it is saved, so changing it later only affects new feedings.
- When animals **leave** a corral, the app calculates `FCR = kg of feed eaten ÷ kg of weight gained` and rates it:

  | FCR | Rating |
  |---|---|
  | up to 2.5 | Buena |
  | 2.6 – 3.0 | Regular |
  | above 3.0 | Mala |

- Animals enter together but leave in small groups, so each exit is charged with the feed an *average animal* of that corral has eaten since it arrived (animals that arrive later are not charged for earlier feed). The result is recalculated from the records, so deleting or correcting a record fixes it automatically. The maths is in `functions/_lib/fcr.js`.

## Types of animal movement

| Movement | Types | Weight | Feed conversion |
|---|---|---|---|
| Ingreso | *Ingreso nuevo* · *Regreso de enfermería* | required for new animals · optional for returns | — |
| Salida | *Venta* · *Enfermería* · *Muerte* | required for sales · optional otherwise | **only Venta is rated** |

- **Muerte:** the feed those animals ate stays in the batch and is spread over the animals that remain, so losses raise the conversion of the group that is sold.
- **Enfermería:** the animals leave the corral count but keep their history (feed eaten, entry weight, entry date). A **Regreso de enfermería** brings back that many animals with that history. You cannot return more animals than are in the infirmary, and an infirmary exit that already returned cannot be deleted.
- Exits recorded before this update count as sales.

## Lotes, feed types and prices

- **Lotes** (Panel): groups of corrales. The Panel shows how many animals each lote has, which corrales it contains and how many were fed today. The administrator uses **Organizar lotes** to move a corral to another lote, rename lotes, add a new one or delete an empty one. The first time, the app creates Lote 1 (corrales 2, 5, 7, 9), Lote 2 (1, 3, 4, 12), Lote 3 (10, 11) and Lote 4 (6, 8, 13). Corrales without a lote appear under *Sin lote*. The animals of a lote are never stored: they are the sum of its corrales, so they are always right.
- **Feed types**: Levante, **Engorde** and Finalizador (40 kg per bulto each by default; change it in Bultos → Tipos de bulto). To add another type, add it in `functions/_lib/foods.js`, `src/lib/format.js` and the `TYPES_SQL` list in `functions/_lib/migrate.js`.
- **Prices** (Bultos, admin only): every delivery (*Ingresos*) is saved with the price of ONE bulto **without IVA**. The IVA (5 %, `IVA_RATE` in `functions/_lib/foods.js`) and the totals are calculated, never stored. Each delivery keeps its own price, so a later refill at a different price does not change the earlier ones. *Bultos → Resumen → Costo de los bultos* shows, per type, the last price, the average price (weighted by bultos), cost per kg, and the totals without IVA, IVA and with IVA. A wrong price is corrected with **Corregir** (no need to delete the delivery).

## Mortality and batches (camadas)

- A **camada** (batch) is the group of animals that goes through a lote together. It **starts** when animals enter a lote that is empty, more entries while animals are still there join the same camada, and it **ends** when the lote is empty again (everything sold or dead). 150 enter and 5 die = one camada with **3,3 %** mortality (deaths ÷ animals that entered).
- Animals in the infirmary stay part of their camada, so sending the healthy ones to be sold does not close it early.
- **Panel → Lotes:** each lote card shows the mortality of the camada in progress (deaths of entered, day number) or, if the lote is empty, of the last finished one.
- **Camadas** (admin menu): mortality per lote over all its history, plus the history of every camada (start, end, days, entered, deaths, sold, mortality).
- Nothing is stored: it is calculated from the animal movements, so deleting or correcting a record fixes the numbers. It uses the corrales each lote has today; moving a corral to another lote recalculates the history of both lotes.

## Feeding screen for workers (tablet)

Workers open **Consumo** and see every corral as a big tile (animals, "Listo"/"Falta" for today). Tapping a corral opens its page with one card per type of bulto (Levante, Engorde, Finalizador): a big **+** adds a bulto, a big **−** takes one off, and the number in the middle is what the corral got today. A switch at the top changes each tap between 1 bulto and ½ bulto.

- **+** adds to the record that person already has today for that corral and type, so ten taps are one line, not ten. It respects the stock in storage (it stops at 0 even if two people tap at once).
- **−** takes bultos off today's feeding. Workers can only take off what they registered themselves; the administrator can take off anyone's. Everything taken off is copied to *Historial eliminados* with the reason "Se quitó con el botón −".
- The administrator keeps the detailed form (other dates, notes) at **Consumo**, with a link to see the workers' screen. Links from the Panel (`/consumo?corral=7`) open the corral's tablet page for workers.

## Low-stock notices (administrator)

The top of the **Panel** has an **Avisos** card. When a type of bulto in storage drops **below 40 bultos** it shows a line ("Quedan 13 bultos de Levante (menos de 40)") with a *Registrar ingreso* button, so there is time to buy before it runs out; at 0 it says "Sin bultos". Types that were never bought are not flagged. The limit is `LOW_STOCK_BULTOS` in `functions/api/dashboard.js`.

## Moving animals between corrales: Solicitudes

- A **worker** opens **Solicitudes**, picks the origin corral, the destination, how many animals and an optional note. The request stays **Pendiente** and **nothing moves** until the administrator approves. The worker can cancel it while it is pending and sees the result (Aprobada / Rechazada, with the administrator's reason) afterwards.
- The **administrator** sees the pending requests first (a red number on the *Solicitudes* menu and a line in Avisos), and presses **Aprobar traslado** or **Rechazar** (with an optional reason). Approval moves the animals at that moment, and it is refused if the origin no longer has enough animals. The administrator can also move animals directly from the same page.
- An approved move is recorded as an exit from the origin and an entry in the destination (*Traslado*), so animal counts are right everywhere. Feed given before the move is carried to the destination for the conversion (FCR). Between two different lotes, the camada of the lote they leave loses them (not counted as sold or dead) and the lote they join counts them as entered. These records cannot be deleted; to undo a move, request the opposite one.

## Updating an existing database

**The app updates its own database.** The first time anyone uses the site after a new version is deployed, it checks the database and adds whatever is missing (weights, movement types, Engorde, prices, lotes, move requests), keeping every record. There is nothing to run.

The older command-line migrations (`db:remote:update` = 0003, `db:remote:update-types` = 0004) still exist but are no longer needed. A new install only needs:

```bash
npm run db:remote:init
npm run db:remote:seed
```

## Start from zero (clean records and users)

To hand the app over "like new" after testing, wipe all records and users but keep the 20 corrales:

```bash
npm run db:remote:reset      # the real, deployed database (cannot be undone)
```

No terminal? Open **Cloudflare → Workers & Pages → D1 → farm-inventory-db → Console**, paste the contents of `scripts/reset-data.sql` and run it.
Afterwards open `/setup` and create the administrator and workers again. `npm run db:local:reset` does the same on your local test copy.

## Roles

- **admin**: can do everything — register food lots, see the deletion log, delete anyone's records.
- **worker**: sees only **Consumo** (the tablet feeding screen) and **Solicitudes** (asks to move animals between corrales). The Panel, Animales, Bultos, Camadas, Historial diario and Historial eliminados are administrator-only, in the menu **and on the server** (typing the address sends a worker back to Consumo). Workers no longer register animal ingresos, sales or deaths: the administrator does.

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
- Can't reach `/setup` → it's disabled once users exist. Use `npm run db:remote:reset` (see *Start from zero*).
