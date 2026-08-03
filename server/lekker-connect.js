/**
 * Lekker Network Connect API — server-side connector.
 * Token stays on the server; clients call /api/feed only.
 *
 * Env vars (preferred in production):
 *   LEKKER_WORKSPACE_ID
 *   LEKKER_TOKEN
 */

const WID =
  process.env.LEKKER_WORKSPACE_ID || "5970e7e0-9e09-4aae-ab09-63920f87c55d";
const TOKEN =
  process.env.LEKKER_TOKEN || "6205e870-c3f5-4350-97d7-1ec944f21baa";

const BASE = `https://lekker.network/api/connect/${WID}`;

async function call(path, method = "GET", body) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Lekker API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function getFeed(params = { published: true }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const query = qs.toString();
  return call(`/feed${query ? `?${query}` : ""}`);
}

export async function submitContactToLekker(data) {
  return call("/contacts", "POST", data);
}

export function isConfigured() {
  return Boolean(WID && TOKEN);
}
