/* Stockage local : profil, projets, candidatures. Rien ne quitte le navigateur.
   Encodage/décodage du profil partageable dans l'URL (deflate + base64url). */
window.SJ = (() => {
  const KEY = "sj.v1";
  const empty = () => ({ id: { n: "", h: "", mail: "", li: "", site: "" }, x: [], pr: [], f: [], s: [], apps: [] });
  let data = null;
  function load() {
    if (data) return data;
    try { data = Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { data = empty(); }
    for (const k of ["x", "pr", "f", "s", "apps"]) if (!Array.isArray(data[k])) data[k] = [];
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
  return {
    get: () => load(), save,
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
      d.apps.unshift(Object.assign({ date: new Date().toISOString().slice(0, 10), st: "Envoyée", note: "" }, app)); save(); return true;
    },
    // texte prêt à coller dans une IA
    promptText(offre) {
      const d = load(), L = [];
      L.push("Tu composes un CV d'une page, optimisé pour les logiciels de recrutement (ATS) et lisible par un humain en 8 secondes.");
      L.push("RÈGLE ABSOLUE : n'utilise que les faits ci-dessous. N'invente aucun chiffre, aucune mission, aucun outil. Tu peux reformuler pour coller au vocabulaire de l'offre, jamais exagérer.");
      L.push("Structure : profil (3 phrases, 45-60 mots : qui je suis + un résultat chiffré ; mes compétences + outils ; le poste visé et ce que j'apporte) — compétences clés (6 lignes reprenant les mots exacts de l'offre) — expériences (puces choisies et réordonnées selon l'offre) — formation — outils et langues.");
      L.push("Écris dans la langue de l'offre. Pas de titre de poste en en-tête. Pas de « results-driven », « passionné », « proven track record ».");
      L.push("\n=== MES FAITS ===");
      if (d.id.n) L.push(`Nom : ${d.id.n}${d.id.h ? " — " + d.id.h : ""}`);
      if (d.id.mail || d.id.li) L.push(`Contact : ${[d.id.mail, d.id.li, d.id.site].filter(Boolean).join(" · ")}`);
      d.x.forEach(x => { L.push(`\nExpérience — ${x.e || "?"} · ${x.t || ""} · ${x.d || ""}`); (x.p || []).forEach(p => L.push("- " + p)); });
      if (d.pr.length) { L.push("\nProjets :"); d.pr.forEach(p => L.push(`- ${p.t} : ${p.d}${p.u ? " (" + p.u + ")" : ""}${(p.k || []).length ? " [" + p.k.join(", ") + "]" : ""}`)); }
      if (d.f.length) { L.push("\nFormation :"); d.f.forEach(f => L.push(`- ${f.t} (${f.d})`)); }
      if (d.s.length) L.push("\nCompétences et outils : " + d.s.join(" · "));
      L.push("\n=== L'OFFRE ===");
      L.push(offre || "(colle ici l'intitulé, l'entreprise et la description complète de l'offre)");
      return L.join("\n");
    }
  };
})();
