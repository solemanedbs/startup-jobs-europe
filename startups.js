/* Onglets par secteur sur /startups/. Tout est déjà rendu dans la page : on masque,
   on ne recharge rien. Les sections alphabétiques vides et les lettres de la barre
   de navigation correspondantes disparaissent avec. Le secteur choisi est dans l'URL,
   donc partageable — et les pages /sectors/ restent les URLs indexées. */
(function () {
  const tabs = [...document.querySelectorAll(".stab")];
  if (!tabs.length) return;
  const blocs = [...document.querySelectorAll(".alpha-block")];
  const liens = [...document.querySelectorAll(".alphanav a")];
  const cpt = document.getElementById("scount");
  const base = cpt ? cpt.innerHTML : "";

  function appliquer(k, pousser) {
    let total = 0;
    blocs.forEach(b => {
      let vus = 0;
      b.querySelectorAll(".coitem").forEach(el => {
        const ok = !k || el.dataset.k === k;
        el.hidden = !ok;
        if (ok) vus++;
      });
      b.hidden = vus === 0;
      total += vus;
      const l = b.dataset.letter;
      liens.forEach(a => { if (a.dataset.letter === l) a.hidden = vus === 0; });
    });
    tabs.forEach(t => t.setAttribute("aria-selected",
      (t.dataset.k || "") === (k || "") ? "true" : "false"));
    if (cpt) {
      const ico = window.trIcon ? window.trIcon("building", 14) : "";
      const nom = k ? ((tabs.find(t => t.dataset.k === k) || {}).textContent || "")
        .replace(/\s*[\d,]+\s*$/, "").trim().toLowerCase() : "";
      cpt.innerHTML = k
        ? `${ico}<span class="tr-num">${total.toLocaleString("en-GB")}</span> ${nom} companies · the number is how many roles each has open today`
        : base;
    }
    if (pousser) {
      const u = k ? "#sector=" + encodeURIComponent(k) : location.pathname;
      history.replaceState(null, "", u);
    }
  }

  tabs.forEach(t => t.addEventListener("click", () => appliquer(t.dataset.k || "", true)));
  const dep = new URLSearchParams(location.hash.slice(1)).get("sector") || "";
  if (dep && tabs.some(t => t.dataset.k === dep)) appliquer(dep, false);
})();
