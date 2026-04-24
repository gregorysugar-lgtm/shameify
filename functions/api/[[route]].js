// Shameify API — Cloudflare Pages Function
// Auth: email + password login, session tokens stored in D1 sessions table.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function hashPassword(email, password) {
  const data = new TextEncoder().encode(email.toLowerCase() + '|' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const session = await env.DB.prepare(
    `SELECT s.user_id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
  ).bind(token).first();
  return session || null;
}

const BADGE_THRESHOLDS = [
  { id: 'early_adopter',    pts: 0    },
  { id: 'calendar_tetris',  pts: 150  },
  { id: 'email_warrior',    pts: 200  },
  { id: 'boomerang',        pts: 300  },
  { id: 'deck_criminal',    pts: 350  },
  { id: 'ooo_liar',         pts: 400  },
  { id: 'calendar_ghost',   pts: 500  },
  { id: 'synergy_devotee',  pts: 550  },
  { id: 'vanisher',         pts: 700  },
  { id: 'midnight_emailer', pts: 800  },
  { id: 'reply_all_menace', pts: 1000 },
  { id: 'hall_of_infamy',   pts: 2000 },
];

function computeBadges(pts) {
  return BADGE_THRESHOLDS.filter(b => pts >= b.pts).map(b => b.id);
}

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const route  = Array.isArray(params.route) ? params.route : (params.route ? [params.route] : []);
  const method = request.method;

  try {

    // ── POST /api/auth/register ──────────────────────────────────────
    if (route[0] === 'auth' && route[1] === 'register' && method === 'POST') {
      const { name, email, password } = await request.json();
      if (!name?.trim() || !email?.trim() || !password) {
        return json({ error: 'Name, email and password are required.' }, 400);
      }

      const existing = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email.toLowerCase().trim()).first();
      if (existing) return json({ error: 'An account with that email already exists.' }, 409);

      const id   = 'u_' + uid();
      const hash = await hashPassword(email.trim(), password);
      const now  = Date.now();
      const badges = ['early_adopter'];

      await env.DB.prepare(
        `INSERT INTO users (id, name, email, password_hash, shame_points, badges, joined_at) VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).bind(id, name.trim().slice(0, 60), email.toLowerCase().trim(), hash, JSON.stringify(badges), now).run();

      const token = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`).bind(token, id, now).run();

      return json({ token, user: { id, name: name.trim(), email: email.toLowerCase().trim(), shame_points: 0, badges, joined_at: now, infractions: [] } }, 201);
    }

    // ── POST /api/auth/login ─────────────────────────────────────────
    if (route[0] === 'auth' && route[1] === 'login' && method === 'POST') {
      const { email, password } = await request.json();
      if (!email?.trim() || !password) return json({ error: 'Email and password are required.' }, 400);

      const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email.toLowerCase().trim()).first();
      if (!user) return json({ error: 'No account found with that email.' }, 401);

      const hash = await hashPassword(email.trim(), password);
      if (hash !== user.password_hash) return json({ error: 'Incorrect password.' }, 401);

      const token = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`).bind(token, user.id, Date.now()).run();

      const { results: infractions } = await env.DB.prepare(
        `SELECT * FROM infractions WHERE user_id = ? ORDER BY timestamp_ms ASC`
      ).bind(user.id).all();

      return json({ token, user: { ...user, badges: JSON.parse(user.badges || '[]'), infractions, password_hash: undefined } });
    }

    // ── All routes below require a valid session ─────────────────────
    const session = await getSession(request, env);
    if (!session) return json({ error: 'Not authenticated.' }, 401);

    // ── GET /api/users ───────────────────────────────────────────────
    if (route[0] === 'users' && route.length === 1 && method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT u.id, u.name, u.shame_points, u.badges, u.joined_at,
               COUNT(i.id) AS infraction_count,
               MAX(i.timestamp_ms) AS last_infraction_ts,
               (SELECT i2.title FROM infractions i2 WHERE i2.user_id = u.id ORDER BY i2.timestamp_ms DESC LIMIT 1) AS last_infraction_title
        FROM users u
        LEFT JOIN infractions i ON i.user_id = u.id
        GROUP BY u.id
        ORDER BY u.shame_points DESC
      `).all();
      return json(results.map(u => ({ ...u, badges: JSON.parse(u.badges || '[]') })));
    }

    // ── GET /api/users/:id ───────────────────────────────────────────
    if (route[0] === 'users' && route.length === 2 && method === 'GET') {
      const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(route[1]).first();
      if (!user) return json({ error: 'User not found.' }, 404);
      const { results: infractions } = await env.DB.prepare(
        `SELECT * FROM infractions WHERE user_id = ? ORDER BY timestamp_ms ASC`
      ).bind(route[1]).all();
      return json({ ...user, badges: JSON.parse(user.badges || '[]'), infractions, password_hash: undefined });
    }

    // ── POST /api/users/:id/infractions ─────────────────────────────
    if (route[0] === 'users' && route[2] === 'infractions' && method === 'POST') {
      const targetId = route[1];
      const target   = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(targetId).first();
      if (!target) return json({ error: 'User not found.' }, 404);

      const { demeritId = null, title, points, witness = '', deadline = '' } = await request.json();
      if (!title || !points) return json({ error: 'title and points are required.' }, 400);

      const safePoints = Math.min(Math.max(parseInt(points, 10), 1), 10000);
      const id  = 'i_' + uid();
      const now = Date.now();

      await env.DB.prepare(
        `INSERT INTO infractions (id, user_id, demerit_id, title, points, timestamp_ms, witness, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, targetId, demeritId, title.slice(0, 200), safePoints, now, witness.slice(0, 120), deadline.slice(0, 20)).run();

      const newPoints = (target.shame_points || 0) + safePoints;
      const badges    = computeBadges(newPoints);

      await env.DB.prepare(`UPDATE users SET shame_points = ?, badges = ? WHERE id = ?`)
        .bind(newPoints, JSON.stringify(badges), targetId).run();

      return json({ id, timestamp_ms: now, points: safePoints, new_total: newPoints, badges }, 201);
    }

    return json({ error: 'Not found.' }, 404);

  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error.', detail: err.message }, 500);
  }
}
