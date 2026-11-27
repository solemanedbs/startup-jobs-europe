/* « Which startups should you work at? » — cinq questions, puis de vraies offres.
 *
 * Pourquoi ce fichier existe : il fallait un mécanisme de partage. L'idée de départ
 * était un quiz « quelle startup es-tu », écartée pour une raison de fond — il
 * attribue une vraie entreprise à une personne, donc il la caractérise, et on ne
 * juge jamais une startup en public. Ici on ne qualifie personne : on compte des
 * offres réelles et on y emmène.
 *
 * Aucun compte, aucun envoi : tout tourne dans le navigateur sur les mêmes fichiers
 * que la page d'accueil, et le résultat est un lien vers la liste déjà filtrée.
 */
(function () {
  const $ = s => document.querySelector(s);
  const ecran = $("#mq"), barre = $("#mprog");
  if (!ecran) return;

  let ROWS = [], META = null, i = 0;
  const rep = { cat: "", country: "", remote: false, sector: "", salary: false };

  const CATS = [
    ["tech", "Build things", "Engineering, data, infrastructure"],
    ["sales", "Sell things", "Sales, partnerships, growth"],
    ["ops", "Run things", "Operations, finance, marketing"],
    ["leadership", "Lead things", "Heads of, VPs, founders' office"],
    ["", "Surprise me", "Anything that's open"],
  ];

  function questions() {
    const pays = (META.pays || []).slice(0, 7).map(([p, n]) => [p, p, `${n.toLocaleString("en-GB")} roles`]);
    const sect = Object.entries(META.secteurs || {})
      .map(([k, lab]) => [k, lab, ""])
      .sort((a, b) => compteSecteur(b[0]) - compteSecteur(a[0])).slice(0, 7);
    return [
      { cle: "cat", titre: "What do you actually want to do?", opts: CATS },
      { cle: "country", titre: "Where do you want to be?",
        opts: [...pays, ["", "Anywhere", "I'll go where the work is"]] },
      { cle: "remote", titre: "Does it have to be remote?",
        opts: [[true, "Remote only", "No office, no relocation"],
               [false, "Doesn't matter", "Office is fine"]] },
      { cle: "sector", titre: "Which market do you want to work on?",
        opts: [...sect.map(([k, lab]) => [k, lab, `${compteSecteur(k).toLocaleString("en-GB")} roles`]),
               ["", "Any of them", "I care about the job, not the market"]] },
      { cle: "salary", titre: "Do you want to know the pay up front?",
        opts: [[true, "Only show me roles with a salary", "Four in five don't say"],
               [false, "Show me everything", "I'll ask them myself"]] },
    ];
  }

  const compteSecteur = k => ROWS.reduce((n, r) => n + (r.k === k ? 1 : 0), 0);

  function filtre() {
    return ROWS.filter(r =>
      (!rep.cat || r.c === rep.cat) &&
      (!rep.country || r.p === rep.country) &&
      (!rep.remote || r.r) &&
      (!rep.sector || r.k === rep.sector) &&
      (!rep.salary || (r["$"] || "").trim()));
  }

  function lien() {
    const p = new URLSearchParams();
    if (rep.cat) p.set("cat", rep.cat);
    if (rep.country) p.set("country", rep.country);
    if (rep.sector) p.set("sector", rep.sector);
    if (rep.remote) p.set("remote", "1");
    if (rep.salary) p.set("salary", "1");
    p.set("age", "30");
    return "../#" + p.toString();
  }

  function dessine() {
    const qs = questions();
    if (i >= qs.length) return resultat();
    const q = qs[i];
    barre.style.width = (100 * i / qs.length) + "%";
    ecran.innerHTML =
      `<p class="tr-overline" style="margin:0 0 var(--space-2)">Question ${i + 1} of ${qs.length}</p>` +
      `<h2 class="tr-h-m" style="margin:0 0 var(--space-5)">${q.titre}</h2>` +
      `<div class="mopts">` + q.opts.map((o, n) =>
        `<button type="button" class="mopt" data-n="${n}">
           <span class="mopt-t">${o[1]}</span>
           ${o[2] ? `<span class="mopt-s">${o[2]}</span>` : ""}
         </button>`).join("") + `</div>` +
      (i ? `<button type="button" class="tr-btn tr-btn-ghost tr-btn-sm" id="mback"
              style="margin-top:var(--space-4)">Back</button>` : "");
    ecran.querySelectorAll(".mopt").forEach(b => b.onclick = () => {
      rep[q.cle] = q.opts[+b.dataset.n][0];
      i++; dessine();
    });
    const back = $("#mback");
    if (back) back.onclick = () => { i--; dessine(); };
  }

  function resultat() {
    barre.style.width = "100%";
    const m = filtre();
    const parSoc = {};
    m.forEach(r => { parSoc[r.s] = (parSoc[r.s] || 0) + 1; });
    const top = Object.entries(parSoc).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const n = m.length, s = Object.keys(parSoc).length;

    if (!n) {
      ecran.innerHTML =
        `<h2 class="tr-h-m" style="margin:0 0 var(--space-3)">Nothing matches — yet</h2>
         <p style="margin:0 0 var(--space-5)">That combination has nothing open this morning.
         The list is rebuilt every day, so it may tomorrow. Try loosening one answer.</p>
         <button type="button" class="tr-btn tr-btn-primary" id="mredo">Start over</button>`;
      $("#mredo").onclick = () => { i = 0; dessine(); };
      return;
    }
    const quoi = [rep.sector && (META.secteurs || {})[rep.sector], rep.country,
                  rep.remote ? "remote" : ""].filter(Boolean).join(", ");
    const partage = `I just found ${n.toLocaleString("en-GB")} open roles at ${s.toLocaleString("en-GB")} funded startups`
      + (quoi ? ` — ${quoi}` : "") + `. Not one posted by a recruiter.\n\ntractionjobs.com/match/`;

    ecran.innerHTML =
      `<p class="tr-overline" style="margin:0 0 var(--space-2)">Your answer</p>
       <h2 class="tr-h-l" style="margin:0 0 var(--space-2)">
         <span class="tr-num">${n.toLocaleString("en-GB")}</span> roles at
         <span class="tr-num">${s.toLocaleString("en-GB")}</span> companies</h2>
       <p style="margin:0 0 var(--space-5)">All open today, all read this morning from the
       companies' own careers pages. No account, no recruiters.</p>
       <div class="colist" style="margin-bottom:var(--space-5)">` +
        top.map(([nom, c]) =>
          `<span class="coitem"><span class="tr-mark tr-mark-sm">${nom.slice(0, 2).toUpperCase()}</span>
           <span class="coname">${nom}</span><span class="tr-num conb">${c}</span></span>`).join("") +
      `</div>
       <div class="tr-row" style="gap:var(--space-3);flex-wrap:wrap">
         <a class="tr-btn tr-btn-primary" href="${lien()}">See all ${n.toLocaleString("en-GB")} roles</a>
         <button type="button" class="tr-btn tr-btn-secondary" id="mshare">Copy to share</button>
         <button type="button" class="tr-btn tr-btn-ghost" id="mredo">Start over</button>
       </div>`;
    $("#mredo").onclick = () => { i = 0; dessine(); };
    $("#mshare").onclick = async e => {
      try { await navigator.clipboard.writeText(partage); e.target.textContent = "Copied"; }
      catch { e.target.textContent = "Press ⌘C"; }
    };
  }

  Promise.all([
    fetch("../data/meta.json").then(r => r.json()),
    ...["tech", "sales", "ops", "leadership", "autre"].map(c =>
      fetch(`../data/${c}.json`).then(r => r.json()).catch(() => [])),
  ]).then(([meta, ...paquets]) => {
    META = meta; ROWS = [].concat(...paquets);
    dessine();
  }).catch(() => {
    ecran.innerHTML = `<p>Could not load the roles. <a href="../">Browse them all instead</a>.</p>`;
  });
})();
