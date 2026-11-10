# EcoCampus - Module Web (phase 3)

Fichiers : `index.html`, `style.css`, `script.js`, `data.json` (genere par le module C), `data.js` (copie de data.json
pour l'ouverture sans serveur), `vendor/chart.umd.js` (Chart.js).

## Lancer
Ouvrir le dossier dans VS Code puis **Go Live** (extension Live Server). La page lit `data.json` toute seule et se
met a jour toutes les 10 s quand le module C regenere le fichier. Sans serveur (double-clic), la page affiche `data.js`.

## Remarques
- Les icones (Bootstrap Icons) et les polices (Google Fonts) viennent d'Internet.
- Ajouter ou supprimer une mesure sur la page est garde dans le navigateur. Pour l'envoyer au module C :
  page Ajouter > Exporter CSV (format measures_in.csv), ou Profil > Telecharger data.json.

## Connexion (auth.js, auth.css)
A l'ouverture : animation avec le nom EcoCampus, puis page de connexion / creation de compte. Pas de PHP ni de base de
donnees : les comptes sont gardes dans le navigateur (`localStorage`, cle `eco-users`), le mot de passe est enregistre
sous forme d'empreinte salee, jamais en clair. La session est dans `eco-session`. Bouton « Se deconnecter » dans la barre
du haut. Attention : c'est une protection d'interface uniquement (tout est cote navigateur).
Mot de passe oublie : lien sous le formulaire de connexion. Comme il n'y a pas de serveur, aucun e-mail n'est envoye : on saisit
l'e-mail du compte (qui doit exister dans ce navigateur) et un nouveau mot de passe, qui remplace l'ancienne empreinte.
Continuer en invite : acces au tableau de bord sans compte. La session d'invite vit seulement dans l'onglet (sessionStorage),
aucun compte n'est cree ; l'invite peut changer son nom et sa photo pendant la session, mais n'a pas de mot de passe.
Compte connecte (account.js) : le nom et la photo apparaissent dans la barre du haut et sur le tableau de bord ;
la page Profil permet de changer la photo (recadree en carre, gardee dans localStorage), le nom et le mot de passe.
