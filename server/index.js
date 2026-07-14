import express from "express";
import path from "path";
import { fileURLToPath } from "url";

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

app.post("/api/quote", (req, res) => {
  const payload = req.body || {};
  console.log("[quote-request]", JSON.stringify(payload));
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
});
