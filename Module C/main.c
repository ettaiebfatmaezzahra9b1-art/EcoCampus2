#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include "gestion.h"

/* ===================================================================== */
/*  SAISIES PROTEGEES : on verifie tout ce que l'utilisateur tape         */
/* ===================================================================== */

static char *nettoyer(char *s) {                    /* enleve les espaces autour */
    while (isspace((unsigned char)*s)) s++;
    char *fin = s + strlen(s);
    while (fin > s && isspace((unsigned char)fin[-1])) *--fin = '\0';
    return s;
}

/* Lit une ligne au clavier. Retourne 0 si l'entree est terminee (Ctrl+D / fin de fichier). */
static int lire_ligne(const char *invite, char *buf, size_t taille) {
    char brut[256];
    if (invite) { printf("%s", invite); fflush(stdout); }
    if (!fgets(brut, sizeof brut, stdin)) return 0;
    if (!strchr(brut, '\n')) { int c; while ((c = getchar()) != '\n' && c != EOF) ; }
    char *s = nettoyer(brut);
    if (strlen(s) >= taille) s[taille - 1] = '\0';
    strcpy(buf, s);
    return 1;
}

/* Demande un entier entre min et max (redemande tant que c'est invalide) */
static int lire_entier(const char *invite, int min, int max, int *out) {
    char buf[64];
    for (;;) {
        if (!lire_ligne(invite, buf, sizeof buf)) return 0;
        char *fin;
        long v = strtol(buf, &fin, 10);
        if (buf[0] != '\0' && *fin == '\0' && v >= min && v <= max) { *out = (int)v; return 1; }
        printf("Valeur invalide (nombre entre %d et %d).\n", min, max);
    }
}

/* Demande un nombre positif (la virgule est acceptee comme point) */
static int lire_reel(const char *invite, double *out) {
    char buf[64];
    for (;;) {
        if (!lire_ligne(invite, buf, sizeof buf)) return 0;
        for (char *p = buf; *p; p++) if (*p == ',') *p = '.';
        char *fin;
        double v = strtod(buf, &fin);
        if (buf[0] != '\0' && *fin == '\0' && isfinite(v) && v >= 0) { *out = v; return 1; }
        printf("Valeur invalide (nombre positif, ex. 152.4).\n");
    }
}

static int confirmer(const char *question) {
    char buf[16];
    if (!lire_ligne(question, buf, sizeof buf)) return 0;
    return buf[0] == 'o' || buf[0] == 'O' || buf[0] == 'y' || buf[0] == 'Y';
}

/* Demande une date. Si vide_ok, un Entree donne une date vide. */
static int lire_date(const char *invite, char *out, int vide_ok) {
    char buf[32];
    for (;;) {
        if (!lire_ligne(invite, buf, sizeof buf)) return 0;
        if (buf[0] == '\0' && vide_ok) { out[0] = '\0'; return 1; }
        if (date_valide(buf)) { strcpy(out, buf); return 1; }
        printf("Date invalide (format AAAA-MM-JJ).\n");
    }
}

/* ===================================================================== */
/*  CHOIX DANS UNE LISTE (plus simple et plus sur que de taper un nom)    */
/* ===================================================================== */

static int choisir_batiment(const char *invite, int autoriser_nouveau, char *out) {
    char noms[MAX_STATS][TXT];
    int nb = lister_batiments(noms);
    printf("%s\n", invite);
    for (int i = 0; i < nb; i++) printf("  %d. %s\n", i + 1, noms[i]);
    if (autoriser_nouveau) printf("  0. Nouveau batiment\n");
    int c;
    if (!lire_entier("Votre choix : ", autoriser_nouveau ? 0 : 1, nb, &c)) return 0;
    if (c >= 1) { strcpy(out, noms[c - 1]); return 1; }
    char buf[64];
    for (;;) {                                       /* nouveau batiment : on verifie le nom */
        if (!lire_ligne("Nom du nouveau batiment (lettres, chiffres, _ ou -) : ", buf, sizeof buf)) return 0;
        int ok = buf[0] != '\0' && strlen(buf) < TXT;
        for (int i = 0; buf[i] && ok; i++)
            ok = isalnum((unsigned char)buf[i]) || buf[i] == '_' || buf[i] == '-';
        if (ok) { strcpy(out, buf); return 1; }
        printf("Nom invalide.\n");
    }
}

