// api/_cors.js — CORS for the standalone API project (not a route; underscore-prefixed).
// The frontend lives on a different origin (closetcollective.club), so cross-origin
// fetches (status, create-listing) need these headers + an OPTIONS preflight reply.
const ORIGIN = process.env.FRONTEND_URL || "https://www.closetcollective.club";

// Returns true if the request was a preflight that we've already answered.
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { cors };
