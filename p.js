(async () => {
  const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const out = document.getElementById("out"); const raw = location.hash.slice(1);
  if (!raw) { out.innerHTML = `<p class="empty">This link does not contain a profile.<br><a href="moi.html">Create mine →</a></p>`; return; }
  let d; try { d = await SJ.unpack(raw); } catch (e) { out.innerHTML = `<p class="empty">Lien illisible ou tronqué. Demandez à la personne de le renvoyer en entier.</p>`; return; }
  const link = u => { const v = String(u || "").trim(); return /^https?:\/\//i.test(v) ? v : (/^[a-z][a-z0-9+.-]*:/i.test(v) ? "#" : "https://" + v); };
  const H = [];
  H.push(`<div class="phead"><h1>${esc(d.id.n)}</h1>${d.id.h ? `<p class="h">${esc(d.id.h)}</p>` : ""}<p>
    ${d.id.mail ? `<a href="mailto:${esc(d.id.mail)}">${esc(d.id.mail)}</a>` : ""}
    ${d.id.li ? `<a href="${esc(link(d.id.li))}" target="_blank" rel="noopener">LinkedIn</a>` : ""}
    ${d.id.site ? `<a href="${esc(link(d.id.site))}" target="_blank" rel="noopener">${esc(d.id.site)}</a>` : ""}</p></div>`);
  H.push(`<div class="bandeau">This profile is carried inside the link itself. Nothing is stored on this site — no account, no database, no cookie. <a href="moi.html">Create yours →</a></div>`);
  if ((d.pr || []).length) H.push(`<div class="psec"><h2>Projects</h2><div class="cards">` + d.pr.map(p => `<div class="pcard"><h3>${esc(p.t)}</h3>${[p.pb,p.d,p.res].map(v=>(v||"").trim()).filter(Boolean).map(v=>`<p>${esc(v)}</p>`).join("")}${p.u ? `<a href="${esc(link(p.u))}" target="_blank" rel="noopener">${esc(p.u.replace(/^https?:\/\//, "").slice(0, 46))} →</a>` : ""}${(p.k || []).length ? `<div class="chips">${p.k.map(k => `<span class="tag">${esc(k)}</span>`).join("")}</div>` : ""}</div>`).join("") + `</div></div>`);
  if ((d.x || []).length) H.push(`<div class="psec"><h2>Expériences</h2>` + d.x.map(x => `<div class="xp"><div class="l1"><span>${esc(x.e)}</span><span>${esc(x.d)}</span></div>${x.t ? `<div class="l2">${esc(x.t)}</div>` : ""}<ul>${(x.p || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("") + `</div>`);
  if ((d.f || []).length) H.push(`<div class="psec"><h2>Formation</h2>` + d.f.map(f => `<div class="xp"><div class="l1"><span>${esc(f.t)}</span><span>${esc(f.d)}</span></div></div>`).join("") + `</div>`);
  if ((d.s || []).length) H.push(`<div class="psec"><h2>Compétences</h2><div class="chips">` + d.s.map(s => `<span class="tag">${esc(s)}</span>`).join("") + `</div></div>`);
  H.push(`<footer class="foot" style="margin-top:34px"><p>Rendered from the link · <a href="./">Jobs at startups backed by European VC funds</a></p></footer>`);
  out.innerHTML = H.join("");
  document.title = (d.id.n || "Profile") + (d.id.h ? " — " + d.id.h : "");
})();
