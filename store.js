/* Local storage only: profile, projects, applications. Nothing leaves the browser.
   Encodage/décodage du profil partageable dans l'URL (deflate + base64url). */
window.SJ = (() => {
  const KEY = "sj.v1";
  /* Étapes d'une candidature. `st` = où ça en est, `max` = le plus loin jamais atteint.
     Les deux sont nécessaires : un refus après entretien reste un entretien obtenu, et ne doit
     pas disparaître des statistiques quand le statut passe à « Rejected ». */
  const STAGES = ["Applied", "Followed up", "Interview 1", "Interview 2", "Final interview", "Offer"];
  const TERMINAL = ["Rejected", "No reply"];
  const RANK = Object.fromEntries(STAGES.map((s, i) => [s, i]));
  const empty = () => ({ id: { n: "", h: "", mail: "", li: "", site: "" }, x: [], pr: [], f: [], s: [], apps: [], cv: "" });
  let data = null;
  function load() {
    if (data) return data;
    try { data = Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { data = empty(); }
    for (const k of ["x", "pr", "f", "s", "apps"]) if (!Array.isArray(data[k])) data[k] = [];
    // migration : les candidatures d'avant n'ont pas de `max` — on le déduit du statut courant
    let dirty = false;
    data.pr.forEach(x => { if (x.pb === undefined) { x.pb = ""; x.res = ""; dirty = true; } });
    data.apps.forEach(a => {
      if (a.max === undefined) { a.max = RANK[a.st] !== undefined ? RANK[a.st] : 0; dirty = true; }
      if (!a.last) { a.last = a.date || ""; dirty = true; }
    });
    if (dirty) try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    return data;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { alert("Sauvegarde impossible : espace de stockage plein ou navigation privée."); } return data; }
  const u8b64 = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64u8 = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); const b = atob(s); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (!("CompressionStream" in window)) return "r" + u8b64(bytes);
    const cs = new CompressionStream("deflate-raw");
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
    return "d" + u8b64(new Uint8Array(buf));
  }
  async function unpack(str) {
    const kind = str[0], body = b64u8(str.slice(1));
    if (kind === "r") return JSON.parse(new TextDecoder().decode(body));
    const ds = new DecompressionStream("deflate-raw");
    const buf = await new Response(new Blob([body]).stream().pipeThrough(ds)).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(buf));
  }
  /* À appeler à chaque changement de statut : met à jour le plus loin atteint et la date d'action. */
  function setStatus(a, st) {
    a.st = st;
    const r = RANK[st];
    if (r !== undefined && r > (a.max || 0)) a.max = r;
    a.last = new Date().toISOString().slice(0, 10);
    return a;
  }

  return {
    get: () => load(), save, STAGES, TERMINAL, RANK, setStatus,
    /* Entonnoir. Une réponse = l'entreprise s'est manifestée (entretien atteint, offre, ou refus explicite).
       « No reply » et « Applied » ne comptent pas comme une réponse. */
    funnel() {
      const d = load(), A = d.apps;
      const reached = (a, r) => (a.max || 0) >= r;
      const replied = a => reached(a, 2) || a.st === "Rejected" || a.st === "Offer";
      const f = {
        sent: A.length,
        replied: A.filter(replied).length,
        interviews: A.filter(a => reached(a, 2)).length,
        offers: A.filter(a => reached(a, 5)).length,
        rejected: A.filter(a => a.st === "Rejected").length,
        waiting: A.filter(a => !replied(a) && a.st !== "No reply").length
      };
      f.replyRate = f.sent ? Math.round(100 * f.replied / f.sent) : 0;
      f.interviewRate = f.sent ? Math.round(100 * f.interviews / f.sent) : 0;
      // relances : toujours au stade « Applied », envoyées il y a plus de 10 jours
      const lim = Date.now() - 10 * 864e5;
      f.followUps = A.filter(a => (a.max || 0) === 0 && a.st === "Applied" && a.date && new Date(a.date).getTime() < lim);
      // activité
      const w = Date.now() - 7 * 864e5, m = Date.now() - 30 * 864e5;
      f.week = A.filter(a => a.date && new Date(a.date).getTime() >= w).length;
      f.month = A.filter(a => a.date && new Date(a.date).getTime() >= m).length;
      return f;
    },
    reset() { data = empty(); save(); },
    // profil public = tout sauf les candidatures (privées)
    publicProfile() { const d = load(); return { id: d.id, x: d.x, pr: d.pr, f: d.f, s: d.s }; },
    pack, unpack,
    exportFile() {
      const blob = new Blob([JSON.stringify(load(), null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `mon-profil-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    },
    async importFile(file) {
      const t = JSON.parse(await file.text()); data = Object.assign(empty(), t);
      for (const k of ["x", "pr", "f", "s", "apps"]) if (!Array.isArray(data[k])) data[k] = [];
      return save();
    },
    addApp(app) {
      const d = load();
      if (d.apps.some(a => a.u === app.u)) return false;
      const today = new Date().toISOString().slice(0, 10);
      d.apps.unshift(Object.assign({ date: today, st: "Applied", max: 0, last: today, note: "" }, app)); save(); return true;
    },
    /* Second aller-retour : on fait structurer le CV par l'IA, la personne recolle le JSON. */
    extractPrompt(raw) {
      return [
        "Read the CV below and return ONLY a JSON object, with no commentary, no markdown fence, nothing else.",
        "Use only what the CV actually says. Invent nothing. Leave a field as an empty string if the CV does not give it.",
        "Shape:",
        '{"id":{"n":"full name","h":"one-line headline","mail":"","li":"linkedin url","site":""},',
        ' "x":[{"e":"employer","t":"job title","d":"dates as written","p":["one bullet per verifiable fact, keep the numbers exactly as written"]}],',
        ' "f":[{"t":"qualification and school","d":"years"}],',
        ' "pr":[{"t":"project name","d":"what it was and the result","u":"link if any","k":["tool","tool"]}],',
        ' "s":["one skill or tool per entry"]}',
        "Keep the original language of the CV for the content. Order experiences most recent first.",
        "",
        "=== CV ===",
        raw || "(paste your CV)"
      ].join("\n");
    },
    /* Import du JSON recollé : on ne garde que la forme attendue, et on borne tout. */
    importProfile(text, mode) {
      let o;
      const m = String(text || "").match(/\{[\s\S]*\}/);
      if (!m) throw new Error("No JSON object found in what you pasted.");
      try { o = JSON.parse(m[0]); } catch (e) { throw new Error("That is not valid JSON — copy the AI answer again, without any extra text."); }
      const str = (v, n) => typeof v === "string" ? v.trim().slice(0, n || 300) : "";
      const arr = (v, f, max) => Array.isArray(v) ? v.slice(0, max).map(f).filter(Boolean) : [];
      const clean = {
        id: { n: str(o.id && o.id.n, 120), h: str(o.id && o.id.h, 160), mail: str(o.id && o.id.mail, 160), li: str(o.id && o.id.li, 200), site: str(o.id && o.id.site, 200) },
        x: arr(o.x, e => e && (str(e.e, 160) || str(e.t, 160)) ? { e: str(e.e, 160), t: str(e.t, 160), d: str(e.d, 80), p: arr(e.p, b => str(b, 400), 20) } : null, 20),
        f: arr(o.f, e => e && str(e.t, 220) ? { t: str(e.t, 220), d: str(e.d, 60) } : null, 12),
        pr: arr(o.pr, e => e && str(e.t, 160) ? { t: str(e.t, 160), d: str(e.d, 900), u: str(e.u, 300), k: arr(e.k, k => str(k, 50), 12) } : null, 12),
        s: arr(o.s, k => str(k, 120), 40)
      };
      if (!clean.x.length && !clean.f.length && !clean.s.length && !clean.pr.length) throw new Error("Nothing usable in that JSON — no experience, education, projects or skills.");
      const d = load();
      if (mode === "append") {
        d.x = d.x.concat(clean.x); d.f = d.f.concat(clean.f); d.pr = d.pr.concat(clean.pr);
        d.s = [...new Set(d.s.concat(clean.s))];
        Object.keys(clean.id).forEach(k => { if (!d.id[k]) d.id[k] = clean.id[k]; });
      } else {
        d.x = clean.x; d.f = clean.f; d.pr = clean.pr; d.s = clean.s;
        Object.keys(clean.id).forEach(k => { if (clean.id[k]) d.id[k] = clean.id[k]; });
      }
      save();
      return { x: clean.x.length, f: clean.f.length, pr: clean.pr.length, s: clean.s.length };
    },
    // texte prêt à coller dans une IA — fonctionne avec la banque de faits, avec un CV collé, ou les deux
    promptText(offre, cvraw) {
      const d = load(), L = [];
      const hasBank = d.x.length || d.pr.length || d.s.length;
      const raw = (cvraw !== undefined ? cvraw : d.cv || "").trim();
      L.push("You are writing a one-page CV, tailored to one job ad, readable by applicant tracking software and convincing to a human in 8 seconds.");
      L.push("HARD RULE: use only the facts given below. Invent no number, no responsibility, no tool, no employer. You may rephrase to match the wording of the job ad, never inflate. If a fact is missing, leave it out rather than guessing.");
      if (raw && !hasBank) L.push("The facts come from the CV pasted below: read it, extract the verifiable facts, then rebuild a CV targeted at this job ad.");
      else if (raw && hasBank) L.push("Two sources below: a structured fact bank and a pasted CV. Use both, and prefer the fact bank where they disagree.");
      L.push("Structure: summary (3 sentences, 45-60 words: who I am plus one quantified result; my skills plus tools; the role I am going for and what I bring) - key skills (6 lines reusing the exact words of the ad) - experience (bullets selected and reordered for this ad) - education - tools and languages.");
      L.push("Write in the language of the job ad. No job title in the header. Never use results-driven, passionate, or proven track record.");
      if (hasBank) {
        L.push("\n=== MY FACT BANK ===");
        if (d.id.n) L.push(`Name: ${d.id.n}${d.id.h ? " - " + d.id.h : ""}`);
        if (d.id.mail || d.id.li) L.push(`Contact: ${[d.id.mail, d.id.li, d.id.site].filter(Boolean).join(" - ")}`);
        d.x.forEach(x => { L.push(`\nExperience - ${x.e || "?"} - ${x.t || ""} - ${x.d || ""}`); (x.p || []).forEach(p => L.push("- " + p)); });
        if (d.pr.length) { L.push("\nProjects:"); d.pr.forEach(p => { const body = [p.pb, p.d, p.res].map(v => (v || "").trim()).filter(Boolean).join(" ").trim(); L.push(`- ${p.t}: ${body}${p.u ? " (" + p.u + ")" : ""}${(p.k || []).length ? " [" + p.k.join(", ") + "]" : ""}`); }); }
        if (d.f.length) { L.push("\nEducation:"); d.f.forEach(f => L.push(`- ${f.t} (${f.d})`)); }
        if (d.s.length) L.push("\nSkills and tools: " + d.s.join(" - "));
      }
      if (raw) { L.push("\n=== MY CURRENT CV ==="); L.push(raw); }
      if (!hasBank && !raw) L.push("\n=== MY FACTS ===\n(paste your current CV above, or fill in your profile - without facts this prompt produces nothing usable)");
      L.push("\n=== THE JOB AD ===");
      L.push(offre || "(paste the job title, the company and the full description here)");
      return L.join("\n");
    }
  };
})();
