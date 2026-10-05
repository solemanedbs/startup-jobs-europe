(() => {
  const $ = s => document.querySelector(s);
  const PAGE = 50;
  const T = {
    offers: n => n === 1 ? "role" : "roles",
    empty: "No role matches these filters. Try a wider region or a longer period.",
    today: "today", yesterday: "yesterday", days: n => `${n}d ago`, months: n => `${n}mo ago`, unknown: "date unknown",
    seen: "first seen", new: "new", scale: "scale-up", remoteTag: "remote",
    ask: "Did you apply at", askSub: "This role is handled on the company's own site. Add it to your tracker?",
    askY: "Yes, I applied", askN: "No, don't ask again", askL: "Maybe later", added: "Added to your tracker", space: "My space",
    askCv: "Not applied yet? Tailor your CV for this role →"
  };
  const SYN = [[/\b(biz ?dev|bizdev)\b/g, "business develop"], [/\bsdr\b/g, "sales development"], [/\bbdr\b/g, "business development representative"], [/\bae\b/g, "account executive"], [/\bcsm\b/g, "customer success"], [/\bkam\b/g, "key account"], [/\bpm\b/g, "product manager"]];
  const cache = {}; let meta, rows = [], all = [], shown = 0, lastGrp = null;
  const GRP = n => n === null ? "Date unknown" : n <= 0 ? "Today" : n <= 7 ? "This week" : n <= 30 ? "This month" : "Earlier";
  const today = new Date(); const daysAgo = d => d ? Math.round((today - new Date(d)) / 86400000) : null;
  const fmtDate = d => { const n = daysAgo(d); if (n === null) return T.unknown; if (n <= 0) return T.today; if (n === 1) return T.yesterday; if (n < 30) return T.days(n); return T.months(Math.round(n / 30)); };
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = n => n.toLocaleString("en-GB");
  const track = path => { try { window.goatcounter && window.goatcounter.count({ path, title: path, event: true }); } catch (e) {} };

  // ---- filtres en cascade : région → pays → ville
  function fillRegions() {
    const el = $("#region"), cur = el.value || "Europe";
    el.innerHTML = `<option value="">All locations (${num(meta.total)})</option>`;
    meta.regions.forEach(([g, n]) => { const o = document.createElement("option"); o.value = g; o.textContent = `${g} (${num(n)})`; el.appendChild(o); });
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
    return { q: p.get("q") || "", cat: p.get("cat") || "sales", region: p.has("region") ? p.get("region") : "Europe", country: p.get("country") || "", city: p.get("city") || "",
             age: p.get("age") || "30", fonds: p.get("fund") || "", remote: p.get("remote") === "1", noscale: p.get("scale") !== "1", salary: p.get("salary") === "1" };
  }
  function push(st) {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q); if (st.cat !== "sales") p.set("cat", st.cat);
    if (st.region !== "Europe") p.set("region", st.region); if (st.country) p.set("country", st.country); if (st.city) p.set("city", st.city);
    if (st.age !== "30") p.set("age", st.age); if (st.fonds) p.set("fund", st.fonds);
    if (st.remote) p.set("remote", "1"); if (!st.noscale) p.set("scale", "1"); if (st.salary) p.set("salary", "1");
    history.replaceState(null, "", location.pathname + (p.toString() ? "#" + p.toString() : ""));
  }
  function norm(s) { let x = (s || "").toLowerCase(); SYN.forEach(([re, to]) => x = x.replace(re, to)); return x; }

  // prédicat unique : la liste et les compteurs du pouls passent par là, donc un chiffre annoncé
  // est toujours exactement ce que le clic donnera
  function matches(r, st, q, maxAge) {
    if (st.region && r.g !== st.region) return false;
    if (st.country && r.p !== st.country) return false;
    if (st.city && r.v !== st.city) return false;
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
    const st = { q: $("#q").value.trim(), cat: $("#cat").value, region: $("#region").value, country: $("#country").value, city: $("#city").value,
                 age: $("#age").value, fonds: $("#fund").value, remote: $("#remote").checked, noscale: $("#noscale").checked, salary: $("#salary").checked };
    push(st); if (reason) track(`filter/${reason}/${st[reason] === true ? "on" : st[reason] === false ? "off" : st[reason] || "-"}`);
    const q = norm(st.q); const maxAge = +st.age;
    rows = all.filter(r => matches(r, st, q, maxAge));
    rows.sort((a, b) => (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    pulse(st, q);
    shown = 0; lastGrp = null; $("#list").innerHTML = ""; more();
    $("#count").textContent = `${num(rows.length)} ${T.offers(rows.length)}`;
  }
  function more() {
    const frag = document.createDocumentFragment();
    rows.slice(shown, shown + PAGE).forEach(r => {
      const n = daysAgo(r.d || r.n);
      const g = GRP(n);
      if (g !== lastGrp) { const h = document.createElement("li"); h.className = "grp"; h.textContent = g; frag.appendChild(h); lastGrp = g; }
      const li = document.createElement("li");
      // un lieu inconnu n'est pas une information : on n'affiche pas d'étiquette plutôt qu'un « Unspecified » en couleur
      const loc = r.v && r.p ? `${r.v}, ${r.p}` : (r.p || (r.g === "Unspecified" ? "" : r.g));
      li.innerHTML = `<a class="job" href="${esc(r.u)}" target="_blank" rel="noopener">
        <div class="t">${esc(r.t)}</div>
        <div class="r">${r["$"] ? `<span class="sal">${esc(r["$"])}</span> · ` : ""}${r.d ? fmtDate(r.d) : T.seen + " " + fmtDate(r.n)}${n !== null && n <= 3 ? `<span class="new">${T.new}</span>` : ""}</div>
        <div class="s"><b>${esc(r.s)}</b>${r.l ? " · " + esc(r.l) : ""}</div>
        <div class="tags">${loc ? `<span class="tag loc">${esc(loc)}</span>` : ""}${r.r ? `<span class="tag">${T.remoteTag}</span>` : ""}${r.b ? `<span class="tag">${T.scale}</span>` : ""}<span class="tag ats">${esc(r.a)}</span></div>
      </a>`;
      frag.appendChild(li);
    });
    $("#list").appendChild(frag); shown += PAGE;
    $("#more").hidden = shown >= rows.length;
    if (!rows.length) $("#list").innerHTML = `<li class="empty">${T.empty}</li>`;
  }
  async function refresh(reason) { all = await load($("#cat").value); apply(reason); }

  (async () => {
    meta = await (await fetch("data/meta.json")).json();
    $("#meta-total").textContent = num(meta.total);
    $("#meta-startups").textContent = num(meta.startups);
    $("#meta-date").textContent = new Date(meta.date).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const st = state();
    fillRegions(); $("#region").value = st.region;
    fillCountries(st.region); $("#country").value = st.country;
    fillCities(st.country, st.region); $("#city").value = st.city;
    const fs = $("#fund"); meta.fonds.forEach(f => { const o = document.createElement("option"); o.value = f; o.textContent = f; fs.appendChild(o); });
    $("#q").value = st.q; $("#cat").value = st.cat; $("#age").value = st.age; $("#fund").value = st.fonds;
    $("#remote").checked = st.remote; $("#noscale").checked = st.noscale; $("#salary").checked = st.salary;

    $("#cat").addEventListener("change", () => refresh("cat"));
    $("#region").addEventListener("change", () => { fillCountries($("#region").value); fillCities($("#country").value, $("#region").value); apply("region"); });
    $("#country").addEventListener("change", () => { fillCities($("#country").value, $("#region").value); apply("country"); });
    [["#city", "city"], ["#age", "age"], ["#fund", "fonds"], ["#remote", "remote"], ["#noscale", "noscale"], ["#salary", "salary"]].forEach(([s, k]) => $(s).addEventListener("change", () => apply(k)));
    let tm; $("#q").addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => apply(), 150); });
    $("#q").addEventListener("change", () => { if ($("#q").value.trim()) track("search"); });
    $("#more").addEventListener("click", more);
    document.querySelectorAll(".pchip").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.p, on = b.classList.contains("on");
      if (k === "today") $("#age").value = on ? "30" : "0";
      else if (k === "week") $("#age").value = on ? "30" : "7";
      else if (k === "salary") $("#salary").checked = !on;
      else if (k === "remote") $("#remote").checked = !on;
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
        '<a class="ask-cv" href="moi.html#cv" data-a="cv">' + T.askCv + '</a></div>';
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
          track("apply/cv"); return;   // le lien suit son cours vers moi.html#cv
        }
        if (a === "y" && window.SJ) {
          SJ.addApp({ co: r.s, po: r.t, u: r.u, lieu: r.l });
          box.querySelector(".ask-box").innerHTML = '<div class="ask-ico">&#10003;</div><h3 class="ask-done">' + T.added + '</h3><p><a href="moi.html#crm">' + T.space + ' &rarr;</a></p>';
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
