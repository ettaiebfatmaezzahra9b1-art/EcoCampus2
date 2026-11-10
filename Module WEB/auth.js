/* EcoCampus - animation d'ouverture + page de connexion / création de compte.
   Pas de PHP, pas de base de données : tout est gardé dans le navigateur (localStorage).

     eco-users    : la liste des comptes  [{ name, email, salt, hp, hs, created }]
                    (le mot de passe n'est jamais stocké en clair : on garde son empreinte salée)
     eco-session  : le compte connecté (localStorage si « Rester connecté », sinon sessionStorage)

   Ce fichier est indépendant de script.js : il cache le site tant que personne n'est connecté.
   Il lit seulement la langue choisie (clé « eco-lang ») et utilise le bouton FR / EN existant. */
(() => {
  const USERS = "eco-users", SESS = "eco-session", LANGK = "eco-lang";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = $("#auth");
  if (!root) return;

  // ====== 1. Textes (français / anglais) ======
  const T = {
    fr: {
      welcome: "Bienvenue", welcome2: "Créez votre compte",
      sub: "Connectez-vous pour accéder au tableau de bord énergétique du campus.",
      sub2: "Un compte est nécessaire pour accéder à EcoCampus.",
      tabIn: "Connexion", tabUp: "Créer un compte",
      name: "Nom complet", email: "Adresse e-mail", pw: "Mot de passe", pw2: "Confirmer le mot de passe",
      remember: "Rester connecté", btnIn: "Se connecter", btnUp: "Créer mon compte",
      note: "Les comptes sont enregistrés uniquement dans ce navigateur (localStorage).",
      phName: "ex. Sami Ben Ali", phEmail: "nom@exemple.com", phPw: "6 caractères minimum", phPw2: "Retapez le mot de passe",
      show: "Afficher le mot de passe", hide: "Masquer le mot de passe", logout: "Se déconnecter", lang: "Changer de langue",
      sWeak: "Faible", sMid: "Moyen", sStrong: "Fort",
      forgot: "Mot de passe oublié ?", back: "Retour à la connexion", btnFp: "Réinitialiser le mot de passe", pwNew: "Nouveau mot de passe",
      welcome3: "Mot de passe oublié", sub3: "Saisissez votre e-mail et choisissez un nouveau mot de passe. Aucun e-mail n'est envoyé : tout reste dans ce navigateur.",
      okReset: "Mot de passe modifié. Connectez-vous avec le nouveau.", guest: "Continuer en invité", guestName: "Invité",
      eEmpty: "Veuillez remplir tous les champs.", eMail: "Adresse e-mail invalide.", eName: "Le nom doit contenir au moins 2 caractères.",
      ePw: "Le mot de passe doit contenir au moins 6 caractères.", eMatch: "Les deux mots de passe ne sont pas identiques.",
      eExists: "Un compte existe déjà avec cette adresse e-mail.", eBad: "E-mail ou mot de passe incorrect.",
      eNone: "Aucun compte avec cette adresse : créez-en un d'abord.", eStore: "Impossible d'enregistrer le compte (stockage du navigateur désactivé).", eHash: "Ce compte a été créé dans un autre contexte de navigation : impossible de vérifier le mot de passe ici."
    },
    en: {
      welcome: "Welcome back", welcome2: "Create your account",
      sub: "Sign in to access the campus energy dashboard.",
      sub2: "An account is required to access EcoCampus.",
      tabIn: "Sign in", tabUp: "Create account",
      name: "Full name", email: "E-mail address", pw: "Password", pw2: "Confirm password",
      remember: "Keep me signed in", btnIn: "Sign in", btnUp: "Create my account",
      note: "Accounts are stored only in this browser (localStorage).",
      phName: "e.g. Sami Ben Ali", phEmail: "name@example.com", phPw: "6 characters minimum", phPw2: "Type the password again",
      show: "Show password", hide: "Hide password", logout: "Sign out", lang: "Change language",
      sWeak: "Weak", sMid: "Fair", sStrong: "Strong",
      forgot: "Forgot password?", back: "Back to sign in", btnFp: "Reset password", pwNew: "New password",
      welcome3: "Forgot password", sub3: "Enter your e-mail and choose a new password. No e-mail is sent: everything stays in this browser.",
      okReset: "Password updated. Sign in with the new one.", guest: "Continue as guest", guestName: "Guest",
      eEmpty: "Please fill in all the fields.", eMail: "Invalid e-mail address.", eName: "The name must contain at least 2 characters.",
      ePw: "The password must contain at least 6 characters.", eMatch: "The two passwords do not match.",
      eExists: "An account already exists with this e-mail address.", eBad: "Incorrect e-mail or password.",
      eNone: "No account with this address: create one first.", eStore: "Unable to save the account (browser storage is disabled).", eHash: "This account was created in another browsing context: the password cannot be checked here."
    }
  };
  const lang = () => {
    try {
      return localStorage.getItem(LANGK) === "en" ? "en" : "fr";
    } catch (e) {
      return "fr";
    }
  };
  const t = (k) => T[lang()][k];

  // ====== 2. Lecture / écriture dans le navigateur ======
  const rd = (st, k, def) => {
    try {
      const v = JSON.parse(st.getItem(k));
      return v == null ? def : v;
    } catch (e) {
      return def;
    }
  };
  const wr = (st, k, v) => {
    try {
      st.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  };
  const users = () => {
    const u = rd(localStorage, USERS, []);
    return Array.isArray(u) ? u.filter((x) => x && typeof x.email == "string") : [];
  };
  const getSession = () => {
    const g = rd(sessionStorage, SESS, null);
    if (g && g.guest) return { ...g, name: g.name || t("guestName") };
    const s = g || rd(localStorage, SESS, null);
    return s && users().some((u) => u.email == s.email) ? s : null;
  };
  const setSession = (u, remember) => {
    const s = { email: u.email, name: u.name, t: Date.now() };
    try {
      sessionStorage.removeItem(SESS);
      localStorage.removeItem(SESS);
    } catch (e) {
    }
    wr(remember ? localStorage : sessionStorage, SESS, s);
  };
  const clearSession = () => {
    try {
      sessionStorage.removeItem(SESS);
      localStorage.removeItem(SESS);
    } catch (e) {
    }
  };

  // ====== 3. Mot de passe : empreinte salée (jamais en clair) ======
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Empreinte simple (secours si le navigateur n'a pas crypto.subtle, par ex. page ouverte en http).
  function weak(s) {
    let a = 0xdeadbeef, b = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 2654435761);
      b = Math.imul(b ^ c, 1597334677);
    }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return (4294967296 * (2097151 & b) + (a >>> 0)).toString(16);
  }
  async function strong(pw, salt) {
    const enc = new TextEncoder(), key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256));
  }
  const hasSubtle = () => !!(window.crypto && crypto.subtle && crypto.subtle.importKey);
  const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
  async function hashes(pw, salt) {
    return { hp: hasSubtle() ? await strong(pw, salt) : "", hs: weak(salt + pw) };
  }
  async function verify(u, pw) {
    if (u.hp && hasSubtle()) return (await strong(pw, u.salt)) === u.hp;
    if (u.hp && !u.hs) throw new Error("hash");
    return weak(u.salt + pw) === u.hs;
  }

  // ====== 4. Construction de la page ======
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const field = (id, key, icon, type, ac, ph, extra = "") => `<div class="au-f"><label for="${id}" data-k="${key}"></label><div class="au-in"><i class="bi bi-${icon}"></i><input id="${id}" name="${id}" type="${type}" autocomplete="${ac}" autocapitalize="off" spellcheck="false" data-ph="${ph}" maxlength="80" ${extra}>${type == "password" ? '<button class="au-eye" type="button" data-eye="' + id + '"><i class="bi bi-eye-fill"></i></button>' : ""}</div></div>`;
  const wrap = $("#auw");
  wrap.innerHTML = `<div class="glass au-card">
    <div class="au-top"><div class="brand"><b><i class="bi bi-tree-fill"></i></b>EcoCampus</div><button class="au-lang" id="aul" type="button"></button></div>
    <h2 id="aut"></h2><p class="au-sub" id="aus2"></p>
    <div class="au-tabs" role="tablist"><button type="button" role="tab" data-tab="in" data-k="tabIn"></button><button type="button" role="tab" data-tab="up" data-k="tabUp"></button></div>
    <form class="au-form" id="fin" name="login" method="post" action="#" novalidate>
      ${field("li-email", "email", "envelope-fill", "email", "username", "phEmail")}
      ${field("li-pw", "pw", "lock-fill", "password", "current-password", "phPw")}
      <label class="au-chk"><input type="checkbox" id="li-rm" checked><span data-k="remember"></span></label>
      <button class="au-link" type="button" id="fp-go" data-k="forgot"></button>
      <div class="au-err" id="ei" role="alert"></div>
      <button class="au-btn" type="submit"><i class="bi bi-box-arrow-in-right"></i><span data-k="btnIn"></span></button>
    </form>
    <form class="au-form" id="fup" name="signup" method="post" action="#" novalidate hidden>
      ${field("su-name", "name", "person-fill", "text", "name", "phName")}
      ${field("su-email", "email", "envelope-fill", "email", "email", "phEmail")}
      <div>${field("su-pw", "pw", "lock-fill", "password", "new-password", "phPw")}<div class="au-str" id="str"><i></i><i></i><i></i><small></small></div></div>
      ${field("su-pw2", "pw2", "shield-lock-fill", "password", "new-password", "phPw2")}
      <label class="au-chk"><input type="checkbox" id="su-rm" checked><span data-k="remember"></span></label>
      <div class="au-err" id="eu" role="alert"></div>
      <button class="au-btn" type="submit"><i class="bi bi-person-plus-fill"></i><span data-k="btnUp"></span></button>
    </form>
    <form class="au-form" id="ffp" name="reset" method="post" action="#" novalidate hidden>
      ${field("fp-email", "email", "envelope-fill", "email", "username", "phEmail")}
      ${field("fp-pw", "pwNew", "lock-fill", "password", "new-password", "phPw")}
      ${field("fp-pw2", "pw2", "shield-lock-fill", "password", "new-password", "phPw2")}
      <div class="au-err" id="ef" role="alert"></div>
      <button class="au-btn" type="submit"><i class="bi bi-key-fill"></i><span data-k="btnFp"></span></button>
      <button class="au-link" type="button" id="fp-back" data-k="back"></button>
    </form>
    <button class="au-guest" type="button" id="aug"><i class="bi bi-person-fill"></i><span data-k="guest"></span></button>
    <p class="au-note"><i class="bi bi-hdd-fill"></i><span data-k="note"></span></p>
  </div>`;

  let tab = users().length ? "in" : "up", lastErr = { id: "", key: "" };
  // Écrit tous les textes dans la langue choisie.
  function applyLang() {
    $$("[data-k]", wrap).forEach((e) => e.textContent = t(e.dataset.k));
    $$("[data-ph]", wrap).forEach((e) => e.placeholder = t(e.dataset.ph));
    $("#aut").textContent = t(tab == "in" ? "welcome" : tab == "up" ? "welcome2" : "welcome3");
    $("#aus2").textContent = t(tab == "in" ? "sub" : tab == "up" ? "sub2" : "sub3");
    $("#aul").textContent = lang() == "en" ? "FR" : "EN";
    $("#aul").setAttribute("aria-label", t("lang"));
    $$(".au-eye", wrap).forEach((b) => {
      const sh = $("#" + b.dataset.eye).type == "text";
      b.setAttribute("aria-label", t(sh ? "hide" : "show"));
    });
    const lo = $("#lo");
    if (lo) {
      const s = getSession(), l = t("logout") + (s ? " (" + s.name + ")" : "");
      lo.setAttribute("aria-label", l);
      lo.title = l;
    }
    if (lastErr.id) (lastErr.ok ? showOk : showErr)(lastErr.id, lastErr.key);
    strength();
    document.documentElement.lang = lang();
  }
  function showErr(id, key) {
    const e = $("#" + id);
    lastErr = { id, key };
    e.textContent = t(key);
    e.classList.remove("shake", "au-ok");
    void e.offsetWidth;
    e.classList.add("shake");
  }
  function showOk(id, key) {
    const e = $("#" + id);
    lastErr = { id, key, ok: true };
    e.textContent = t(key);
    e.classList.add("au-ok");
  }
  function clearErr() {
    lastErr = { id: "", key: "" };
    $$(".au-err", wrap).forEach((e) => {
      e.textContent = "";
      e.classList.remove("au-ok");
    });
    $$("input[aria-invalid]", wrap).forEach((i) => i.removeAttribute("aria-invalid"));
  }
  function setTab(x) {
    tab = x;
    clearErr();
    $("#fin").hidden = x != "in";
    $("#fup").hidden = x != "up";
    $("#ffp").hidden = x != "fp";
    $("#aug").hidden = x == "fp";
    $$(".au-tabs button", wrap).forEach((b) => {
      b.classList.toggle("on", b.dataset.tab == x);
      b.setAttribute("aria-selected", b.dataset.tab == x);
    });
    applyLang();
    setTimeout(() => $(x == "in" ? "#li-email" : x == "up" ? "#su-name" : "#fp-email").focus({ preventScroll: true }), 50);
  }
  function bad(id, key, input) {
    showErr(id, key);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
    return false;
  }
  // Barre de solidité du mot de passe (inscription).
  function strength() {
    const v = $("#su-pw").value, bars = $$("#str i"), mix = /[A-Z]/.test(v) && /\d/.test(v) || /[^A-Za-z0-9]/.test(v);
    const lv = !v ? 0 : v.length < 6 ? 1 : Math.min(3, 1 + (v.length >= 10) + mix) || 1;
    bars.forEach((b, i) => b.className = i < lv ? "on" + lv : "");
    $("#str small").textContent = lv ? t(["", "sWeak", "sMid", "sStrong"][lv]) : "";
  }

  // ====== 5. Connexion et création de compte ======
  function enter(u, remember) {
    setSession(u, remember);
    unlock();
  }
  $("#fin").onsubmit = async (e) => {
    e.preventDefault();
    clearErr();
    const em = $("#li-email"), pw = $("#li-pw"), email = em.value.trim().toLowerCase();
    if (!email || !pw.value) return bad("ei", "eEmpty", email ? pw : em);
    if (!EMAIL.test(email)) return bad("ei", "eMail", em);
    const u = users().find((x) => x.email == email);
    if (!u) return bad("ei", "eNone", em);
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    try {
      if (!await verify(u, pw.value)) return bad("ei", "eBad", pw);
      pw.value = "";
      enter(u, $("#li-rm").checked);
    } catch (err) {
      bad("ei", err.message == "hash" ? "eHash" : "eBad", pw);
    } finally {
      btn.disabled = false;
    }
  };
  $("#fup").onsubmit = async (e) => {
    e.preventDefault();
    clearErr();
    const n = $("#su-name"), em = $("#su-email"), p1 = $("#su-pw"), p2 = $("#su-pw2");
    const name = n.value.trim().replace(/\s+/g, " "), email = em.value.trim().toLowerCase();
    if (!name || !email || !p1.value || !p2.value) return bad("eu", "eEmpty", !name ? n : !email ? em : !p1.value ? p1 : p2);
    if (name.length < 2) return bad("eu", "eName", n);
    if (!EMAIL.test(email)) return bad("eu", "eMail", em);
    if (p1.value.length < 6) return bad("eu", "ePw", p1);
    if (p1.value !== p2.value) return bad("eu", "eMatch", p2);
    const list = users();
    if (list.some((x) => x.email == email)) return bad("eu", "eExists", em);
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    try {
      const salt = newSalt(), u = { name, email, salt, ...await hashes(p1.value, salt), created: new Date().toISOString() };
      list.push(u);
      if (!wr(localStorage, USERS, list)) return bad("eu", "eStore");
      p1.value = p2.value = "";
      enter(u, $("#su-rm").checked);
    } finally {
      btn.disabled = false;
    }
  };
  // Mot de passe oublié : pas de serveur, donc aucun e-mail envoyé. On vérifie que le compte existe dans ce navigateur.
  $("#fp-go").onclick = () => {
    const v = $("#li-email").value.trim();
    setTab("fp");
    if (v) $("#fp-email").value = v;
  };
  $("#fp-back").onclick = () => setTab("in");
  $("#ffp").onsubmit = async (e) => {
    e.preventDefault();
    clearErr();
    const em = $("#fp-email"), p1 = $("#fp-pw"), p2 = $("#fp-pw2"), email = em.value.trim().toLowerCase();
    if (!email || !p1.value || !p2.value) return bad("ef", "eEmpty", !email ? em : !p1.value ? p1 : p2);
    if (!EMAIL.test(email)) return bad("ef", "eMail", em);
    const list = users(), i = list.findIndex((x) => x.email == email);
    if (i < 0) return bad("ef", "eNone", em);
    if (p1.value.length < 6) return bad("ef", "ePw", p1);
    if (p1.value !== p2.value) return bad("ef", "eMatch", p2);
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    try {
      const salt = newSalt();
      list[i] = { ...list[i], salt, ...await hashes(p1.value, salt) };
      if (!wr(localStorage, USERS, list)) return bad("ef", "eStore");
      p1.value = p2.value = "";
      setTab("in");
      $("#li-email").value = email;
      showOk("ei", "okReset");
    } finally {
      btn.disabled = false;
    }
  };
  // Continuer en invité : session de l'onglet seulement, aucun compte n'est créé ni enregistré.
  $("#aug").onclick = () => {
    try {
      sessionStorage.removeItem(SESS);
      localStorage.removeItem(SESS);
    } catch (e) {
    }
    if (!wr(sessionStorage, SESS, { guest: true, t: Date.now() })) return;
    unlock();
  };
  $$(".au-tabs button", wrap).forEach((b) => b.onclick = () => setTab(b.dataset.tab));
  $$(".au-eye", wrap).forEach((b) => b.onclick = () => {
    const i = $("#" + b.dataset.eye), show = i.type == "password";
    i.type = show ? "text" : "password";
    b.firstElementChild.className = "bi bi-eye" + (show ? "-slash" : "") + "-fill";
    b.setAttribute("aria-label", t(show ? "hide" : "show"));
    i.focus();
  });
  $$("input", wrap).forEach((i) => i.addEventListener("input", () => {
    i.removeAttribute("aria-invalid");
    if (i.id == "su-pw") strength();
  }));
  // Bouton de langue de la page de connexion : il actionne le bouton FR / EN du site.
  $("#aul").onclick = () => {
    const b = document.getElementById("lg");
    if (b) b.click();
    else {
      try {
        localStorage.setItem(LANGK, lang() == "en" ? "fr" : "en");
      } catch (e) {
      }
    }
    applyLang();
  };
  const lg = document.getElementById("lg");
  if (lg) lg.addEventListener("click", () => setTimeout(applyLang, 0));

  // ====== 6. Animation d'ouverture, accès au site et déconnexion ======
  const splash = $("#aus"), rm = matchMedia("(prefers-reduced-motion: reduce)").matches, DUR = rm ? 700 : 3000;
  let splashDone = false, timer = 0;
  function afterSplash() {
    if (splashDone) return;
    splashDone = true;
    clearTimeout(timer);
    if (getSession()) return unlock();
    splash.classList.add("gone");
    setTimeout(() => {
      splash.hidden = true;
      wrap.hidden = false;
      setTab(tab);
    }, 450);
  }
  function unlock() {
    emit();
    root.classList.add("out");
    document.body.classList.remove("auth-locked");
    addLogout();
    applyLang();
    setTimeout(() => {
      root.hidden = true;
    }, 700);
  }
  function lock() {
    clearSession();
    emit();
    clearErr();
    $$("input", wrap).forEach((i) => {
      if (i.type != "checkbox") i.value = "";
      if (/pw2?$/.test(i.id)) i.type = "password";
    });
    $$(".au-eye i", wrap).forEach((i) => i.className = "bi bi-eye-fill");
    document.body.classList.add("auth-locked");
    root.hidden = false;
    splash.hidden = true;
    wrap.hidden = false;
    void root.offsetWidth;
    root.classList.remove("out");
    tab = users().length ? "in" : "up";
    setTab(tab);
  }
  // Bouton « Se déconnecter » ajouté à la barre du haut, à côté du bouton de thème.
  function addLogout() {
    if ($("#lo")) return applyLang();
    const tg = document.getElementById("tg");
    if (!tg) return;
    const b = document.createElement("button");
    b.id = "lo";
    b.className = "lo";
    b.type = "button";
    b.innerHTML = '<i class="bi bi-box-arrow-right"></i>';
    b.onclick = lock;
    tg.parentNode.insertBefore(b, tg);
  }
  // On peut passer l'animation par un clic ou une touche.
  const skip = () => {
    if (!splashDone) afterSplash();
  };
  root.addEventListener("click", skip);
  document.addEventListener("keydown", (e) => {
    if (!splashDone && (e.key == "Enter" || e.key == " " || e.key == "Escape")) skip();
  });
  // ====== 7. Petite API pour account.js (nom, photo et mot de passe du compte connecté) ======
  const cur = () => {
    const s = getSession();
    if (s && s.guest) return { name: s.name, email: "—", photo: s.photo, created: new Date(s.t || Date.now()).toISOString(), guest: true };
    return s ? users().find((u) => u.email == s.email) || null : null;
  };
  const emit = () => document.dispatchEvent(new CustomEvent("eco-auth", { detail: { user: cur() } }));
  function save(patch) {
    const s0 = getSession();
    if (s0 && s0.guest) {
      const g = rd(sessionStorage, SESS, null) || { guest: true };
      if (!wr(sessionStorage, SESS, { ...g, ...patch })) return false;
      applyLang();
      emit();
      return true;
    }
    const list = users(), s = getSession(), i = s ? list.findIndex((u) => u.email == s.email) : -1;
    if (i < 0) return false;
    list[i] = { ...list[i], ...patch };
    if (!wr(localStorage, USERS, list)) return false;
    if (patch.name) {
      const st = rd(sessionStorage, SESS, null) ? sessionStorage : localStorage;
      wr(st, SESS, { ...s, name: patch.name });
    }
    applyLang();
    emit();
    return true;
  }
  window.EcoAuth = {
    user: cur,
    save,
    checkPassword: (pw) => verify(cur(), pw).catch(() => false),
    async setPassword(pw) {
      const salt = newSalt();
      return save({ salt, ...await hashes(pw, salt) });
    }
  };
  applyLang();
  timer = setTimeout(afterSplash, DUR);
})();
