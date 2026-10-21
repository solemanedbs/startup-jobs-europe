/* Bascule de thème du design system : tokens.css définit [data-theme="dark"].
   Le choix tient dans localStorage, sinon on suit le réglage du système. */
(function () {
  var cle = "traction-theme";
  function pose(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  var choix = null;
  try { choix = localStorage.getItem(cle); } catch (e) {}
  pose(choix);
  function sombre() {
    if (choix) return choix === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function icone(b) {
    if (!b || !window.trIcon) return;
    b.innerHTML = window.trIcon(sombre() ? "sun" : "moon", 18);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("theme");
    icone(b);
    if (!b) return;
    b.addEventListener("click", function () {
      choix = sombre() ? "light" : "dark";
      try { localStorage.setItem(cle, choix); } catch (e) {}
      pose(choix); icone(b);
    });
  });
})();
