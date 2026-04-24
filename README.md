# SHAMEIFY™
### *Shame Is the New Motivation*

An inverse rewards platform where employees accrue shame instead of points, get roasted instead of celebrated, and earn embarrassing penance instead of perks. Backed by Cloudflare Pages + D1.

---

## Run Locally

```bash
# Install Wrangler once
npm install -g wrangler
wrangler login

# Create a local .dev.vars file (gitignored) with your PIN
echo 'SHAME_PIN=shame' > .dev.vars

# Create a local D1 database and run the schema
wrangler d1 create shameify-db --local
wrangler d1 execute shameify-db --local --file=schema.sql

# Start the dev server (serves index.html + functions/ at localhost:8788)
wrangler pages dev .
```

Then open `http://localhost:8788`. The access code is whatever you set in `.dev.vars`.

---

## Deploy to Cloudflare Pages + D1

### 1. Create the D1 database

```bash
wrangler d1 create shameify-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding       = "DB"
database_name = "shameify-db"
database_id   = "PASTE_YOUR_DATABASE_ID_HERE"   # ← here
```

### 2. Run the schema (seeds demo users too)

```bash
wrangler d1 execute shameify-db --remote --file=schema.sql
```

### 3. Deploy to Pages

```bash
wrangler pages deploy .
```

Cloudflare will assign a domain like `shameify.pages.dev`.

### 4. Set the PIN secret

```bash
wrangler pages secret put SHAME_PIN
# → prompts for the value (e.g. "shame")
```

This is the server-side PIN the API validates on every request. It must match `CONFIG.PIN` in `index.html`.

### 5. Bind D1 to the Pages project (dashboard step)

Go to **Cloudflare Dashboard → Workers & Pages → shameify → Settings → Functions → D1 database bindings**:

- Variable name: `DB`
- D1 database: `shameify-db`

Click **Save**. Trigger a redeploy:

```bash
wrangler pages deploy .
```

The app is now live with a real shared database.

---

## Direct Upload (no CLI)

If you'd rather not use Wrangler, you can deploy the frontend manually:

1. **Cloudflare Dashboard → Workers & Pages → Create → Pages → Direct Upload**
2. Upload `index.html` (the `functions/` folder must be deployed via CLI or Git for the API to work)

For the full D1 backend, the CLI approach above is the path of least resistance.

---

## Customization

Everything lives in the `CONFIG` object at the top of the `<script>` block in `index.html`.

### Change the access PIN

Update `CONFIG.PIN` in `index.html`, then update the Pages secret:
```bash
wrangler pages secret put SHAME_PIN
```
Both must match or the API will return 401.

### Add or edit shame titles
```js
SHAME_TITLES: [
  { min: 0,   title: 'Slightly Tardy',  color: '#9CA3AF' },
  { min: 100, title: 'Habitually Vague', color: '#D4C5A0' },
  // ...
]
```
`min` is the shame point threshold. Titles escalate as points accumulate.

### Add demerits (pre-loaded sin catalog)
```js
DEMERITS: [
  { id: 'unique_id', name: 'What It\'s Called', points: 50, description: 'One-liner.' },
]
```
Each `id` must be unique. Also add a matching seed row to `schema.sql` if you want it in the demo data.

### Edit penances, roast templates, daily report templates
All are plain arrays in `CONFIG`. They're selected randomly at runtime. Template variables: `{name}`, `{points}`, `{infractions}`, `{title}`.

### Add achievement badges
```js
ACHIEVEMENTS: [
  { id: 'unique_id', icon: '🏅', name: 'Badge Name', description: '...', triggerPoints: 300 },
]
```
Also add the badge to `BADGE_THRESHOLDS` in `functions/api/[[route]].js` so the server awards it correctly.

---

## Architecture

```
shameify/
├── index.html                  ← Frontend (Cloudflare Pages)
├── functions/
│   └── api/
│       └── [[route]].js        ← Pages Function (API layer, binds to D1)
├── schema.sql                  ← D1 schema + demo seed data
├── wrangler.toml               ← Local dev config
└── README.md
```

**API routes** (all require `X-Shame-Pin` header):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List all users (sorted by shame score) |
| `POST` | `/api/users` | Create a user `{ name }` |
| `GET` | `/api/users/:id` | Get user + full infraction history |
| `POST` | `/api/users/:id/infractions` | Add an infraction `{ demeritId, title, points, witness, deadline }` |

**Persistence:** All user records and infractions live in D1 (SQLite). The `CONFIG` arrays (demerits, penances, templates, achievements) are purely frontend config — edit and redeploy `index.html` to change them.

**Sessions:** The currently selected user ID is stored in `localStorage` as a convenience — switching browsers or devices shows the picker again. All actual data is in D1 and shared across everyone who knows the PIN.

---

*"Shame is the new motivation."*
