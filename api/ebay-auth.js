// api/ebay-auth.js
//   GET    /api/ebay-auth → start eBay OAuth (redirect to eBay consent)
//   DELETE /api/ebay-auth → disconnect (clear stored token)
const crypto = require("crypto");
const { saveState, clearToken } = require("./_supa");
const { cors } = require("./_cors");

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const REDIRECT_URI = process.env.EBAY_REDIRECT_URI; // eBay RuName
const SANDBOX = process.env.EBAY_SANDBOX === "true";
const EBAY_AUTH_BASE = SANDBOX ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
].join(" ");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method === "DELETE") {
    await clearToken("ebay");
    return res.status(200).json({ success: true, message: "ebay disconnected" });
  }

  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send("eBay is not configured (missing EBAY_CLIENT_ID / EBAY_REDIRECT_URI).");
  }

  const state = crypto.randomBytes(16).toString("hex");
  await saveState(state, "ebay");

  const url =
    `${EBAY_AUTH_BASE}/oauth2/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${state}`;

  res.redirect(302, url);
};
