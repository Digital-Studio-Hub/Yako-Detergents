import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getFeed, submitContactToLekker, isConfigured } from "./lekker-connect.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

/**
 * Product catalogue feed proxy.
 * Keeps the Lekker Connect token off the client.
 * GET /api/feed?published=true
 */
app.get("/api/feed", async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Lekker Connect is not configured on this server.",
    });
  }
  try {
    const published =
      req.query.published === undefined ? true : req.query.published !== "false";
    const data = await getFeed({ published });
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("[lekker-feed]", err.message);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({
      error: "Unable to load products from Lekker Network right now.",
      detail: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

app.post("/api/quote", async (req, res) => {
  const payload = req.body || {};
  console.log("[quote-request]", JSON.stringify(payload));

  // Best-effort: also push the lead into Lekker CRM when Connect is configured
  if (isConfigured() && (payload.name || payload.email || payload.phone)) {
    try {
      await submitContactToLekker({
        name: payload.name || "Website quote",
        email: payload.email || undefined,
        phone: payload.phone || undefined,
        message: [
          payload.message,
          payload.product ? `Product: ${payload.product}` : null,
          payload.quantity ? `Quantity: ${payload.quantity}` : null,
          payload.company ? `Company: ${payload.company}` : null,
        ]
          .filter(Boolean)
          .join("\n") || undefined,
        sourceUrl: payload.sourceUrl || "https://yakodp.co.za/contact",
      });
    } catch (err) {
      console.warn("[lekker-contact]", err.message);
    }
  }

  res.json({
    ok: true,
    message: "Quote request received. Our sales team will contact you shortly.",
  });
});

app.use(express.static(publicDir, { extensions: ["html"] }));

// Clean routes
const pages = {
  "/": "index.html",
  "/about": "about.html",
  "/products": "products.html",
  "/bulk-supply": "bulk-supply.html",
  "/private-label": "private-label.html",
  "/bbee-compliance": "bbee-compliance.html",
  "/target-markets": "target-markets.html",
  "/contact": "contact.html",
};

for (const [route, file] of Object.entries(pages)) {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(publicDir, file));
  });
}

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});

const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`Yako Detergents site listening on :${port}`);
  console.log(
    `Lekker Connect: ${isConfigured() ? "configured" : "NOT configured"}`
  );
});
