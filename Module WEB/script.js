/* EcoCampus - module Web (phase 3)
   Ce fichier lit data.json (produit par le module C) et construit toutes les pages.

   Noms courts utilisés partout :
     mesure m : m.id (numéro), m.b (bâtiment), m.r (ressource), m.v (valeur), m.s (seuil), m.d (date), m.t (heure)
     D  = toutes les mesures          F() = mesures de la période choisie
     al(m) = la mesure est en alerte (valeur > seuil)      ov(m) = dépassement en %
     RES = les 4 ressources (nom, unité, couleur, icône)
     $("#id") = trouver un élément de la page */
let META = "";

// ====== 1. DONNÉES DE BASE : ressources, noms, icônes ======
const RES = {
  electricite: { n: "Électricité", u: "kWh", c: "#fbbf24", i: "lightning-charge-fill", t: "Vérifier l'éclairage et les appareils laissés allumés (veilles, heures creuses)." },
  eau: { n: "Eau", u: "m³", c: "#38bdf8", i: "droplet-fill", t: "Chercher une fuite ou un robinet / une chasse d'eau qui coule en continu." },
  chauffage: { n: "Chauffage", u: "kWh", c: "#fb7185", i: "fire", t: "Vérifier les thermostats et les fenêtres restées ouvertes." },
  gaz: { n: "Gaz", u: "m³", c: "#a78bfa", i: "fuel-pump-fill", t: "Vérifier les appareils de cuisson et de chauffage et leurs réglages." }
};
const BN = { Bibliotheque: "Bibliothèque", Salles_Cours: "Salles de cours", Residence: "Résidence" };
const BI = { Administration: "briefcase-fill", Bibliotheque: "book-fill", Foyer: "house-heart-fill", Laboratoire: "eyedropper", Restaurant: "cup-hot-fill", Residence: "buildings-fill", Salles_Cours: "mortarboard-fill" };
const GI = { A: "patch-check-fill", B: "check-circle-fill", C: "exclamation-triangle-fill", D: "x-octagon-fill" };
const NI = { dashboard: "speedometer2", analysis: "graph-up-arrow", buildings: "buildings-fill", reports: "file-earmark-text-fill", add: "plus-circle-fill", profile: "person-circle" };

// ====== 2. PETITES FONCTIONS UTILES ======
// $(...) cherche un élément ; f(n) formate un nombre ; al(m) dit si une mesure est en alerte.
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const bnr = (b) => BN[b] || String(b).replace(/_/g, " "), bn = (b) => esc(bnr(b));
const bic = (b) => `<i class="bi bi-${BI[b] || "building-fill"}"></i>`;
const ri = (r) => `<i class="bi bi-${RES[r].i} ico" style="color:${RES[r].c}"></i>`;
const gi = (g) => `<i class="bi bi-${g ? GI[g] : "dash-circle"} gi ${g || "N"}"></i>`;
const al = (m) => m.v > m.s, ov = (m) => (m.v - m.s) / m.s * 100;
const f = (n, d = 1) => n.toLocaleString("fr", { minimumFractionDigits: d, maximumFractionDigits: d });
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const rnd = (n, d = 2) => n == null ? "" : Math.round(n * 10 ** d) / 10 ** d;
const sd = (d) => (new Date(d + "T00:00")).toLocaleDateString("fr", { weekday: "short", day: "numeric", month: "short" });
const grade = (p) => p >= 95 ? "A" : p >= 85 ? "B" : p >= 70 ? "C" : "D", GL = { A: "Excellent", B: "Très bon", C: "Moyen", D: "Critique" };
const pctOk = (a) => a.length ? 100 * a.filter((m) => !al(m)).length / a.length : 100;
const cv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const nowStr = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = { dashboard: "Tableau de bord", analysis: "Analyse par bâtiment", buildings: "Bâtiments et comparaison", reports: "Rapports · mesures", add: "Ajouter une mesure", profile: "Profil" };
const curView = () => $(".view.on").id.slice(2);

// ====== 3. LES MESURES : lecture et validation ======
let D = [], BASE = [], SRC = "embedded", lastText = null, NOANIM = false, UNDO = [];
const sg = (m) => [m.b, m.r, m.d, m.t].join("|");
const kk = (m) => [sg(m), (+m.v).toFixed(2), (+m.s).toFixed(2)].join("|");
// Vrai si la date AAAA-MM-JJ existe vraiment (pas de 31 février).
function realDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number), t = new Date(Date.UTC(y, m - 1, d));
  return y >= 1970 && y <= 2100 && t.getUTCFullYear() == y && t.getUTCMonth() == m - 1 && t.getUTCDate() == d;
}
// Vrai si l'heure HH:MM est valide.
function realTime(s) {
  const x = typeof s === "string" && /^(\d{2}):(\d{2})$/.exec(s);
  return !!x && +x[1] < 24 && +x[2] < 60;
}
// Vérifie une mesure (mêmes règles que gestion.c). Retourne le message d'erreur, ou "" si tout va bien.
function check(m) {
  if (!m || typeof m !== "object") return "objet invalide";
  if (!Number.isInteger(m.id) || m.id <= 0) return "id invalide";
  if (typeof m.b !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N}_ -]{0,30}$/u.test(m.b)) return "nom de bâtiment invalide";
  if (typeof m.r !== "string" || !Object.hasOwn(RES, m.r)) return "ressource inconnue";
  if (typeof m.v !== "number" || !isFinite(m.v)) return "valeur non numérique";
  if (m.v < 0) return "valeur négative";
  if (m.v > 1e7) return "valeur hors limites";
  if (typeof m.s !== "number" || !isFinite(m.s) || m.s <= 0) return "le seuil doit être > 0";
  if (m.s > 1e7) return "seuil hors limites";
  if (!realDate(m.d)) return "date invalide";
  if (!realTime(m.t)) return "heure invalide";
  return "";
}
// Sépare les lignes valides des lignes rejetées (avec le motif) et ignore les doublons.
function ingest(rows) {
  const ok = [], bad = [], ids = new Set(), sigs = new Set();
  rows.forEach((m, i) => {
    const e = check(m) || (ids.has(m.id) ? "id en double" : "") || (sigs.has(sg(m)) ? "doublon bâtiment/ressource/date/heure" : "");
    if (e) bad.push(`ligne ${i + 1} (id ${m && m.id}) : ${e}`);
    else {
      ids.add(m.id);
      sigs.add(sg(m));
      ok.push({ id: m.id, b: m.b, r: m.r, v: m.v, s: m.s, d: m.d, t: m.t });
    }
  });
  return { ok, bad };
}
// Convertit une mesure du data.json (noms longs) vers le format court utilisé dans ce fichier.
const fromC = (m) => ({ id: m && m.id, b: m && m.batiment, r: m && m.ressource, v: m && m.valeur, s: m && m.seuil, d: m && m.date, t: m && m.heure });
// Liste des bâtiments, sans doublon, par ordre alphabétique.
const bats = () => [...new Set(D.map((m) => m.b))].sort();
// Prochain identifiant libre.
const nextId = () => Math.max(0, ...D.map((m) => m.id)) + 1;

// ====== 4. FILTRE PAR PÉRIODE ======
let DF = { from: "", to: "" };
// Vrai si la date est dans la période choisie.
const inRange = (d) => (!DF.from || d >= DF.from) && (!DF.to || d <= DF.to);
// F() = mesures de la période choisie. Toutes les pages l'utilisent.
const F = () => D.filter((m) => inRange(m.d));
const dates = () => [...new Set(F().map((m) => m.d))].sort();
const periodText = () => DF.from || DF.to ? `${DF.from || "…"} → ${DF.to || "…"}` : "Toutes les dates";
const stamp = () => DF.from || DF.to ? `${DF.from || "debut"}_${DF.to || "fin"}` : "toutes-dates";

