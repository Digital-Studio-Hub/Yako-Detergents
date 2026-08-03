/**
 * Lekker Network Connect API — server-side connector.
 * Token stays on the server; clients call /api/feed and /api/product-image only.
 *
 * Env vars (preferred in production):
 *   LEKKER_WORKSPACE_ID
 *   LEKKER_TOKEN
 */

const WID =
  process.env.LEKKER_WORKSPACE_ID || "5970e7e0-9e09-4aae-ab09-63920f87c55d";
const TOKEN =
  process.env.LEKKER_TOKEN || "6205e870-c3f5-4350-97d7-1ec944f21baa";
const LEKKER_ORIGIN =
  process.env.LEKKER_ORIGIN || "https://lekker.network";

const BASE = `${LEKKER_ORIGIN}/api/connect/${WID}`;

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

/**
 * Extract object-storage path from a Lekker image URL.
 * e.g. https://lekker.network/objects/uploads/uuid → objects/uploads/uuid
 */
export function extractObjectPath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  try {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const u = new URL(imageUrl);
      if (u.pathname.startsWith("/objects/")) {
        return u.pathname.slice(1); // objects/uploads/...
      }
      // Already a public proxy URL — extract subpath after workspace id
      const m = u.pathname.match(
        /^\/api\/public\/img\/[0-9a-f-]{36}\/(.+)$/i
      );
      if (m) return m[1];
      return null;
    }
    if (imageUrl.startsWith("/objects/")) return imageUrl.slice(1);
    if (imageUrl.startsWith("objects/")) return imageUrl;
  } catch {
    return null;
  }
  return null;
}

/** Rewrite feed product images to our same-origin proxy (token never in browser). */
export function rewriteFeedImageUrls(data) {
  if (!data || !Array.isArray(data.products)) return data;
  for (const p of data.products) {
    const objectPath = extractObjectPath(p.imageUrl);
    if (objectPath) {
      p.imageUrl = `/api/product-image?path=${encodeURIComponent(objectPath)}`;
    }
  }
  if (data.workspace?.logo) {
    const logoPath = extractObjectPath(data.workspace.logo);
    if (logoPath) {
      data.workspace.logo = `/api/product-image?path=${encodeURIComponent(logoPath)}`;
    }
  }
  return data;
}

/**
 * Fetch a product image from Lekker's public image proxy.
 * Falls back to the raw objects URL (usually 401) only as a last attempt.
 */
export async function fetchProductImage(objectPath) {
  const clean = String(objectPath || "")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "");
  if (!clean || !/^(objects|products|logos|content-creation)\//.test(clean)) {
    const err = new Error("Invalid image path");
    err.status = 400;
    throw err;
  }

  const candidates = [
    `${LEKKER_ORIGIN}/api/public/img/${WID}/${clean}?token=${encodeURIComponent(TOKEN)}`,
    // Older public-img shape without workspace segment (legacy)
    `${LEKKER_ORIGIN}/api/public/img/${clean}?token=${encodeURIComponent(TOKEN)}`,
  ];

  let lastStatus = 502;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "image/*,*/*" },
        redirect: "follow",
      });
      if (!res.ok) {
        lastStatus = res.status;
        continue;
      }
      const contentType = res.headers.get("content-type") || "";
      // SPA HTML fallback is not an image
      if (contentType.includes("text/html")) {
        lastStatus = 502;
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      return {
        buffer,
        contentType: contentType.startsWith("image/")
          ? contentType
          : "image/jpeg",
      };
    } catch {
      lastStatus = 502;
    }
  }

  const err = new Error("Unable to load product image from Lekker Network");
  err.status = lastStatus;
  throw err;
}

export async function getFeed(params = { published: true }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  }
  const query = qs.toString();
  const data = await call(`/feed${query ? `?${query}` : ""}`);
  return rewriteFeedImageUrls(data);
}

export async function submitContactToLekker(data) {
  return call("/contacts", "POST", data);
}

export function isConfigured() {
  return Boolean(WID && TOKEN);
}

export function getWorkspaceId() {
  return WID;
}
