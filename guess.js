/* « Guess what this pays » — cinq vraies offres, tu devines, on révèle.
 *
 * La fourchette affichée est celle que l'entreprise a publiée elle-même sur sa
 * propre page carrières. Le jeu ne note personne et ne compare rien : il montre
 * un chiffre public que quatre offres sur cinq ne donnent pas.
 *
 * Tout tourne dans le navigateur, sur data/guess.json. Aucun compte, aucun envoi.
 */
(function () {
  const $ = s => document.querySelector(s);
  const scene = $("#gg");
  if (!scene) return;

  const TOURS = 5;
  const SIGNE = { USD: "$", EUR: "€", GBP: "£" };
  let JEU = [], tirage = [], tour = 0, notes = [];

  const fmt = (n, c) => SIGNE[c] + Math.round(n / 1000) + "k";
  const esc = t => String(t).replace(/[&<>"]/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

  /* la note se joue sur le milieu de la fourchette : viser une borne précise
     relèverait de la chance, pas du jugement */
  function note(guess, o) {
    const mid = (o.lo + o.hi) / 2;
    const e = Math.abs(guess - mid) / mid;
    if (guess >= o.lo && guess <= o.hi) return ["🟩", "Inside the range", e];
    if (e <= 0.15) return ["🟩", "Within 15%", e];
    if (e <= 0.30) return ["🟨", "Within 30%", e];
    if (e <= 0.50) return ["🟧", "Within 50%", e];
    return ["⬜", "Way off", e];
  }

  function intro() {
    scene.innerHTML =
      `<h2 class="tr-h-m" style="margin:0 0 var(--space-3)">Five real jobs. What do they pay?</h2>
       <p style="margin:0 0 var(--space-5)">Every range below was published by the company
       itself, on its own careers page, this morning. Four out of five startups never post
       one at all — these are the ones that did.</p>
       <button type="button" class="tr-btn tr-btn-primary tr-btn-lg" id="gstart">Play</button>`;
    $("#gstart").onclick = () => {
      tirage = []; notes = []; tour = 0;
      const pris = new Set();
      while (tirage.length < TOURS && pris.size < JEU.length) {
        const i = Math.floor(Math.random() * JEU.length);
        if (!pris.has(i)) { pris.add(i); tirage.push(JEU[i]); }
      }
      manche();
    };
  }

  function manche() {
    if (tour >= tirage.length) return final();
    const o = tirage[tour];
    scene.innerHTML =
      `<p class="tr-overline" style="margin:0 0 var(--space-2)">Role ${tour + 1} of ${TOURS}
         · ${notes.map(n => n[0]).join("") || "—"}</p>
       <div class="tr-card" style="margin-bottom:var(--space-5)"><div class="tr-card-body">
         <h2 class="tr-h-s" style="margin:0 0 4px">${esc(o.t)}</h2>
         <p class="tr-stat-foot" style="margin:0">${esc(o.s)} · ${esc(o.l)}</p>
         ${o.f ? `<p class="tr-stat-foot" style="margin:var(--space-2) 0 0">Backed by ${esc(o.f)}</p>` : ""}
       </div></div>
       <label class="tr-field-label" for="gin">What does it pay a year?</label>
       <div class="tr-row" style="gap:var(--space-3);margin:var(--space-2) 0 0;flex-wrap:wrap">
         <div class="tr-input-wrap" style="flex:1;min-width:180px">
           <input class="tr-input" id="gin" type="number" inputmode="numeric"
                  placeholder="${SIGNE[o.c]} 120000" step="1000" min="0">
         </div>
         <button type="button" class="tr-btn tr-btn-primary" id="gok">Lock it in</button>
       </div>
       <p class="tr-stat-foot" style="margin:var(--space-3) 0 0">In ${o.c}. Base salary, as posted.</p>`;
    const champ = $("#gin");
    champ.focus();
    const jouer = () => {
      const v = parseFloat(champ.value);
      if (!(v > 0)) { champ.focus(); return; }
      reveler(o, v);
    };
    $("#gok").onclick = jouer;
    champ.onkeydown = e => { if (e.key === "Enter") jouer(); };
  }

  function reveler(o, guess) {
    const [carre, libelle, e] = note(guess, o);
    notes.push([carre, libelle]);
    const bas = guess < (o.lo + o.hi) / 2;
    scene.innerHTML =
      `<p class="tr-overline" style="margin:0 0 var(--space-2)">Role ${tour + 1} of ${TOURS}
         · ${notes.map(n => n[0]).join("")}</p>
       <div class="tr-card" style="margin-bottom:var(--space-4)"><div class="tr-card-body">
         <h2 class="tr-h-s" style="margin:0 0 4px">${esc(o.t)}</h2>
         <p class="tr-stat-foot" style="margin:0">${esc(o.s)} · ${esc(o.l)}</p>
       </div></div>
       <div class="sgrid" style="margin-bottom:var(--space-4)">
         <div class="tr-stat"><span class="tr-stat-label">They posted</span>
           <span class="tr-stat-value">${fmt(o.lo, o.c)}–${fmt(o.hi, o.c)}</span></div>
         <div class="tr-stat"><span class="tr-stat-label">You said</span>
           <span class="tr-stat-value">${fmt(guess, o.c)}</span></div>
       </div>
       <p style="margin:0 0 var(--space-5)"><strong>${carre} ${libelle}.</strong>
         ${e < 0.02 ? "That is uncanny." : `You were ${Math.round(e * 100)}% ${bas ? "under" : "over"} the midpoint.`}
         ${o.u ? `<a href="${esc(o.u)}" rel="nofollow noopener" target="_blank">See the posting</a>` : ""}</p>
       <button type="button" class="tr-btn tr-btn-primary" id="gnext">
         ${tour + 1 >= TOURS ? "See how you did" : "Next role"}</button>`;
    $("#gnext").onclick = () => { tour++; manche(); };
  }

  function final() {
    const bons = notes.filter(n => n[0] === "🟩").length;
    const proches = notes.filter(n => n[0] === "🟩" || n[0] === "🟨").length;
    const grille = notes.map(n => n[0]).join("");
    const jour = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const partage = `Guess What This Pays — ${jour}\n${grille}\n${proches}/${TOURS} within 30%\n\n`
      + `Real startup salaries, as posted.\ntractionjobs.com/guess/`;
    const mot = bons >= 4 ? "You have done this before."
      : bons >= 2 ? "Respectable." : proches >= 3 ? "Close enough to be dangerous."
      : "The pay ranges are wider than anyone thinks.";
    /* « 3/5 nailed it, 3/5 within 30% » repetait le meme chiffre des qu'il n'y
       avait aucun jaune : on ne dit la seconde moitie que si elle ajoute quelque chose */
    const score = bons === proches
      ? `${bons}/${TOURS} inside the range.`
      : `${bons}/${TOURS} inside the range, ${proches}/${TOURS} within 30%.`;
    scene.innerHTML =
      `<p class="tr-overline" style="margin:0 0 var(--space-2)">Your round</p>
       <h2 class="tr-h-l" style="margin:0 0 var(--space-2)">${grille}</h2>
       <p style="margin:0 0 var(--space-5)"><strong>${score}</strong> ${mot}</p>
       <div class="tr-row" style="gap:var(--space-3);flex-wrap:wrap">
         <button type="button" class="tr-btn tr-btn-primary" id="gshare">Copy your grid</button>
         <button type="button" class="tr-btn tr-btn-secondary" id="gagain">Play again</button>
         <a class="tr-btn tr-btn-ghost" href="../observatory/salary-transparency/">
           Why four in five say nothing</a>
       </div>`;
    $("#gagain").onclick = intro;
    $("#gshare").onclick = async e => {
      try { await navigator.clipboard.writeText(partage); e.target.textContent = "Copied"; }
      catch { e.target.textContent = "Press ⌘C"; }
    };
  }

  fetch("data.json").then(r => r.json()).then(j => {
    JEU = j;
    if (!JEU.length) throw new Error("vide");
    intro();
  }).catch(() => {
    scene.innerHTML = `<p>Could not load the roles this morning.
      <a href="../">Browse them all instead</a>.</p>`;
  });
})();
