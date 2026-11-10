/* EcoCampus - bouton de langue FR / EN
   Ce fichier est chargé APRÈS script.js. Il ne modifie pas la logique du site :
   - le français reste la langue par défaut (tel que dans script.js et index.html) ;
   - en anglais, tous les textes affichés sont traduits à la volée (DOM + noms des ressources/bâtiments
     + libellés des graphiques + formats de nombres et de dates) ;
   - le choix est mémorisé dans localStorage (clé « eco-lang »). */
(() => {
  const KEY = "eco-lang";
  let LANG = "fr";
  try {
    if (localStorage.getItem(KEY) === "en") LANG = "en";
  } catch (e) {
  }

  // ====== 1. Formats de nombres et de dates (script.js appelle toLocaleString("fr") / toLocaleDateString("fr")) ======
  const nl = Number.prototype.toLocaleString, dl = Date.prototype.toLocaleDateString;
  Number.prototype.toLocaleString = function (l, o) {
    return nl.call(this, l === "fr" && LANG === "en" ? "en-GB" : l, o);
  };
  Date.prototype.toLocaleDateString = function (l, o) {
    return dl.call(this, l === "fr" && LANG === "en" ? "en-GB" : l, o);
  };

  // ====== 2. Données de script.js à traduire (copie du français pour pouvoir revenir) ======
  const EN_RES = {
    electricite: { n: "Electricity", t: "Check the lighting and appliances left on (standby, off-peak hours)." },
    eau: { n: "Water", t: "Look for a leak or a tap / toilet that runs continuously." },
    chauffage: { n: "Heating", t: "Check the thermostats and windows left open." },
    gaz: { n: "Gas", t: "Check the cooking and heating appliances and their settings." }
  };
  const EN_BN = { Bibliotheque: "Library", Salles_Cours: "Classrooms", Residence: "Residence", Foyer: "Common room", Laboratoire: "Laboratory" };
  const EN_GL = { A: "Excellent", B: "Very good", C: "Average", D: "Critical" };
  const EN_COLS = { id: "ID", b: "Building", r: "Resource", v: "Value", s: "Threshold", d: "Date", t: "Time", st: "Status" };
  const FR_RES = {}, FR_BN = { ...BN }, FR_GL = { ...GL }, FR_COLS = COLS.map((c) => c.slice());
  Object.keys(RES).forEach((k) => FR_RES[k] = { n: RES[k].n, t: RES[k].t });

  function patchData() {
    const en = LANG === "en";
    Object.keys(RES).forEach((k) => {
      RES[k].n = (en ? EN_RES : FR_RES)[k].n;
      RES[k].t = (en ? EN_RES : FR_RES)[k].t;
    });
    Object.keys(EN_BN).forEach((k) => {
      if (en) BN[k] = EN_BN[k];
      else if (k in FR_BN) BN[k] = FR_BN[k];
      else delete BN[k];
    });
    Object.assign(GL, en ? EN_GL : FR_GL);
    COLS.forEach((c, i) => {
      if (c[0]) c[1] = en ? EN_COLS[c[0]] : FR_COLS[i][1];
    });
  }

  // ====== 3. Dictionnaire des textes (français -> anglais) ======
  const EX = {
    "Tableau de bord": "Dashboard", "Analyse": "Analysis", "Bâtiments": "Buildings", "Rapports": "Reports", "Ajouter": "Add", "Profil": "Profile",
    "Analyse par bâtiment": "Analysis by building", "Bâtiments et comparaison": "Buildings and comparison", "Rapports · mesures": "Reports · measurements",
    "Ajouter une mesure": "Add a measurement", "Ajouter une mesure · toutes les mesures": "Add a measurement · all measurements",
    "Période": "Period", "Tout": "All", "Dernier jour": "Last day", "3 derniers jours": "Last 3 days", "7 derniers jours": "Last 7 days",
    "Exporter CSV": "Export CSV", "Exporter PDF": "Export PDF", "Toutes les dates": "All dates",
    "Score éco du campus": "Campus eco score", "sur 100": "out of 100", "Charge par rapport au seuil, par jour": "Load versus threshold, per day",
    "100 % = limite d'alerte.": "100% = alert limit.", "Pires dépassements": "Worst overruns",
    "Charge par rapport au seuil, par jour (100 % = limite d'alerte)": "Load versus threshold, per day (100% = alert limit)",
    "Évolution de la consommation (% du seuil)": "Consumption trend (% of threshold)", "Charge moyenne par ressource": "Average load per resource",
    "Analyse et alertes": "Analysis and alerts", "Comparer deux bâtiments": "Compare two buildings", "contre": "versus",
    "% moyen du seuil": "Average % of threshold", "Valeur moyenne": "Average value", "Valeur totale": "Total value",
    "Tous les statuts": "All statuses", "Alertes uniquement": "Alerts only", "OK uniquement": "OK only", "Annuler la suppression": "Undo deletion",
    "Tous les bâtiments": "All buildings",
    "Bâtiment": "Building", "Ressource": "Resource", "Valeur": "Value", "Seuil": "Threshold", "Date": "Date", "Heure": "Time", "Statut": "Status",
    "Enregistrer la mesure": "Save measurement", "Actions en cours": "Ongoing actions", "Conseils éco": "Eco tips",
    "Gestionnaire énergie": "Energy manager", "Administrateur EcoCampus": "EcoCampus administrator", "Préférences": "Preferences",
    "Thème": "Theme", "Sombre": "Dark", "Clair": "Light",
    "Les données viennent du module C : data.json, produit par l'option 12 du menu console. Il y a alerte quand valeur > seuil.": "The data comes from module C: data.json, produced by option 12 of the console menu. An alert is raised when value > threshold.",
    "Télécharger data.json": "Download data.json", "Abandonner les changements locaux": "Discard local changes",
    "Alertes": "Alerts", "Tout marquer comme lu": "Mark all as read", "Voir dans Rapports": "View in Reports", "Voir": "View", "Ouvrir": "Open",
    "Confirmer": "Confirm", "Supprimer": "Delete", "Abandonner": "Discard", "Abandonner les changements locaux ?": "Discard local changes?", "Fermer": "Close",
    "Mesures": "Measurements", "Score éco": "Eco score", "Niveau": "Level", "Ressources": "Resources", "Comparés": "Compared",
    "Lignes": "Rows", "Filtre": "Filter", "aucun": "none", "Changements locaux": "Local changes", "Changements locaux non enregistrés": "Unsaved local changes",
    "Généré le": "Generated on", "Élément": "Item", "Action": "Action", "Avancement": "Progress", "Conseil": "Tip", "Total": "Total", "Quand": "When",
    "Dépassement": "Overrun", "Moyenne": "Average", "Pic": "Peak", "% moyen de la limite": "Average % of the limit", "% sans alerte": "% without alert",
    "Consommation par ressource": "Consumption per resource", "Analyse par ressource": "Analysis by resource",
    "Excellent": "Excellent", "Très bon": "Very good", "Moyen": "Average", "Critique": "Critical",
    "Passage au LED": "LED switch", "Optimisation CVC": "HVAC optimisation", "Compteurs d'eau intelligents": "Smart water meters", "Audit gaz des cuisines": "Kitchen gas audit",
    "Électricité": "Electricity", "Eau": "Water", "Chauffage": "Heating", "Gaz": "Gas",
    "Bibliothèque": "Library", "Salles de cours": "Classrooms", "Résidence": "Residence", "Laboratoire": "Laboratory", "Foyer": "Common room",
    "Rechercher un bâtiment ou une ressource": "Search for a building or a resource", "ex. 142,5": "e.g. 142.5", "alerte si la valeur dépasse": "alert if the value exceeds",
    "Ouvrir les alertes": "Open alerts", "Basculer thème sombre / clair": "Toggle dark / light theme", "Date de début": "Start date", "Date de fin": "End date",
    "Premier bâtiment": "First building", "Deuxième bâtiment": "Second building", "Indicateur": "Indicator", "Rechercher": "Search",
    "Filtre bâtiment": "Building filter", "Filtre statut": "Status filter",
    "Pas encore écrit dans data.json : clique pour télécharger le fichier à jour": "Not yet written to data.json: click to download the up-to-date file",
    "Données affichées": "Data displayed",
    "Aucune donnée": "No data", "Aucune donnée.": "No data.", "Tout sous les limites": "All under the limits",
    "Non restaurée": "Not restored", "Mode local": "Local mode", "CSV exporté": "CSV exported", "Préparation du PDF": "Preparing the PDF",
    "data.json téléchargé": "data.json downloaded", "data.json mis à jour": "data.json updated",
    "Une mesure avec le même bâtiment, la même ressource, la même date et la même heure existe déjà.": "A measurement with the same building, resource, date and time already exists.",
    "Ouvre le panneau des alertes pour tout voir.": "Open the alerts panel to see everything.",
    "Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » comme destination.": "In the print window, choose “Save as PDF” as the destination.",
    "Tu pourras annuler ensuite.": "You will be able to undo afterwards.",
    "Choisis un bâtiment.": "Choose a building.", "Saisis une valeur numérique.": "Enter a numeric value.",
    "La valeur ne peut pas être négative.": "The value cannot be negative.", "La valeur est trop grande.": "The value is too large.",
    "Le seuil doit être supérieur à 0.": "The threshold must be greater than 0.", "Le seuil est trop grand.": "The threshold is too large.",
    "Choisis une date valide.": "Choose a valid date.", "Choisis une heure valide.": "Choose a valid time.",
    "Le module C accepte 500 mesures maximum : supprime-en avant d'en ajouter.": "Module C accepts 500 measurements at most: delete some before adding more.",
    "Aucune alerte. Tout est sous le seuil.": "No alerts. Everything is under the threshold.",
    "Aucune alerte. Toutes les mesures sont sous leur seuil.": "No alerts. All measurements are under their threshold.",
    "Aucune alerte (aucune donnée sur cette période).": "No alerts (no data in this period).",
    "Aucune mesure sur cette période.": "No measurements in this period.", "Aucune mesure sur cette période": "No measurements in this period",
    "Aucune mesure pour ce bâtiment sur la période choisie.": "No measurements for this building in the selected period.",
    "Aucune mesure ne correspond à ces filtres.": "No measurement matches these filters.",
    "Ces bâtiments n'ont aucune ressource en commun dans le filtre / la période choisis.": "These buildings have no resource in common within the selected filter / period.",
    "Comparer deux journées": "Compare two days", "Première journée": "First day", "Deuxième journée": "Second day",
    "Bâtiment de la comparaison": "Building of the comparison", "Tout le campus": "Whole campus", "Limite": "Limit",
    "Aucune ressource en commun pour ces deux journées.": "No resource in common for these two days.",
    "Les données viennent du module C": "The data comes from module C"
  };
  // Remplacements « dans le texte » (messages d'erreur de check(), mots isolés des PDF...).
  const INL = [
    ["nom de bâtiment invalide", "invalid building name"], ["valeur non numérique", "non-numeric value"], ["valeur négative", "negative value"],
    ["valeur hors limites", "value out of range"], ["le seuil doit être > 0", "threshold must be > 0"], ["seuil hors limites", "threshold out of range"],
    ["ressource inconnue", "unknown resource"], ["objet invalide", "invalid object"], ["heure invalide", "invalid time"], ["date invalide", "invalid date"],
    ["id invalide", "invalid id"], ["id en double", "duplicate id"], ["doublon bâtiment/ressource/date/heure", "duplicate building/resource/date/time"],
    ["valeur moyenne", "average value"], ["valeur totale", "total value"], ["Toutes les dates", "All dates"], ["% moyen du seuil", "average % of threshold"]
  ];
  const pl = (n, a, b) => n == 1 ? a : b;
  // Règles pour les textes qui contiennent des nombres ou des noms (appliquées l'une après l'autre).
  const RULES = [
    [/^(Électricité|Eau|Chauffage|Gaz) \((kWh|m³)\)$/g, (m, r, u) => EX[r] + " (" + u + ")"],
    [/Ouvrir les alertes/g, "Open alerts"],
    [/Mesure n°(\d+) enregistrée/g, "Measurement #$1 saved"],
    [/Mesure n°(\d+) supprimée/g, "Measurement #$1 deleted"],
    [/Mesure n°(\d+) restaurée/g, "Measurement #$1 restored"],
    [/Supprimer la mesure n°(\d+) \?/g, "Delete measurement #$1?"],
    [/Supprimer la mesure (\d+)/g, "Delete measurement $1"],
    [/Mesure invalide : /g, "Invalid measurement: "],
    [/Une mesure existe déjà pour ce bâtiment, cette ressource, cette date et cette heure \(n°(\d+)\)\./g, "A measurement already exists for this building, resource, date and time (#$1)."],
    [/(.*) le (\d{4}-\d\d-\d\d) à (\d\d:\d\d)\.$/, "$1 on $2 at $3."],
    [/(\d+) mesures sur (\d+) dans la période/g, "$1 measurements out of $2 in the period"],
    [/économisés sous les limites · (\d+) mesures sur (\d+) sont sous le seuil/g, "saved under the limits · $1 of $2 measurements are under the threshold"],
    [/(\d+) sur (\d+) mesures/g, "$1 of $2 measurements"],
    [/(\d+) changements? (?:locaux|local) · récupérer data\.json/g, (m, n) => `${n} local change${pl(n, "", "s")} · get data.json`],
    [/(\d+) changement\(s\) gardé\(s\) dans ce navigateur seront perdus et data\.json sera affiché tel quel\./g, "$1 change(s) kept in this browser will be lost and data.json will be displayed as is."],
    [/(\d+) lignes? invalides? ignorées?/g, (m, n) => `${n} invalid row${pl(n, "", "s")} ignored`],
    [/ligne (\d+) \(id ([^)]*)\) : /g, "row $1 (id $2): "],
    [/(\d+) autres? alertes?/g, (m, n) => `${n} other alert${pl(n, "", "s")}`],
    [/\((\d+) non lues?\)/g, "($1 unread)"],
    [/(\d+) non lues?/g, "$1 unread"],
    [/(\d+) au total/g, "$1 total"],
    [/(\d+) mesures\. Remplace le data\.json placé à côté de la page par ce fichier\./g, "$1 measurements. Replace the data.json placed next to the page with this file."],
    [/(\d+) mesures rechargées\./g, "$1 measurements reloaded."],
    [/ data\.json mis à jour\./g, " data.json updated."],
    [/data\.json mis à jour/g, "data.json updated"],
    [/Gardée dans ce navigateur jusqu'au téléchargement de data\.json\./g, "Kept in this browser until data.json is downloaded."],
    [/est sous son seuil\./g, "is under its threshold."],
    [/Alerte enregistrée · /g, "Alert saved · "],
    [/^Alerte · /g, "Alert · "],
    [/data\.json n'a pas pu être lu : les données de data\.js sont affichées\. Ouvre le dossier avec $/g, "data.json could not be read: the data from data.js is displayed. Open the folder with "],
    [/^ pour que la page se mette à jour toute seule\.$/g, " so that the page updates by itself."],
    [/habituel : /g, "usual: "],
    [/Stable : (\S+) % de la limite en moyenne\./g, "Stable: $1% of the limit on average."],
    [/· moyenne (.+), pic (.+) le (.+)$/g, "· average $1, peak $2 on $3"],
    [/(\d+) lignes?\b/g, (m, n) => `${n} row${pl(n, "", "s")}`],
    [/(\d+) mesures?\b/g, (m, n) => `${n} measurement${pl(n, "", "s")}`],
    [/(\d+) alertes?\b/g, (m, n) => `${n} alert${pl(n, "", "s")}`],
    [/sans alerte/g, "alert-free"],
    [/^Aucune alerte$/g, "No alerts"],
    [/\bALERTE\b/g, "ALERT"],
    [/^Période : /g, "Period: "],
    [/Données générées le /g, "Data generated on "],
    [/Exporté le /g, "Exported on "],
    [/Analyse par bâtiment · /g, "Analysis by building · "],
    [/^Comparaison : /g, "Comparison: "],
    [/\(valeur moyenne\)/g, "(average value)"],
    [/ contre /g, " versus "],
    [/^EcoCampus · Énergie du campus intelligent · Il y a alerte quand valeur > seuil\.$/g, "EcoCampus · Smart campus energy · An alert is raised when value > threshold."],
    [/ : (?=.* est [\d.,\s]+ % plus (bas|haut))/g, ": "],
    [/ est ([\d.,\s]+) % plus bas/g, " is $1% lower"],
    [/ est ([\d.,\s]+) % plus haut/g, " is $1% higher"],
    [/ (lower|higher) que /g, " $1 than "],
    [/^Comparaison de deux journées : /g, "Comparison of two days: "],
    [/(^| · )alertes$/g, "$1alerts"],
    [/^· (Électricité|Chauffage|Eau|Gaz)$/g, (m, r) => "· " + ({ "Électricité": "Electricity", "Chauffage": "Heating", "Eau": "Water", "Gaz": "Gas" })[r]],
    [/^Les données viennent du module C/g, "The data comes from module C"]
  ];
  function trCore(s, el) {
    if (s === "Annuler") return el && el.closest("[data-r]") ? "Cancel" : "Undo";
    if (Object.hasOwn(EX, s)) return EX[s];
    if (s.includes(" · ")) s = s.split(" · ").map((p) => Object.hasOwn(EX, p) ? EX[p] : p).join(" · ");
    INL.forEach(([a, b]) => s = s.split(a).join(b));
    RULES.forEach(([re, rep]) => s = s.replace(re, rep));
    // Titres des PDF « EcoCampus · Tableau de bord ».
    const x = /^(EcoCampus · )(.+)$/.exec(s);
    if (x && Object.hasOwn(EX, x[2])) s = x[1] + EX[x[2]];
    return s.replace(/(\d) %/g, "$1%");
  }
  function tr(s, el) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    return m[2] ? m[1] + trCore(m[2], el) + m[3] : s;
  }

  // ====== 4. Traduction du DOM (textes + attributs), avec mémoire du français ======
  const TN = new WeakMap(), AT = new WeakMap(), ATTRS = ["placeholder", "aria-label", "title", "alt"];
  const skip = (el) => !el || el.closest("script,style,#lg,canvas");
  function trText(n) {
    if (LANG !== "en" || skip(n.parentElement)) return;
    const v = n.data, k = TN.get(n);
    if (!v.trim() || (k && k.en === v)) return;
    const o = tr(v, n.parentElement);
    if (o !== v) {
      TN.set(n, { fr: v, en: o });
      n.data = o;
    }
  }
  function trAttr(el, a) {
    if (LANG !== "en" || skip(el) || !el.hasAttribute(a)) return;
    const v = el.getAttribute(a), mp = AT.get(el) || {}, k = mp[a];
    if (!v.trim() || (k && k.en === v)) return;
    const o = tr(v, el);
    if (o !== v) {
      mp[a] = { fr: v, en: o };
      AT.set(el, mp);
      el.setAttribute(a, o);
    }
  }
  function scan(root) {
    if (root.nodeType === 3) return trText(root);
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n = w.currentNode;
    do {
      if (n.nodeType === 3) trText(n);
      else ATTRS.forEach((a) => trAttr(n, a));
    } while ((n = w.nextNode()));
  }
  // Retour au français : on remet les textes d'origine.
  function restore(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n = w.currentNode;
    do {
      if (n.nodeType === 3) {
        const k = TN.get(n);
        if (k && k.en === n.data) n.data = k.fr;
        TN.delete(n);
      } else {
        const mp = AT.get(n);
        if (mp) Object.keys(mp).forEach((a) => {
          if (n.getAttribute(a) === mp[a].en) n.setAttribute(a, mp[a].fr);
        });
        AT.delete(n);
      }
    } while ((n = w.nextNode()));
  }
  const obs = new MutationObserver((list) => {
    obs.disconnect();
    list.forEach((r) => {
      if (r.type === "childList") r.addedNodes.forEach(scan);
      else if (r.type === "characterData") trText(r.target);
      else if (r.type === "attributes") trAttr(r.target, r.attributeName);
    });
    start();
  });
  const start = () => obs.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS });

  // ====== 5. Graphiques : libellés et info-bulles ======
  const origMk = window.mk;
  window.mk = function (id, cfg) {
    if (LANG === "en" && cfg && cfg.data && cfg.data.datasets) cfg.data.datasets.forEach((d) => {
      if (typeof d.label === "string") d.label = tr(d.label);
    });
    origMk(id, cfg);
    const c = CH[id], cb = c && c.options.plugins && c.options.plugins.tooltip && c.options.plugins.tooltip.callbacks;
    if (cb && cb.label) {
      const lb = cb.label;
      cb.label = function (ctx) {
        const t = lb.call(this, ctx);
        return LANG === "en" ? tr(String(t).replace(/aucune mesure pour cette ressource/, "no measurement for this resource").replace(/aucune mesure/, "no measurement")) : t;
      };
    }
  };

  // ====== 6. Bouton FR / EN ======
  function setLang(l, first) {
    LANG = l;
    try {
      localStorage.setItem(KEY, l);
    } catch (e) {
    }
    document.documentElement.lang = l;
    const b = document.getElementById("lg");
    b.textContent = l == "en" ? "FR" : "EN";
    b.setAttribute("aria-label", l == "en" ? "Switch to French" : "Passer en anglais");
    b.title = l == "en" ? "Switch to French" : "Passer en anglais";
    obs.disconnect();
    if (l == "fr") restore(document.body);
    patchData();
    if (l == "en") scan(document.body);
    if (first) return start();
    // Réaffiche la page avec la nouvelle langue (sans perdre la position ni les filtres).
    const y = scrollY;
    $("#ns").innerHTML = "";
    try {
      fill();
      setSync();
      renderAll();
      if ($("#np").classList.contains("on")) renderPanel();
      syncAlerts(false);
    } catch (e) {
    }
    scrollTo({ top: y });
    if (l == "en") scan(document.body);
    start();
  }
  document.getElementById("lg").onclick = () => setLang(LANG == "en" ? "fr" : "en");
  setLang(LANG, true);
})();