static int choisir_ressource(const char *invite, char *out) {
    printf("%s\n", invite);
    for (int i = 0; i < NB_RESSOURCES; i++) printf("  %d. %s (%s)\n", i + 1, RESSOURCES[i], unite(RESSOURCES[i]));
    int c;
    if (!lire_entier("Votre choix : ", 1, NB_RESSOURCES, &c)) return 0;
    strcpy(out, RESSOURCES[c - 1]);
    return 1;
}

/* ===================================================================== */
/*  ACTIONS DU MENU (chacune retourne 1 si les donnees ont change)        */
/* ===================================================================== */

static int action_ajouter(void) {
    Mesure m;
    memset(&m, 0, sizeof m);
    m.id = prochain_id();
    printf("\n--- Ajouter une mesure (id attribue : %d) ---\n", m.id);
    if (!choisir_batiment("Batiment :", 1, m.batiment)) return 0;
    if (!choisir_ressource("Ressource :", m.ressource)) return 0;
    char invite[96];
    snprintf(invite, sizeof invite, "Valeur consommee (%s) : ", unite(m.ressource));
    if (!lire_reel(invite, &m.valeur)) return 0;

    /* seuil propose : celui de la derniere mesure du meme batiment et de la meme ressource */
    double seuil_defaut = 0;
    for (int i = 0; i < nb_mesures; i++)
        if (egal(mesures[i].batiment, m.batiment) && egal(mesures[i].ressource, m.ressource))
            seuil_defaut = mesures[i].seuil;
    for (;;) {
        char buf[64];
        if (seuil_defaut > 0) snprintf(invite, sizeof invite, "Seuil [%.2f, Entree = garder] : ", seuil_defaut);
        else snprintf(invite, sizeof invite, "Seuil de reference : ");
        if (!lire_ligne(invite, buf, sizeof buf)) return 0;
        if (buf[0] == '\0' && seuil_defaut > 0) { m.seuil = seuil_defaut; break; }
        char *fin;
        double v = strtod(buf, &fin);
        if (buf[0] != '\0' && *fin == '\0' && v > 0) { m.seuil = v; break; }
        printf("Seuil invalide (nombre > 0).\n");
    }

    char auj[11], maint[6];
    date_du_jour(auj);
    heure_actuelle(maint);
    snprintf(invite, sizeof invite, "Date AAAA-MM-JJ [Entree = %s] : ", auj);
    if (!lire_date(invite, m.date, 1)) return 0;
    if (m.date[0] == '\0') strcpy(m.date, auj);
    for (;;) {
        char buf[16];
        snprintf(invite, sizeof invite, "Heure HH:MM [Entree = %s] : ", maint);
        if (!lire_ligne(invite, buf, sizeof buf)) return 0;
        if (buf[0] == '\0') { strcpy(m.heure, maint); break; }
        if (heure_valide(buf)) { strcpy(m.heure, buf); break; }
        printf("Heure invalide (format HH:MM).\n");
    }

    const char *erreur;
    if (!ajouter(&m, &erreur)) { printf("Mesure refusee : %s\n", erreur); return 0; }
    printf("Mesure %d ajoutee.\n", m.id);
    if (est_alerte(&m))
        printf("!! ALERTE : %.2f %s depasse le seuil de %.2f (+%.1f%%).\n",
               m.valeur, unite(m.ressource), m.seuil, depassement(&m));
    return 1;
}

static void action_rechercher(void) {
    printf("\n--- Rechercher ---\n"
           "  1. Par batiment\n  2. Par ressource\n  3. Par batiment ET ressource\n  4. Par periode (dates)\n");
    int c;
    if (!lire_entier("Votre choix : ", 1, 4, &c)) return;
    char bat[TXT] = "", res[TXT] = "", debut[11] = "", fin[11] = "";
    if ((c == 1 || c == 3) && !choisir_batiment("Batiment :", 0, bat)) return;
    if ((c == 2 || c == 3) && !choisir_ressource("Ressource :", res)) return;
    if (c == 4) {
        if (!lire_date("Date de debut AAAA-MM-JJ (Entree = sans limite) : ", debut, 1)) return;
        if (!lire_date("Date de fin   AAAA-MM-JJ (Entree = sans limite) : ", fin, 1)) return;
        if (debut[0] && fin[0] && strcmp(debut, fin) > 0) {
            printf("La date de debut est apres la date de fin.\n");
            return;
        }
    }
    printf("\n");
    int n = rechercher(bat, res, debut, fin);
    printf(n ? "%d resultat(s).\n" : "Aucun resultat.\n", n);
}

