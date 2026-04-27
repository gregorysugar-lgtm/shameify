export async function onRequest(context) {
  const url = new URL(context.request.url);
  const name   = url.searchParams.get('name')   || 'Someone';
  const title  = url.searchParams.get('title')  || 'Corporate Misconduct';
  const points = url.searchParams.get('points') || '???';
  const by     = url.searchParams.get('by');

  const ogTitle = `${name} has been formally charged`;
  const ogDesc  = by
    ? `"${title}" · +${points} shame points. Filed by ${by}. View the full Ledger.`
    : `"${title}" · +${points} shame points added to their permanent record.`;

  const esc = s => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(name)} — Formally Shamed | Shameify</title>
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:url" content="${esc(url.href)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Shameify">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(ogDesc)}">
<meta http-equiv="refresh" content="0;url=/app.html?linezero">
</head>
<body>
<script>window.location.replace('/app.html?linezero');</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}
