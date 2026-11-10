/* EcoCampus - compte connecté : nom affiché dans la barre du haut et sur le tableau de bord,
   et page Profil (informations du compte, changement de photo, de nom et de mot de passe).
   Les données viennent de auth.js (window.EcoAuth) et restent dans le navigateur (localStorage). */
(() => {
  const A = window.EcoAuth;
  if (!A) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const lang = () => {
    try {
      return localStorage.getItem("eco-lang") === "en" ? "en" : "fr";
    } catch (e) {
      return "fr";
    }
  };
  const T = {
    fr: {
      hello: "Bonjour", helloSub: "Voici l'état énergétique du campus.", profile: "Voir mon profil",
      title: "Mon compte", photo: "Photo de profil", change: "Changer la photo", remove: "Supprimer la photo",
      photoHint: "Image JPG, PNG ou WebP. Elle est recadrée en carré et gardée dans ce navigateur.",
      info: "Informations", name: "Nom complet", email: "Adresse e-mail", since: "Membre depuis", save: "Enregistrer",
      pwTitle: "Changer le mot de passe", pwOld: "Mot de passe actuel", pwNew: "Nouveau mot de passe", pwNew2: "Confirmer le nouveau mot de passe",
      pwBtn: "Changer le mot de passe",
      eName: "Le nom doit contenir au moins 2 caractères.", eImg: "Choisissez une image (JPG, PNG ou WebP).", eBig: "Image trop lourde (5 Mo maximum).",
      eRead: "Impossible de lire cette image.", eSave: "Impossible d'enregistrer (stockage du navigateur plein ou désactivé).",
      ePwEmpty: "Remplissez les trois champs.", ePwOld: "Le mot de passe actuel est incorrect.", ePwLen: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
      ePwMatch: "Les deux nouveaux mots de passe ne sont pas identiques.", ePwSame: "Le nouveau mot de passe doit être différent de l'ancien.",
      okPhoto: "Photo de profil mise à jour", okPhotoDel: "Photo de profil supprimée", okName: "Nom mis à jour", okPw: "Mot de passe modifié",
      okBody: "Les changements sont gardés dans ce navigateur."
    },
    en: {
      hello: "Hello", helloSub: "Here is the campus energy overview.", profile: "View my profile",
      title: "My account", photo: "Profile picture", change: "Change photo", remove: "Remove photo",
      photoHint: "JPG, PNG or WebP image. It is cropped to a square and kept in this browser.",
      info: "Information", name: "Full name", email: "E-mail address", since: "Member since", save: "Save",
      pwTitle: "Change password", pwOld: "Current password", pwNew: "New password", pwNew2: "Confirm new password",
      pwBtn: "Change password",
      eName: "The name must contain at least 2 characters.", eImg: "Choose an image (JPG, PNG or WebP).", eBig: "Image too large (5 MB maximum).",
      eRead: "This image cannot be read.", eSave: "Unable to save (browser storage is full or disabled).",
      ePwEmpty: "Fill in the three fields.", ePwOld: "The current password is incorrect.", ePwLen: "The new password must contain at least 6 characters.",
      ePwMatch: "The two new passwords do not match.", ePwSame: "The new password must be different from the old one.",
      okPhoto: "Profile picture updated", okPhotoDel: "Profile picture removed", okName: "Name updated", okPw: "Password changed",
      okBody: "The changes are kept in this browser."
    }
  };
  const t = (k) => T[lang()][k];
  const ok = (k) => typeof notify == "function" && notify({ t: "ok", title: t(k), body: t("okBody"), ms: 4500 });
  const initials = (n) => (n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
  const first = (n) => n.trim().split(/\s+/)[0] || n;
  const avatar = (u) => u.photo ? `<img src="${esc(u.photo)}" alt="">` : esc(initials(u.name));
  const since = (u) => {
    const d = new Date(u.created);
    return isNaN(d) ? "–" : d.toLocaleDateString(lang() == "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
  };

  // ====== 1. Éléments ajoutés à la page (une seule fois) ======
  // Puce « avatar + nom » dans la barre du haut.
  const me = document.createElement("button");
  me.id = "me";
  me.className = "me";
  me.type = "button";
  const top = $(".top"), anchor = $("#lo") || $("#tg");
  if (top && anchor) top.insertBefore(me, anchor);
  me.onclick = () => {
    const nav = $('.nav[data-v="profile"]');
    if (nav) nav.click();
  };
  // Bonjour, <prénom> en haut du tableau de bord.
  const hello = document.createElement("div");
  hello.className = "hello";
  hello.id = "hello";
  const dash = $("#v-dashboard");
  if (dash) dash.insertBefore(hello, dash.firstChild);
  // Carte « Mon compte » dans la page Profil.
  const acc = document.createElement("div");
  acc.className = "glass card acc";
  acc.id = "acc";
  acc.style.gridColumn = "1 / -1";
  acc.innerHTML = `<h3 data-k="title"></h3>
    <div class="acc-grid">
      <div class="acc-photo">
        <div class="av acc-av" id="acc-av"></div>
        <div class="sub" data-k="photo" style="font-weight:700"></div>
        <div class="acc-btns">
          <button class="btn sm" id="acc-ch" type="button"><i class="bi bi-camera-fill"></i> <span data-k="change"></span></button>
          <button class="btn sm ghost" id="acc-rm" type="button"><i class="bi bi-trash3-fill"></i> <span data-k="remove"></span></button>
        </div>
        <input type="file" id="acc-file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
        <p class="sub" data-k="photoHint"></p>
        <div class="err" id="acc-e0" role="alert"></div>
      </div>
      <form class="f" id="acc-fn" novalidate>
        <div class="sub" data-k="info" style="font-weight:700"></div>
        <label><span data-k="name"></span><input id="acc-name" name="acc-name" maxlength="60" autocomplete="name"></label>
        <label><span data-k="email"></span><input id="acc-email" name="acc-email" readonly autocomplete="off"></label>
        <p class="sub"><span data-k="since"></span> : <b id="acc-since"></b></p>
        <div class="err" id="acc-e1" role="alert"></div>
        <button class="btn sm" type="submit"><i class="bi bi-save2-fill"></i> <span data-k="save"></span></button>
      </form>
      <form class="f" id="acc-fp" novalidate>
        <div class="sub" data-k="pwTitle" style="font-weight:700"></div>
        <label><span data-k="pwOld"></span><input id="acc-p0" name="acc-p0" type="password" maxlength="80" autocomplete="current-password"></label>
        <label><span data-k="pwNew"></span><input id="acc-p1" name="acc-p1" type="password" maxlength="80" autocomplete="new-password"></label>
        <label><span data-k="pwNew2"></span><input id="acc-p2" name="acc-p2" type="password" maxlength="80" autocomplete="new-password"></label>
        <div class="err" id="acc-e2" role="alert"></div>
        <button class="btn sm" type="submit"><i class="bi bi-key-fill"></i> <span data-k="pwBtn"></span></button>
      </form>
    </div>`;
  const grid = $("#v-profile .grid");
  if (grid) grid.appendChild(acc);

  // ====== 2. Affichage du compte connecté ======
  function render() {
    const u = A.user();
    if (!u) return;
    me.innerHTML = `<span class="me-av">${avatar(u)}</span><span class="me-n">${esc(first(u.name))}</span>`;
    me.title = `${t("profile")} (${u.name})`;
    me.setAttribute("aria-label", me.title);
    hello.innerHTML = `<span class="me-av big">${avatar(u)}</span><div><h2>${esc(t("hello"))}, ${esc(first(u.name))}</h2><p class="sub">${esc(t("helloSub"))}</p></div>`;
    // Carte d'identité existante de la page Profil : on remplace le nom et le rôle d'exemple par ceux du compte.
    const id = $("#v-profile .glass.card"), av = id && $(".av", id), h = id && $("h3", id), p = id && $("p.sub", id);
    if (id && id !== acc && av && h && p) {
      av.innerHTML = avatar(u);
      av.classList.add("has-name");
      h.textContent = u.name;
      p.textContent = u.email;
    }
    $("#acc-av").innerHTML = avatar(u);
    $("#acc-rm").hidden = !u.photo;
    if (document.activeElement !== $("#acc-name")) $("#acc-name").value = u.name;
    $("#acc-email").value = u.email;
    $("#acc-since").textContent = since(u);
    $("#acc-fp").style.display = u.guest ? "none" : "";
    $$("[data-k]", acc).forEach((e) => e.textContent = t(e.dataset.k));
  }
  document.addEventListener("eco-auth", render);
  const lg = $("#lg");
  if (lg) lg.addEventListener("click", () => setTimeout(render, 0));
  render();

  // ====== 3. Photo de profil (recadrée en carré 256 px, gardée en base64 dans localStorage) ======
  const err = (id, k) => {
    $("#" + id).textContent = k ? t(k) : "";
    return false;
  };
  $("#acc-ch").onclick = () => $("#acc-file").click();
  $("#acc-file").onchange = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    err("acc-e0");
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return err("acc-e0", "eImg");
    if (f.size > 5 * 1024 * 1024) return err("acc-e0", "eBig");
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const S = 256, c = document.createElement("canvas"), k = Math.min(img.width, img.height);
      c.width = c.height = S;
      c.getContext("2d").drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, S, S);
      if (A.save({ photo: c.toDataURL("image/jpeg", 0.85) })) ok("okPhoto");
      else err("acc-e0", "eSave");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      err("acc-e0", "eRead");
    };
    img.src = url;
  };
  $("#acc-rm").onclick = () => {
    err("acc-e0");
    if (A.save({ photo: "" })) ok("okPhotoDel");
    else err("acc-e0", "eSave");
  };

  // ====== 4. Nom et mot de passe ======
  $("#acc-fn").onsubmit = (e) => {
    e.preventDefault();
    const name = $("#acc-name").value.trim().replace(/\s+/g, " ");
    err("acc-e1");
    if (name.length < 2) return err("acc-e1", "eName");
    if (A.save({ name })) ok("okName");
    else err("acc-e1", "eSave");
  };
  $("#acc-fp").onsubmit = async (e) => {
    e.preventDefault();
    const p0 = $("#acc-p0"), p1 = $("#acc-p1"), p2 = $("#acc-p2");
    err("acc-e2");
    if (!p0.value || !p1.value || !p2.value) return err("acc-e2", "ePwEmpty");
    if (!await A.checkPassword(p0.value)) return err("acc-e2", "ePwOld");
    if (p1.value.length < 6) return err("acc-e2", "ePwLen");
    if (p1.value !== p2.value) return err("acc-e2", "ePwMatch");
    if (p1.value === p0.value) return err("acc-e2", "ePwSame");
    if (await A.setPassword(p1.value)) {
      p0.value = p1.value = p2.value = "";
      ok("okPw");
    } else err("acc-e2", "eSave");
  };
})();