// ====== 5. SAUVEGARDE DANS LE NAVIGATEUR ET data.json ======
// Ajouts et suppressions faits sur la page sont gardés dans le navigateur (localStorage).
const LS = "eco-overlay-v1";
// Différence entre les mesures affichées et celles de data.json.
function overlayFromD() {
  const bs = new Set(BASE.map(kk)), ds = new Set(D.map(kk));
  return { add: D.filter((m) => !bs.has(kk(m))), del: BASE.filter((m) => !ds.has(kk(m))).map(kk) };
}
// Lit les changements gardés dans le navigateur.
function readOv() {
  try {
    const o = JSON.parse(localStorage.getItem(LS) || "null");
    if (o && Array.isArray(o.add) && Array.isArray(o.del)) return { add: ingest(o.add).ok, del: o.del.filter((x) => typeof x === "string") };
  } catch (e) {
  }
  return { add: [], del: [] };
}
// Enregistre les changements dans le navigateur.
function writeOv(o) {
  try {
    o.add.length || o.del.length ? localStorage.setItem(LS, JSON.stringify(o)) : localStorage.removeItem(LS);
  } catch (e) {
  }
}
// Applique les changements locaux par-dessus les mesures de data.json.
function applyOverlay(base, o) {
  const del = new Set(o.del), out = base.filter((m) => !del.has(kk(m))), have = new Set(base.map(kk)), sgs = new Set(out.map(sg)), ids = new Set(base.map((m) => m.id));
  let mx = Math.max(0, ...ids);
  for (const a of o.add) {
    if (have.has(kk(a)) || sgs.has(sg(a))) continue;
    const m = { ...a };
    if (ids.has(m.id)) m.id = ++mx;
    ids.add(m.id);
    mx = Math.max(mx, m.id);
    sgs.add(sg(m));
    out.push(m);
  }
  return out;
}
const pending = () => {
  const o = overlayFromD();
  return o.add.length + o.del.length;
};
// Fabrique le texte d'un data.json (même format que celui du module C).
function toJSONText(arr, when) {
  const rk = Object.keys(RES), M = arr.slice().sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t) || a.id - b.id), n2 = (x) => (+x).toFixed(2), uj = (r) => RES[r].u.replace("³", "3");
  let o = `{
  "meta": {"genere_le": ${JSON.stringify(when)}, "nb_mesures": ${M.length}, "nb_alertes": ${M.filter(al).length}},
  "mesures": [
`;
  o += M.map((m) => `    {"id": ${m.id}, "batiment": ${JSON.stringify(m.b)}, "ressource": ${JSON.stringify(m.r)}, "unite": ${JSON.stringify(uj(m.r))}, "valeur": ${n2(m.v)}, "seuil": ${n2(m.s)}, "date": ${JSON.stringify(m.d)}, "heure": ${JSON.stringify(m.t)}, "alerte": ${al(m)}}`).join(",\n");
  const st = [];
  [...new Set(M.map((m) => m.b))].sort().forEach((b) => rk.forEach((r) => {
    const x = M.filter((m) => m.b == b && m.r == r);
    if (!x.length) return;
    const vs = x.map((m) => m.v), t = vs.reduce((a, c) => a + c, 0);
    st.push(`    {"batiment": ${JSON.stringify(b)}, "ressource": ${JSON.stringify(r)}, "unite": ${JSON.stringify(uj(r))}, "nb": ${x.length}, "total": ${n2(t)}, "moyenne": ${n2(t / x.length)}, "min": ${n2(Math.min(...vs))}, "max": ${n2(Math.max(...vs))}, "nb_alertes": ${x.filter(al).length}}`);
  }));
  return o + `${M.length ? "\n" : ""}  ],
  "statistiques": [
${st.join(",\n")}${st.length ? "\n" : ""}  ]
}
`;
}
// Après un ajout ou une suppression : sauvegarde dans le navigateur.
async function commit() {
  writeOv(overlayFromD());
  setSync();
  return false;
}
// Télécharge un fichier texte.
function downloadFile(name, text, type) {
  const a = document.createElement("a"), u = URL.createObjectURL(new Blob([text], { type }));
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2e3);
}
// Télécharge le data.json à jour.
function downloadJSON() {
  downloadFile("data.json", toJSONText(D, nowStr()), "application/json");
  notify({ t: "ok", title: "data.json téléchargé", body: `${D.length} mesures. Remplace le data.json placé à côté de la page par ce fichier.` });
}
// Met à jour le bouton d'état des données (en haut de la page).
function setSync() {
  const p = pending(), b = $("#sy");
  if (p) {
    b.className = "pill warn";
    b.innerHTML = `<i class="bi bi-download"></i> ${p} changement${p > 1 ? "s" : ""} ${p > 1 ? "locaux" : "local"} · récupérer data.json`;
    b.title = "Pas encore écrit dans data.json : clique pour télécharger le fichier à jour";
  } else {
    b.className = "pill";
    b.innerHTML = `<i class="bi bi-database"></i> ${SRC == "data.json" ? "data.json" : "data.js"}`;
    b.title = "Données affichées";
  }
  if ($(".view.on") && curView() == "profile") renderProfile();
}
// Lit data.json (ou data.js si la page est ouverte sans serveur), puis affiche tout.
async function load(auto) {
  let base = null, bad = [];
  try {
    const r = await fetch("data.json", { cache: "no-store" });
    if (r.ok) {
      const txt = await r.text(), j = JSON.parse(txt);
      if (!j || !Array.isArray(j.mesures)) throw 0;
      const x = ingest(j.mesures.map(fromC));
      base = x.ok;
      bad = x.bad;
      SRC = "data.json";
      lastText = txt;
      if (j.meta && typeof j.meta.genere_le === "string") META = j.meta.genere_le;
    }
  } catch (e) {
  }
  if (!base) {
    const E = window.ECO_DATA;
    if (E && Array.isArray(E.mesures)) {
      const x = ingest(E.mesures.map(fromC));
      base = x.ok;
      bad = x.bad;
      if (E.meta && typeof E.meta.genere_le === "string") META = E.meta.genere_le;
    } else base = [];
    SRC = "embedded";
  }
  BASE = base.map((x) => ({ ...x }));
  const o = readOv();
  D = applyOverlay(BASE, o);
  if (bad.length) notify({ t: "warn", title: `${bad.length} ligne${bad.length > 1 ? "s" : ""} invalide${bad.length > 1 ? "s" : ""} ignorée${bad.length > 1 ? "s" : ""}`, body: esc(bad.slice(0, 3).join(" · ")) + (bad.length > 3 ? " …" : ""), ms: 1e4 });
  if (auto) notify({ t: "info", title: "data.json mis à jour", body: `${D.length} mesures rechargées.` });
  changed();
}
// Toutes les 10 s : relit data.json et recharge si le module C l'a modifié.
async function poll() {
  if (SRC != "data.json" || $("#mdl").classList.contains("on") || document.hidden) return;
  try {
    const r = await fetch("data.json", { cache: "no-store" });
    if (r.ok) {
      const t = await r.text();
      if (lastText !== null && t !== lastText) await load(true);
    }
  } catch (e) {
  }
}

