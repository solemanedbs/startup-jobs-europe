(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const D = SJ.get();
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };

  /* ---- onglets ---- */
  $$(".tab").forEach(b => b.addEventListener("click", () => {
    $$(".tab").forEach(x => x.classList.toggle("on", x === b));
    $$("main section").forEach(s => s.hidden = s.id !== "s-" + b.dataset.t);
    if (b.dataset.t === "cv") renderPrompt();
    location.hash = b.dataset.t;
  }));

  /* ---- identité ---- */
  const idMap = { "i-n": "n", "i-h": "h", "i-mail": "mail", "i-li": "li", "i-site": "site" };
  Object.entries(idMap).forEach(([id, k]) => {
    const inp = document.getElementById(id); inp.value = D.id[k] || "";
    inp.addEventListener("input", () => { D.id[k] = inp.value.trim(); SJ.save(); });
  });

  /* ---- expériences ---- */
  function xCard(x, i) {
    const c = el(`<div class="item">
      <div class="head"><b>Expérience ${i + 1}</b><button class="del">Supprimer</button></div>
      <div class="grid2">
        <label>Entreprise<input class="e" placeholder="Nom de l'entreprise"></label>
        <label>Intitulé du poste<input class="t" placeholder="Business developer"></label>
        <label>Dates<input class="d" placeholder="Nov. 2025 – juil. 2026"></label>
      </div>
      <label>Ce que vous avez fait — une ligne par fait, avec un chiffre quand c'est possible
        <textarea class="p" rows="5" placeholder="11 mandats signés en 9 mois sur un marché sans client ni pipeline&#10;Bases de prospects construites de zéro, prospection e-mail et LinkedIn"></textarea></label></div>`);
    c.querySelector(".e").value = x.e || ""; c.querySelector(".t").value = x.t || ""; c.querySelector(".d").value = x.d || "";
    c.querySelector(".p").value = (x.p || []).join("\n");
    c.addEventListener("input", () => { x.e = c.querySelector(".e").value; x.t = c.querySelector(".t").value; x.d = c.querySelector(".d").value; x.p = c.querySelector(".p").value.split("\n").map(s => s.trim()).filter(Boolean); SJ.save(); });
    c.querySelector(".del").addEventListener("click", () => { D.x.splice(i, 1); SJ.save(); renderX(); });
    return c;
  }
  function renderX() { const w = $("#xs"); w.innerHTML = ""; D.x.forEach((x, i) => w.appendChild(xCard(x, i))); }
  $("#addx").addEventListener("click", () => { D.x.push({ e: "", t: "", d: "", p: [] }); SJ.save(); renderX(); });

  /* ---- formation ---- */
  function fCard(f, i) {
    const c = el(`<div class="item"><div class="head"><b>Formation ${i + 1}</b><button class="del">Supprimer</button></div>
      <div class="grid2"><label>Intitulé et école<input class="t" placeholder="Master Entrepreneuriat, Université de Caen"></label>
      <label>Années<input class="d" placeholder="2023–2025"></label></div></div>`);
    c.querySelector(".t").value = f.t || ""; c.querySelector(".d").value = f.d || "";
    c.addEventListener("input", () => { f.t = c.querySelector(".t").value; f.d = c.querySelector(".d").value; SJ.save(); });
    c.querySelector(".del").addEventListener("click", () => { D.f.splice(i, 1); SJ.save(); renderF(); });
    return c;
  }
  function renderF() { const w = $("#fs"); w.innerHTML = ""; D.f.forEach((f, i) => w.appendChild(fCard(f, i))); }
  $("#addf").addEventListener("click", () => { D.f.push({ t: "", d: "" }); SJ.save(); renderF(); });

  /* ---- compétences ---- */
  const sIn = $("#i-s"); sIn.value = (D.s || []).join("\n");
  sIn.addEventListener("input", () => { D.s = sIn.value.split("\n").map(s => s.trim()).filter(Boolean); SJ.save(); });

  /* ---- projets ---- */
  function prCard(p, i) {
    const c = el(`<div class="item"><div class="head"><b>Projet ${i + 1}</b><button class="del">Supprimer</button></div>
      <label>Titre<input class="t" placeholder="Séquence d'e-mails froids — 400 prospects"></label>
      <label>Ce que vous avez fait — le problème, ce que vous avez construit, le résultat
        <textarea class="d" rows="3" placeholder="Construction d'une séquence en 4 touches sur 400 dirigeants, avec personnalisation automatisée. 18 % de réponses, 12 rendez-vous."></textarea></label>
      <div class="grid2">
        <label>Lien de vérification (optionnel)<input class="u" placeholder="https://drive.google.com/… · github.com/… · notion.site/…"></label>
        <label>Mots-clés, séparés par des virgules<input class="k" placeholder="Lemlist, Apollo, Python"></label>
      </div>
      <p class="hint warn" hidden>⚠︎ Lien Drive ou Notion : vérifiez qu'il est ouvert « à toute personne disposant du lien », sinon le recruteur verra une demande d'accès.</p></div>`);
    c.querySelector(".t").value = p.t || ""; c.querySelector(".d").value = p.d || ""; c.querySelector(".u").value = p.u || ""; c.querySelector(".k").value = (p.k || []).join(", ");
    const warn = c.querySelector(".warn"); const chk = () => warn.hidden = !/drive\.google|docs\.google|notion\.(so|site)|dropbox/i.test(c.querySelector(".u").value);
    chk();
    c.addEventListener("input", () => {
      p.t = c.querySelector(".t").value; p.d = c.querySelector(".d").value; p.u = c.querySelector(".u").value.trim();
      p.k = c.querySelector(".k").value.split(",").map(s => s.trim()).filter(Boolean); chk(); SJ.save();
    });
    c.querySelector(".del").addEventListener("click", () => { D.pr.splice(i, 1); SJ.save(); renderPr(); });
    return c;
  }
  function renderPr() { const w = $("#prs"); w.innerHTML = ""; D.pr.forEach((p, i) => w.appendChild(prCard(p, i))); }
  $("#addpr").addEventListener("click", () => { D.pr.push({ t: "", d: "", u: "", k: [] }); SJ.save(); renderPr(); });

  /* ---- CV : texte pour l'IA ---- */
  function renderPrompt() { $("#prompt").textContent = SJ.promptText($("#offre").value.trim()); }
  $("#offre").addEventListener("input", renderPrompt);
  $("#copy").addEventListener("click", async () => {
    const txt = SJ.promptText($("#offre").value.trim());
    try { await navigator.clipboard.writeText(txt); } catch (e) { const t = $("#prompt"); t.hidden = false; const r = document.createRange(); r.selectNode(t); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); }
    const ok = $("#copied"); ok.hidden = false; setTimeout(() => ok.hidden = true, 2200);
  });

  /* ---- lien partageable ---- */
  $("#mklink").addEventListener("click", async () => {
    const p = SJ.publicProfile();
    if (!p.id.n) { alert("Renseignez au moins votre nom."); return; }
    const url = location.origin + location.pathname.replace(/moi\.html$/, "") + "p.html#" + await SJ.pack(p);
    const box = $("#link"); box.hidden = false; box.value = url; box.select();
    try { await navigator.clipboard.writeText(url); } catch (e) {}
    const a = $("#preview"); a.hidden = false; a.href = url;
    alert("Lien copié. Longueur : " + url.length + " caractères — collez-le derrière un texte (« Mon portfolio »), pas en brut.");
  });

  /* ---- CRM ---- */
  const STATUTS = ["Envoyée", "Relancée", "Entretien 1", "Entretien 2", "Offre", "Refus", "Sans réponse"];
  function renderApps() {
    const tb = $("#apps tbody"); tb.innerHTML = "";
    D.apps.forEach((a, i) => {
      const tr = el(`<tr>
        <td><input type="date" class="dt"></td><td><input class="co" placeholder="Entreprise"></td><td><input class="po" placeholder="Poste"></td>
        <td><select class="st">${STATUTS.map(s => `<option>${s}</option>`).join("")}</select></td>
        <td><input class="no" placeholder="—"></td><td class="lien"></td><td><button class="del">✕</button></td></tr>`);
      tr.querySelector(".dt").value = a.date || ""; tr.querySelector(".co").value = a.co || ""; tr.querySelector(".po").value = a.po || "";
      tr.querySelector(".st").value = a.st || "Envoyée"; tr.querySelector(".no").value = a.note || "";
      if (a.u) tr.querySelector(".lien").innerHTML = `<a href="${esc(a.u)}" target="_blank" rel="noopener">voir</a>`;
      tr.addEventListener("input", () => { a.date = tr.querySelector(".dt").value; a.co = tr.querySelector(".co").value; a.po = tr.querySelector(".po").value; a.st = tr.querySelector(".st").value; a.note = tr.querySelector(".no").value; SJ.save(); });
      tr.querySelector(".del").addEventListener("click", () => { D.apps.splice(i, 1); SJ.save(); renderApps(); });
      tb.appendChild(tr);
    });
    $("#nApps").textContent = D.apps.length;
  }
  $("#addapp").addEventListener("click", () => { D.apps.unshift({ date: new Date().toISOString().slice(0, 10), co: "", po: "", st: "Envoyée", note: "", u: "" }); SJ.save(); renderApps(); });
  $("#csv").addEventListener("click", () => {
    const q = s => `"${String(s || "").replace(/"/g, '""')}"`;
    const csv = ["Date,Entreprise,Poste,Statut,Note,Lien"].concat(D.apps.map(a => [a.date, a.co, a.po, a.st, a.note, a.u].map(q).join(","))).join("\n");
    const b = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); const dl = document.createElement("a");
    dl.href = URL.createObjectURL(b); dl.download = "mes-candidatures.csv"; dl.click(); URL.revokeObjectURL(dl.href);
  });

  /* ---- export / import ---- */
  $("#exp").addEventListener("click", () => SJ.exportFile());
  $("#imp").addEventListener("change", async e => {
    if (!e.target.files[0]) return;
    try { await SJ.importFile(e.target.files[0]); location.reload(); } catch (err) { alert("Fichier illisible."); }
  });

  renderX(); renderF(); renderPr(); renderApps(); renderPrompt();
  const h = (location.hash || "").slice(1);
  if (h && $$(".tab").some(b => b.dataset.t === h)) $$(".tab").find(b => b.dataset.t === h).click();
})();
