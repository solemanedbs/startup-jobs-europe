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
  const q = $("#fq"), cat = $("#fcat"), country = $("#fcountry"), city = $("#fcity"), sect = $("#fsector");
  if (!grouped || !out) return;

  const SECT = JSON.parse(document.getElementById("sector-labels")?.textContent || "{}");
  const LAB = { sales: "Sales & business development", finance: "Finance", ops: "Operations & strategy",
                produit_marketing: "Product & marketing", tech: "Tech & data",
                management: "Management & leadership", autre: "Other roles" };

  function remplir(sel, vals, tout) {
    sel.innerHTML = `<option value="">${tout}</option>` +
      vals.map(([v, n]) => `<option value="${esc(v)}">${esc(LAB[v] || SECT[v] || v)} (${n})</option>`).join("");
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
    return n === null ? "" : n <= 0 ? "Today" : n === 1 ? "yesterday" : n < 7 ? n + "d ago" : Math.round(n / 7) + "w ago";
  }

  /* Noms des systèmes de recrutement, comme leurs éditeurs les écrivent.
     Même table que fmt.py : « via Ashby » doit s'écrire pareil partout. */
  const ATS = {"ashby":"Ashby","bamboohr":"BambooHR","breezy":"Breezy","greenhouse":"Greenhouse","join":"Join","lever":"Lever","personio":"Personio","pinpoint":"Pinpoint","recruitee":"Recruitee","rippling":"Rippling","smartrecruiters":"SmartRecruiters","teamtailor":"Teamtailor","workable":"Workable","workday":"Workday","dover":"Dover","factorial":"Factorial","homerun":"Homerun","notion":"Notion"};
  const fmtAts = n => ATS[String(n || "").toLowerCase()] || n;
  const ico = (nom, t) => window.trIcon ? window.trIcon(nom, t) : "";
  function marque(nom) {
    const w = String(nom || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    const i = w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2);
    return `<span class="tr-mark tr-mark-md" aria-hidden="true">${esc(i.toUpperCase())}</span>`;
  }
  /* Composant JobRow du design system — même structure que la page d'accueil. */
  function ligne(r) {
    const loc = r.v && r.p ? `${r.v}, ${r.p}` : (r.p || r.l || "");
    const d = quand(r), neuve = d === "Today";
    const tags = [];
    if (r.c && LAB[r.c]) tags.push(`<span class="tr-badge tr-badge-outline">${esc(LAB[r.c])}</span>`);
    if (r.k && SECT[r.k]) tags.push(`<span class="tr-badge tr-badge-outline">${esc(SECT[r.k])}</span>`);
    if (r.a) tags.push(`<span class="tr-badge tr-badge-neutral">via ${esc(fmtAts(r.a))}</span>`);
    return `<article class="tr-jobrow">${marque(r.s)}<div class="tr-jobrow-main">` +
      `<a class="tr-jobrow-title" href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener">${esc(r.t)}</a>` +
      `<div class="tr-jobrow-meta"><span class="tr-jobrow-company">${esc(r.s)}</span>` +
      (loc ? `<span>${ico("map-pin", 14)}${esc(loc)}</span>` : "") + `</div>` +
      (tags.length ? `<div class="tr-jobrow-tags">${tags.join("")}</div>` : "") +
      `</div><div class="tr-jobrow-side">` +
      (neuve ? `<span class="tr-jobrow-new">Today</span>`
             : `<span class="tr-jobrow-date">${esc(d)}</span>`) + `</div></article>`;
  }

  function appliquer() {
    const t = (q.value || "").trim().toLowerCase();
    const f = r => (!cat.value || r.c === cat.value) && (!sect.value || r.k === sect.value)
      && (!country.value || r.p === country.value)
      && (!city.value || r.v === city.value)
      && (!t || (r.t + " " + r.s + " " + (r.l || "")).toLowerCase().includes(t));
    const res = DATA.filter(f);
    const actif = !!(t || cat.value || sect.value || country.value || city.value);
    grouped.hidden = actif; out.hidden = !actif;
    count.innerHTML = actif
      ? `${ico("briefcase", 14)}<span class="tr-num">${res.length.toLocaleString("en-GB")}</span> role${res.length === 1 ? "" : "s"} match`
      : "";
    if (!actif) return;
    out.innerHTML = res.length ? res.map(ligne).join("")
      : `<div class="tr-empty"><span class="tr-empty-icon">${ico("search", 20)}</span>` +
        `<h3>No role matches</h3><p>No role at this fund's portfolio matches these filters.</p></div>`;
    // les listes dépendantes se resserrent sur la sélection courante
    const gardeC = country.value, gardeV = city.value;
    remplir(country, compte("p", r => !cat.value || r.c === cat.value), "All countries");
    country.value = gardeC;
    remplir(city, compte("v", r => (!cat.value || r.c === cat.value) && (!gardeC || r.p === gardeC)), "All cities");
    city.value = gardeV;
  }

  remplir(cat, compte("c"), "All role families");
  remplir(sect, compte("k").filter(([k]) => SECT[k]), "All sectors");
  remplir(country, compte("p"), "All countries");
  remplir(city, compte("v"), "All cities");
  [q, cat, sect, country, city].forEach(e => e.addEventListener("input", appliquer));
  $("#fclear").addEventListener("click", e => {
    e.preventDefault(); q.value = ""; cat.value = ""; sect.value = ""; country.value = ""; city.value = "";
    remplir(country, compte("p"), "All countries"); remplir(city, compte("v"), "All cities");
    appliquer();
  });
})();