// ====== 6. NOTIFICATIONS ET PANNEAU D'ALERTES ======
const NIC = { al: "exclamation-triangle-fill", bad: "x-octagon-fill", warn: "exclamation-circle-fill", info: "info-circle-fill", ok: "check-circle-fill" };
// Affiche une notification (info, ok, alerte...) qui disparaît toute seule.
function notify({ t = "info", title = "", body = "", actions = [], ms = 6500 }) {
  const ns = $("#ns"), el = document.createElement("div");
  el.className = "nt " + t;
  el.setAttribute("role", t == "al" || t == "bad" ? "alert" : "status");
  el.innerHTML = `<i class="bi bi-${NIC[t]} nti"></i><div class="ntb"><b>${title}</b><div class="sub">${body}</div><div class="nta"></div></div><button class="ntx" type="button" aria-label="Fermer"><i class="bi bi-x-lg"></i></button><i class="ntp" style="animation-duration:${ms}ms"></i>`;
  let rem = ms, t0 = 0, tm = 0, gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    clearTimeout(tm);
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  };
  const go = () => {
    t0 = Date.now();
    tm = setTimeout(close, rem);
  };
  el.onmouseenter = () => {
    clearTimeout(tm);
    rem -= Date.now() - t0;
  };
  el.onmouseleave = go;
  el.querySelector(".ntx").onclick = close;
  actions.forEach((a) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a.l;
    b.onclick = (ev) => {
      ev.stopPropagation();
      close();
      a.f();
    };
    el.querySelector(".nta").appendChild(b);
  });
  while (ns.children.length >= 4) ns.firstChild.remove();
  ns.appendChild(el);
  go();
  return close;
}
let READ = new Set(), SEEN = new Set();
try {
  READ = new Set(JSON.parse(localStorage.getItem("eco-read") || "[]"));
} catch (e) {
}
const saveRead = () => {
  try {
    localStorage.setItem("eco-read", JSON.stringify([...READ]));
  } catch (e) {
  }
};
const alertsAll = () => D.filter(al).sort((a, b) => ov(b) - ov(a));
const alMsg = (m) => `${f(m.v)} / ${f(m.s, 0)} ${RES[m.r].u} · <b>+${f(ov(m), 1)}%</b> · ${sd(m.d)} ${m.t}`;
// Met à jour le compteur de la cloche et affiche les nouvelles alertes.
function syncAlerts(popup) {
  const A = alertsAll(), keys = new Set(A.map(kk));
  READ = new Set([...READ].filter((k) => keys.has(k)));
  saveRead();
  const un = A.filter((m) => !READ.has(kk(m))), em = $("#bc");
  em.textContent = un.length > 99 ? "99+" : un.length;
  em.hidden = !un.length;
  $("#bell").setAttribute("aria-label", `Ouvrir les alertes (${un.length} non lue${un.length > 1 ? "s" : ""})`);
  const fresh = un.filter((m) => !SEEN.has(kk(m)));
  fresh.forEach((m) => SEEN.add(kk(m)));
  if (popup && fresh.length && !$("#np").classList.contains("on")) {
    fresh.slice(0, 2).forEach((m, i) => setTimeout(() => notify({ t: "al", title: `Alerte · ${bn(m.b)} · ${RES[m.r].n}`, body: alMsg(m), actions: [{ l: "Voir", f: () => goToAlert(m) }], ms: 9e3 }), i * 350));
    if (fresh.length > 2) setTimeout(() => notify({ t: "al", title: `${fresh.length - 2} autre${fresh.length > 3 ? "s" : ""} alerte${fresh.length > 3 ? "s" : ""}`, body: "Ouvre le panneau des alertes pour tout voir.", actions: [{ l: "Ouvrir", f: openPanel }], ms: 9e3 }), 2 * 350);
    const b = $("#bell");
    b.classList.remove("ring-it");
    void b.offsetWidth;
    b.classList.add("ring-it");
  }
  if ($("#np").classList.contains("on")) renderPanel();
}
// Contenu du panneau de la cloche.
function renderPanel() {
  const A = alertsAll(), un = A.filter((m) => !READ.has(kk(m))).length;
  $("#np").innerHTML = `<header><i class="bi bi-bell-fill" style="color:var(--bad)"></i><h3>Alertes</h3><span class="sub">${un} non lue${un > 1 ? "s" : ""} · ${A.length} au total</span><button class="ntx" id="npx" type="button" aria-label="Fermer"><i class="bi bi-x-lg"></i></button></header>
  <div class="lst">${A.length ? A.map((m) => `<button class="al-i ${READ.has(kk(m)) ? "rd" : ""}" type="button" data-k="${esc(kk(m))}"><span class="dot"></span>${ri(m.r)}<div><b>${bn(m.b)}</b> · ${RES[m.r].n}<div class="sub">${alMsg(m)}</div></div></button>`).join("") : `<div class="empty"><i class="bi bi-shield-check"></i>Aucune alerte. Tout est sous le seuil.</div>`}</div>
  <footer><button class="btn sm ghost" id="npr" type="button" ${un ? "" : "disabled"}><i class="bi bi-check2-all"></i> Tout marquer comme lu</button><button class="btn sm" id="npa" type="button"><i class="bi bi-table"></i> Voir dans Rapports</button></footer>`;
  $("#npx").onclick = closePanel;
  $("#npr").onclick = () => {
    A.forEach((m) => READ.add(kk(m)));
    saveRead();
    syncAlerts(false);
  };
  $("#npa").onclick = () => {
    closePanel();
    $("#fb").value = "";
    $("#q").value = "";
    $("#fs").value = "al";
    show("reports");
  };
  $$("#np .al-i").forEach((b) => b.onclick = () => {
    const m = A.find((x) => kk(x) == b.dataset.k);
    if (m) goToAlert(m);
  });
}
// Ouvre le panneau des alertes.
function openPanel() {
  $("#ns").innerHTML = "";
  renderPanel();
  $("#np").classList.add("on");
}
// Ferme le panneau des alertes.
function closePanel() {
  $("#np").classList.remove("on");
}
// Clic sur une alerte : ouvre la page Rapports filtrée sur ce bâtiment.
function goToAlert(m) {
  READ.add(kk(m));
  saveRead();
  closePanel();
  if (!inRange(m.d)) setDF("", "");
  $("#q").value = "";
  $("#fb").value = m.b;
  $("#fs").value = "al";
  show("reports");
  syncAlerts(false);
}
// Fenêtre de confirmation. Retourne true (OK) ou false (Annuler).
function confirmBox({ title, body, ok = "Confirmer", danger }) {
  return new Promise((res) => {
    const m = $("#mdl");
    $("#mbx").innerHTML = `<h3><i class="bi bi-${danger ? "trash3-fill" : "question-circle-fill"}" style="color:var(--${danger ? "bad" : "acc2"})"></i>${title}</h3><p class="sub">${body}</p><div class="acts"><button class="btn sm ghost" type="button" data-r="0">Annuler</button><button class="btn sm ${danger ? "danger" : ""}" type="button" data-r="1">${ok}</button></div>`;
    m.classList.add("on");
    const done = (v) => {
      m.classList.remove("on");
      m.onclick = null;
      document.removeEventListener("keydown", kd);
      res(v);
    }, kd = (e) => {
      if (e.key === "Escape") done(false);
    };
    document.addEventListener("keydown", kd);
    m.onclick = (e) => {
      const b = e.target.closest("[data-r]");
      if (b) done(b.dataset.r == "1");
      else if (e.target === m) done(false);
    };
    $("#mbx [data-r='0']").focus();
  });
}

