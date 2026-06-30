// api/ebay-create-listing.js — POST /api/ebay-create-listing
// Publishes a fixed-price eBay listing via the Sell Inventory API.
const { getToken, setToken } = require("./_supa");
const { cors } = require("./_cors");

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const SANDBOX = process.env.EBAY_SANDBOX === "true";
const EBAY_BASE = SANDBOX ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
].join(" ");

async function ebayFetch(url, opts, token) {
  return fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
      ...(opts.headers || {}),
    },
  });
}

async function refreshToken(tokens) {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const resp = await fetch(`${EBAY_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, scope: SCOPES }),
  });
  if (!resp.ok) throw new Error("Could not refresh eBay token — please reconnect eBay.");
  const data = await resp.json();
  await setToken("ebay", { access_token: data.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

async function getValidToken() {
  const tokens = await getToken("ebay");
  if (!tokens) throw new Error("eBay not connected.");
  if (Date.now() > Number(tokens.expires_at) - 60000) return refreshToken(tokens);
  return tokens.access_token;
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });
  try {
    const token = await getValidToken();
    const { title, description, price, imageUrls = [], condition, category, gender, size, brand, material, color, era, suggestedPrice } = req.body || {};

    const sku = `CC-${Date.now()}`;
    const numPrice = parseFloat(String(suggestedPrice || price || "20").replace(/[^0-9.]/g, "")) || 20;

    const invResp = await ebayFetch(`${EBAY_BASE}/sell/inventory/v1/inventory_item/${sku}`, {
      method: "PUT",
      body: JSON.stringify({
        product: {
          title: String(title || "").slice(0, 80),
          description,
          imageUrls: imageUrls.slice(0, 12),
          aspects: buildAspects({ brand, size, material, color, era, gender }),
        },
        condition: ebayCondition(condition),
        conditionDescription: condition,
        availability: { shipToLocationAvailability: { quantity: 1 } },
      }),
    }, token);
    if (!invResp.ok) throw new Error(await firstError(invResp));

    const offerResp = await ebayFetch(`${EBAY_BASE}/sell/inventory/v1/offer`, {
      method: "POST",
      body: JSON.stringify({
        sku, marketplaceId: "EBAY_US", format: "FIXED_PRICE", availableQuantity: 1,
        categoryId: ebayCategory(category, gender),
        listingDescription: description,
        listingPolicies: await getPolicies(token),
        pricingSummary: { price: { value: numPrice.toFixed(2), currency: "USD" } },
        includeCatalogProductDetails: false,
      }),
    }, token);
    if (!offerResp.ok) throw new Error(await firstError(offerResp));
    const { offerId } = await offerResp.json();

    const pubResp = await ebayFetch(`${EBAY_BASE}/sell/inventory/v1/offer/${offerId}/publish`, { method: "POST", body: "{}" }, token);
    if (!pubResp.ok) throw new Error(await firstError(pubResp));
    const { listingId } = await pubResp.json();

    res.status(200).json({ success: true, listingId, listingUrl: `https://www.ebay.com/itm/${listingId}` });
  } catch (e) {
    console.error("eBay listing error:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};

async function firstError(resp) {
  try { const j = await resp.json(); return j.errors?.[0]?.message || JSON.stringify(j); }
  catch { return `eBay API error (${resp.status})`; }
}

async function getPolicies(token) {
  async function getPolicy(type, endpoint, defaultBody) {
    try {
      const r = await fetch(`${EBAY_BASE}/sell/account/v1/${endpoint}?marketplace_id=EBAY_US`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        const items = data[Object.keys(data).find((k) => Array.isArray(data[k]))] || [];
        if (items.length) return items[0][`${type}PolicyId`];
      }
    } catch {}
    const r = await ebayFetch(`${EBAY_BASE}/sell/account/v1/${endpoint}`, { method: "POST", body: JSON.stringify(defaultBody) }, token);
    const data = await r.json();
    return data[`${type}PolicyId`];
  }
  const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId] = await Promise.all([
    getPolicy("fulfillment", "fulfillment_policy", {
      name: "Standard Shipping", marketplaceId: "EBAY_US", handlingTime: { value: 3, unit: "DAY" },
      shippingOptions: [{ optionType: "DOMESTIC", costType: "FLAT_RATE", shippingServices: [{ shippingServiceCode: "USPSFirstClass", buyerResponsibleForShipping: false, shippingCost: { value: "5.00", currency: "USD" }, additionalShippingCost: { value: "2.00", currency: "USD" } }] }],
    }),
    getPolicy("payment", "payment_policy", { name: "Immediate Payment", marketplaceId: "EBAY_US", immediatePay: true }),
    getPolicy("return", "return_policy", { name: "No Returns", marketplaceId: "EBAY_US", returnsAccepted: false }),
  ]);
  return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

function ebayCondition(condition) {
  return { "Excellent / Like new": "LIKE_NEW", "Good — minor wear": "VERY_GOOD", "Fair — visible wear": "GOOD", "Distressed / As-is": "ACCEPTABLE" }[condition] || "GOOD";
}

function ebayCategory(category, gender) {
  const map = {
    "Jacket / Coat": { "Men's": "57988", "Women's": "63862", default: "57988" },
    "Shirt / Top": { "Men's": "185100", "Women's": "53159", default: "185100" },
    "Pants / Jeans": { "Men's": "57989", "Women's": "63863", default: "57989" },
    "Dress / Skirt": { "Women's": "63861", default: "63861" },
    "Sweater / Knitwear": { "Men's": "11484", "Women's": "63864", default: "11484" },
    "Suit / Blazer": { "Men's": "3001", "Women's": "63865", default: "3001" },
    "Shoes / Footwear": { "Men's": "93427", "Women's": "55793", default: "93427" },
    Accessories: { default: "4250" },
    Sportswear: { default: "137084" },
    "Vintage / Collectible": { default: "11450" },
  };
  const cat = map[category] || { default: "11450" };
  return cat[gender] || cat.default;
}

function buildAspects(item) {
  const a = {};
  if (item.brand && item.brand !== "no brand") a["Brand"] = [item.brand];
  if (item.size) a["Size"] = [item.size];
  if (item.material) a["Material"] = [item.material];
  if (item.color) a["Color"] = [item.color];
  if (item.gender) a["Department"] = [item.gender.replace("'s", "s")];
  if (item.era) a["Vintage"] = ["Yes"];
  return a;
}
