// api/etsy-auth.js — Etsy not currently enabled (API access pending). Graceful stub.
const { clearToken } = require("./_supa");
const { cors } = require("./_cors");
const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.closetcollective.club";

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === "DELETE") {
    await clearToken("etsy");
    return res.status(200).json({ success: true });
  }
  res.redirect(302, `${FRONTEND_URL}?etsy_auth=error&reason=not_available`);
};