static int action_supprimer(void) {
    printf("\n--- Supprimer une mesure ---\n");
    if (nb_mesures == 0) { printf("Aucune mesure.\n"); return 0; }
    int id;
    if (!lire_entier("ID de la mesure a supprimer : ", 1, 2000000000, &id)) return 0;
    int i = trouver_id(id);
    if (i < 0) { printf("ID introuvable.\n"); return 0; }
    printf("Mesure selectionnee :\n  #%d %s / %s : %.2f %s (%s %s)\n", id, mesures[i].batiment,
           mesures[i].ressource, mesures[i].valeur, unite(mesures[i].ressource),
           mesures[i].date, mesures[i].heure);
    if (!confirmer("Confirmer la suppression ? (o/n) : ")) { printf("Suppression annulee.\n"); return 0; }
    int avant = nb_mesures;
    supprimer(id);
    printf("Suppression effectuee (%d -> %d mesures). Vous pouvez l'annuler avec l'option 5.\n", avant, nb_mesures);
    return 1;
}

static int action_restaurer(void) {
    const char *erreur;
    if (restaurer(&erreur)) {
        printf("Derniere suppression annulee : mesure restauree (%d mesures).\n", nb_mesures);
        return 1;
    }
    printf("Impossible : %s.\n", erreur);
    return 0;
}

static void action_trier(void) {
    printf("\n--- Trier les mesures ---\n"
           "  1. Consommation croissante\n  2. Consommation decroissante\n"
           "  3. Date croissante (plus ancienne d'abord)\n  4. Date decroissante (plus recente d'abord)\n"
           "  5. Batiment (ordre alphabetique)\n");
    int c;
    if (!lire_entier("Votre choix : ", 1, 5, &c)) return;
    trier(c);
    printf("Tri effectue.\n\n");
    afficher_mesures();
}

static void action_stats(void) {
    Stat st[MAX_STATS];
    int ns = calculer_stats(st);
    printf("\n===== STATISTIQUES par batiment et par ressource =====\n");
    if (ns == 0) { printf("Aucune donnee.\n"); return; }
    afficher_stats(st, ns);
}

static void action_alertes(void) {
    printf("\n--- Alertes ---\n  1. Depassements de seuil (alerte = valeur > seuil)\n"
           "  2. Pics inhabituels (valeur > 1.5 x moyenne du groupe)\n");
    int c;
    if (!lire_entier("Votre choix : ", 1, 2, &c)) return;
    printf("\n");
    int n = (c == 1) ? afficher_alertes() : afficher_pics();
    if (n == 0) printf("Aucune mesure a signaler.\n");
    else printf("%d mesure(s) a signaler.\n", n);
}

static void action_comparer(void) {
    char noms[MAX_STATS][TXT];
    if (lister_batiments(noms) < 2) { printf("\nIl faut au moins deux batiments.\n"); return; }
    char b1[TXT], b2[TXT];
    printf("\n--- Comparer deux batiments ---\n");
    if (!choisir_batiment("Premier batiment :", 0, b1)) return;
    do {
        if (!choisir_batiment("Deuxieme batiment :", 0, b2)) return;
        if (egal(b1, b2)) printf("Choisissez un batiment different.\n");
    } while (egal(b1, b2));
    comparer(b1, b2);
}

static void action_classement(void) {
    char r[TXT];
    printf("\n--- Classement des batiments ---\n");
    if (!choisir_ressource("Ressource :", r)) return;
    classement(r);
}

/* Envoie une copie de data.json dans un dossier du module Web (s'il existe) :
   dossier/data.json (lu par la page) et dossier/data.js (copie pour l'ouverture sans serveur). */
