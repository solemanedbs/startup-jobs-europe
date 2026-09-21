(() => {
  const $ = s => document.querySelector(s);
  const EUROPE = new Set(["France","Royaume-Uni","Allemagne","Pays-Bas","Belgique","Luxembourg","Espagne","Portugal","Italie","Suisse","Autriche","Suède","Danemark","Norvège","Finlande","Irlande","Pologne","Tchéquie","Hongrie","Roumanie","Bulgarie","Grèce","Estonie","Lettonie","Lituanie","Croatie","Slovénie","Slovaquie","Europe (non précisé)","Remote"]);
  const I18N = {
    fr: { title: "Offres dans les startups européennes VC-backed", sub1: "offres ouvertes chez", sub2: "startups financées par des fonds de capital-risque. Mis à jour le", sub3: "Lien direct vers la candidature, sans compte.",
      q: "Rechercher un poste, une startup…", c_sales: "Sales & bizdev", c_finance: "Finance", c_ops: "Ops & stratégie", c_pm: "Produit & marketing", c_tech: "Tech & data", c_other: "Autres", c_all: "Toutes catégories",
      p_eu: "Europe + remote", v_all: "Toutes les villes", a7: "7 derniers jours", a30: "30 derniers jours", a60: "60 derniers jours", aall: "Toutes dates", remote: "Remote uniquement", noscale: "Masquer les scale-ups (100+ offres)", f_all: "Tous les fonds investisseurs",
      hint: "Cliquez sur une offre pour postuler sur le site de la startup.", more: "Afficher 50 offres de plus", offers: n => n > 1 ? "offres" : "offre", empty: "Aucune offre avec ces filtres. Élargissez la période ou la zone.",
      today: "aujourd'hui", yesterday: "hier", days: n => `il y a ${n} j`, months: n => `il y a ${n} mois`, unknown: "date inconnue", seen: "vue", new: "nouveau", scale: "scale-up", remoteTag: "remote",
      foot1: "Les offres proviennent des pages carrière officielles des startups (Greenhouse, Lever, Ashby, Teamtailor, Personio, Workable, Recruitee…), relues chaque matin. Les startups sont issues des portefeuilles de plus de 1 000 fonds de capital-risque européens : ce sont des entreprises financées, qui recrutent réellement.",
      foot2: "Un projet personnel de", contact: "Signaler une erreur ou une startup manquante", legal: "Mentions légales", foot3: "Statistiques de fréquentation anonymes (GoatCounter, sans cookie). Aucune donnée personnelle n'est collectée.", dateFmt: "fr-FR", other: "EN" },
    en: { title: "Jobs at European VC-backed startups", sub1: "open roles at", sub2: "startups backed by venture capital funds. Updated on", sub3: "Direct link to apply, no account needed.",
      q: "Search a role, a startup…", c_sales: "Sales & bizdev", c_finance: "Finance", c_ops: "Ops & strategy", c_pm: "Product & marketing", c_tech: "Tech & data", c_other: "Other", c_all: "All categories",
      p_eu: "Europe + remote", v_all: "All cities", a7: "Last 7 days", a30: "Last 30 days", a60: "Last 60 days", aall: "All dates", remote: "Remote only", noscale: "Hide scale-ups (100+ roles)", f_all: "All investors",
      hint: "Click a role to apply on the startup's own site.", more: "Show 50 more", offers: n => n > 1 ? "roles" : "role", empty: "No role matches these filters. Widen the period or the area.",
      today: "today", yesterday: "yesterday", days: n => `${n} d ago`, months: n => `${n} mo ago`, unknown: "date unknown", seen: "seen", new: "new", scale: "scale-up", remoteTag: "remote",
      foot1: "Roles come from the startups' official career pages (Greenhouse, Lever, Ashby, Teamtailor, Personio, Workable, Recruitee…), re-read every morning. Startups are taken from the portfolios of 1,000+ European venture capital funds: funded companies that are actually hiring.",
      foot2: "A personal project by", contact: "Report an error or a missing startup", legal: "Legal notice", foot3: "Anonymous, cookie-free traffic statistics (GoatCounter). No personal data is collected.", dateFmt: "en-GB", other: "FR" }
  };
  const COUNTRY_EN = { "France":"France","Royaume-Uni":"United Kingdom","Allemagne":"Germany","Pays-Bas":"Netherlands","Belgique":"Belgium","Luxembourg":"Luxembourg","Espagne":"Spain","Portugal":"Portugal","Italie":"Italy","Suisse":"Switzerland","Autriche":"Austria","Suède":"Sweden","Danemark":"Denmark","Norvège":"Norway","Finlande":"Finland","Irlande":"Ireland","Pologne":"Poland","Tchéquie":"Czechia","Hongrie":"Hungary","Roumanie":"Romania","Bulgarie":"Bulgaria","Grèce":"Greece","Estonie":"Estonia","Lettonie":"Latvia","Lituanie":"Lithuania","Croatie":"Croatia","Slovénie":"Slovenia","Slovaquie":"Slovakia","Israël":"Israel","Europe (non précisé)":"Europe (unspecified)","Remote":"Remote","Hors Europe":"Outside Europe","Non précisé":"Unspecified","Autre":"Other" };
  const SYN = [[/\b(biz ?dev|bizdev)\b/g, "business develop"], [/\bsdr\b/g, "sales development"], [/\bbdr\b/g, "business development representative"], [/\bae\b/g, "account executive"], [/\bcsm\b/g, "customer success"], [/\bkam\b/g, "key account"], [/\bcompta\b/g, "comptab"], [/\bpm\b/g, "product manager"]];
  let lang = (() => { try { return localStorage.getItem("lang") || (navigator.language || "en").slice(0, 2) === "fr" ? (localStorage.getItem("lang") || "fr") : "en"; } catch (e) { return "en"; } })();
  const T = () => I18N[lang];
  const cache = {}; let meta, rows = [], all = [], shown = 0; const PAGE = 50;
  const today = new Date(); const daysAgo = d => d ? Math.round((today - new Date(d)) / 86400000) : null;
  const fmtDate = d => { const n = daysAgo(d); if (n === null) return T().unknown; if (n <= 0) return T().today; if (n === 1) return T().yesterday; if (n < 30) return T().days(n); return T().months(Math.round(n / 30)); };
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const country = p => lang === "en" ? (COUNTRY_EN[p] || p) : p;
  const track = path => { try { window.goatcounter && window.goatcounter.count({ path, title: path, event: true }); } catch (e) {} };

  function applyLang() {
    document.documentElement.lang = lang; const t = T();
    document.querySelectorAll("[data-i]").forEach(el => { const k = el.dataset.i; if (typeof t[k] === "string") el.textContent = t[k]; });
    document.querySelectorAll("[data-ph]").forEach(el => el.placeholder = t[el.dataset.ph]);
    $("#lang").textContent = t.other;
    if (meta) { $("#meta-date").textContent = new Date(meta.date).toLocaleDateString(t.dateFmt, { day: "numeric", month: "long" }); fillCountries(); }
    try { localStorage.setItem("lang", lang); } catch (e) {}
  }
  function fillCountries() {
    const ps = $("#pays"); const cur = ps.value || "europe"; ps.innerHTML = `<option value="europe">${T().p_eu}</option>`;
    meta.pays.filter(([p]) => p !== "Autre").forEach(([p, n]) => { const o = document.createElement("option"); o.value = p; o.textContent = `${country(p)} (${n.toLocaleString(T().dateFmt)})`; ps.appendChild(o); });
    ps.value = cur;
  }
  async function load(cat) {
    const cats = cat === "all" ? Object.keys(meta.categories) : [cat];
    const parts = await Promise.all(cats.map(async c => { if (!cache[c]) cache[c] = await (await fetch(`data/${c}.json`)).json(); return cache[c]; }));
    return parts.flat();
  }
  function state() {
    const p = new URLSearchParams(location.hash.slice(1));
    return { q: p.get("q") || "", cat: p.get("cat") || "sales", pays: p.get("pays") || "europe", ville: p.get("ville") || "", age: p.get("age") || "30", fonds: p.get("fonds") || "", remote: p.get("remote") === "1", noscale: p.get("scale") !== "1" };
  }
  function push(st) {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q); if (st.cat !== "sales") p.set("cat", st.cat); if (st.pays !== "europe") p.set("pays", st.pays); if (st.ville) p.set("ville", st.ville);
    if (st.age !== "30") p.set("age", st.age); if (st.fonds) p.set("fonds", st.fonds); if (st.remote) p.set("remote", "1"); if (!st.noscale) p.set("scale", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "#" + p.toString() : ""));
  }
  function norm(s) { let x = (s || "").toLowerCase(); SYN.forEach(([re, to]) => x = x.replace(re, to)); return x; }
  function apply(reason) {
    const st = { q: $("#q").value.trim(), cat: $("#cat").value, pays: $("#pays").value, ville: $("#ville").value, age: $("#age").value, fonds: $("#fonds").value, remote: $("#remote").checked, noscale: $("#noscale").checked };
    push(st); if (reason) track(`filter/${reason}/${st[reason] === true ? "on" : st[reason] === false ? "off" : st[reason] || "-"}`);
    const q = norm(st.q); const maxAge = +st.age;
    rows = all.filter(r => {
      if (st.pays === "europe" ? !EUROPE.has(r.p) : (st.pays && r.p !== st.pays)) return false;
      if (st.ville && r.v !== st.ville) return false;
      if (st.remote && !r.r) return false;
      if (st.noscale && r.b) return false;
      if (st.fonds && !r.f.split(" ; ").includes(st.fonds)) return false;
      if (maxAge < 999) { const n = daysAgo(r.d || r.n); if (n === null || n > maxAge) return false; }
      if (q && !norm(r.t + " " + r.s + " " + r.l).includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    shown = 0; $("#list").innerHTML = ""; more();
    $("#count").textContent = `${rows.length.toLocaleString(T().dateFmt)} ${T().offers(rows.length)}`;
  }
  function more() {
    const frag = document.createDocumentFragment(); const t = T();
    rows.slice(shown, shown + PAGE).forEach(r => {
      const li = document.createElement("li"); const n = daysAgo(r.d || r.n);
      li.innerHTML = `<a class="job" href="${esc(r.u)}" target="_blank" rel="noopener">
        <div class="t">${esc(r.t)}</div>
        <div class="r">${r.d ? fmtDate(r.d) : t.seen + " " + fmtDate(r.n)}${n !== null && n <= 3 ? `<span class="new">${t.new}</span>` : ""}</div>
        <div class="s"><b>${esc(r.s)}</b>${r.l ? " · " + esc(r.l) : ""}</div>
        <div class="tags"><span class="tag loc">${esc(country(r.p))}</span>${r.r ? `<span class="tag">${t.remoteTag}</span>` : ""}${r.b ? `<span class="tag">${t.scale}</span>` : ""}<span class="tag">${esc(r.a)}</span></div>
      </a>`;
      frag.appendChild(li);
    });
    $("#list").appendChild(frag); shown += PAGE;
    $("#more").hidden = shown >= rows.length;
    if (!rows.length) $("#list").innerHTML = `<li class="empty">${T().empty}</li>`;
  }
  async function refresh(reason) { all = await load($("#cat").value); apply(reason); }
  (async () => {
    applyLang();
    meta = await (await fetch("data/meta.json")).json();
    $("#meta-total").textContent = meta.total.toLocaleString(T().dateFmt); $("#meta-startups").textContent = meta.startups.toLocaleString(T().dateFmt);
    $("#meta-date").textContent = new Date(meta.date).toLocaleDateString(T().dateFmt, { day: "numeric", month: "long" });
    fillCountries();
    const vs = $("#ville"); meta.villes.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; vs.appendChild(o); });
    const fs = $("#fonds"); meta.fonds.forEach(f => { const o = document.createElement("option"); o.value = f; o.textContent = f; fs.appendChild(o); });
    const st = state(); $("#q").value = st.q; $("#cat").value = st.cat; $("#pays").value = st.pays; $("#ville").value = st.ville; $("#age").value = st.age; $("#fonds").value = st.fonds; $("#remote").checked = st.remote; $("#noscale").checked = st.noscale;
    $("#cat").addEventListener("change", () => refresh("cat"));
    [["#pays", "pays"], ["#ville", "ville"], ["#age", "age"], ["#fonds", "fonds"], ["#remote", "remote"], ["#noscale", "noscale"]].forEach(([s, k]) => $(s).addEventListener("change", () => apply(k)));
    let tm; $("#q").addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => apply(), 150); });
    $("#q").addEventListener("change", () => { if ($("#q").value.trim()) track("search"); });
    $("#more").addEventListener("click", more);
    $("#lang").addEventListener("click", () => { lang = lang === "fr" ? "en" : "fr"; applyLang(); apply(); track("lang/" + lang); });
    await refresh();
  })();
})();
