# SHAMEIFY™
### *Shame Is the New Motivation*

An inverse rewards platform where employees accrue shame instead of points, get roasted instead of celebrated, and earn embarrassing penance instead of perks. Think Bonusly, but written by the HR department of Lumon Industries.

---

## Run Locally

```bash
cd shameify
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just double-click `index.html` — it runs entirely in-browser with no build step.

**Default access code:** `shame`

---

## Deploy to Cloudflare Pages (Direct Upload)

No Git required. Drag and drop.

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Direct Upload**
2. Name your project (e.g. `shameify`)
3. Click **Upload assets** and drag in `index.html`
4. Click **Deploy site**

Your app is live at `https://shameify.pages.dev` (or your custom project name). To update: upload a new `index.html` to the same project.

---

## Customization

Everything is in the `CONFIG` object at the top of the `<script>` block in `index.html`. Open it in any text editor.

### Change the access PIN
```js
PIN: 'shame',  // ← change this
```

### Add or edit shame titles (the corporate rank ladder)
```js
SHAME_TITLES: [
  { min: 0,    title: 'Slightly Tardy',       color: '#9CA3AF' },
  { min: 100,  title: 'Habitually Vague',      color: '#D4C5A0' },
  // ... add more tiers here
]
```
`min` is the shame point threshold. Titles escalate as points accumulate.

### Add or edit demerits (the pre-loaded sin catalog)
```js
DEMERITS: [
  { id: 'your_id', name: 'What It\'s Called', points: 50, description: 'One-liner context.' },
  // ...
]
```
Each entry appears as a clickable row in the Demerit Catalog. The `id` must be unique.

### Edit penances
```js
PENANCES: [
  "Bring donuts to the 9am standup tomorrow.",
  // add as many as you want — one is selected at random per infraction
]
```

### Edit achievements / badges
```js
ACHIEVEMENTS: [
  { id: 'unique_id', icon: '🏅', name: 'Badge Name', description: 'What it means.', triggerPoints: 300 },
  // ...
]
```
`triggerPoints` is the shame score at which the badge is automatically awarded.

### Edit roast and daily report templates
```js
ROAST_TEMPLATES: [
  "{name}'s last calendar invite had no agenda...",
  // {name}, {points}, {infractions}, {title} are replaced at runtime
]

DAILY_REPORT_TEMPLATES: [
  // same template variables apply
]
```

---

## Architecture

- **Zero backend.** Everything runs in the browser.
- **LocalStorage** stores all user data under the key `shameify_v1`.
- **No build step.** Pure HTML + vanilla JS + Tailwind CDN.
- **Offline after first load** (Tailwind and Google Fonts will cache).
- Three demo users are seeded on first load so the app isn't empty.

---

## Cloudflare D1 (Future v2)

The current version uses LocalStorage — data lives in the browser and isn't shared across devices or users. If you want a shared leaderboard (multiple real people competing), the upgrade path is:

1. Add a Cloudflare Worker as a thin API layer
2. Attach a D1 SQLite database to the Worker
3. Replace `localStorage.getItem/setItem` calls in `index.html` with `fetch()` calls to the Worker endpoints

The CONFIG arrays (demerits, penances, templates) stay in `index.html` — only the user/infraction persistence moves to D1.

---

*"Shame is the new motivation."*
