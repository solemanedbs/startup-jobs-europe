(() => {
  const $ = s => document.querySelector(s);
  const PAGE = 50;
  const T = {
    offers: n => n === 1 ? "role" : "roles",
    empty: "No role matches these filters. Try a wider region or a longer period.",
    today: "today", yesterday: "yesterday", days: n => `${n}d ago`, months: n => `${n}mo ago`, unknown: "date unknown",
    seen: "listed", new: "new", scale: "scale-up", remoteTag: "remote",
    ask: "Did you apply at", askSub: "This role is handled on the company's own site. Add it to your tracker?",
    askY: "Yes, I applied", askN: "No, don't ask again", askL: "Maybe later", added: "Added to your tracker", space: "My space",
    askCv: "Not applied yet? Tailor your CV for this role →"
  };
  const SYN = [[/\b(biz ?dev|bizdev)\b/g, "business develop"], [/\bsdr\b/g, "sales development"], [/\bbdr\b/g, "business development representative"], [/\bae\b/g, "account executive"], [/\bcsm\b/g, "customer success"], [/\bkam\b/g, "key account"], [/\bpm\b/g, "product manager"]];
  const cache = {}; let meta, rows = [], all = [], shown = 0, lastGrp = null, remoteOn = false, savedOn = false, matchOn = false;
  const GRP = n => n === null ? "Date unknown" : n <= 0 ? "Today" : n <= 7 ? "This week" : n <= 30 ? "This month" : "Earlier";
  // comparaison de dates de calendrier, pas de durées : sinon une offre publiée aujourd'hui
  // compte pour « 1 jour » dès qu'on consulte la page l'après-midi (bug du 05/10)
  const midnight = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const daysAgo = d => { const x = midnight(d); return x ? Math.round((today0 - x) / 86400000) : null; };
  const fmtDate = d => { const n = daysAgo(d); if (n === null) return T.unknown; if (n <= 0) return T.today; if (n === 1) return T.yesterday; if (n < 30) return T.days(n); return T.months(Math.round(n / 30)); };
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // une URL non http(s) ne doit jamais atterrir dans un href : « javascript: » s'exécuterait
  // dans le contexte du site et pourrait siphonner localStorage (profil, CV, candidatures)
  const safeUrl = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "#";
  const num = n => n.toLocaleString("en-GB");
  const track = path => { try { window.goatcounter && window.goatcounter.count({ path, title: path, event: true }); } catch (e) {} };

  // ---- filtres en cascade : région → pays → ville
  function fillRegions(st, q, maxAge) {
    const el = $("#region"), cur = el.value || "EMEA";
    // comptes recalculés sur les filtres actifs : sinon « Europe (10 104) » contredit « 24 552 roles »
    let m = null, total = meta.total;
    if (st && all.length) {
      m = new Map(); total = 0;
      all.forEach(r => { if (matches(r, st, q, maxAge, "region")) { total++; if (r.g) m.set(r.g, (m.get(r.g) || 0) + 1); } });
    }
    el.innerHTML = `<option value="">All locations (${num(total)})</option>`;
    meta.regions.forEach(([g, n]) => {
      if (g === "Multiple locations" || g === "Unspecified") return;
      const o = document.createElement("option"); o.value = g;
      o.textContent = `${g} (${num(m ? (m.get(g) || 0) : n)})`; el.appendChild(o);
    });
    el.value = cur;
  }
  function fillCountries(region) {
    const el = $("#country"), cur = el.value;
    el.innerHTML = `<option value="">${region ? "All countries in " + region : "All countries"}</option>`;
    meta.pays.filter(([p]) => !region || meta.pays_region[p] === region)
      .forEach(([p, n]) => { const o = document.createElement("option"); o.value = p; o.textContent = `${p} (${num(n)})`; el.appendChild(o); });
    el.value = [...el.options].some(o => o.value === cur) ? cur : "";
  }
  function fillCities(country, region) {
    const el = $("#city"), cur = el.value;
    el.innerHTML = `<option value="">${country ? "All cities in " + country : "All cities"}</option>`;
    meta.villes.filter(([c]) => {
      const p = meta.ville_pays[c]; if (!p) return false;
      if (country) return p === country;
      return !region || meta.pays_region[p] === region;
    }).forEach(([c, n]) => { const o = document.createElement("option"); o.value = c; o.textContent = `${c} (${num(n)})`; el.appendChild(o); });
    el.value = [...el.options].some(o => o.value === cur) ? cur : "";
  }

  async function load(cat) {
    const cats = cat === "all" ? Object.keys(meta.categories) : [cat];
    const parts = await Promise.all(cats.map(async c => { if (!cache[c]) cache[c] = await (await fetch(`data/${c}.json`)).json(); return cache[c]; }));
    return parts.flat();
  }
  function state() {
    const p = new URLSearchParams(location.hash.slice(1));
    return { q: p.get("q") || "", cat: p.get("cat") || "sales", region: p.has("region") ? p.get("region") : "EMEA", country: p.get("country") || "", city: p.get("city") || "", sector: p.get("sector") || "", saved: p.get("saved") === "1", match: p.get("match") === "1",
             age: p.get("age") || "30", fonds: p.get("fonds") || "", remote: p.get("remote") === "1", noscale: false, salary: p.get("salary") === "1" };
  }
  function push(st) {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q); if (st.cat !== "sales") p.set("cat", st.cat);
    if (st.region !== "EMEA") p.set("region", st.region); if (st.country) p.set("country", st.country); if (st.city) p.set("city", st.city);
    if (st.age !== "30") p.set("age", st.age);
    if (st.fonds) p.set("fonds", st.fonds); if (st.sector) p.set("sector", st.sector);
    if (st.saved) p.set("saved", "1"); if (st.match) p.set("match", "1");
    if (st.remote) p.set("remote", "1"); if (st.salary) p.set("salary", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "#" + p.toString() : ""));
  }
  function norm(s) { let x = (s || "").toLowerCase(); SYN.forEach(([re, to]) => x = x.replace(re, to)); return x; }

  // prédicat unique : la liste et les compteurs du pouls passent par là, donc un chiffre annoncé
  // est toujours exactement ce que le clic donnera
  function matches(r, st, q, maxAge, ignore) {
    if (ignore !== "region" && st.region && r.g !== st.region) return false;
    if (st.country && r.p !== st.country) return false;
    if (st.city && r.v !== st.city) return false;
    if (st.sector && r.k !== st.sector) return false;
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
  function pulse(st, q) {
    $("#p-today").textContent = num(countIf(st, q, { age: "0" }));
    $("#p-week").textContent  = num(countIf(st, q, { age: "7" }));
    $("#p-sal").textContent   = num(countIf(st, q, { salary: true }));
    $("#p-rem").textContent   = num(countIf(st, q, { remote: true }));
    const co = new Set(); all.forEach(r => { if (matches(r, st, q, +st.age)) co.add(r.s); });
    $("#p-co").textContent = num(co.size); $("#p-funds").textContent = num(meta.fonds.length);
    $("#pulse").hidden = false;
    document.querySelectorAll(".pchip").forEach(b => {
      const k = b.dataset.p;
      b.classList.toggle("on", (k === "today" && st.age === "0") || (k === "week" && st.age === "7") || (k === "salary" && st.salary) || (k === "remote" && st.remote));
    });
  }

  function apply(reason) {
    const st = { q: $("#q").value.trim(), cat: $("#cat").value, region: $("#region").value, country: $("#country").value, city: $("#city").value, sector: $("#sector").value, saved: savedOn, match: matchOn,
                 age: $("#age").value, fonds: state().fonds, remote: remoteOn, noscale: false, salary: $("#salary").checked };
    const fb = $("#fundbar");
    if (fb) { fb.hidden = !st.fonds; if (st.fonds) $("#fundname").textContent = st.fonds; }
    push(st); if (reason) track(`filter/${reason}/${st[reason] === true ? "on" : st[reason] === false ? "off" : st[reason] || "-"}`);
    const q = norm(st.q); const maxAge = +st.age;
    fillRegions(st, q, maxAge);
    rows = all.filter(r => matches(r, st, q, maxAge));
    if (st.match && aProfil()) rows.sort((a, b) => score(b) - score(a) || (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    else rows.sort((a, b) => (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    pulse(st, q);
    shown = 0; lastGrp = null; $("#list").innerHTML = ""; more();
    $("#count").textContent = `${num(rows.length)} ${T.offers(rows.length)}`;
  }
  let FUNDS = {};
  fetch("data/funds.json").then(r => r.ok ? r.json() : {}).then(m => { FUNDS = m; })
    .catch(() => {});

  function fillSectors(rowsAll, cur) {
    const m = new Map();
    rowsAll.forEach(r => { if (r.k && r.k !== "unclassified") m.set(r.k, (m.get(r.k) || 0) + 1); });
    const L = (meta && meta.secteurs) || {};
    const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
    $("#sector").innerHTML = `<option value="">All sectors</option>` +
      ord.map(([k, n]) => `<option value="${esc(k)}">${esc(L[k] || k)} (${n})</option>`).join("");
    $("#sector").value = cur || "";
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
    b.querySelector("b").textContent = saved.size;
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

  function more() {
    const frag = document.createDocumentFragment();
    rows.slice(shown, shown + PAGE).forEach(r => {
      const n = daysAgo(r.d || r.n);
      const g = GRP(n);
      if (g !== lastGrp) { const h = document.createElement("li"); h.className = "grp"; h.textContent = g; frag.appendChild(h); lastGrp = g; }
      const li = document.createElement("li");
      // un lieu inconnu n'est pas une information : on n'affiche pas d'étiquette plutôt qu'un « Unspecified » en couleur
      const brut = (r.l || "").trim();
      const faux = /^(\d+\s+locations?|multiple locations|various|unspecified)$/i.test(brut);
      const loc = r.v && r.p ? `${r.v}, ${r.p}`
        : (r.p || (faux || !brut ? (r.g === "Unspecified" ? "" : r.g) : brut.split(/[;•|]/)[0].trim()));
      li.innerHTML = `<a class="job" href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener">
        <div class="t">${esc(r.t)}</div>
        <div class="r">${r["$"] ? `<span class="sal">${esc(r["$"])}</span> · ` : ""}${r.d ? fmtDate(r.d) : `<span title="This company does not publish a posting date. This is when the role first appeared on its careers page.">${T.seen} ${fmtDate(r.n)}</span>`}${n !== null && n <= 3 ? `<span class="new">${T.new}</span>` : ""}</div>
        <div class="s"><b>${esc(r.s)}</b>${loc ? " · " + esc(loc) : ""}</div>
        <div class="tags">${r.r ? `<span class="tag">${T.remoteTag}</span>` : ""}${r.b ? `<span class="tag">${T.scale}</span>` : ""}</div>
      </a>`;
      // une seule rangée de pied : étoile, correspondance, investisseurs — pour ne pas
      // ajouter 60 px de hauteur à chaque offre.
      const foot = document.createElement("div"); foot.className = "jobfoot";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "star" + (saved.has(r.u) ? " on" : "");
      const majBtn = () => {
        const on = saved.has(r.u);
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "Remove from saved roles" : "Save this role");
        btn.textContent = on ? "\u2605" : "\u2606";
      };
      majBtn();
      btn.addEventListener("click", () => {
        toggleSave(r); majBtn();
        if (savedOn && !saved.has(r.u)) li.remove();
        track("save");
      });
      li.appendChild(btn);
      if (matchOn && aProfil()) {
        const sc = score(r);
        if (sc >= 20) { const c = document.createElement("span"); c.className = "mscore"; c.textContent = sc + "%"; foot.appendChild(c); }
      }
      const back = (r.f || "").split(" ; ").map(x => x.trim()).filter(Boolean);
      if (back.length) {
        const d = document.createElement("span"); d.className = "backers";
        d.innerHTML = "backed by " + back.map(n => FUNDS[n]
          ? `<a href="funds/${encodeURIComponent(FUNDS[n])}/">${esc(n)}</a>` : esc(n)).join(" \u00b7 ");
        foot.appendChild(d);
      }
      if (foot.childNodes.length) li.appendChild(foot);
      frag.appendChild(li);
    });
    $("#list").appendChild(frag); shown += PAGE;
    $("#more").hidden = shown >= rows.length;
    if (!rows.length) $("#list").innerHTML = `<li class="empty">${T.empty}</li>`;
  }
  async function refresh(reason) { all = await load($("#cat").value); fillSectors(all, $("#sector").value || state().sector); apply(reason); }

  (async () => {
    meta = await (await fetch("data/meta.json")).json();
    $("#meta-date").textContent = new Date(meta.date).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const st = state();
    fillRegions(); $("#region").value = st.region;
    fillCountries(st.region); $("#country").value = st.country;
    fillCities(st.country, st.region); $("#city").value = st.city;
    $("#q").value = st.q; $("#cat").value = st.cat; $("#age").value = st.age;
    remoteOn = st.remote; $("#salary").checked = st.salary;
    savedOn = st.saved; matchOn = st.match && aProfil();
    $("#sector").innerHTML = '<option value="">All sectors</option>';

    $("#cat").addEventListener("change", () => refresh("cat"));
    $("#region").addEventListener("change", () => { fillCountries($("#region").value); fillCities($("#country").value, $("#region").value); apply("region"); });
    $("#country").addEventListener("change", () => { fillCities($("#country").value, $("#region").value); apply("country"); });
    [["#city", "city"], ["#age", "age"], ["#salary", "salary"], ["#sector", "sector"]].forEach(([s, k]) => $(s).addEventListener("change", () => apply(k)));
    let tm; $("#q").addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => apply(), 150); });
    $("#q").addEventListener("change", () => { if ($("#q").value.trim()) track("search"); });
    $("#more").addEventListener("click", more);
    // Repli des filtres sur mobile : le bouton affiche combien sont actifs, pour qu'on
    // sache ce qui est appliqué sans déplier.
    const ft = $("#filtoggle"), ff = $("#filters");
    const majFiltres = () => {
      const st = state();
      const n = [st.q, st.cat !== "sales" ? st.cat : "", st.region !== "EMEA" ? st.region : "",
                 st.country, st.city, st.sector, st.age !== "30" ? st.age : "",
                 st.salary ? "1" : "", st.remote ? "1" : ""].filter(Boolean).length;
      $("#filcount").textContent = n ? `${n} active` : "";
    };
    ft.addEventListener("click", () => {
      const ouvert = ff.classList.toggle("ouvert");
      ft.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
    majFiltres();
    ff.addEventListener("change", majFiltres);
    $("#q").addEventListener("input", majFiltres);
    $("#savedbtn").addEventListener("click", () => { savedOn = !savedOn; $("#savedbtn").classList.toggle("on", savedOn); apply("saved"); });
    $("#matchbtn").addEventListener("click", () => { matchOn = !matchOn; $("#matchbtn").classList.toggle("on", matchOn); apply("match"); });
    // le bouton de tri n'apparaît que si le profil est assez rempli pour que le calcul ait un sens
    $("#matchbtn").hidden = !aProfil(); $("#matchhint").hidden = aProfil();
    $("#matchbtn").classList.toggle("on", matchOn); $("#savedbtn").classList.toggle("on", savedOn);
    refreshSavedBtn();
    $("#fundclear").addEventListener("click", e => {          // retirer le filtre fonds venu d'une page /funds/
      e.preventDefault();
      const p = new URLSearchParams(location.hash.slice(1)); p.delete("fonds");
      history.replaceState(null, "", location.pathname + (p.toString() ? "#" + p.toString() : ""));
      apply();
    });
    document.querySelectorAll(".pchip").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.p, on = b.classList.contains("on");
      if (k === "today") $("#age").value = on ? "30" : "0";
      else if (k === "week") $("#age").value = on ? "30" : "7";
      else if (k === "salary") $("#salary").checked = !on;
      else if (k === "remote") remoteOn = !on;
      apply("pulse-" + k);
    }));

    // ---- suivi de candidature : on retient l'offre ouverte, puis on demande dès que la personne revient
    let asked = new Set(), pending = null;
    try { asked = new Set(JSON.parse(localStorage.getItem("sj.asked") || "[]")); } catch (e) {}
    try { const p0 = JSON.parse(sessionStorage.getItem("sj.pending") || "null"); if (p0) pending = p0; } catch (e) {}
    const savePending = () => { try { pending ? sessionStorage.setItem("sj.pending", JSON.stringify(pending)) : sessionStorage.removeItem("sj.pending"); } catch (e) {} };
    const saveAsked = () => { try { localStorage.setItem("sj.asked", JSON.stringify([...asked].slice(-400))); } catch (e) {} };
    $("#list").addEventListener("click", e => {
      const a = e.target.closest("a.job"); if (!a) return;
      const href = a.getAttribute("href"); const r = rows.find(x => x.u === href);
      if (!r || asked.has(r.u)) return;
      pending = { u: r.u, s: r.s, t: r.t, l: r.l || r.p, at: Date.now() }; savePending();
      clearTimeout(window.__sjT); window.__sjT = setTimeout(askBar, 12000);
    });
    function askBar() {
      if (!pending || document.hidden || document.querySelector(".ask")) return;
      if (Date.now() - (pending.at || 0) < 2500) { clearTimeout(window.__sjT); window.__sjT = setTimeout(askBar, 2500); return; }
      const r = pending;
      const box = document.createElement("div"); box.className = "ask"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      box.innerHTML = '<div class="ask-box"><div class="ask-ico">&#10003;</div>' +
        '<h3>' + T.ask + ' <b>' + esc(r.s) + '</b>?</h3>' +
        '<p>' + esc(r.t) + (r.l ? ' &middot; ' + esc(r.l) : '') + '<br>' + T.askSub + '</p>' +
        '<div class="ask-btns"><button class="y" data-a="y">' + T.askY + '</button>' +
        '<button data-a="l">' + T.askL + '</button><button data-a="n">' + T.askN + '</button></div>' +
        '<a class="ask-cv" href="moi/#cv" data-a="cv">' + T.askCv + '</a></div>';
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
          box.querySelector(".ask-box").innerHTML = '<div class="ask-ico">&#10003;</div><h3 class="ask-done">' + T.added + '</h3><p><a href="moi/#crm">' + T.space + ' &rarr;</a></p>';
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
