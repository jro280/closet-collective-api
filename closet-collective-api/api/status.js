// api/status.js — GET /api/status → which platforms are connected
const { statusAll } = require("./_supa");
const { cors } = require("./_cors");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    res.status(200).json(await statusAll());
  } catch (e) {
    res.status(200).json({ etsy: false, ebay: false });
  }
};