// ====== 7. THÈME SOMBRE / CLAIR ======
// Change le thème et le mémorise.
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("eco-theme", t);
  } catch (e) {
  }
  $$("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t == t));
  drawCur();
}
let th0;
try {
  th0 = localStorage.getItem("eco-theme");
} catch (e) {
}
document.documentElement.dataset.theme = th0 || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
const SVGI = { moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>' };
$("#nav").innerHTML = `<div class="brand"><b><i class="bi bi-tree-fill"></i></b>EcoCampus</div>` + Object.keys(VIEWS).map((k) => `<button class="nav" data-v="${k}"><i class="bi bi-${NI[k]}"></i><span>${{ dashboard: "Tableau de bord", analysis: "Analyse", buildings: "Bâtiments", reports: "Rapports", add: "Ajouter", profile: "Profil" }[k]}</span></button>`).join("") + `<div class="sp"></div><div class="mini" id="mn"></div>`;
$("#bell").innerHTML = '<i class="bi bi-bell-fill"></i><em id="bc" hidden></em>';
$("#tg").innerHTML = `<svg class="m i" viewBox="0 0 24 24">${SVGI.moon}</svg><svg class="s i" viewBox="0 0 24 24">${SVGI.sun}</svg>`;
$("#tg").onclick = () => setTheme(document.documentElement.dataset.theme == "dark" ? "light" : "dark");
$$("[data-t]").forEach((b) => b.onclick = () => setTheme(b.dataset.t));

// ====== 8. GRAPHIQUES (Chart.js) ======
const CH = {};
// Crée (ou recrée) un graphique Chart.js.
function mk(id, cfg) {
  CH[id] && CH[id].destroy();
  Chart.defaults.color = cv("--mute");
  Chart.defaults.font.family = "DM Sans";
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, animation: NOANIM ? false : { duration: 1100, easing: "easeOutQuart" } }, cfg.options || {});
  cfg.options.plugins = Object.assign({ legend: { labels: { usePointStyle: true, boxWidth: 8 } } }, cfg.options.plugins);
  // Info-bulle sûre : valeurs arrondies, et message clair quand il n'y a pas de mesure (valeur null).
  const tt = cfg.options.plugins.tooltip = cfg.options.plugins.tooltip || {};
  tt.callbacks = Object.assign({ label: (c) => c.parsed.y == null ? `${c.dataset.label}: aucune mesure` : `${c.dataset.label}: ${f(c.parsed.y)}${id == "c4" ? "" : " %"}` }, tt.callbacks);
  CH[id] = new Chart($("#" + id), cfg);
}
const gridc = () => ({ grid: { color: cv("--line") }, border: { display: false } });
const lim = (n) => ({ label: "Limite", data: Array(n).fill(100), borderColor: cv("--bad"), borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 });
// Graphique du tableau de bord : charge par jour, par ressource.
function drawDash() {
  const X = F(), ds = dates();
  mk("c1", { type: "line", data: { labels: ds.map(sd), datasets: [...Object.keys(RES).map((k) => ({ label: RES[k].n, data: ds.map((d) => avg(X.filter((m) => m.r == k && m.d == d).map((m) => m.v / m.s * 100))), borderColor: RES[k].c, backgroundColor: RES[k].c + "33", tension: 0.4, fill: true, pointRadius: 4, spanGaps: true })), lim(ds.length)] }, options: { scales: { y: { ...gridc(), min: 40, ticks: { callback: (v) => v + "%" } }, x: { grid: { display: false } } } } });
}
let curB, afs = new Set(Object.keys(RES));
// Graphiques de la page Analyse : évolution et charge moyenne.
function drawAn() {
  const X = F(), b = curB, ds = dates(), rs = [...new Set(X.filter((m) => m.b == b).map((m) => m.r))].filter((r) => afs.has(r));
  mk("c2", { type: "line", data: { labels: ds.map(sd), datasets: [...rs.map((k) => ({ label: RES[k].n, data: ds.map((d) => avg(X.filter((m) => m.b == b && m.r == k && m.d == d).map((m) => m.v / m.s * 100))), borderColor: RES[k].c, tension: 0.35, borderWidth: 3, pointRadius: 5, pointHoverRadius: 8, spanGaps: true })), lim(ds.length)] }, options: { scales: { y: { ...gridc(), ticks: { callback: (v) => v + "%" } }, x: { grid: { display: false } } } } });
  mk("c3", { type: "bar", data: { labels: rs.map((k) => RES[k].n), datasets: [{ label: "% moyen du seuil", data: rs.map((k) => avg(X.filter((m) => m.b == b && m.r == k).map((m) => m.v / m.s * 100))), backgroundColor: rs.map((k) => RES[k].c + "cc"), borderRadius: 10 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { ...gridc(), suggestedMax: 110, ticks: { callback: (v) => v + "%" } }, x: { grid: { display: false } } } } });
}
let cfs = new Set(Object.keys(RES));
// Calculs de la comparaison entre deux bâtiments.
function cmpData() {
  const X = F(), a = $("#ca").value, b = $("#cb").value, k = $("#cm").value, rs = Object.keys(RES).filter((r) => cfs.has(r));
  const val = (bt, r) => {
    const x = X.filter((m) => m.b == bt && m.r == r);
    if (!x.length) return null;
    return k == "p" ? avg(x.map((m) => m.v / m.s * 100)) : k == "v" ? avg(x.map((m) => m.v)) : x.reduce((s2, m) => s2 + m.v, 0);
  };
  const s = rs.map((r) => {
    const x = val(a, r), y = val(b, r);
    if (x == null || y == null || !x) return null;
    const d = (y - x) / x * 100;
    return `${RES[r].n} : ${bnr(b)} est ${f(Math.abs(d))} % ${d < 0 ? "plus bas" : "plus haut"}`;
  }).filter(Boolean);
  return { a, b, k, rs, val, s };
}
// Graphique de comparaison de deux bâtiments.
function drawCmp() {
  const { a, b, k, rs, val, s } = cmpData();
  mk("c4", { type: "bar", data: { labels: rs.map((r) => RES[r].n), datasets: [[a, "#34d399"], [b, "#22d3ee"]].map(([bt, c]) => ({ label: bnr(bt), data: rs.map((r) => val(bt, r)), backgroundColor: c + "cc", borderRadius: 10 })) }, options: { scales: { y: { ...gridc(), beginAtZero: true }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => c.parsed.y == null ? `${c.dataset.label}: aucune mesure pour cette ressource` : `${c.dataset.label}: ${f(c.parsed.y)}${k == "p" ? " %" : " " + RES[rs[c.dataIndex]].u}` } } } } });
  $("#cs").textContent = s.length ? s.join("  ·  ") : "Ces bâtiments n'ont aucune ressource en commun dans le filtre / la période choisis.";
  drawDays();
}
// Comparaison de deux journées (historique) : charge moyenne par ressource, pour un bâtiment ou pour tout le campus.
function drawDays() {
  const a = $("#da").value, b = $("#db").value, bt = $("#dbt").value, rs = Object.keys(RES);
  const val = (d, r) => {
    const x = D.filter((m) => m.d == d && m.r == r && (!bt || m.b == bt));
    return x.length ? avg(x.map((m) => m.v / m.s * 100)) : null;
  };
  mk("c5", { type: "bar", data: { labels: rs.map((r) => RES[r].n), datasets: [[a, "#34d399"], [b, "#22d3ee"]].map(([d, c]) => ({ label: d ? sd(d) : "", data: rs.map((r) => val(d, r)), backgroundColor: c + "cc", borderRadius: 10 })).concat([{ ...lim(rs.length), type: "line" }]) }, options: { scales: { y: { ...gridc(), beginAtZero: true, suggestedMax: 110, ticks: { callback: (v) => v + "%" } }, x: { grid: { display: false } } } } });
  const s = rs.map((r) => {
    const x = val(a, r), y = val(b, r);
    if (x == null || y == null || !x) return null;
    const d = (y - x) / x * 100;
    return `${RES[r].n} : ${sd(b)} est ${f(Math.abs(d))} % ${d < 0 ? "plus bas" : "plus haut"} que ${sd(a)}`;
  }).filter(Boolean);
  $("#ds").textContent = s.length ? s.join("  ·  ") : "Aucune ressource en commun pour ces deux journées.";
}
// Redessine le graphique de la page affichée.
const drawCur = () => {
  ({ dashboard: drawDash, analysis: drawAn, buildings: drawCmp })[curView()]?.();
};
// Animation : le nombre monte jusqu'à sa valeur.
function count(el) {
  const to = +el.dataset.to, dec = +el.dataset.d, t0 = performance.now(), rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  (function s(t) {
    const p = rm ? 1 : Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 4);
    el.textContent = f(to * e, dec);
    if (p < 1) requestAnimationFrame(s);
  })(t0);
}

