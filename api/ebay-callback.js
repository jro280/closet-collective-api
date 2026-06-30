// api/ebay-callback.js — GET /api/ebay-callback
// eBay redirects here with ?code&state. Exchange code for tokens, store, bounce home.
// (Top-level browser navigation — no CORS needed, but harmless to set.)
const { consumeState, setToken } = require("./_supa");
const { cors } = require("./_cors");

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const REDIRECT_URI = process.env.EBAY_REDIRECT_URI; // eBay RuName
const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.closetcollective.club";
const SANDBOX = process.env.EBAY_SANDBOX === "true";
const EBAY_BASE = SANDBOX ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  const { code, state, error } = req.query;

  if (error || !code) {
    return res.redirect(302, `${FRONTEND_URL}?ebay_auth=error&reason=${error || "no_code"}`);
  }
  const platform = await consumeState(state);
  if (platform !== "ebay") {
    return res.redirect(302, `${FRONTEND_URL}?ebay_auth=error&reason=state_mismatch`);
  }

  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const resp = await fetch(`${EBAY_BASE}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!resp.ok) {
      console.error("eBay token exchange failed:", await resp.text());
      return res.redirect(302, `${FRONTEND_URL}?ebay_auth=error&reason=token_exchange`);
    }
    const data = await resp.json();
    await setToken("ebay", {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
    res.redirect(302, `${FRONTEND_URL}?ebay_auth=success`);
  } catch (e) {
    console.error("eBay OAuth error:", e.message);
    res.redirect(302, `${FRONTEND_URL}?ebay_auth=error`);
  }
};
