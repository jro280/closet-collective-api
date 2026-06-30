# Closet Collective API — setup

A standalone Vercel project that hosts the eBay integration as serverless functions.
It's deliberately **separate** from the website project because Vercel reliably builds
`/api` functions for a plain Node project (no front-end framework getting in the way).

Tokens are stored in your existing Supabase (`platform_tokens` / `oauth_state` tables,
already created and locked down). The functions read/write them with the Supabase
**service-role** key, which stays server-side only.

## Endpoints
- `GET  /api/status` → `{ ebay, etsy }` connection status
- `GET  /api/ebay-auth` → starts eBay OAuth (browser redirect)
- `GET  /api/ebay-callback` → eBay returns here; tokens get stored
- `POST /api/ebay-create-listing` → publishes a listing
- `DELETE /api/ebay-auth` → disconnect eBay
- `GET/DELETE /api/etsy-auth` → Etsy stub (not enabled yet)

---

## Step 1 — Put this folder in its own GitHub repo
1. Create a new repo on github.com named **closet-collective-api** (Private is fine).
2. Upload the contents of this `closet-collective-api/` folder (the `api/` folder and `package.json`).

## Step 2 — Import it into Vercel as a NEW project
1. Vercel → **Add New… → Project** → import the `closet-collective-api` repo.
2. Framework Preset: **Other** (it's just Node functions — no build step).
3. Deploy. You'll get a URL like `https://closet-collective-api.vercel.app`.

## Step 3 — Add environment variables (Vercel → this project → Settings → Environment Variables)
```
EBAY_CLIENT_ID            = (from your eBay developer keyset)
EBAY_CLIENT_SECRET        = (from your eBay developer keyset)
EBAY_REDIRECT_URI         = (your eBay RuName — the Redirect URL *name*, not a URL)
EBAY_SANDBOX              = false
FRONTEND_URL              = https://www.closetcollective.club
SUPABASE_URL              = https://pdlebkbfdaygvegwuttj.supabase.co
SUPABASE_SERVICE_ROLE_KEY = (Supabase → Project Settings → API → service_role secret)
```
> The eBay client ID/secret are the same values your old Railway backend used — copy them
> from the Railway dashboard (Variables tab) or regenerate them in the eBay developer portal.
> The service-role key is a **secret** — only ever put it here (server side), never in the website.

After adding variables, redeploy this project once so they take effect.

## Step 4 — Point the eBay developer portal at the new callback
In the eBay developer portal, edit your Redirect URL (RuName) settings so the
**"Your auth accepted URL"** is:
```
https://closet-collective-api.vercel.app/api/ebay-callback
```
(Use your real API project URL if it differs.)

## Step 5 — Tell the website where the API lives
In the **website** Vercel project (`closet-collective-frontend`) → Settings → Environment Variables, add:
```
REACT_APP_API_URL = https://closet-collective-api.vercel.app
```
Then redeploy the website. (`src/lib/api.js` already reads this variable.)

## Step 6 — Test
1. Open the site → **Platforms** tab → **Connect eBay** → sign in on eBay → you should land back with "eBay connected!".
2. Generate a listing → **Post to eBay** → it should create a live listing.

---

### Why separate, and what it costs
Two Vercel projects on the Hobby plan are free. The website stays a fast static app; the API
is independent, so an issue with one never takes down the other. If you later want it all under
one roof, we can revisit once the function-build quirk on the CRA project is sorted.
