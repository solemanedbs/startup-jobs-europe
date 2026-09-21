(() => {
  const $ = s => document.querySelector(s);
  const EUROPE = new Set(["France","Royaume-Uni","Allemagne","Pays-Bas","Belgique","Luxembourg","Espagne","Portugal","Italie","Suisse","Autriche","Suède","Danemark","Norvège","Finlande","Irlande","Pologne","Tchéquie","Hongrie","Roumanie","Bulgarie","Grèce","Estonie","Lettonie","Lituanie","Croatie","Slovénie","Slovaquie","Europe (non précisé)","Remote"]);
  const cache = {}; let meta, rows = [], shown = 0; const PAGE = 50;
  const today = new Date(); const daysAgo = d => d ? Math.round((today - new Date(d)) / 86400000) : null;
  const fmtDate = d => { const n = daysAgo(d); if (n === null) return "date inconnue"; if (n <= 0) return "aujourd'hui"; if (n === 1) return "hier"; if (n < 30) return `il y a ${n} j`; return `il y a ${Math.round(n/30)} mois`; };
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  async function load(cat) {
    const cats = cat === "all" ? Object.keys(meta.categories) : [cat];
    const parts = await Promise.all(cats.map(async c => { if (!cache[c]) cache[c] = await (await fetch(`data/${c}.json`)).json(); return cache[c]; }));
    return parts.flat();
  }
  function state() {
    const p = new URLSearchParams(location.hash.slice(1));
    return { q: p.get("q") || "", cat: p.get("cat") || "sales", pays: p.get("pays") || "europe", ville: p.get("ville") || "", age: p.get("age") || "30", fonds: p.get("fonds") || "" };
  }
  function push(st) { const p = new URLSearchParams(); Object.entries(st).forEach(([k, v]) => { if (v && !(k === "cat" && v === "sales") && !(k === "pays" && v === "europe") && !(k === "age" && v === "30")) p.set(k, v); }); history.replaceState(null, "", "#" + p.toString()); }
  function apply() {
    const st = { q: $("#q").value.trim(), cat: $("#cat").value, pays: $("#pays").value, ville: $("#ville").value, age: $("#age").value, fonds: $("#fonds").value };
    push(st);
    const q = st.q.toLowerCase(); const maxAge = +st.age;
    rows = all.filter(r => {
      if (st.pays === "europe" ? !EUROPE.has(r.p) : (st.pays && r.p !== st.pays)) return false;
      if (st.ville && r.v !== st.ville) return false;
      if (st.fonds && !r.f.split(" ; ").includes(st.fonds)) return false;
      if (maxAge < 999) { const n = daysAgo(r.d || r.n); if (n === null || n > maxAge) return false; }
      if (q && !(r.t + " " + r.s + " " + r.f + " " + r.l).toLowerCase().includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => (b.d || b.n || "").localeCompare(a.d || a.n || ""));
    shown = 0; $("#list").innerHTML = ""; more();
    $("#count").textContent = rows.length.toLocaleString("fr-FR") + (rows.length > 1 ? " offres" : " offre");
  }
  function more() {
    const frag = document.createDocumentFragment();
    rows.slice(shown, shown + PAGE).forEach(r => {
      const li = document.createElement("li"); const n = daysAgo(r.d || r.n);
      li.innerHTML = `<a class="job" href="${esc(r.u)}" target="_blank" rel="noopener">
        <div class="t">${esc(r.t)}</div>
        <div class="r">${r.d ? fmtDate(r.d) : "vue " + fmtDate(r.n)}${n !== null && n <= 3 ? '<span class="new">nouveau</span>' : ""}</div>
        <div class="s"><b>${esc(r.s)}</b>${r.l ? " · " + esc(r.l) : ""}</div>
        <div class="tags">${r.f.split(" ; ").filter(Boolean).slice(0, 3).map(f => `<span class="tag">${esc(f)}</span>`).join("")}<span class="tag">${esc(r.a)}</span></div>
      </a>`;
      frag.appendChild(li);
    });
    $("#list").appendChild(frag); shown += PAGE;
    $("#more").hidden = shown >= rows.length;
    if (!rows.length) $("#list").innerHTML = '<li class="empty">Aucune offre avec ces filtres. Élargissez la période ou la zone.</li>';
  }
  let all = [];
  async function refresh() { all = await load($("#cat").value); apply(); }
  (async () => {
    meta = await (await fetch("data/meta.json")).json();
    $("#meta-total").textContent = meta.total.toLocaleString("fr-FR"); $("#meta-startups").textContent = meta.startups.toLocaleString("fr-FR");
    $("#meta-fonds").textContent = "1 036"; $("#meta-date").textContent = new Date(meta.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    const ps = $("#pays"); meta.pays.filter(([p]) => p !== "Autre").forEach(([p, n]) => { const o = document.createElement("option"); o.value = p; o.textContent = `${p} (${n.toLocaleString("fr-FR")})`; ps.appendChild(o); });
    const vs = $("#ville"); meta.villes.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; vs.appendChild(o); });
    const fs = $("#fonds"); meta.fonds.forEach(f => { const o = document.createElement("option"); o.value = f; o.textContent = f; fs.appendChild(o); });
    const st = state(); $("#q").value = st.q; $("#cat").value = st.cat; $("#pays").value = st.pays; $("#ville").value = st.ville; $("#age").value = st.age; $("#fonds").value = st.fonds;
    $("#cat").addEventListener("change", refresh);
    ["#pays", "#ville", "#age", "#fonds"].forEach(s => $(s).addEventListener("change", apply));
    let t; $("#q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 150); });
    $("#more").addEventListener("click", more);
    await refresh();
  })();
})();
