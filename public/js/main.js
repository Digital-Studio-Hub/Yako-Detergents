(function () {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => nav.classList.remove("open"));
    });
  }

  const path = location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const clean = href.replace(/\/$/, "") || "/";
    if (clean === path || (path.endsWith(clean) && clean !== "/")) {
      a.classList.add("active");
    }
  });

  const form = document.getElementById("quote-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const success = form.querySelector(".form-success");
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Request failed");
        form.reset();
        if (success) success.classList.add("show");
      } catch {
        // Fallback: open mail client so the presentation still works offline/API-less
        const subject = encodeURIComponent("Yako Detergents Quote Request");
        const body = encodeURIComponent(
          Object.entries(data)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
        );
        window.location.href = `mailto:mnquru@uuunbs.co.za?subject=${subject}&body=${body}`;
        if (success) success.classList.add("show");
      }
    });
  }
})();