static void publier_vers_web(const char *dossier) {
    char chemin[256];
    snprintf(chemin, sizeof chemin, "%s/data.json", dossier);
    FILE *dest = fopen(chemin, "w");
    if (!dest) { printf("  (dossier %s introuvable : copie ignoree)\n", dossier); return; }
    snprintf(chemin, sizeof chemin, "%s/data.js", dossier);
    FILE *js = fopen(chemin, "w");
    FILE *src = fopen("data.json", "r");
    if (src) {
        if (js) fputs("/* Copie de data.json (ecrite par le module C) */\nwindow.ECO_DATA = ", js);
        int c;
        while ((c = fgetc(src)) != EOF) { fputc(c, dest); if (js) fputc(c, js); }
        if (js) fputs(";\n", js);
        fclose(src);
    }
    fclose(dest);
    if (js) fclose(js);
    printf("  copie envoyee dans %s (la page se met a jour toute seule)\n", dossier);
}

static int action_export_json(void) {
    if (exporter_json("data.json")) {
        printf("data.json genere (%d mesures, %d alerte(s)).\n", nb_mesures, nb_alertes_total());
        publier_vers_web("../Module_Web");
        return 1;
    }
    printf("Echec de l'export.\n");
    return 0;
}

static void action_export_csv(void) {
    if (exporter_csv("measures_out.csv")) printf("%d mesures sauvegardees dans measures_out.csv.\n", nb_mesures);
    else printf("Echec de la sauvegarde.\n");
}

static void afficher_menu(void) {
    printf("\n================================================\n"
           "                  ECO CAMPUS\n"
           "================================================\n"
           " -- GESTION DES MESURES --\n"
           "  1. Afficher les mesures\n"
           "  2. Ajouter une mesure\n"
           "  3. Rechercher \n"
           "  4. Supprimer une mesure\n"
           "  5. Annuler la derniere suppression\n"
           "  6. Trier les mesures\n"
           " -- ANALYSE --\n"
           "  7. Statistiques par batiment et ressource\n"
           "  8. Alertes et pics de consommation\n"
           "  9. Comparer deux batiments\n"
           " 10. Classement des batiments \n"
           " 11. Score eco et conseils d'economie\n"
           " -- FICHIERS --\n"
           " 12. Exporter data.json (pour le module Web)\n"
           " 13. Sauvegarder les mesures en CSV\n"
           "  0. Quitter\n");
}

/* ===================================================================== */
/*  PROGRAMME PRINCIPAL                                                   */
/* ===================================================================== */

int main(int argc, char *argv[]) {
    const char *entree = (argc > 1) ? argv[1] : "measures_in.csv";
    int chargees, rejetees;

    if (charger_csv(entree, &chargees, &rejetees) < 0) {
        fprintf(stderr, "Impossible de lire '%s'. Usage : %s [fichier.csv]\n", entree, argv[0]);
        return 1;
    }
    printf("%d mesure(s) chargee(s) depuis %s", chargees, entree);
    if (rejetees) printf(" (%d ligne(s) rejetee(s))", rejetees);
    printf(".\n");
    if (chargees == 0) printf("Attention : aucune mesure valide. Vous pouvez en ajouter avec l'option 2.\n");
    if (nb_alertes_total() > 0)
        printf("!! %d alerte(s) de surconsommation detectee(s) (option 8).\n", nb_alertes_total());

    int modifie = 0;            /* 1 si les donnees ont change depuis le dernier export */
    int choix = -1;
    while (choix != 0) {
        afficher_menu();
        if (!lire_entier("Votre choix : ", 0, 13, &choix)) break;
        switch (choix) {
            case 1:  printf("\n"); afficher_mesures();  break;
            case 2:  if (action_ajouter())    modifie = 1; break;
            case 3:  action_rechercher();     break;
            case 4:  if (action_supprimer())  modifie = 1; break;
            case 5:  if (action_restaurer())  modifie = 1; break;
            case 6:  action_trier();          break;
            case 7:  action_stats();          break;
            case 8:  action_alertes();        break;
            case 9:  action_comparer();       break;
            case 10: action_classement();     break;
            case 11: score_eco(); conseils(); break;
            case 12: if (action_export_json()) modifie = 0; break;
            case 13: action_export_csv();     break;
            default: break;
        }
    }
    if (modifie && confirmer("\nDes modifications ne sont pas dans data.json. Exporter avant de quitter ? (o/n) : "))
        action_export_json();
    printf("Au revoir.\n");
    return 0;
}
