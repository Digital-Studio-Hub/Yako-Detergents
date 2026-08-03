/**
 * Lekker Network product catalogue (client).
 * Fetches from /api/feed — the Connect token never appears in this file.
 */
(function () {
  const FEED_URL = "/api/feed?published=true";

  const els = {
    shipping: document.getElementById("shipping-banner"),
    tabs: document.getElementById("category-tabs"),
    grid: document.getElementById("product-grid"),
    status: document.getElementById("catalogue-status"),
    empty: document.getElementById("catalogue-empty"),
    error: document.getElementById("catalogue-error"),
    errorMsg: document.getElementById("catalogue-error-msg"),
    retry: document.getElementById("catalogue-retry"),
    meta: document.getElementById("catalogue-meta"),
  };

  let workspace = null;
  let categories = [];
  let products = [];
  let activeCategoryId = "all";

  const CURRENCY_SYMBOLS = {
    ZAR: "R",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  function currencySymbol(code) {
    if (!code) return "R";
    return CURRENCY_SYMBOLS[code.toUpperCase()] || code + " ";
  }

  function formatMoney(amount, currency) {
    const symbol = currencySymbol(currency);
    const n = Number(amount);
    if (Number.isNaN(n)) return symbol + "0.00";
    // South African style: space as thousands separator
    const fixed = n.toFixed(2);
    const [whole, dec] = fixed.split(".");
    const withSpaces = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${symbol}${withSpaces}.${dec}`;
  }

  function formatCents(cents, currency) {
    if (cents == null) return null;
    return formatMoney(Number(cents) / 100, currency);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function setLoading(on) {
    if (!els.grid) return;
    if (on) {
      show(els.error, false);
      show(els.empty, false);
      show(els.tabs, false);
      show(els.shipping, false);
      show(els.meta, false);
      els.grid.setAttribute("aria-busy", "true");
      els.grid.innerHTML = Array.from({ length: 8 }, () => skeletonCard()).join("");
      if (els.status) {
        els.status.textContent = "Loading products…";
        show(els.status, true);
      }
    } else {
      els.grid.removeAttribute("aria-busy");
      if (els.status) show(els.status, false);
    }
  }

  function skeletonCard() {
    return `
      <article class="product-card product-card--skeleton" aria-hidden="true">
        <div class="product-card__media skeleton-block"></div>
        <div class="product-card__body">
          <div class="skeleton-line skeleton-line--lg"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--sm"></div>
        </div>
      </article>`;
  }

  function renderShippingBanner() {
    if (!els.shipping || !workspace?.shipping) {
      show(els.shipping, false);
      return;
    }
    const s = workspace.shipping;
    if (!s.enabled || s.flatRateCents == null) {
      show(els.shipping, false);
      return;
    }
    const currency = workspace.currency || "ZAR";
    const fee = formatCents(s.flatRateCents, currency);
    let text = `Delivery: ${fee}`;
    if (s.freeThresholdCents != null) {
      text += ` — Free over ${formatCents(s.freeThresholdCents, currency)}`;
    }
    if (s.collectionEnabled) {
      text += " · Collection available";
    }
    els.shipping.innerHTML = `<span class="shipping-banner__icon" aria-hidden="true">🚚</span><span>${escapeHtml(text)}</span>`;
    show(els.shipping, true);
  }

  function renderTabs() {
    if (!els.tabs) return;
    const items = [{ id: "all", name: "All" }, ...categories];
    els.tabs.innerHTML = items
      .map(
        (c) => `
      <button type="button"
        class="cat-tab${c.id === activeCategoryId ? " is-active" : ""}"
        data-category-id="${escapeHtml(c.id)}"
        aria-pressed="${c.id === activeCategoryId ? "true" : "false"}">
        ${escapeHtml(c.name)}
      </button>`
      )
      .join("");
    show(els.tabs, true);

    els.tabs.querySelectorAll(".cat-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategoryId = btn.getAttribute("data-category-id") || "all";
        renderTabs();
        renderProducts();
      });
    });
  }

  function filteredProducts() {
    if (activeCategoryId === "all") return products;
    return products.filter((p) =>
      (p.categories || []).some((c) => c.id === activeCategoryId)
    );
  }

  function productCard(p) {
    const currency = workspace?.currency || "ZAR";
    const price =
      p.priceFormatted != null
        ? `${currencySymbol(currency)}${p.priceFormatted}`
        : formatMoney(p.price, currency);
    const initial = escapeHtml((p.name || "?").charAt(0).toUpperCase());
    const img = p.imageUrl
      ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" width="400" height="400" data-initial="${initial}" onerror="window.__yakoImgFallback&&window.__yakoImgFallback(this)" />`
      : `<div class="product-card__placeholder" aria-hidden="true"><span>${initial}</span></div>`;
    const badge = p.inStock
      ? ""
      : `<span class="product-badge product-badge--oos">Out of stock</span>`;
    const subtitle = p.subtitle
      ? `<p class="product-card__subtitle">${escapeHtml(p.subtitle)}</p>`
      : "";
    const type =
      p.itemType === "service"
        ? `<span class="product-badge product-badge--type">Service</span>`
        : "";

    return `
      <article class="product-card${!p.inStock ? " product-card--oos" : ""}" data-id="${escapeHtml(p.id)}">
        <div class="product-card__media">
          ${img}
          ${badge}
          ${type}
        </div>
        <div class="product-card__body">
          <h3 class="product-card__name">${escapeHtml(p.name)}</h3>
          ${subtitle}
          <p class="product-card__price">${escapeHtml(price)}</p>
          <a class="btn btn-outline product-card__cta" href="/contact#quote">Enquire</a>
        </div>
      </article>`;
  }

  function renderProducts() {
    if (!els.grid) return;
    const list = filteredProducts();
    if (!list.length) {
      els.grid.innerHTML = "";
      if (els.empty) {
        els.empty.textContent = products.length
          ? "No products in this category."
          : "No products published yet. Check back soon, or request a quote for our full range.";
        show(els.empty, true);
      }
      return;
    }
    show(els.empty, false);
    els.grid.innerHTML = list.map(productCard).join("");
  }

  function renderMeta() {
    if (!els.meta) return;
    const total = products.length;
    const shown = filteredProducts().length;
    const label =
      activeCategoryId === "all"
        ? `${total} product${total === 1 ? "" : "s"}`
        : `Showing ${shown} of ${total}`;
    els.meta.textContent = label;
    show(els.meta, total > 0);
  }

  function showError(message) {
    setLoading(false);
    if (els.grid) els.grid.innerHTML = "";
    show(els.tabs, false);
    show(els.shipping, false);
    show(els.meta, false);
    show(els.empty, false);
    if (els.errorMsg) els.errorMsg.textContent = message;
    show(els.error, true);
  }

  async function load() {
    setLoading(true);
    show(els.error, false);
    try {
      const res = await fetch(FEED_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        let msg = "We couldn't load the product catalogue.";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch (_) {
          /* ignore */
        }
        throw new Error(msg);
      }
      const data = await res.json();
      workspace = data.workspace || null;
      categories = Array.isArray(data.categories) ? data.categories : [];
      products = Array.isArray(data.products) ? data.products : [];
      activeCategoryId = "all";

      setLoading(false);
      renderShippingBanner();
      renderTabs();
      renderProducts();
      renderMeta();
    } catch (err) {
      console.error("[catalogue]", err);
      showError(
        err.message ||
          "Something went wrong while loading products. Please try again."
      );
    }
  }

  if (els.retry) {
    els.retry.addEventListener("click", () => load());
  }

  // Graceful fallback when Lekker image proxy is unavailable
  window.__yakoImgFallback = function (img) {
    if (!img || img.dataset.failed) return;
    img.dataset.failed = "1";
    const initial = img.getAttribute("data-initial") || "?";
    const ph = document.createElement("div");
    ph.className = "product-card__placeholder";
    ph.setAttribute("aria-hidden", "true");
    ph.innerHTML = `<span>${initial}</span>`;
    img.replaceWith(ph);
  };

  if (els.grid) {
    load();
  }
})();
