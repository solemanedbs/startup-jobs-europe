(() => {
  const $ = s => document.querySelector(s);
  const PAGE = 50;
  const T = {
    offers: n => n === 1 ? "role" : "roles",
    empty: "No role matches these filters. Try a wider region or a longer period.",
    today: "Today", yesterday: "yesterday", days: n => `${n}d ago`, weeks: n => `${n}w ago`, unknown: "date unknown",
    seen: "listed", new: "new", scale: "scale-up", remoteTag: "remote",
    ask: "Did you apply at", askSub: "This role is handled on the company's own site. Add it to your tracker?",
    askY: "Yes, I applied", askN: "No, don't ask again", askL: "Maybe later", added: "Added to your tracker", space: "My space",
    askCv: "Not applied yet? Tailor your CV for this role →"
  };
  const SYN = [[/\b(biz ?dev|bizdev)\b/g, "business develop"], [/\bsdr\b/g, "sales development"], [/\bbdr\b/g, "business development representative"], [/\bae\b/g, "account executive"], [/\bcsm\b/g, "customer success"], [/\bkam\b/g, "key account"], [/\bpm\b/g, "product manager"]];
  const cache = {}; let meta, rows = [], all = [], shown = 0, remoteOn = false, savedOn = false, matchOn = false;
  let NBFONDS = null, TOUT = null;   // TOUT : le jeu complet, pour les compteurs absolus
  // comparaison de dates de calendrier, pas de durées : sinon une offre publiée aujourd'hui
  // compte pour « 1 jour » dès qu'on consulte la page l'après-midi (bug du 05/10)
  const midnight = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const daysAgo = d => { const x = midnight(d); return x ? Math.round((today0 - x) / 86400000) : null; };
  const fmtDate = d => { const n = daysAgo(d); if (n === null) return T.unknown; if (n <= 0) return T.today; if (n === 1) return T.yesterday; if (n < 7) return T.days(n); return T.weeks(Math.round(n / 7)); };
  const EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;
  const cleanTitle = t => String(t || "").replace(EMOJI, "").replace(/\s{2,}/g, " ").replace(/[\s\-–—·|]+$/, "").trim();

  /* Salaires normalisés : « $170K – $200K », devise devant, K majuscule, tiret demi-cadratin
     espacé. Les ATS livrent « 213k–231k $ », « $265K - $325K », « 90000-120000 EUR »… */
  const DEVISES = { "$": "$", "€": "€", "£": "£", USD: "$", EUR: "€", GBP: "£" };
  function fmtSalary(raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    let dev = "";
    for (const k in DEVISES) if (t.toUpperCase().includes(k)) { dev = DEVISES[k]; break; }
    const nums = (t.match(/\d[\d\s.,]*\s*[kK]?/g) || [])
      .map(x => {
        const k = /[kK]\s*$/.test(x);
        const n = parseFloat(x.replace(/[\s,]/g, "").replace(/[kK]$/, ""));
        return isNaN(n) ? null : (k ? n : n / 1000);
      }).filter(n => n !== null && n > 0);
    if (!nums.length) return t;
    const fmt = n => dev + (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + "K";
    return nums.length > 1 ? `${fmt(nums[0])} \u2013 ${fmt(nums[nums.length - 1])}` : fmt(nums[0]);
  }

  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // une URL non http(s) ne doit jamais atterrir dans un href : « javascript: » s'exécuterait
  // dans le contexte du site et pourrait siphonner localStorage (profil, CV, candidatures)
  const safeUrl = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "#";
  const num = n => n.toLocaleString("en-GB");
  const track = path => { try { window.goatcounter && window.goatcounter.count({ path, title: path, event: true }); } catch (e) {} };

  // ---- couche d'interface : le panneau du design system coche des cases et presse des
  // segments, là où il y avait des <select>. Les filtres à cases sont donc multiples.
  /* Noms des systèmes de recrutement, comme leurs éditeurs les écrivent.
     Même table que fmt.py : « via Ashby » doit s'écrire pareil partout. */
  const ATS = {"ashby":"Ashby","bamboohr":"BambooHR","breezy":"Breezy","greenhouse":"Greenhouse","join":"Join","lever":"Lever","personio":"Personio","pinpoint":"Pinpoint","recruitee":"Recruitee","rippling":"Rippling","smartrecruiters":"SmartRecruiters","teamtailor":"Teamtailor","workable":"Workable","workday":"Workday","dover":"Dover","factorial":"Factorial","homerun":"Homerun","notion":"Notion"};
  const fmtAts = n => ATS[String(n || "").toLowerCase()] || n;
  const ico = (n, t) => window.trIcon ? window.trIcon(n, t) : "";
  const coches = cle => [...document.querySelectorAll(`input[data-f="${cle}"]:checked`)].map(i => i.value);
  function cocher(cle, vals) {
    const set = new Set(vals);
    document.querySelectorAll(`input[data-f="${cle}"]`).forEach(i => { i.checked = set.has(i.value); });
  }
  const segment = id => { const b = document.querySelector(`#${id} button[aria-pressed="true"]`); return b ? b.dataset.v : ""; };
  function poserSegment(id, v) {
    document.querySelectorAll(`#${id} button`).forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.v === v ? "true" : "false"));
  }
  /* Une case à cocher du système, avec son compteur aligné à droite. */
  function caseFiltre(cle, val, label, compte, coche) {
    return `<label class="tr-check"><input type="checkbox" data-f="${esc(cle)}" value="${esc(val)}"${coche ? " checked" : ""}>` +
           `<span>${esc(label)}</span>` +
           (compte != null ? `<span class="tr-check-count">${num(compte)}</span>` : "") + `</label>`;
  }
  /* Les listes longues (pays, villes, secteurs) se replient : six entrées puis « Show all ». */
  const PLI = 6;
  function listePliee(hote, bouton, cle, entrees, choisis, mot, filtre) {
    const el = $(hote), bt = $(bouton);
    const sel = new Set(choisis);
    const q = (filtre || "").trim().toLowerCase();
    let vus = entrees.filter(([v]) => !q || v.toLowerCase().includes(q));
    // ce qui est coché reste visible même hors des six premiers, sinon on ne peut plus décocher
    const tete = vus.filter(([v]) => sel.has(v));
    const reste = vus.filter(([v]) => !sel.has(v));
    const ouvert = el.dataset.ouvert === "1";
    const liste = ouvert ? tete.concat(reste) : tete.concat(reste.slice(0, Math.max(0, PLI - tete.length)));
    el.innerHTML = liste.map(([v, c]) => caseFiltre(cle, v, v, c, sel.has(v))).join("")
      || `<p class="tr-field-hint">No ${mot} matches.</p>`;
    const cachees = vus.length - liste.length;
    bt.hidden = cachees <= 0 && !ouvert;
    bt.textContent = ouvert ? `Show fewer ${mot}` : `Show all ${num(vus.length)} ${mot}`;
    bt.onclick = () => { el.dataset.ouvert = ouvert ? "0" : "1"; apply(); };
  }

  // ---- filtres en cascade : région → pays → ville
  function fillRegions(st, q, maxAge) {
    // comptes recalculés sur les filtres actifs : sinon « EMEA 10 104 » contredit « 24 552 roles »
    let m = new Map();
    if (st && all.length) all.forEach(r => { if (matches(r, st, q, maxAge, "region") && r.g) m.set(r.g, (m.get(r.g) || 0) + 1); });
    document.querySelectorAll("#region button").forEach(b => {
      const v = b.dataset.v;
      const c = v ? (m.get(v) || 0) : [...m.values()].reduce((a, x) => a + x, 0);
      const cpt = b.querySelector(".tr-chip-count");
      if (cpt) cpt.textContent = num(c);
    });
  }
  function fillCountries(region, choisis) {
    const e = meta.pays.filter(([p]) => !region || meta.pays_region[p] === region);
    listePliee("#countries", "#morecountry", "country", e, choisis, "countries", $("#qcountry").value);
  }
  function fillCities(countries, region, choisis) {
    const cs = new Set(countries);
    const e = meta.villes.filter(([c]) => {
      const p = meta.ville_pays[c]; if (!p) return false;
      if (cs.size) return cs.has(p);
      return !region || meta.pays_region[p] === region;
    });
    listePliee("#cities", "#morecity", "city", e, choisis, "cities", $("#qcity").value);
  }

  async function load(cat) {
    const cats = (!cat || !cat.length) ? Object.keys(meta.categories) : cat;
    const parts = await Promise.all(cats.map(async c => { if (!cache[c]) cache[c] = await (await fetch(`data/${c}.json?v=${meta.date}`)).json(); return cache[c]; }));
    const out = parts.flat();
    // le premier chargement ramène toutes les familles : on garde ce jeu complet pour
    // que les compteurs des raccourcis restent absolus même après un filtrage
    if (!TOUT && cats.length === Object.keys(meta.categories).length) TOUT = out;
    return out;
  }
  // cat / country / city / sector sont désormais des listes : le panneau du design system
  // coche des cases, donc on peut en choisir plusieurs. Les anciennes URL à valeur unique
  // continuent de marcher, une valeur seule étant une liste d'un élément.
  const liste = v => (v || "").split(",").map(x => x.trim()).filter(Boolean);
  function state() {
    const p = new URLSearchParams(location.hash.slice(1));
    const cat = liste(p.get("cat")).filter(c => c !== "all");
    return { q: p.get("q") || "", where: p.get("where") || "", cat, region: p.get("region") || "",
             country: liste(p.get("country")), city: liste(p.get("city")), sector: liste(p.get("sector")),
             saved: p.get("saved") === "1", match: p.get("match") === "1",
             age: p.get("age") || "30", fonds: p.get("fonds") || "",
             remote: p.get("remote") === "1", noscale: false, salary: p.get("salary") === "1" };
  }
  function push(st) {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q); if (st.where) p.set("where", st.where);
    if (st.cat.length) p.set("cat", st.cat.join(","));
    if (st.region) p.set("region", st.region);
    if (st.country.length) p.set("country", st.country.join(","));
    if (st.city.length) p.set("city", st.city.join(","));
    if (st.sector.length) p.set("sector", st.sector.join(","));
    if (st.age !== "30") p.set("age", st.age);
    if (st.fonds) p.set("fonds", st.fonds);
    if (st.saved) p.set("saved", "1"); if (st.match) p.set("match", "1");
    if (st.remote) p.set("remote", "1"); if (st.salary) p.set("salary", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "#" + p.toString() : ""));
  }
  function norm(s) { let x = (s || "").toLowerCase(); SYN.forEach(([re, to]) => x = x.replace(re, to)); return x; }

  // prédicat unique : la liste et les compteurs du pouls passent par là, donc un chiffre annoncé
  // est toujours exactement ce que le clic donnera
  function matches(r, st, q, maxAge, ignore) {
    if (st.cat && st.cat.length && !st.cat.includes(r.c)) return false;
    if (ignore !== "region" && st.region && r.g !== st.region) return false;
    if (st.country.length && !st.country.includes(r.p)) return false;
    if (st.city.length && !st.city.includes(r.v)) return false;
    if (st.sector.length && !st.sector.includes(r.k)) return false;
    if (st.where && !norm(`${r.v || ""} ${r.p || ""} ${r.l || ""} ${r.g || ""}`).includes(norm(st.where))) return false;
    if (st.saved && !saved.has(r.u)) return false;
    if (st.remote && !r.r) return false;
    if (st.noscale && r.b) return false;
    if (st.salary && !r["$"]) return false;
    if (st.fonds && !r.f.split(" ; ").includes(st.fonds)) return false;
    if (maxAge < 999) { const n = daysAgo(r.d || r.n); if (n === null || n > maxAge) return false; }
    if (q && !norm(r.t + " " + r.s + " " + r.l).includes(q)) return false;
    return true;
  }
  const countIf = (st, q, over) => {
    const s2 = Object.assign({}, st, over);
    return all.reduce((n, r) => n + (matches(r, s2, q, +s2.age) ? 1 : 0), 0);
  };
  /* Les chiffres du chapeau, et les puces « filtres actifs » du composant ActiveFilters.
     Ils remplacent les quatre cartes de statistiques : l'écran de recherche du design
     system met les chiffres dans la phrase, pas dans des encarts. */
  function pulse(st, q) {
    const co = new Set();
    let nb = 0;
    all.forEach(r => { if (matches(r, st, q, +st.age)) { nb++; co.add(r.s); } });
    $("#p-total").textContent = num(nb);
    $("#p-co").textContent = num(co.size);
    // les fonds réellement représentés dans les données, pas la liste plafonnée de meta
    if (NBFONDS === null) {
      const f = new Set();
      all.forEach(r => (r.f || "").split(" ; ").forEach(x => { x = x.trim(); if (x) f.add(x); }));
      NBFONDS = f.size;
    }
    $("#p-funds").textContent = num(NBFONDS);
  }
  const LABFAM = { sales: "Sales & business development", tech: "Tech & data",
                   ops: "Operations, finance & marketing", leadership: "Leadership", autre: "Other roles" };
  const LABAGE = { "0": "Posted today", "7": "Last 7 days", "30": "Last 30 days", "60": "Last 60 days", "999": "Any date" };
  /* Le volume de chaque raccourci, calculé sur les données chargées : un bouton qui
     annonce son chiffre dit aussi s'il vaut le clic. */
  function compterPresets() {
    document.querySelectorAll("[data-preset]").forEach(b => {
      let v = {}; try { v = JSON.parse(b.dataset.preset); } catch (e) { return; }
      const st = { q: "", where: "", cat: v.cat || [], region: v.region || "",
                   country: v.country || [], city: v.city || [], sector: v.sector || [],
                   saved: false, match: false, age: v.age || "30", fonds: "",
                   remote: !!v.remote, noscale: false, salary: !!v.salary };
      const c = (TOUT || all).reduce((t, r) => t + (matches(r, st, "", +st.age) ? 1 : 0), 0);
      const cpt = b.querySelector(".tr-chip-count");
      if (cpt) cpt.textContent = num(c);
    });
  }

  function activeFilters(st) {
    const items = [];
    if (st.q) items.push(["q", `“${st.q}”`]);
    if (st.where) items.push(["where", st.where]);
    st.cat.forEach(c => items.push([`cat:${c}`, LABFAM[c] || c]));
    if (st.region) items.push(["region", st.region]);
    st.country.forEach(c => items.push([`country:${c}`, c]));
    st.city.forEach(c => items.push([`city:${c}`, c]));
    st.sector.forEach(k => items.push([`sector:${k}`, (meta.secteurs && meta.secteurs[k]) || k]));
    if (st.age !== "30") items.push(["age", LABAGE[st.age] || st.age]);
    if (st.salary) items.push(["salary", "Salary shown"]);
    if (st.remote) items.push(["remote", "Remote"]);
    if (st.saved) items.push(["saved", "Saved only"]);
    const box = $("#active");
    box.innerHTML = items.map(([k, l]) =>
      `<button type="button" class="tr-chip" aria-pressed="true" data-x="${esc(k)}">${esc(l)}` +
      `<span class="tr-chip-x" aria-label="Remove">${ico("x", 12)}</span></button>`).join("")
      + (items.length ? '<button type="button" class="tr-active-clear" id="clearall">Clear all</button>' : "");
    const fc = $("#filcount");
    fc.hidden = !items.length; fc.textContent = items.length ? `${items.length}` : "";
    // le badge de chaque groupe du panneau : combien y sont cochés
    const parGroupe = { cat: st.cat.length, country: st.country.length, city: st.city.length,
                        sector: st.sector.length, region: st.region ? 1 : 0,
                        age: st.age !== "30" ? 1 : 0, sal: st.salary ? 1 : 0, fund: st.fonds ? 1 : 0 };
    document.querySelectorAll("[data-n]").forEach(b => {
      const c = parGroupe[b.dataset.n] || 0;
      b.hidden = !c; b.textContent = c;
    });
  }

  function apply(reason) {
    const st = { q: $("#q").value.trim(), where: $("#qwhere").value.trim(),
                 cat: coches("cat"), region: segment("region"),
                 country: coches("country"), city: coches("city"), sector: coches("sector"),
                 saved: savedOn, match: matchOn, age: segment("age") || "30",
                 fonds: state().fonds, remote: remoteOn, noscale: false, salary: $("#salary").checked };
    const fb = $("#fundbar");
    if (fb) { fb.hidden = !st.fonds; if (st.fonds) $("#fundname").textContent = st.fonds; }
    push(st);
    if (reason) track(`filter/${reason}`);
    const q = norm(st.q); const maxAge = +st.age;
    fillRegions(st, q, maxAge);
    fillCountries(st.region, st.country);
    fillCities(st.country, st.region, st.city);
    fillSectors(all, st.sector);
    rows = all.filter(r => matches(r, st, q, maxAge));
    if (st.match && aProfil()) rows.sort((a, b) => score(b) - score(a) || (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    else if ($("#sort") && $("#sort").value === "company") rows.sort((a, b) => (a.s || "").localeCompare(b.s || ""));
    else rows.sort((a, b) => (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    pulse(st, q); activeFilters(st); compterPresets();
    shown = 0; $("#list").innerHTML = ""; more();
    $("#count").textContent = num(rows.length);
    $("#total").textContent = num(rows.length);
    const sd = $("#sheetdone"); if (sd) sd.textContent = `Show ${num(rows.length)} roles`;
  }
  let FUNDS = {};
  fetch("data/funds.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).then(m => { FUNDS = m; })
    .catch(() => {});

  function fillSectors(rowsAll, choisis) {
    const m = new Map();
    rowsAll.forEach(r => { if (r.k && r.k !== "unclassified") m.set(r.k, (m.get(r.k) || 0) + 1); });
    const L = (meta && meta.secteurs) || {};
    const sel = new Set(choisis || []);
    const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const el = $("#sectors"), bt = $("#moresector");
    const ouvert = el.dataset.ouvert === "1";
    const tete = ord.filter(([k]) => sel.has(k)), reste = ord.filter(([k]) => !sel.has(k));
    const vus = ouvert ? tete.concat(reste) : tete.concat(reste.slice(0, Math.max(0, 5 - tete.length)));
    el.innerHTML = vus.map(([k, c]) => caseFiltre("sector", k, L[k] || k, c, sel.has(k))).join("");
    bt.hidden = ord.length <= vus.length && !ouvert;
    bt.textContent = ouvert ? "Show fewer sectors" : `Show all ${ord.length} sectors`;
    bt.onclick = () => { el.dataset.ouvert = ouvert ? "0" : "1"; apply(); };
  }

  /* Offres gardées : une simple liste d'URL dans le navigateur, rien ne sort. */
  const SKEY = "sj.saved";
  let saved = new Map();
  try { (JSON.parse(localStorage.getItem(SKEY) || "[]")).forEach(o => saved.set(o.u, o)); } catch (e) {}
  const persist = () => { try { localStorage.setItem(SKEY, JSON.stringify([...saved.values()].slice(-500))); } catch (e) {} };
  function toggleSave(r) {
    if (saved.has(r.u)) saved.delete(r.u);
    else saved.set(r.u, { u: r.u, t: r.t, s: r.s, l: r.l || r.v || r.p || "", d: r.d || r.n, w: r.w });
    persist(); refreshSavedBtn();
  }
  function refreshSavedBtn() {
    const b = $("#savedbtn"); if (!b) return;
    $("#savedn").textContent = saved.size;
    b.hidden = saved.size === 0 && !state().saved;
  }

  /* Correspondance avec le profil. Les termes viennent de My Space — compétences, intitulés
     de poste, titre d'accroche, faits d'expérience. Le calcul se fait ici, sur des données
     déjà dans le navigateur : aucun compte, aucun envoi. */
  const STOP = new Set(("and the for with from that this your our are was were has have had not all any "
    + "des les une avec pour dans sur par aux est ont été plus tout tous sans chez qui que "
    + "manager senior junior lead head chief officer director associate specialist assistant "
    + "international global team work working experience years year new").split(" "));
  const mots = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9+#.]+/).filter(w => w.length > 2 && !STOP.has(w));
  let TERMES = null, REF = 0;
  function profilTermes() {
    if (TERMES) return TERMES;
    TERMES = new Map();
    let d = null;
    try { d = window.SJ && window.SJ.get(); } catch (e) {}
    if (!d) return TERMES;
    const add = (txt, poids) => mots(txt).forEach(w => TERMES.set(w, (TERMES.get(w) || 0) + poids));
    (d.s || []).forEach(x => add(x, 3));
    (d.x || []).forEach(x => { add(x.t, 3); add(x.e, 1); (x.p || []).forEach(p => add(p, 1)); });
    add(d.id && d.id.h, 2);
    (d.pr || []).forEach(p => add(p.t, 1));
    (d.f || []).forEach(f => add(f.t, 1));
    REF = [...TERMES.values()].sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0) || 1;
    return TERMES;
  }
  const aProfil = () => profilTermes().size >= 4;
  function score(r) {
    const T = profilTermes(); if (!T.size) return 0;
    let acc = 0; const vus = new Set();
    mots(r.t).forEach(w => { if (T.has(w) && !vus.has(w)) { vus.add(w); acc += T.get(w); } });
    return Math.min(100, Math.round(100 * acc / REF));
  }

  /* Composant JobRow du design system : monogramme, titre, méta avec icônes, étiquettes,
     puis date et étoile dans la colonne de droite. Mêmes classes que les pages générées. */
  function marque(nom) {
    const w = String(nom || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    const i = w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2);
    return `<span class="tr-mark tr-mark-md" aria-hidden="true">${esc(i.toUpperCase())}</span>`;
  }
  function more() {
    const frag = document.createDocumentFragment();
    rows.slice(shown, shown + PAGE).forEach(r => {
      const nj = daysAgo(r.d || r.n);
      // un lieu inconnu n'est pas une information : mieux vaut rien qu'un « Unspecified »
      const brut = (r.l || "").trim();
      const faux = /^(\d+\s+locations?|multiple locations|various|unspecified)$/i.test(brut);
      const loc = r.v && r.p ? `${r.v}, ${r.p}`
        : (r.p || (faux || !brut ? (r.g === "Unspecified" ? "" : r.g) : brut.split(/[;•|]/)[0].trim()));
      const sal = fmtSalary(r["$"]);
      const dateur = r.d ? fmtDate(r.d)
        : `${T.seen} ${fmtDate(r.n)}`;
      const art = document.createElement("article");
      art.className = "tr-jobrow";
      const tags = [];
      if (r.c && LABFAM[r.c]) tags.push(`<span class="tr-badge tr-badge-outline">${esc(LABFAM[r.c])}</span>`);
      if (r.k && meta.secteurs && meta.secteurs[r.k]) tags.push(`<span class="tr-badge tr-badge-outline">${esc(meta.secteurs[r.k])}</span>`);
      if (r.r) tags.push(`<span class="tr-badge tr-badge-outline">Remote</span>`);
      if (r.a) tags.push(`<span class="tr-badge tr-badge-neutral">via ${esc(fmtAts(r.a))}</span>`);
      if (matchOn && aProfil()) {
        const sc = score(r);
        if (sc >= 20) tags.push(`<span class="tr-badge tr-badge-brand">${sc}% match</span>`);
      }
      art.innerHTML = marque(r.s) +
        `<div class="tr-jobrow-main">` +
          `<a class="tr-jobrow-title job" href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener">${esc(cleanTitle(r.t))}</a>` +
          `<div class="tr-jobrow-meta">` +
            `<span class="tr-jobrow-company">${esc(r.s)}</span>` +
            (loc ? `<span>${ico("map-pin", 14)}${esc(loc)}</span>` : "") +
            (sal ? `<span class="tr-jobrow-salary">${ico("banknote", 14)}${esc(sal)}</span>` : "") +
          `</div>` +
          (tags.length ? `<div class="tr-jobrow-tags">${tags.join("")}</div>` : "") +
        `</div>` +
        `<div class="tr-jobrow-side">` +
          (nj !== null && nj <= 0 ? `<span class="tr-jobrow-new">${T.today}</span>`
                                  : `<span class="tr-jobrow-date">${esc(dateur)}</span>`) +
        `</div>`;
      // étoile : l'IconButton du système, dans la colonne de droite
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "tr-iconbtn tr-iconbtn-sm";
      const majBtn = () => {
        const on = saved.has(r.u);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "Saved" : "Save role");
        btn.title = btn.getAttribute("aria-label");
        btn.innerHTML = ico("bookmark", 16);
      };
      majBtn();
      btn.addEventListener("click", () => {
        toggleSave(r); majBtn();
        if (savedOn && !saved.has(r.u)) art.remove();
        track("save");
      });
      art.querySelector(".tr-jobrow-side").appendChild(btn);
      // les investisseurs, en pied de ligne : c'est le maillage vers les pages /funds/
      const back = (r.f || "").split(" ; ").map(x => x.trim()).filter(Boolean);
      if (back.length) {
        const d = document.createElement("div"); d.className = "backers";
        d.innerHTML = ico("landmark", 13) + "Backed by " + back.map(x => FUNDS[x]
          ? `<a href="funds/${encodeURIComponent(FUNDS[x])}/">${esc(x)}</a>` : esc(x)).join(", ");
        art.querySelector(".tr-jobrow-main").appendChild(d);
      }
      frag.appendChild(art);
    });
    $("#list").appendChild(frag); shown += PAGE;
    $("#shown").textContent = num(Math.min(shown, rows.length));
    $("#more").hidden = shown >= rows.length;
    $("#track").style.width = Math.max(2, Math.min(100, Math.round(100 * Math.min(shown, rows.length) / (rows.length || 1)))) + "%";
    $("#loadmore").hidden = !rows.length;
    if (!rows.length) {
      $("#list").innerHTML = `<div class="tr-empty"><span class="tr-empty-icon">${ico("search", 20)}</span>` +
        `<h3>No role matches</h3><p>${T.empty}</p>` +
        `<button type="button" class="tr-btn tr-btn-secondary" id="emptyreset">Clear all filters</button></div>`;
      const er = $("#emptyreset"); if (er) er.addEventListener("click", () => $("#reset").click());
    }
  }
  async function refresh(reason) { all = await load(coches("cat")); apply(reason); }

  (async () => {
    meta = await (await fetch("data/meta.json?t=" + Date.now(), { cache: "no-store" })).json();
    $("#meta-date").textContent = new Date(meta.date).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const st = state();
    $("#q").value = st.q; $("#qwhere").value = st.where;
    cocher("cat", st.cat);
    poserSegment("region", st.region); poserSegment("age", st.age);
    remoteOn = st.remote; $("#salary").checked = st.salary;
    savedOn = st.saved; matchOn = st.match && aProfil();
    // les listes dépliantes se remplissent une première fois pour que les cases de l'URL existent
    fillCountries(st.region, st.country); cocher("country", st.country);
    fillCities(st.country, st.region, st.city); cocher("city", st.city);

    // les cases et les segments : un seul écouteur délégué sur le panneau
    const ff = $("#filters");
    ff.addEventListener("change", e => {
      const i = e.target.closest("input[data-f]");
      if (i) return refresh(i.dataset.f === "cat" ? "cat" : i.dataset.f);
      if (e.target.id === "salary") return apply("salary");
    });
    ff.addEventListener("click", e => {
      const seg = e.target.closest(".chipwrap button");
      if (seg) {
        poserSegment(seg.parentElement.id, seg.dataset.v);
        return apply(seg.parentElement.id);
      }
      const tete = e.target.closest(".tr-fgroup-head");
      if (tete) {   // FilterGroup : l'en-tête replie son corps et retourne le chevron
        const ouvert = tete.getAttribute("aria-expanded") === "true";
        tete.setAttribute("aria-expanded", ouvert ? "false" : "true");
        const corps = tete.nextElementSibling;
        if (corps) corps.hidden = ouvert;
        const chev = tete.querySelector(".tr-icon");
        if (chev) chev.outerHTML = ico(ouvert ? "chevron-right" : "chevron-down", 14);
      }
    });
    let tp; ["#qcountry", "#qcity"].forEach(sel => $(sel).addEventListener("input", () => {
      clearTimeout(tp); tp = setTimeout(() => apply(), 120);
    }));
    let tm; $("#q").addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => apply(), 150); });
    $("#qwhere").addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => apply(), 150); });
    $("#searchbar").addEventListener("submit", e => { e.preventDefault(); apply(); if ($("#q").value.trim()) track("search"); });
    $("#sort").addEventListener("change", () => {
      matchOn = $("#sort").value === "match" && aProfil();
      apply("sort");
    });
    $("#more").addEventListener("click", more);
    $("#reset").addEventListener("click", () => {
      history.replaceState(null, "", location.pathname);
      ["cat", "country", "city", "sector"].forEach(k => cocher(k, []));
      poserSegment("region", ""); poserSegment("age", "30");
      $("#q").value = ""; $("#qwhere").value = ""; $("#qcountry").value = ""; $("#qcity").value = "";
      $("#salary").checked = false; remoteOn = false; savedOn = false; matchOn = false;
      $("#savedbtn").setAttribute("aria-pressed", "false");
      refresh("reset");
    });
    // ActiveFilters : chaque puce se retire d'un clic
    $("#active").addEventListener("click", e => {
      if (e.target.closest("#clearall")) return $("#reset").click();
      const ch = e.target.closest("[data-x]"); if (!ch) return;
      const [k, v] = ch.dataset.x.split(":");
      if (k === "q") $("#q").value = "";
      else if (k === "where") $("#qwhere").value = "";
      else if (k === "region") poserSegment("region", "");
      else if (k === "age") poserSegment("age", "30");
      else if (k === "salary") $("#salary").checked = false;
      else if (k === "remote") remoteOn = false;
      else if (k === "saved") { savedOn = false; $("#savedbtn").setAttribute("aria-pressed", "false"); }
      else {
        const i = document.querySelector(`input[data-f="${k}"][value="${v}"]`);
        if (i) i.checked = false;
      }
      if (k === "cat") refresh("cat"); else apply("chip");
    });
    /* Raccourcis du chapeau. Chaque bouton porte sa sélection en JSON : on la pose
       sur les contrôles, on recharge si la famille change, puis on applique. Passer
       par l'URL ne marchait pas — apply() réécrit le hash depuis le DOM juste après. */
    async function preset(v) {
      ["cat", "country", "city", "sector"].forEach(k => cocher(k, v[k] || []));
      poserSegment("region", v.region || "");
      poserSegment("age", v.age || "30");
      $("#q").value = v.q || ""; $("#qwhere").value = v.where || "";
      $("#salary").checked = !!v.salary;
      remoteOn = !!v.remote;
      if (v.sector && v.sector.length) $("#sectors").dataset.ouvert = "1";
      if (v.country && v.country.length) $("#countries").dataset.ouvert = "1";
      fillCountries(v.region || "", v.country || []);
      all = await load(v.cat && v.cat.length ? v.cat : []);
      fillSectors(all, v.sector || []);
      cocher("sector", v.sector || []);
      cocher("country", v.country || []);
      apply("preset");
      const sh = document.querySelector(".shell");
      if (sh) window.scrollTo({ top: sh.offsetTop - 16, behavior: "smooth" });
      track("preset");
    }
    document.querySelectorAll("[data-preset]").forEach(b => {
      let v = {}; try { v = JSON.parse(b.dataset.preset); } catch (e) {}
      b.addEventListener("click", () => preset(v));
    });

    // Tiroir de filtres sur mobile : il monte du bas, le fond est verrouillé, et
    // le bouton du pied annonce combien d'offres la sélection laisse.
    const ft = $("#filtoggle");
    function tiroir(ouvrir) {
      ff.classList.toggle("ouvert", ouvrir);
      document.body.classList.toggle("sheet-on", ouvrir);
      ft.setAttribute("aria-expanded", ouvrir ? "true" : "false");
      if (ouvrir) majTiroir();
    }
    const majTiroir = () => { $("#sheetdone").textContent = `Show ${num(rows.length)} roles`; };
    ft.addEventListener("click", () => tiroir(!ff.classList.contains("ouvert")));
    $("#sheetclose").addEventListener("click", () => tiroir(false));
    $("#sheetdone").addEventListener("click", () => tiroir(false));
    $("#reset2").addEventListener("click", () => $("#reset").click());
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && ff.classList.contains("ouvert")) tiroir(false);
    });
    document.addEventListener("click", e => {   // clic sur le voile
      if (!ff.classList.contains("ouvert")) return;
      if (ff.contains(e.target) || ft.contains(e.target)) return;
      if (e.clientY && document.body.classList.contains("sheet-on")) tiroir(false);
    });
    $("#savedbtn").addEventListener("click", () => {
      savedOn = !savedOn;
      $("#savedbtn").setAttribute("aria-pressed", savedOn ? "true" : "false");
      apply("saved");
    });
    if (aProfil()) $("#optmatch").hidden = false;
    if (matchOn) $("#sort").value = "match";
    refreshSavedBtn();
    $("#fundclear").addEventListener("click", e => {          // retirer le filtre fonds venu d'une page /funds/
      e.preventDefault();
      const pp = new URLSearchParams(location.hash.slice(1)); pp.delete("fonds");
      history.replaceState(null, "", location.pathname + (pp.toString() ? "#" + pp.toString() : ""));
      apply();
    });

    // ---- suivi de candidature : on retient l'offre ouverte, puis on demande dès que la personne revient
    let asked = new Set(), pending = null;
    try { asked = new Set(JSON.parse(localStorage.getItem("sj.asked") || "[]")); } catch (e) {}
    try { const p0 = JSON.parse(sessionStorage.getItem("sj.pending") || "null"); if (p0) pending = p0; } catch (e) {}
    const savePending = () => { try { pending ? sessionStorage.setItem("sj.pending", JSON.stringify(pending)) : sessionStorage.removeItem("sj.pending"); } catch (e) {} };
    const saveAsked = () => { try { localStorage.setItem("sj.asked", JSON.stringify([...asked].slice(-400))); } catch (e) {} };
    $("#list").addEventListener("click", e => {
      const a = e.target.closest("a.tr-jobrow-title"); if (!a) return;
      const href = a.getAttribute("href"); const r = rows.find(x => x.u === href);
      if (!r || asked.has(r.u)) return;
      pending = { u: r.u, s: r.s, t: r.t, l: r.l || r.p, at: Date.now() }; savePending();
      clearTimeout(window.__sjT); window.__sjT = setTimeout(askBar, 12000);
    });
    function askBar() {
      if (!pending || document.hidden || document.querySelector(".ask")) return;
      if (Date.now() - (pending.at || 0) < 2500) { clearTimeout(window.__sjT); window.__sjT = setTimeout(askBar, 2500); return; }
      const r = pending;
      // composant Dialog du design system : voile, en-tête avec croix, corps, pied d'actions
      const box = document.createElement("div"); box.className = "tr-scrim ask";
      box.innerHTML = '<div class="tr-dialog" role="dialog" aria-modal="true" aria-labelledby="trdlg">' +
        '<div class="tr-dialog-head"><div><h2 id="trdlg">' + T.ask + ' ' + esc(r.s) + '?</h2>' +
        '<p>' + esc(cleanTitle(r.t)) + (r.l ? ' · ' + esc(r.l) : '') + '</p></div>' +
        '<button type="button" class="tr-iconbtn tr-iconbtn-sm" data-a="n" aria-label="Close" title="Close">' + ico("x", 16) + '</button></div>' +
        '<div class="tr-dialog-body"><p style="margin:0;font-size:14px;color:var(--ink-muted)">' + T.askSub + '</p>' +
        '<a class="tr-callout tr-callout-neutral" href="moi/#cv" data-a="cv" style="text-decoration:none">' +
        ico("file-text", 18) + '<span class="tr-callout-body">' + T.askCv + '</span></a></div>' +
        '<div class="tr-dialog-foot">' +
        '<button type="button" class="tr-btn tr-btn-ghost" data-a="n">' + T.askN + '</button>' +
        '<button type="button" class="tr-btn tr-btn-secondary" data-a="l">' + T.askL + '</button>' +
        '<button type="button" class="tr-btn tr-btn-primary y" data-a="y">' + T.askY + '</button>' +
        '</div></div>';
      document.body.appendChild(box);
      const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
      const onKey = e => { if (e.key === "Escape") { close(); pending = null; savePending(); } };
      document.addEventListener("keydown", onKey);
      box.querySelector(".y").focus();
      box.addEventListener("click", ev => {
        if (ev.target === box) { close(); pending = null; savePending(); return; }
        const a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
        if (a === "cv") {
          // on transmet l'offre à l'outil de CV : il s'ouvre déjà rempli
          try { sessionStorage.setItem("sj.cvjob", JSON.stringify({ co: r.s, po: r.t, u: r.u, l: r.l })); } catch (e) {}
          track("apply/cv"); return;   // le lien suit son cours vers moi/#cv
        }
        if (a === "y" && window.SJ) {
          SJ.addApp({ co: r.s, po: r.t, u: r.u, lieu: r.l });
          box.querySelector(".tr-dialog").innerHTML =
            '<div class="tr-dialog-body"><div class="tr-empty">' +
            '<span class="tr-empty-icon">' + ico("check", 20) + '</span>' +
            '<h3>' + T.added + '</h3><p><a href="moi/#crm">' + T.space + ' →</a></p></div></div>';
          setTimeout(close, 2000); track("apply/yes");
        } else { close(); track("apply/" + a); }
        if (a !== "l") { asked.add(r.u); saveAsked(); }
        pending = null; savePending(); clearTimeout(window.__sjT);
      });
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(askBar, 500); });
    window.addEventListener("focus", () => setTimeout(askBar, 500));
    ["pointerdown", "keydown", "wheel"].forEach(ev => window.addEventListener(ev, () => { if (pending) setTimeout(askBar, 150); }, { passive: true }));
    if (pending) setTimeout(askBar, 1200);
    await refresh();
  })();
})();