// ====== 9. AFFICHAGE DES PAGES ======
// Page Tableau de bord.
function renderDash() {
  const X = F(), n = X.length, a = X.filter(al), sc = pctOk(X), g = n ? grade(sc) : null;
  $("#sc").dataset.to = sc;
  $("#sc").dataset.d = 1;
  $("#bd").className = "badge " + (g || "");
  $("#bd").innerHTML = g ? `<i class="bi bi-${GI[g]}"></i> ${GL[g]}` : `<i class="bi bi-dash-circle"></i> Aucune donnée`;
  const save = X.filter((m) => !al(m) && RES[m.r].u == "kWh").reduce((s, m) => s + m.s - m.v, 0);
  $("#sv").innerHTML = n ? `<b>${f(save, 0)} kWh</b> économisés sous les limites · ${n - a.length} mesures sur ${n} sont sous le seuil` : "Aucune mesure sur cette période.";
  $("#kp").innerHTML = Object.keys(RES).map((k) => {
    const x = X.filter((m) => m.r == k), t = x.reduce((s, m) => s + m.v, 0), na = x.filter(al).length;
    return `<div class="glass card kpi" style="--c:${RES[k].c}"><span style="font-size:24px">${ri(k)}</span><div class="sub">${RES[k].n}</div><div class="big"><span class="cnt" data-to="${t}" data-d="${t > 999 ? 0 : 1}">0</span><small>${RES[k].u}</small></div><div class="tag">${!x.length ? "Aucune donnée" : na ? na + " alerte" + (na > 1 ? "s" : "") : "Tout sous les limites"}</div></div>`;
  }).join("");
  $("#top").innerHTML = a.slice().sort((x, y) => ov(y) - ov(x)).slice(0, 6).map((m) => `<div class="row">${ri(m.r)}<div><b>${bn(m.b)}</b> · ${RES[m.r].n}<div class="sub">${f(m.v)} / ${f(m.s, 0)} ${RES[m.r].u} · ${sd(m.d)} ${m.t}</div></div><span class="st al">+${f(ov(m), 1)}%</span></div>`).join("") || `<p class="sub">Aucune alerte${n ? ". Toutes les mesures sont sous leur seuil." : " (aucune donnée sur cette période)."}</p>`;
  $$("#kp .cnt").forEach(count);
  count($("#sc"));
  requestAnimationFrame(() => $("#pr").style.strokeDashoffset = 377 * (1 - sc / 100));
  drawDash();
}
// Page Analyse par bâtiment.
function renderAn() {
  const x = F().filter((m) => m.b == curB), a = x.filter(al), sc = pctOk(x), g = x.length ? grade(sc) : null;
  $("#ak").innerHTML = [["Mesures", x.length, "var(--acc2)"], ["Alertes", a.length, "var(--bad)"], ["Score éco", x.length ? f(sc, 0) + " %" : "–", "var(--acc)"], ["Niveau", g ? `${gi(g)} ${GL[g]}` : "–", "var(--warn)"]].map(([l, v, c]) => `<div class="glass card kpi" style="--c:${c}"><div class="sub">${l}</div><div class="big" style="font-size:28px">${v}</div></div>`).join("");
  const rs = [...new Set(x.map((m) => m.r))];
  $("#af").innerHTML = Object.keys(RES).filter((r) => rs.includes(r)).map((r) => `<button class="chip ${afs.has(r) ? "on" : ""}" style="--c:${RES[r].c}" data-r="${r}" type="button">${ri(r)} ${RES[r].n}</button>`).join("");
  $$("#af .chip").forEach((c) => c.onclick = () => {
    afs.has(c.dataset.r) ? afs.delete(c.dataset.r) : afs.add(c.dataset.r);
    renderAn();
  });
  $("#ai").innerHTML = rs.map((r) => {
    const y = x.filter((m) => m.r == r), p = avg(y.map((m) => m.v / m.s * 100)), pk = y.reduce((q, m) => m.v / m.s > q.v / q.s ? m : q), ya = y.filter(al);
    return `<div class="row">${ri(r)}<div><b>${RES[r].n}</b> · moyenne ${f(avg(y.map((m) => m.v)))} ${RES[r].u}, pic ${f(pk.v)} le ${sd(pk.d)}<div class="bar ${p > 100 ? "w" : ""}" style="margin:7px 0 4px"><i data-w="${Math.min(100, p)}"></i></div>${ya.length ? `<div class="sub"><i class="bi bi-lightbulb-fill" style="color:var(--warn)"></i> ${RES[r].t}</div>` : `<div class="sub">Stable : ${f(p, 0)} % de la limite en moyenne.</div>`}</div>${ya.length ? `<span class="st al">${ya.length} alerte${ya.length > 1 ? "s" : ""} · max +${f(Math.max(...ya.map(ov)), 1)}%</span>` : `<span class="st ok">OK</span>`}</div>`;
  }).join("") || `<div class="empty"><i class="bi bi-inbox"></i>Aucune mesure pour ce bâtiment sur la période choisie.</div>`;
  setTimeout(() => $$("#ai .bar i").forEach((i) => i.style.width = i.dataset.w + "%"), 60);
  drawAn();
}
// Page Bâtiments et comparaison.
function renderB() {
  const X = F();
  $("#bl").innerHTML = bats().map((b) => {
    const x = X.filter((m) => m.b == b), n = x.length, p = pctOk(x), g = n ? grade(p) : null, na = x.filter(al).length;
    return `<div class="glass card bc" data-b="${esc(b)}" tabindex="0" role="button" aria-label="${bn(b)}"><div class="bch"><span class="bti">${bic(b)}</span><h3>${bn(b)}</h3>${gi(g)}</div><div class="bar ${g > "B" ? "w" : ""}" style="margin:12px 0 8px"><i data-w="${n ? p : 0}"></i></div><div class="sub">${n ? `${f(p, 0)} % sans alerte · ${na} alerte${na < 2 ? "" : "s"} · ${n} mesures` : "Aucune mesure sur cette période"}</div>${n ? `<div class="sub gl">${GL[g]}</div>` : ""}</div>`;
  }).join("") || `<div class="glass card empty" style="grid-column:1/-1"><i class="bi bi-inbox"></i>Aucune donnée.</div>`;
  setTimeout(() => $$("#bl .bar i").forEach((i) => i.style.width = i.dataset.w + "%"), 60);
  $$(".bc").forEach((c) => {
    const go = () => {
      curB = c.dataset.b;
      $("#ab").value = curB;
      show("analysis");
    };
    c.onclick = go;
    c.onkeydown = (e) => e.key == "Enter" && go();
  });
  drawCmp();
}
let sk = "d", sdir = -1;
const COLS = [["id", "ID"], ["b", "Bâtiment"], ["r", "Ressource"], ["v", "Valeur"], ["s", "Seuil"], ["d", "Date"], ["t", "Heure"], ["st", "Statut"], ["", ""]];
// Lignes du tableau Rapports après recherche, filtres et tri.
function repRows() {
  const q = $("#q").value.trim().toLowerCase(), b = $("#fb").value, s = $("#fs").value;
  const key = (m) => sk == "d" ? m.d + m.t : sk == "st" ? ov(m) : sk == "b" ? bnr(m.b) : sk == "r" ? RES[m.r].n : m[sk];
  return F().filter((m) => (!b || m.b == b) && (!s || s == "al" == al(m)) && (bnr(m.b) + " " + RES[m.r].n).toLowerCase().includes(q)).sort((p, r) => (key(p) > key(r) ? 1 : key(p) < key(r) ? -1 : 0) * sdir);
}
// Page Rapports : tableau des mesures.
function renderT() {
  const x = repRows();
  $("#th").innerHTML = COLS.map(([k, l]) => k ? `<th data-k="${k}">${l}${sk == k ? sdir > 0 ? " ▲" : " ▼" : ""}</th>` : `<th class="nos"><span class="sr"></span></th>`).join("");
  $$("#th th[data-k]").forEach((h) => h.onclick = () => {
    sdir = sk == h.dataset.k ? -sdir : 1;
    sk = h.dataset.k;
    renderT();
  });
  $("#tb").innerHTML = x.map((m) => `<tr class="${al(m) ? "hot" : ""}" data-id="${m.id}"><td>${m.id}</td><td>${bic(m.b)} ${bn(m.b)}</td><td>${ri(m.r)} ${RES[m.r].n}</td><td><b>${f(m.v)}</b> ${RES[m.r].u}</td><td>${f(m.s, 0)} ${RES[m.r].u}</td><td>${m.d}</td><td>${m.t}</td><td>${al(m) ? `<span class="st al"><i class="bi bi-exclamation-triangle-fill"></i> ALERTE +${f(ov(m), 1)} %</span>` : `<span class="st ok"><i class="bi bi-check-circle-fill"></i> OK</span>`}</td><td><button class="ib" type="button" data-del="${m.id}" aria-label="Supprimer la mesure ${m.id}" title="Supprimer"><i class="bi bi-trash3-fill"></i></button></td></tr>`).join("") || `<tr><td colspan="9"><div class="empty"><i class="bi bi-inbox"></i>Aucune mesure ne correspond à ces filtres.</div></td></tr>`;
  $("#cnt").textContent = x.length + " sur " + F().length + " mesures";
  $("#un").disabled = !UNDO.length;
}
// Page Ajouter : actions en cours et conseils.
function renderAdd() {
  const M = [["Passage au LED", "Électricité", 78], ["Optimisation CVC", "Chauffage", 54], ["Compteurs d'eau intelligents", "Eau", 36], ["Audit gaz des cuisines", "Gaz", 22]];
  $("#am").innerHTML = M.map(([n, r, p]) => `<div class="row"><div><b>${n}</b> <span class="sub">· ${r}</span><div class="bar" style="margin-top:6px"><i data-w="${p}"></i></div></div><span class="sub">${p}%</span></div>`).join("");
  $("#et").innerHTML = Object.keys(RES).map((k) => `<div class="tip"><i class="bi bi-${RES[k].i}" style="color:${RES[k].c}"></i><div><b>${RES[k].n}</b><div class="sub">${RES[k].t}</div></div></div>`).join("");
  setTimeout(() => $$("#am .bar i").forEach((i) => i.style.width = i.dataset.w + "%"), 60);
}
// Page Profil.
function renderProfile() {
  const p = pending();
  $("#pm").textContent = `Données générées le ${META} · ${D.length} mesures`;
  $("#dr").disabled = !p;
}

