(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const D = SJ.get();
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // une URL non http(s) ne doit jamais atterrir dans un href : « javascript: » s'exécuterait
  // dans le contexte du site et pourrait siphonner localStorage (profil, CV, candidatures)
  const safeUrl = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "#";
  const el = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };

  /* ---- onglets ---- */
  const ico = (nm, t) => window.trIcon ? window.trIcon(nm, t) : "";
  $$(".tr-sidenav a[data-t]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault();
    $$(".tr-sidenav a[data-t]").forEach(x => {
      if (x === b) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current");
    });
    $$(".spacemain > section").forEach(s => s.hidden = s.id !== "s-" + b.dataset.t);
    if (b.dataset.t === "saved") renderSaved();
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
    const c = el(`<div class="tr-card item">
      <div class="tr-card-head"><h3>Experience ${i + 1}</h3>
        <button type="button" class="tr-btn tr-btn-ghost tr-btn-sm del">Remove</button></div>
      <div class="tr-card-body">
      <div class="grid2">
        <label class="tr-field"><span class="tr-field-label">Company</span><input class="tr-input e" placeholder="Company name"></label>
        <label class="tr-field"><span class="tr-field-label">Job title</span><input class="tr-input t" placeholder="Business developer"></label>
        <label class="tr-field"><span class="tr-field-label">Dates</span><input class="tr-input d" placeholder="Nov 2025 – Jul 2026"></label>
      </div>
      <label class="tr-field" style="margin-top:var(--space-4)"><span class="tr-field-label">What you did — one line per fact, with a number where you have one</span>
        <textarea class="tr-input p" rows="5" placeholder="Signed 11 mandates in 9 months on a market with no clients and no pipeline&#10;Built the target lists from scratch, ran the outreach by email and LinkedIn"></textarea></label>
      </div></div>`);
    c.querySelector(".e").value = x.e || ""; c.querySelector(".t").value = x.t || ""; c.querySelector(".d").value = x.d || "";
    c.querySelector(".p").value = (x.p || []).join("\n");
    c.addEventListener("input", () => { x.e = c.querySelector(".e").value; x.t = c.querySelector(".t").value; x.d = c.querySelector(".d").value; x.p = c.querySelector(".p").value.split("\n").map(s => s.trim()).filter(Boolean); SJ.save(); });
    c.querySelector(".del").addEventListener("click", () => { D.x.splice(i, 1); SJ.save(); renderX(); });
    return c;
  }
  function renderX() { const w = $("#xs"); w.innerHTML = ""; D.x.forEach((x, i) => w.appendChild(xCard(x, i))); renderStart(); }
  $("#addx").addEventListener("click", () => { D.x.push({ e: "", t: "", d: "", p: [] }); SJ.save(); renderX(); });

  /* ---- formation ---- */
  function fCard(f, i) {
    const c = el(`<div class="tr-card item">
      <div class="tr-card-head"><h3>Qualification ${i + 1}</h3>
        <button type="button" class="tr-btn tr-btn-ghost tr-btn-sm del">Remove</button></div>
      <div class="tr-card-body"><div class="grid2">
      <label class="tr-field"><span class="tr-field-label">Title and school</span><input class="tr-input t" placeholder="MSc Entrepreneurship, Université de Caen"></label>
      <label class="tr-field"><span class="tr-field-label">Years</span><input class="tr-input d" placeholder="2023–2025"></label>
      </div></div></div>`);
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
  // chaque type de projet pose ses propres questions : se souvenir est plus facile qu'inventer
  const TY = {
    tool:     { t: "e.g. Weekly shift planner, Excel", pb: "What was slow, manual or going wrong before?", d: "What did you actually build, and with what?", res: "What changed — time saved, errors avoided, people using it" },
    outreach: { t: "e.g. Cold email sequence, 400 founders", pb: "Who were you trying to reach, and why was it hard?", d: "How did you build the list and the messages?", res: "Replies, meetings booked, deals — the numbers you remember" },
    event:    { t: "e.g. Student careers evening, 120 people", pb: "What was missing, and for whom?", d: "What did you organise, and what did you handle yourself?", res: "Turnout, feedback, what happened next" },
    data:     { t: "e.g. Churn analysis for a 30-person SaaS", pb: "What question was someone trying to answer?", d: "What data did you use, and how did you work it?", res: "What you found, and what was decided because of it" },
    process:  { t: "e.g. Rebuilt the onboarding checklist", pb: "What was breaking, and who felt it?", d: "What did you change?", res: "How you know it worked" },
    build:    { t: "e.g. Job board for VC-backed startups", pb: "What problem were you solving, for yourself or others?", d: "What did you build, with which tools?", res: "Users, traffic, or simply: it runs every day" },
    other:    { t: "Give it a short, concrete name", pb: "What was the problem?", d: "What did you do?", res: "What was the result?" }
  };
  function prCard(p, i) {
    const q = TY[p.ty] || TY.other;
    const c = el(`<div class="tr-card item">
      <div class="tr-card-head"><h3>Project ${i + 1}</h3>
        <button type="button" class="tr-btn tr-btn-ghost tr-btn-sm del">Remove</button></div>
      <div class="tr-card-body tr-stack" style="gap:var(--space-4)">
      <label class="tr-field"><span class="tr-field-label">Name</span><input class="tr-input t" placeholder="${esc(q.t)}"></label>
      <label class="tr-field"><span class="tr-field-label">The problem</span><textarea class="tr-input pb" rows="2" placeholder="${esc(q.pb)}"></textarea></label>
      <label class="tr-field"><span class="tr-field-label">What you did</span><textarea class="tr-input d" rows="3" placeholder="${esc(q.d)}"></textarea></label>
      <label class="tr-field"><span class="tr-field-label">The result</span><textarea class="tr-input res" rows="2" placeholder="${esc(q.res)}"></textarea></label>
      <div class="grid2">
        <label class="tr-field"><span class="tr-field-label">Proof link (optional)</span><input class="tr-input u" placeholder="https://github.com/… · notion.site/…"></label>
        <label class="tr-field"><span class="tr-field-label">Tools and keywords, comma separated</span><input class="tr-input k" placeholder="Excel, Apollo, Python"></label>
      </div>
      <div class="tr-callout tr-callout-warning warn" hidden><div class="tr-callout-body">Drive or Notion link: make sure it is open to anyone with the link, otherwise the recruiter just sees an access request.</div></div>
      </div></div>`);
    const g = sel => c.querySelector(sel);
    g(".t").value = p.t || ""; g(".pb").value = p.pb || ""; g(".d").value = p.d || ""; g(".res").value = p.res || "";
    g(".u").value = p.u || ""; g(".k").value = (p.k || []).join(", ");
    const warn = c.querySelector(".warn"); const chk = () => warn.hidden = !/drive\.google|docs\.google|notion\.(so|site)|dropbox/i.test(g(".u").value);
    chk();
    c.addEventListener("input", () => {
      p.t = g(".t").value; p.pb = g(".pb").value; p.d = g(".d").value; p.res = g(".res").value;
      p.u = g(".u").value.trim(); p.k = g(".k").value.split(",").map(x => x.trim()).filter(Boolean);
      chk(); SJ.save(); renderPreview();
    });
    c.querySelector(".del").addEventListener("click", () => { D.pr.splice(i, 1); SJ.save(); renderPr(); });
    return c;
  }
  function renderPr() { const w = $("#prs"); w.innerHTML = ""; D.pr.forEach((p, i) => w.appendChild(prCard(p, i))); renderStart(); renderPreview(); }
  function addProject(ty) {
    D.pr.push({ t: "", pb: "", d: "", res: "", u: "", k: [], ty: ty || "other" }); SJ.save(); renderPr();
    const last = $("#prs").lastElementChild;
    if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); const f = last.querySelector(".t"); if (f) setTimeout(() => f.focus(), 250); }
  }
  $("#addpr").addEventListener("click", () => addProject("other"));
  $$("#triggers .tr-chip").forEach(b => b.addEventListener("click", () => addProject(b.dataset.ty)));

  /* ---- aperçu de la page publique : la contrepartie, visible pendant qu'on écrit ---- */
  function renderPreview() {
    const done = D.pr.filter(p => (p.t || "").trim());
    $("#prev-block").hidden = !done.length;
    $("#prev").innerHTML = done.map(p => {
      const body = [p.pb, p.d, p.res].map(v => (v || "").trim()).filter(Boolean).join(" ");
      return `<div class="pcard"><h3>${esc(p.t)}</h3>${body ? `<p>${esc(body)}</p>` : `<p class="todo">No description yet — a name alone tells a recruiter nothing.</p>`}` +
        (p.u ? `<a href="${esc(safeUrl(p.u))}" target="_blank" rel="noopener">${esc(p.u.replace(/^https?:\/\//, "").slice(0, 46))} →</a>` : `<span class="todo">No proof link</span>`) +
        ((p.k || []).length ? `<div class="chips">${p.k.map(k => `<span class="tag">${esc(k)}</span>`).join("")}</div>` : "") + `</div>`;
    }).join("");
  }

  /* ---- CV : texte pour l'IA ---- */
  const cvRaw = $("#cvraw"); cvRaw.value = D.cv || "";
  function renderPrompt() {
    const raw = cvRaw.value.trim();
    $("#prompt").textContent = SJ.promptText($("#offre").value.trim(), raw);
    const bank = D.x.length || D.pr.length || D.s.length;
    const src = bank && raw ? "Using your profile and the CV you pasted."
      : bank ? "Using the facts saved in your profile."
      : raw ? "Using the CV you pasted."
      : "No facts yet — paste your CV above, or fill in your profile.";
    $("#cv-src").textContent = src;
    const np = $("#cv-noprofile"); if (np) np.hidden = !!bank;
  }
  cvRaw.addEventListener("input", () => { D.cv = cvRaw.value; SJ.save(); renderPrompt(); });

  /* ---- dépôt du CV : lecture locale, aucun envoi ---- */
  const drop = $("#drop"), fileIn = $("#cvfile"), dmsg = $("#dropmsg"), cvText = $("#cvtext");
  const say = (t, bad) => { dmsg.hidden = false; dmsg.textContent = t; dmsg.classList.toggle("bad", !!bad); };
  async function takeFile(f) {
    if (!f) return;
    say("Reading " + f.name + "…");
    try {
      const txt = await CVFile.read(f);
      // le texte lu sert uniquement à alimenter le profil : il ne part pas aussi comme « CV brut »
      cvText.value = txt; $("#cvtext-wrap").hidden = false;
      say(f.name + " — " + txt.split(/\s+/).filter(Boolean).length + " words read. Now turn it into structured facts below.");
      $("#bankbox").open = true;
    } catch (e) { say(e.message || "Could not read that file.", true); }
  }
  drop.addEventListener("click", () => fileIn.click());
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener("change", e => takeFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => takeFile(e.dataTransfer.files[0]));

  /* ---- aller-retour JSON : l'IA structure, on importe ---- */
  $("#bank-copy").addEventListener("click", async () => {
    const txt = SJ.extractPrompt((cvText.value || cvRaw.value).trim());
    try { await navigator.clipboard.writeText(txt); } catch (e) { alert(txt); }
    const ok = $("#bank-copied"); ok.hidden = false; setTimeout(() => ok.hidden = true, 2200);
  });
  $("#bank-apply").addEventListener("click", () => {
    const msg = $("#bank-msg"); msg.hidden = false; msg.classList.remove("bad");
    try {
      const n = SJ.importProfile($("#bank-json").value, $("#bank-append").checked ? "append" : "replace");
      renderX(); renderF(); renderPr(); renderStart();
      const sIn2 = $("#i-s"); if (sIn2) sIn2.value = (D.s || []).join("\n");
      Object.entries({ "i-n": "n", "i-h": "h", "i-mail": "mail", "i-li": "li", "i-site": "site" }).forEach(([id, k]) => { const el2 = document.getElementById(id); if (el2) el2.value = D.id[k] || ""; });
      renderPrompt();
      // le CV brut a servi, le profil fait désormais foi : on évite la double source
      cvText.value = ""; $("#cvtext-wrap").hidden = true;
      if (D.cv) { D.cv = ""; cvRaw.value = ""; SJ.save(); }
      msg.textContent = `Profile filled: ${n.x} experience(s), ${n.f} qualification(s), ${n.pr} project(s), ${n.s} skill(s). Read through it below — an AI can misread a date or merge two jobs.`;
      $("#bank-json").value = "";
    } catch (e) { msg.textContent = e.message; msg.classList.add("bad"); }
  });
  $("#offre").addEventListener("input", renderPrompt);
  $("#copy").addEventListener("click", async () => {
    const txt = SJ.promptText($("#offre").value.trim(), cvRaw.value.trim());
    try { await navigator.clipboard.writeText(txt); } catch (e) { const t = $("#prompt"); t.hidden = false; const r = document.createRange(); r.selectNode(t); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy"); }
    const ok = $("#copied"); ok.hidden = false; setTimeout(() => ok.hidden = true, 2200);
  });

  /* ---- lien partageable ---- */
  $("#mklink").addEventListener("click", async () => {
    const p = SJ.publicProfile();
    if (!p.id.n) { alert("Add your name first."); return; }
    const url = location.origin + location.pathname.replace(/moi\/?(index\.html)?$/, "") + "p/#" + await SJ.pack(p);
    const box = $("#link"); box.hidden = false; box.value = url; box.select();
    try { await navigator.clipboard.writeText(url); } catch (e) {}
    const a = $("#preview"); a.hidden = false; a.href = url;
    alert("Lien copié. Longueur : " + url.length + " caractères — collez-le derrière un texte (« Mon portfolio »), pas en brut.");
  });

  /* ---- CRM ---- */
  const STATUTS = SJ.STAGES.concat(SJ.TERMINAL);
  /* Table des candidatures : composant DataTable du système. Les onglets filtrent
     (All / Active / Follow-up due / Closed), le champ cherche, le select trie. */
  let appFiltre = "all", appTri = "date";
  const CLOS = new Set(["Rejected", "Closed", "Offer"]);
  function appsVisibles() {
    const q = ($("#appq").value || "").trim().toLowerCase();
    const dus = new Set(SJ.funnel().followUps.map(a => a.date + "|" + a.co + "|" + a.po));
    let r = D.apps.filter(a => {
      if (q && !((a.co || "") + " " + (a.po || "")).toLowerCase().includes(q)) return false;
      if (appFiltre === "closed") return CLOS.has(a.st);
      if (appFiltre === "active") return !CLOS.has(a.st);
      if (appFiltre === "followup") return dus.has(a.date + "|" + a.co + "|" + a.po);
      return true;
    });
    if (appTri === "co") r = [...r].sort((x, y) => (x.co || "").localeCompare(y.co || ""));
    else if (appTri === "st") r = [...r].sort((x, y) => (x.st || "").localeCompare(y.st || ""));
    else r = [...r].sort((x, y) => (y.date || "").localeCompare(x.date || ""));
    return r;
  }
  function compteursOnglets() {
    const dus = SJ.funnel().followUps.length;
    const clos = D.apps.filter(a => CLOS.has(a.st)).length;
    const m = { all: D.apps.length, active: D.apps.length - clos, followup: dus, closed: clos };
    $$("#apptabs [data-c]").forEach(e => { e.textContent = m[e.dataset.c] || 0; });
  }
  function renderApps() {
    const tb = $("#apps tbody"); tb.innerHTML = "";
    const vus = appsVisibles();
    vus.forEach(a => {
      const i = D.apps.indexOf(a);
      const tr = el(`<tr>
        <td><input type="date" class="tr-input dt"></td>
        <td class="cellrole"><div class="tr-cell-main"><span class="tr-mark tr-mark-sm mk"></span>
          <div><input class="tr-input po" placeholder="Role"><input class="tr-input co" placeholder="Company"></div></div></td>
        <td><select class="tr-select st">${STATUTS.map(s2 => `<option>${s2}</option>`).join("")}</select></td>
        <td class="max"></td>
        <td><input class="tr-input no" placeholder="—"></td>
        <td class="lien"><input class="tr-input lk" type="url" placeholder="https://…"><a class="go tr-btn tr-btn-ghost tr-btn-sm" target="_blank" rel="noopener" hidden>open</a></td>
        <td class="r"><button type="button" class="tr-iconbtn tr-iconbtn-sm del" aria-label="Remove"></button></td></tr>`);
      tr.querySelector(".del").innerHTML = ico("x", 16);
      tr.querySelector(".dt").value = a.date || ""; tr.querySelector(".co").value = a.co || ""; tr.querySelector(".po").value = a.po || "";
      tr.querySelector(".st").value = a.st || "Applied"; tr.querySelector(".no").value = a.note || "";
      const majMk = () => {
        const w = String(a.co || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
        tr.querySelector(".mk").textContent =
          (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
      };
      majMk();
      const majMax = () => { tr.querySelector(".max").innerHTML = badge(a); };
      majMax();
      const lk = tr.querySelector(".lk"), go = tr.querySelector(".go");
      const syncLink = () => { const v = safeUrl(a.u); go.hidden = v === "#"; if (v !== "#") go.href = v; };
      lk.value = a.u || ""; syncLink();
      tr.addEventListener("input", e => {
        a.date = tr.querySelector(".dt").value; a.co = tr.querySelector(".co").value; a.po = tr.querySelector(".po").value; a.note = tr.querySelector(".no").value;
        a.u = lk.value.trim(); syncLink(); majMk();
        const st = tr.querySelector(".st").value;
        if (st !== a.st) { SJ.setStatus(a, st); majMax(); }
        SJ.save(); if (e.target.classList.contains("st")) { renderBoard(); compteursOnglets(); }
      });
      tr.querySelector(".del").addEventListener("click", () => { D.apps.splice(i, 1); SJ.save(); renderApps(); renderBoard(); });
      tb.appendChild(tr);
    });
    $("#apps-empty").hidden = vus.length > 0;
    $("#apps").hidden = vus.length === 0;
    $("#nApps").textContent = D.apps.length;
    compteursOnglets();
    renderStart();
  }
  $$("#apptabs .tr-tab").forEach(b => b.addEventListener("click", () => {
    appFiltre = b.dataset.f;
    $$("#apptabs .tr-tab").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
    renderApps();
  }));
  $("#appq").addEventListener("input", renderApps);
  $("#appsort").addEventListener("change", () => { appTri = $("#appsort").value; renderApps(); });

  $("#addapp").addEventListener("click", () => { const t = new Date().toISOString().slice(0, 10); D.apps.unshift({ date: t, co: "", po: "", st: "Applied", max: 0, last: t, note: "", u: "" }); SJ.save(); renderApps(); renderBoard(); });
  $("#csv").addEventListener("click", () => {
    const q = s => `"${String(s || "").replace(/"/g, '""')}"`;
    const csv = ["Date,Company,Role,Status,Furthest stage,Note,Link"].concat(D.apps.map(a => [a.date, a.co, a.po, a.st, SJ.STAGES[a.max || 0], a.note, a.u].map(q).join(","))).join("\n");
    const b = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); const dl = document.createElement("a");
    dl.href = URL.createObjectURL(b); dl.download = "mes-candidatures.csv"; dl.click(); URL.revokeObjectURL(dl.href);
  });

  /* ---- tableau de bord ---- */
  const TONS = { Applied: "neutral", "Follow-up due": "warning", Interview: "brand",
                 Offer: "success", Rejected: "danger", Closed: "outline" };
  const badge = a => ((a.max || 0) >= 2 && a.st !== SJ.STAGES[a.max])
    ? `<span class="tr-badge tr-badge-${TONS[SJ.STAGES[a.max]] || "outline"} tr-badge-dot">${esc(SJ.STAGES[a.max])}</span>`
    : "";
  function renderBoard() {
    const f = SJ.funnel();
    $("#b-empty").hidden = f.sent > 0;
    $("#b-data").hidden = f.sent === 0;
    if (!f.sent) return;
    // composant Pipeline : une barre proportionnelle puis la légende chiffrée
    const PIPE = [["applied", "Applied", "var(--viz-3)"], ["followup", "Follow-up due", "var(--warning)"],
                  ["interview", "Interview", "var(--night)"], ["offer", "Offer", "var(--success)"],
                  ["rejected", "Rejected", "var(--danger)"]];
    const dus = f.followUps.length;
    const parStatut = { applied: 0, followup: dus, interview: 0, offer: 0, rejected: 0 };
    D.apps.forEach(a => {
      if (a.st === "Rejected") parStatut.rejected++;
      else if (a.st === "Offer") parStatut.offer++;
      else if (a.st === "Interview") parStatut.interview++;
      else parStatut.applied++;
    });
    parStatut.applied = Math.max(0, parStatut.applied - dus);
    const tot = PIPE.reduce((t, p) => t + parStatut[p[0]], 0) || 1;
    $("#funnel").innerHTML =
      `<div class="tr-pipe-bar" role="img" aria-label="${PIPE.map(p => p[1] + " " + parStatut[p[0]]).join(", ")}">`
      + PIPE.filter(p => parStatut[p[0]]).map(p =>
          `<span style="flex:${parStatut[p[0]]};background:${p[2]}"></span>`).join("")
      + `</div><ul class="tr-pipe-legend">`
      + PIPE.map(p => `<li><span><i style="background:${p[2]}"></i>${p[1]}</span><b>${parStatut[p[0]]}</b></li>`).join("")
      + `</ul>`;
    $("#pipe-total").textContent = `${f.sent} total`;
    $("#s-week").textContent = f.week; $("#s-month").textContent = f.month; $("#s-wait").textContent = f.waiting;
    $("#s-month-foot").textContent = f.replied
      ? `${f.replied} replied · ${f.replyRate}% reply rate` : "no reply yet";
    $("#s-wait-foot").textContent = dus ? `${dus} worth a follow-up` : "nothing overdue";
    $("#s-week-foot").textContent = f.interviews
      ? `${f.interviews} reached an interview (${f.interviewRate}%)` : "";
    const fu = f.followUps.slice(0, 12);
    $("#fu-block").hidden = !fu.length;
    $("#fu").innerHTML = fu.map(a => {
      const d = Math.round((Date.now() - new Date(a.date).getTime()) / 864e5);
      const w = String(a.co || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
      const ini = (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
      const lien = a.u ? `<a href="${esc(safeUrl(a.u))}" target="_blank" rel="noopener">${esc(a.po || "—")}</a>`
                       : esc(a.po || "—");
      return `<tr><td><div class="tr-cell-main">`
           + `<span class="tr-mark tr-mark-sm" aria-hidden="true">${esc(ini)}</span>`
           + `<div><strong>${lien}</strong><small>${esc(a.co || "")}</small></div></div></td>`
           + `<td><span class="tr-num">${esc(a.date || "—")}</span></td>`
           + `<td><span class="tr-badge tr-badge-warning tr-badge-dot">${d} days</span></td></tr>`;
    }).join("");
  }

  /* ---- offres enregistrées : elles vivent dans le même navigateur, on les montre ici ---- */
  function renderSaved() {
    let sv = [];
    try { sv = JSON.parse(localStorage.getItem("sj.saved") || "[]"); } catch (e) {}
    const box = $("#savedlist"), vide = $("#saved-empty");
    $("#nSaved").textContent = sv.length;
    vide.hidden = sv.length > 0; box.hidden = sv.length === 0;
    if (!sv.length) { box.innerHTML = ""; return; }
    box.innerHTML = sv.slice().reverse().map(r => {
      const w = String(r.s || "?").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
      const ini = (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
      const loc = r.v && r.p ? `${r.v}, ${r.p}` : (r.p || r.l || "");
      return `<article class="tr-jobrow">`
        + `<span class="tr-mark tr-mark-md" aria-hidden="true">${esc(ini)}</span>`
        + `<div class="tr-jobrow-main">`
        + `<a class="tr-jobrow-title" href="${esc(safeUrl(r.u))}" target="_blank" rel="noopener">${esc(r.t || "")}</a>`
        + `<div class="tr-jobrow-meta"><span class="tr-jobrow-company">${esc(r.s || "")}</span>`
        + (loc ? `<span>${ico("map-pin", 14)}${esc(loc)}</span>` : "") + `</div></div>`
        + `<div class="tr-jobrow-side"><button type="button" class="tr-btn tr-btn-secondary tr-btn-sm log"`
        + ` data-co="${esc(r.s || "")}" data-po="${esc(r.t || "")}" data-u="${esc(safeUrl(r.u))}">Log it</button></div>`
        + `</article>`;
    }).join("");
  }
  // depuis une offre enregistrée : on crée la candidature et on bascule sur la table
  document.addEventListener("click", e => {
    const b = e.target.closest("#savedlist .log"); if (!b) return;
    SJ.addApp({ co: b.dataset.co, po: b.dataset.po, u: b.dataset.u });
    renderApps(); renderBoard();
    const t = $$(".tr-sidenav a[data-t]").find(x => x.dataset.t === "crm"); if (t) t.click();
  });

  /* ---- checklist de démarrage : disparaît quand les trois sont faits ---- */
  function renderStart() {
    const done = { x: D.x.length > 0, pr: D.pr.length > 0, apps: D.apps.length > 0 };
    const all = done.x && done.pr && done.apps;
    $("#start").hidden = all;
    $$("#start .startitem").forEach(b => b.classList.toggle("done", !!done[b.dataset.s]));
    const pr = $("#nPr"); if (pr) pr.textContent = D.pr.length;
  }
  // les liens de la checklist et de l'avertissement ouvrent le bon onglet
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-go]"); if (!a) return;
    e.preventDefault(); const t = $$(".tr-sidenav a[data-t]").find(b => b.dataset.t === a.dataset.go); if (t) t.click();
  });
  const allerA = k => { const b = $$(".tr-sidenav a[data-t]").find(x => x.dataset.t === k); if (b) b.click(); };
  $$("#start .startitem").forEach(b => b.addEventListener("click", () =>
    allerA({ x: "profil", pr: "projets", apps: "crm" }[b.dataset.s])));
  // les deux boutons d'en-tête de l'écran Overview
  const gcv = $("#go-cv"); if (gcv) gcv.addEventListener("click", () => allerA("cv"));
  const aa2 = $("#addapp2"); if (aa2) aa2.addEventListener("click", () => { $("#addapp").click(); allerA("crm"); });
  // le second bouton « Get my link », en bas de l'écran Profile
  const ml2 = $("#mklink2"); if (ml2) ml2.addEventListener("click", () => $("#mklink").click());
  // la bascule de thème de l'écran Backup, synchronisée avec celle de la barre
  const dp = $("#darkpref");
  if (dp) {
    const sombre = () => document.documentElement.getAttribute("data-theme") === "dark"
      || (!document.documentElement.getAttribute("data-theme")
          && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    dp.checked = sombre();
    dp.addEventListener("change", () => { const t = $("#theme"); if (t) t.click(); });
  }

  /* ---- export / import ---- */
  $("#exp").addEventListener("click", () => SJ.exportFile());
  $("#imp").addEventListener("change", async e => {
    if (!e.target.files[0]) return;
    try { await SJ.importFile(e.target.files[0]); location.reload(); } catch (err) { alert("Fichier illisible."); }
  });

  // arrivée depuis le job board : l'offre est déjà identifiée, on amorce le champ
  try {
    const j = JSON.parse(sessionStorage.getItem("sj.cvjob") || "null");
    if (j) {
      sessionStorage.removeItem("sj.cvjob");
      if (!$("#offre").value.trim())
        $("#offre").value = `${j.po || ""}\n${j.co || ""}${j.l ? " — " + j.l : ""}${j.u ? "\n" + j.u : ""}\n\n(paste the full job description here)`;
      const t = $$(".tr-sidenav a[data-t]").find(b => b.dataset.t === "cv"); if (t) t.click();
    }
  } catch (e) {}

  renderX(); renderF(); renderPr(); renderApps(); renderPrompt(); renderBoard(); renderStart(); renderSaved();
  const h = (location.hash || "").slice(1);
  if (h && $$(".tr-sidenav a[data-t]").some(b => b.dataset.t === h))
    $$(".tr-sidenav a[data-t]").find(b => b.dataset.t === h).click();
})();
