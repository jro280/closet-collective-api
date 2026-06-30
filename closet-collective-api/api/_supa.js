// api/_supa.js — server-side Supabase helpers (NOT a route; underscore-prefixed).
// Uses the SERVICE ROLE key so it can read/write the locked-down token tables.
// This key is a server-only secret and is never sent to the browser.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: "return=representation",
  };
}

async function getToken(platform) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/platform_tokens?platform=eq.${platform}`, { headers: headers() });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

async function setToken(platform, { access_token, refresh_token, expires_at }) {
  await fetch(`${SUPABASE_URL}/rest/v1/platform_tokens?on_conflict=platform`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ platform, access_token, refresh_token, expires_at, updated_at: new Date().toISOString() }),
  });
}

async function clearToken(platform) {
  await fetch(`${SUPABASE_URL}/rest/v1/platform_tokens?platform=eq.${platform}`, {
    method: "DELETE",
    headers: { ...headers(), Prefer: "" },
  });
}

async function statusAll() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/platform_tokens?select=platform`, { headers: headers() });
  const rows = r.ok ? await r.json() : [];
  const set = new Set(rows.map((x) => x.platform));
  return { etsy: set.has("etsy"), ebay: set.has("ebay") };
}

async function saveState(state, platform) {
  await fetch(`${SUPABASE_URL}/rest/v1/oauth_state`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ state, platform }),
  });
}

async function consumeState(state) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/oauth_state?state=eq.${encodeURIComponent(state)}`, { headers: headers() });
  const rows = r.ok ? await r.json() : [];
  if (!rows.length) return null;
  await fetch(`${SUPABASE_URL}/rest/v1/oauth_state?state=eq.${encodeURIComponent(state)}`, {
    method: "DELETE",
    headers: { ...headers(), Prefer: "" },
  });
  return rows[0].platform;
}

module.exports = { getToken, setToken, clearToken, statusAll, saveState, consumeState };