// ====== 10. SUPPRIMER ET AJOUTER UNE MESURE ======
// Supprime une mesure après confirmation (annulation possible).
async function delMeasure(id) {
  const i = D.findIndex((m2) => m2.id == id);
  if (i < 0) return;
  const m = D[i];
  const ok = await confirmBox({ title: `Supprimer la mesure n°${m.id} ?`, body: `${bn(m.b)} · ${RES[m.r].n} · ${f(m.v)} ${RES[m.r].u} le ${m.d} à ${m.t}.<br>Tu pourras annuler ensuite.`, ok: "Supprimer", danger: true });
  if (!ok) return;
  const tr = $(`#tb tr[data-id="${m.id}"]`);
  if (tr) {
    tr.classList.add("gone");
    await sleep(320);
  }
  const j = D.findIndex((x) => x.id == id);
  if (j < 0) return;
  D.splice(j, 1);
  UNDO.push(m);
  const saved = await commit();
  changed();
  notify({ t: "ok", title: `Mesure n°${m.id} supprimée`, body: `${bn(m.b)} · ${RES[m.r].n} · ${m.d} ${m.t}${saved ? " · data.json mis à jour" : ""}`, actions: [{ l: "Annuler", f: undoDelete }], ms: 9e3 });
}
// Annule la dernière suppression.
async function undoDelete() {
  const m = UNDO.pop();
  if (!m) {
    $("#un").disabled = true;
    return;
  }
  if (D.some((x) => sg(x) == sg(m))) {
    notify({ t: "warn", title: "Non restaurée", body: "Une mesure avec le même bâtiment, la même ressource, la même date et la même heure existe déjà." });
    return;
  }
  if (D.some((x) => x.id == m.id)) m.id = nextId();
  D.push(m);
  const saved = await commit();
  changed();
  notify({ t: "ok", title: `Mesure n°${m.id} restaurée`, body: `${bn(m.b)} · ${RES[m.r].n} · ${m.d} ${m.t}${saved ? " · data.json mis à jour" : ""}` });
}
$("#tb").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del]");
  if (b) delMeasure(+b.dataset.del);
});
$("#un").onclick = undoDelete;
// Formulaire d'ajout : mêmes contrôles que la fonction ajouter() du module C.
$("#fm").onsubmit = async (e) => {
  e.preventDefault();
  const b = $("#mb").value, r = $("#mr").value, vs = $("#mv").value.trim(), ss = $("#ms").value.trim(), d = $("#md").value, t = $("#mt").value;
  const v = Math.round(Number(vs) * 100) / 100, s = Math.round(Number(ss) * 100) / 100;
  let er = "";
  const dup = D.find((m2) => sg(m2) == [b, r, d, t].join("|"));
  if (!b || !bats().includes(b)) er = "Choisis un bâtiment.";
  else if (vs === "" || !isFinite(v)) er = "Saisis une valeur numérique.";
  else if (v < 0) er = "La valeur ne peut pas être négative.";
  else if (v > 1e7) er = "La valeur est trop grande.";
  else if (ss === "" || !isFinite(s) || s <= 0) er = "Le seuil doit être supérieur à 0.";
  else if (s > 1e7) er = "Le seuil est trop grand.";
  else if (!realDate(d)) er = "Choisis une date valide.";
  else if (!realTime(t)) er = "Choisis une heure valide.";
  else if (dup) er = `Une mesure existe déjà pour ce bâtiment, cette ressource, cette date et cette heure (n°${dup.id}).`;
  else if (D.length >= 500) er = "Le module C accepte 500 mesures maximum : supprime-en avant d'en ajouter.";
  $("#er").textContent = er;
  if (er) return;
  const m = { id: nextId(), b, r, v, s, d, t }, bad = check(m);
  if (bad) {
    $("#er").textContent = "Mesure invalide : " + bad;
    return;
  }
  const btn = $("#sm");
  btn.disabled = true;
  D.push(m);
  SEEN.add(kk(m));
  const saved = await commit();
  btn.disabled = false;
  $("#mv").value = "";
  $("#ms").value = "";
  changed();
  notify(al(m) ? { t: "al", title: `Alerte enregistrée · ${bn(m.b)} · ${RES[m.r].n}`, body: alMsg(m), actions: [{ l: "Voir", f: () => goToAlert(m) }], ms: 9e3 } : { t: "ok", title: `Mesure n°${m.id} enregistrée`, body: `${bn(m.b)} · ${RES[m.r].n} est sous son seuil.${saved ? " data.json mis à jour." : " Gardée dans ce navigateur jusqu'au téléchargement de data.json."}` });
  if (al(m)) {
    const bl = $("#bell");
    bl.classList.remove("ring-it");
    void bl.offsetWidth;
    bl.classList.add("ring-it");
  }
};
// Propose le seuil habituel du bâtiment et de la ressource choisis.
function sugg() {
  const x = D.filter((m) => m.b == $("#mb").value && m.r == $("#mr").value);
  $("#ms").placeholder = x.length ? "habituel : " + f(x[x.length - 1].s, 0) : "alerte si la valeur dépasse";
}
// Remplit les listes déroulantes avec les bâtiments.
function fill() {
  const bs = bats(), o = bs.map((b) => `<option value="${esc(b)}">${bn(b)}</option>`).join(""), old = { ca: $("#ca").value, cb: $("#cb").value, mb: $("#mb").value, fb: $("#fb").value };
  ["#ab", "#ca", "#cb", "#mb"].forEach((s) => $(s).innerHTML = o);
  $("#fb").innerHTML = '<option value="">Tous les bâtiments</option>' + o;
  $("#ab").value = curB || "";
  $("#ca").value = bs.includes(old.ca) ? old.ca : bs[0] || "";
  $("#cb").value = bs.includes(old.cb) ? old.cb : bs[3] || bs[1] || bs[0] || "";
  $("#mb").value = bs.includes(old.mb) ? old.mb : bs[0] || "";
  $("#fb").value = bs.includes(old.fb) ? old.fb : "";
  const dd = [...new Set(D.map((m) => m.d))].sort(), od = dd.map((d) => `<option value="${d}">${sd(d)}</option>`).join(""), oldD = { da: $("#da").value, db: $("#db").value, dbt: $("#dbt").value };
  $("#da").innerHTML = $("#db").innerHTML = od;
  $("#dbt").innerHTML = '<option value="">Tout le campus</option>' + o;
  $("#da").value = dd.includes(oldD.da) ? oldD.da : dd[0] || "";
  $("#db").value = dd.includes(oldD.db) ? oldD.db : dd[dd.length - 1] || "";
  $("#dbt").value = bs.includes(oldD.dbt) ? oldD.dbt : "";
  sugg();
}

// ====== 11. BARRE DE PÉRIODE ======
// Période prédéfinie (tout, dernier jour, 3 jours, 7 jours).
function presetRange(p) {
  if (p == "all" || !D.length) return ["", ""];
  const mx = D.reduce((a, m) => m.d > a ? m.d : a, "");
  return [addDays(mx, -(+p - 1)), ""];
}
// Met à jour les dates et les boutons de la barre de période.
function syncBar() {
  
  // Pas de min/max : toutes les dates du calendrier restent choisissables.
  ["#df", "#dt"].forEach((s) => {
    $(s).removeAttribute("min");
    $(s).removeAttribute("max");
  });
  $("#df").value = DF.from;
  $("#dt").value = DF.to;
  $$("#dfw .chip").forEach((c) => {
    const [a, b] = presetRange(c.dataset.p);
    c.classList.toggle("on", DF.from == a && DF.to == b);
  });
  const act = DF.from || DF.to;
  $("#fc").textContent = act ? `${F().length} mesures sur ${D.length} dans la période` : "";
}
// Applique une nouvelle période et réaffiche la page.
function setDF(a, b) {
  DF.from = a;
  DF.to = b;
  syncBar();
  if ($(".view.on")) renderAll();
  updChrome();
}
$("#df").onchange = $("#dt").onchange = () => {
  let a = $("#df").value, b = $("#dt").value;
  if (a && b && a > b) [a, b] = [b, a];
  setDF(a, b);
};
$$("#dfw .chip").forEach((c) => c.onclick = () => {
  const [a, b] = presetRange(c.dataset.p);
  setDF(a, b);
});

