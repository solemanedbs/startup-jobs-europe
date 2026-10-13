/* Filtres sur une page fonds, sans quitter la page.
   Les données du fonds sont embarquées dans un <script type="application/json"> (non exécuté,
   donc compatible avec la CSP qui interdit le script en ligne). La vue groupée par société reste
   le rendu par défaut — c'est elle que Google indexe ; les filtres basculent sur une liste à plat. */
(function () {
  const el = document.getElementById("fund-data");
  if (!el) return;
  let DATA = [];
  try { DATA = JSON.parse(el.textContent); } catch (e) { return; }

  const $ = s => document.querySelector(s);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "#";
  const grouped = $("#grouped"), out = $("#fresults"), count = $("#fcount");
  const q = $("#fq"), cat = $("#fcat"), country = $("#fcountry"), city = $("#fcity");
  if (!grouped || !out) return;

  const LAB = { sales: "Sales & business development", finance: "Finance", ops: "Operations & strategy",
                produit_marketing: "Product & marketing", tech: "Tech & data",
                management: "Management & leadership", autre: "Other roles" };

  function remplir(sel, vals, tout) {
    sel.innerHTML = `<option value="">${tout}</option>` +
      vals.map(([v, n]) => `<option value="${esc(v)}">${esc(LAB[v] || v)} (${n})</option>`).join("");
  }
  function compte(champ, filtre) {
    const m = new Map();
    DATA.filter(filtre || (() => true)).forEach(r => { const v = r[champ]; if (v) m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  }
  function jours(d) {
    if (!d) return null;
    const n = Math.floor((Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5);
    return isNaN(n) ? null : n;
  }
  function quand(r) {
    const n = jours(r.d || r.n);
    return n === null ? "" : n <= 0 ? "today" : n === 1 ? "yesterday" : n < 30 ? n + "d ago" : Math.round(n / 30) + "mo ago";
  }

  function appliquer() {
    const t = (q.value || "").trim().toLowerCase();
    const f = r => (!cat.value || r.c === cat.value) && (!country.value || r.p === country.value)
      && (!city.value || r.v === city.value)
      && (!t || (r.t + " " + r.s + " " + (r.l || "")).toLowerCase().includes(t));
    const res = DATA.filter(f);
    const actif = !!(t || cat.value || country.value || city.value);
    grouped.hidden = actif; out.hidden = !actif;
    count.textContent = actif ? `${res.length} role${res.length === 1 ? "" : "s"} match` : "";
    if (!actif) return;
    out.innerHTML = res.length ? res.map(r => `<li><a class="job" href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener">
      <div class="t">${esc(r.t)}</div>
      <div class="s"><b>${esc(r.s)}</b>${r.l ? " · " + esc(r.l) : ""} · ${esc(quand(r))}</div></a></li>`).join("")
      : `<li class="empty">No role matches these filters.</li>`;
    // les listes dépendantes se resserrent sur la sélection courante
    const gardeC = country.value, gardeV = city.value;
    remplir(country, compte("p", r => !cat.value || r.c === cat.value), "All countries");
    country.value = gardeC;
    remplir(city, compte("v", r => (!cat.value || r.c === cat.value) && (!gardeC || r.p === gardeC)), "All cities");
    city.value = gardeV;
  }

  remplir(cat, compte("c"), "All role families");
  remplir(country, compte("p"), "All countries");
  remplir(city, compte("v"), "All cities");
  [q, cat, country, city].forEach(e => e.addEventListener("input", appliquer));
  $("#fclear").addEventListener("click", e => {
    e.preventDefault(); q.value = ""; cat.value = ""; country.value = ""; city.value = "";
    remplir(country, compte("p"), "All countries"); remplir(city, compte("v"), "All cities");
    appliquer();
  });
})();
