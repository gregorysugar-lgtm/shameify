// Shameify API — Cloudflare Pages Function
// Handles all /api/* routes. Binds to D1 database "DB".
// Auth: every request must include X-Shame-Pin header matching SHAME_PIN secret.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Shame-Pin',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Badge thresholds — must stay in sync with CONFIG.ACHIEVEMENTS in index.html
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

function computeBadges(shamePoints) {
  return BADGE_THRESHOLDS.filter(b => shamePoints >= b.pts).map(b => b.id);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function onRequest(context) {
  const { request, env, params } = context;

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // Auth — compare against SHAME_PIN Worker secret
  const pin = request.headers.get('X-Shame-Pin');
  if (!env.SHAME_PIN || pin !== env.SHAME_PIN) {
    return json({ error: 'ACCESS DENIED. SHAME ON YOU.' }, 401);
  }

  const route = Array.isArray(params.route) ? params.route : (params.route ? [params.route] : []);
  const method = request.method;

  try {
    // ── GET /api/users ──────────────────────────────────────────────
    if (route.length === 1 && route[0] === 'users' && method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT
          u.id, u.name, u.shame_points, u.badges, u.joined_at,
          COUNT(i.id)         AS infraction_count,
          MAX(i.timestamp_ms) AS last_infraction_ts,
          (SELECT i2.title FROM infractions i2
           WHERE i2.user_id = u.id
           ORDER BY i2.timestamp_ms DESC LIMIT 1) AS last_infraction_title
        FROM users u
        LEFT JOIN infractions i ON i.user_id = u.id
        GROUP BY u.id
        ORDER BY u.shame_points DESC
      `).all();

      return json(results.map(u => ({ ...u, badges: JSON.parse(u.badges || '[]') })));
    }

    // ── POST /api/users ─────────────────────────────────────────────
    if (route.length === 1 && route[0] === 'users' && method === 'POST') {
      const { name } = await request.json();
      if (!name?.trim()) return json({ error: 'name is required' }, 400);

      const id       = 'u_' + uid();
      const now      = Date.now();
      const badges   = ['early_adopter'];

      await env.DB.prepare(
        `INSERT INTO users (id, name, shame_points, badges, joined_at) VALUES (?, ?, 0, ?, ?)`
      ).bind(id, name.trim().slice(0, 60), JSON.stringify(badges), now).run();

      return json({ id, name: name.trim(), shame_points: 0, badges, joined_at: now, infraction_count: 0 }, 201);
    }

    // ── GET /api/users/:id ──────────────────────────────────────────
    if (route.length === 2 && route[0] === 'users' && method === 'GET') {
      const userId = route[1];
      const user   = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
      if (!user) return json({ error: 'User not found' }, 404);

      const { results: infractions } = await env.DB.prepare(
        `SELECT * FROM infractions WHERE user_id = ? ORDER BY timestamp_ms ASC`
      ).bind(userId).all();

      return json({ ...user, badges: JSON.parse(user.badges || '[]'), infractions });
    }

    // ── POST /api/users/:id/infractions ────────────────────────────
    if (route.length === 3 && route[0] === 'users' && route[2] === 'infractions' && method === 'POST') {
      const userId = route[1];
      const user   = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
      if (!user) return json({ error: 'User not found' }, 404);

      const body = await request.json();
      const { demeritId = null, title, points, witness = '', deadline = '' } = body;

      if (!title || !points) return json({ error: 'title and points are required' }, 400);

      const safePoints = Math.min(Math.max(parseInt(points, 10), 1), 10000);
      const id         = 'i_' + uid();
      const now        = Date.now();

      await env.DB.prepare(
        `INSERT INTO infractions (id, user_id, demerit_id, title, points, timestamp_ms, witness, deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, userId, demeritId, title.slice(0, 200), safePoints, now, witness.slice(0, 120), deadline.slice(0, 20)).run();

      const newPoints = (user.shame_points || 0) + safePoints;
      const badges    = computeBadges(newPoints);

      await env.DB.prepare(`UPDATE users SET shame_points = ?, badges = ? WHERE id = ?`)
        .bind(newPoints, JSON.stringify(badges), userId).run();

      return json({ id, timestamp_ms: now, points: safePoints, new_total: newPoints, badges }, 201);
    }

    return json({ error: 'Not found' }, 404);

  } catch (err) {
    console.error(err);
    return json({ error: 'Internal server error', detail: err.message }, 500);
  }
}