// ====== 12. EXPORTS CSV ET PDF ======
// Prépare une valeur pour le CSV.
const cell = (v) => {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvText = (rows) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
const mRow = (m) => [m.id, bnr(m.b), RES[m.r].n, rnd(m.v), RES[m.r].u, rnd(m.s), m.d, m.t, al(m) ? "ALERTE" : "OK", al(m) ? rnd(ov(m), 1) : ""];
const MH = ["id", "batiment", "ressource", "valeur", "unite", "seuil", "date", "heure", "statut", "depassement_pct"];
// Pour chaque page : le contenu de son export CSV et de son rapport PDF.
const SPEC = {
  dashboard() {
    const X = F(), n = X.length, sc = pctOk(X), g = n ? grade(sc) : null, a = X.filter(al);
    const byR = Object.keys(RES).map((k) => {
      const x = X.filter((m) => m.r == k);
      return { n: RES[k].n, k: x.length, t: x.reduce((s, m) => s + m.v, 0), u: RES[k].u, a: x.filter(al).length, p: avg(x.map((m) => m.v / m.s * 100)) };
    });
    return {
      title: "Tableau de bord",
      csv: { name: "dashboard", rows: [["ressource", "mesures", "total", "unite", "alertes", "moy_pct_du_seuil"], ...byR.map((r) => [r.n, r.k, rnd(r.t), r.u, r.a, rnd(r.p)])] },
      kpis: [["Score éco", f(sc, 1) + " / 100"], ["Niveau", g ? GL[g] : "Aucune donnée"], ["Mesures", n], ["Alertes", a.length]],
      charts: [{ id: "c1", t: "Charge par rapport au seuil, par jour (100 % = limite d'alerte)" }],
      tables: [
        { t: "Consommation par ressource", h: ["Ressource", "Mesures", "Total", "Alertes", "% moyen du seuil"], r: byR.map((r) => [r.n, r.k, f(r.t) + " " + r.u, r.a, r.p == null ? "–" : f(r.p, 0) + " %"]) },
        { t: "Pires dépassements", h: ["Bâtiment", "Ressource", "Valeur", "Seuil", "Quand", "Dépassement"], r: a.slice().sort((x, y) => ov(y) - ov(x)).slice(0, 10).map((m) => [bnr(m.b), RES[m.r].n, f(m.v) + " " + RES[m.r].u, f(m.s, 0), m.d + " " + m.t, "+" + f(ov(m), 1) + " %"]) }
      ]
    };
  },
  analysis() {
    const X = F().filter((m) => m.b == curB && afs.has(m.r)), n = X.length, a = X.filter(al), sc = pctOk(X), g = n ? grade(sc) : null, rs = [...new Set(X.map((m) => m.r))];
    const ins = rs.map((r) => {
      const y = X.filter((m) => m.r == r), p = avg(y.map((m) => m.v / m.s * 100)), pk = y.reduce((q, m) => m.v / m.s > q.v / q.s ? m : q), ya = y.filter(al);
      return [RES[r].n, y.length, f(avg(y.map((m) => m.v))) + " " + RES[r].u, f(pk.v) + " (" + pk.d + ")", f(p, 0) + " %", ya.length ? ya.length + " alerte(s), max +" + f(Math.max(...ya.map(ov)), 1) + " %" : "OK"];
    });
    return {
      title: "Analyse par bâtiment · " + bnr(curB),
      csv: { name: "analysis_" + bnr(curB).replace(/\W+/g, "-"), rows: [MH, ...X.slice().sort((p, q) => (p.d + p.t).localeCompare(q.d + q.t)).map(mRow)] },
      kpis: [["Mesures", n], ["Alertes", a.length], ["Score éco", n ? f(sc, 0) + " %" : "–"], ["Niveau", g ? GL[g] : "–"]],
      charts: [{ id: "c2", t: "Évolution de la consommation (% du seuil)" }, { id: "c3", t: "Charge moyenne par ressource" }],
      tables: [
        { t: "Analyse par ressource", h: ["Ressource", "Mesures", "Moyenne", "Pic", "% moyen de la limite", "Statut"], r: ins },
        { t: "Mesures", h: ["ID", "Ressource", "Valeur", "Seuil", "Date", "Heure", "Statut"], r: X.slice().sort((p, q) => (p.d + p.t).localeCompare(q.d + q.t)).map((m) => [m.id, RES[m.r].n, f(m.v) + " " + RES[m.r].u, f(m.s, 0), m.d, m.t, al(m) ? "ALERTE +" + f(ov(m), 1) + " %" : "OK"]) }
      ]
    };
  },
  buildings() {
    const X = F(), rows = bats().map((b) => {
      const x = X.filter((m) => m.b == b), n = x.length, p = pctOk(x);
      return { b, n, na: x.filter(al).length, p, g: n ? grade(p) : null };
    }), c = cmpData();
    return {
      title: "Bâtiments et comparaison",
      csv: { name: "buildings", rows: [["batiment", "mesures", "alertes", "pct_sans_alerte", "statut"], ...rows.map((r) => [bnr(r.b), r.n, r.na, r.n ? rnd(r.p, 1) : "", r.g ? GL[r.g] : "Aucune donnée"])] },
      kpis: [["Bâtiments", rows.length], ["Mesures", X.length], ["Alertes", X.filter(al).length], ["Comparés", bnr(c.a) + " contre " + bnr(c.b)]],
      charts: [{ id: "c4", t: "Comparaison : " + bnr(c.a) + " contre " + bnr(c.b) + " (" + { p: "% moyen du seuil", v: "valeur moyenne", t: "valeur totale" }[c.k] + ")" }, { id: "c5", t: "Comparaison de deux journées : " + sd($("#da").value) + " contre " + sd($("#db").value) + " (% moyen du seuil)" }],
      note: c.s.join(" · "),
      tables: [{ t: "Bâtiments", h: ["Bâtiment", "Mesures", "Alertes", "% sans alerte", "Statut"], r: rows.map((r) => [bnr(r.b), r.n, r.na, r.n ? f(r.p, 0) + " %" : "–", r.g ? GL[r.g] : "Aucune donnée"]) }]
    };
  },
  reports() {
    const x = repRows();
    return {
      title: "Rapports · mesures",
      csv: { name: "reports", rows: [MH, ...x.map(mRow)] },
      kpis: [["Lignes", x.length], ["Alertes", x.filter(al).length], ["OK", x.filter((m) => !al(m)).length], ["Filtre", ($("#q").value.trim() || "aucun") + ($("#fb").value ? " · " + bnr($("#fb").value) : "") + ($("#fs").value ? " · " + ($("#fs").value == "al" ? "alertes" : "ok") : "")]],
      tables: [{ t: "Mesures", h: ["ID", "Bâtiment", "Ressource", "Valeur", "Seuil", "Date", "Heure", "Statut"], r: x.map((m) => [m.id, bnr(m.b), RES[m.r].n, f(m.v) + " " + RES[m.r].u, f(m.s, 0), m.d, m.t, al(m) ? "ALERTE +" + f(ov(m), 1) + " %" : "OK"]) }]
    };
  },
  add() {
    return {
      title: "Ajouter une mesure · toutes les mesures",
      period: false,
      csv: { name: "measures", raw: true, rows: [["id", "batiment", "ressource", "valeur", "date", "heure", "seuil"], ...D.slice().sort((a, b) => a.id - b.id).map((m) => [m.id, m.b, m.r, m.v.toFixed(2), m.d, m.t, m.s.toFixed(2)])] },
      kpis: [["Mesures", D.length], ["Alertes", D.filter(al).length], ["Bâtiments", bats().length], ["Ressources", Object.keys(RES).length]],
      tables: [
        { t: "Actions en cours", h: ["Action", "Ressource", "Avancement"], r: [["Passage au LED", "Électricité", "78 %"], ["Optimisation CVC", "Chauffage", "54 %"], ["Compteurs d'eau intelligents", "Eau", "36 %"], ["Audit gaz des cuisines", "Gaz", "22 %"]] },
        { t: "Conseils éco", h: ["Ressource", "Conseil"], r: Object.keys(RES).map((k) => [RES[k].n, RES[k].t]) }
      ]
    };
  },
  profile() {
    const p = pending(), rows = [["Généré le", META], ["Mesures", D.length], ["Alertes", D.filter(al).length], ["Bâtiments", bats().length], ["Changements locaux non enregistrés", p]];
    return { title: "Profil", period: false, csv: { name: "profile", rows: [["cle", "valeur"], ...rows] }, kpis: rows.slice(1, 4).concat([["Changements locaux", p]]), tables: [{ t: "Profil", h: ["Élément", "Valeur"], r: rows }] };
  }
};
// Bouton « Exporter CSV ».
function doCSV() {
  const v = curView(), s = SPEC[v](), c = s.csv, txt = csvText(c.rows);
  downloadFile(`ecocampus_${c.name}${s.period === false ? "" : "_" + stamp()}.csv`, (c.raw ? "" : "\uFEFF") + txt, "text/csv;charset=utf-8");
  notify({ t: "ok", title: "CSV exporté", body: `${c.rows.length - 1} ligne${c.rows.length == 2 ? "" : "s"} · ecocampus_${esc(c.name)}.csv` });
}
// Transforme les graphiques en images pour le PDF.
function captureCharts(list) {
  if (!list || !list.length) return [];
  const root = document.documentElement, th = root.dataset.theme;
  NOANIM = true;
  root.dataset.theme = "light";
  drawCur();
  const out = list.map((c) => ({ t: c.t, src: $("#" + c.id).toDataURL("image/png") }));
  root.dataset.theme = th;
  drawCur();
  NOANIM = false;
  return out;
}
// Construit la page imprimable du rapport.
function buildPA(s) {
  const imgs = captureCharts(s.charts), pe = s.period === false ? "" : `Période : ${periodText()} · `;
  const isA = (v) => /^(ALERTE|\+)/.test(String(v));
  $("#pa").innerHTML = `<h1>EcoCampus · ${esc(s.title)}</h1><div class="meta">${pe}Données générées le ${esc(META)} · Exporté le ${esc(nowStr())}</div>
   ${s.kpis ? `<div class="pk">${s.kpis.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
   ${imgs.map((i) => `<figure><figcaption>${esc(i.t)}</figcaption><img alt="${esc(i.t)}" src="${i.src}"></figure>`).join("")}
   ${s.note ? `<p>${esc(s.note)}</p>` : ""}
   ${(s.tables || []).map((t) => `<h2>${esc(t.t)}</h2><table><thead><tr>${t.h.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.r.length ? t.r.map((r) => `<tr>${r.map((c) => `<td class="${isA(c) ? "al" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${t.h.length}">Aucune donnée</td></tr>`}</tbody></table>`).join("")}
   <div class="ft">EcoCampus · Énergie du campus intelligent · Il y a alerte quand valeur &gt; seuil.</div>`;
}
// Bouton « Exporter PDF » (ouvre l'impression).
function doPDF() {
  buildPA(SPEC[curView()]());
  notify({ t: "info", title: "Préparation du PDF", body: "Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » comme destination.", ms: 4e3 });
  setTimeout(() => window.print(), 350);
}
window.addEventListener("afterprint", () => {
  $("#pa").innerHTML = "";
});
$("#xc").onclick = doCSV;
$("#xp").onclick = doPDF;

// ====== 13. NAVIGATION ET DÉMARRAGE ======
// Met à jour le titre, le compteur d'alertes et le bloc de date du menu.
function updChrome() {
  const X = F(), a = X.filter(al).length;
  $("#gen").textContent = `${X.length} mesures · ${a} alerte${a < 2 ? "" : "s"}`;
  $("#mn").innerHTML = `<b>${esc(META)}</b><br>${D.length} mesures`;
}
// Affiche une page (tableau de bord, analyse...).
function show(v) {
  $$(".view").forEach((x) => x.classList.toggle("on", x.id == "v-" + v));
  $$(".nav[data-v]").forEach((n) => n.classList.toggle("on", n.dataset.v == v));
  $("#ttl").textContent = VIEWS[v];
  scrollTo({ top: 0 });
  $("#dfw").hidden = v == "add" || v == "profile";
  updChrome();
  syncBar();
  ({ dashboard: renderDash, analysis: renderAn, buildings: renderB, reports: renderT, add: renderAdd, profile: renderProfile })[v]();
  try {
    history.replaceState(null, "", "#" + v);
  } catch (e) {
  }
}
// Réaffiche la page courante.
function renderAll() {
  show(curView());
}
// À appeler après un changement de données : tout est remis à jour.
function changed() {
  if (!bats().includes(curB)) curB = bats()[0];
  fill();
  syncAlerts(true);
  setSync();
  renderAll();
}
$$(".nav[data-v]").forEach((n) => n.onclick = () => show(n.dataset.v));
$("#bell").onclick = (e) => {
  e.stopPropagation();
  $("#np").classList.contains("on") ? closePanel() : openPanel();
};
document.addEventListener("click", (e) => {
  // Un bouton re-rendu (ex. « Ouvrir », « Tout marquer comme lu ») n'est plus dans la page : on ne ferme pas.
  if (!e.target.isConnected || e.target.closest("#ns")) return;
  if ($("#np").classList.contains("on") && !e.target.closest("#np") && !e.target.closest("#bell")) closePanel();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePanel();
});
$("#ab").onchange = (e) => {
  curB = e.target.value;
  afs = new Set(Object.keys(RES));
  renderAn();
};
["#ca", "#cb", "#cm"].forEach((s) => $(s).onchange = drawCmp);
["#da", "#db", "#dbt"].forEach((s) => $(s).onchange = drawDays);
["#q", "#fb", "#fs"].forEach((s) => $(s).oninput = renderT);
["#mb", "#mr"].forEach((s) => $(s).onchange = sugg);
$("#mr").innerHTML = Object.keys(RES).map((k) => `<option value="${k}">${RES[k].n} (${RES[k].u})</option>`).join("");
$("#cf").innerHTML = Object.keys(RES).map((r) => `<button class="chip on" style="--c:${RES[r].c}" data-r="${r}" type="button">${ri(r)} ${RES[r].n}</button>`).join("");
$$("#cf .chip").forEach((c) => c.onclick = () => {
  cfs.has(c.dataset.r) ? cfs.delete(c.dataset.r) : cfs.add(c.dataset.r);
  c.classList.toggle("on");
  drawCmp();
});
$("#md").value = (new Date()).toISOString().slice(0, 10);
$("#mt").value = (new Date()).toTimeString().slice(0, 5);
$("#sy").onclick = () => pending() ? downloadJSON() : show("profile");
$("#dj").onclick = downloadJSON;
$("#dr").onclick = async () => {
  if (!pending()) return;
  if (!await confirmBox({ title: "Abandonner les changements locaux ?", body: `${pending()} changement(s) gardé(s) dans ce navigateur seront perdus et data.json sera affiché tel quel.`, ok: "Abandonner", danger: true })) return;
  writeOv({ add: [], del: [] });
  UNDO = [];
  await load(false);
};
setInterval(poll, 1e4);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) poll();
});
// Démarrage : thème, lecture des données, puis affichage de la page demandée.
(async () => {
  const h = location.hash.slice(1);
  setTheme(document.documentElement.dataset.theme);
  await load(false);
  show(Object.hasOwn(VIEWS, h) ? h : "dashboard");
  if (SRC != "data.json") notify({ t: "warn", title: "Mode local", body: "data.json n'a pas pu être lu : les données de data.js sont affichées. Ouvre le dossier avec <b>Live Server</b> pour que la page se mette à jour toute seule.", ms: 9e3 });
})();
