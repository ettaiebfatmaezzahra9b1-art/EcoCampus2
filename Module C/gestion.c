#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <time.h>
#include "gestion.h"

const char *RESSOURCES[NB_RESSOURCES] = { "electricite", "eau", "chauffage", "gaz" };
static const char *UNITES[NB_RESSOURCES] = { "kWh", "m3", "kWh", "m3" };

Mesure mesures[MAX_MESURES];
int    nb_mesures = 0;

static Mesure derniere;              /* derniere mesure supprimee */
static int    a_derniere = 0;

/* ===================================================================== */
/*  1. OUTILS                                                             */
/* ===================================================================== */

/* compare deux textes sans tenir compte des majuscules : 0 si egaux */
static int comparer_texte(const char *a, const char *b) {
    while (*a && *b && tolower((unsigned char)*a) == tolower((unsigned char)*b)) { a++; b++; }
    return tolower((unsigned char)*a) - tolower((unsigned char)*b);
}

int egal(const char *a, const char *b) { return comparer_texte(a, b) == 0; }

static int num_ressource(const char *r) {
    for (int i = 0; i < NB_RESSOURCES; i++)
        if (egal(r, RESSOURCES[i])) return i;
    return -1;
}

const char *unite(const char *r) {
    int i = num_ressource(r);
    return i >= 0 ? UNITES[i] : "?";
}

static int que_des_chiffres(const char *s, int debut, int fin) {
    for (int i = debut; i < fin; i++)
        if (!isdigit((unsigned char)s[i])) return 0;
    return 1;
}

/* Date AAAA-MM-JJ avec annees bissextiles */
int date_valide(const char *s) {
    static const int jours[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    if (strlen(s) != 10 || s[4] != '-' || s[7] != '-') return 0;
    if (!que_des_chiffres(s, 0, 4) || !que_des_chiffres(s, 5, 7) || !que_des_chiffres(s, 8, 10)) return 0;
    int annee = atoi(s), mois = atoi(s + 5), jour = atoi(s + 8);
    if (annee < 1 || mois < 1 || mois > 12 || jour < 1) return 0;
    int max = jours[mois - 1];
    if (mois == 2 && ((annee % 4 == 0 && annee % 100 != 0) || annee % 400 == 0)) max = 29;
    return jour <= max;
}

/* Heure HH:MM */
int heure_valide(const char *s) {
    if (strlen(s) != 5 || s[2] != ':') return 0;
    if (!que_des_chiffres(s, 0, 2) || !que_des_chiffres(s, 3, 5)) return 0;
    return atoi(s) <= 23 && atoi(s + 3) <= 59;
}

void date_du_jour(char out[11]) {
    time_t t = time(NULL);
    strftime(out, 11, "%Y-%m-%d", localtime(&t));
}

void heure_actuelle(char out[6]) {
    time_t t = time(NULL);
    strftime(out, 6, "%H:%M", localtime(&t));
}

/* ===================================================================== */
/*  2. AJOUT, VALIDATION, CHARGEMENT                                      */
/* ===================================================================== */

int trouver_id(int id) {
    for (int i = 0; i < nb_mesures; i++)
        if (mesures[i].id == id) return i;
    return -1;
}

int prochain_id(void) {
    int max = 0;
    for (int i = 0; i < nb_mesures; i++)
        if (mesures[i].id > max) max = mesures[i].id;
    return max + 1;
}

int est_alerte(const Mesure *m) { return m->valeur > m->seuil; }

double depassement(const Mesure *m) { return (m->valeur - m->seuil) / m->seuil * 100.0; }

/* un nom de batiment : lettres, chiffres, _ ou - (sans espace) */
static int nom_valide(const char *s) {
    if (s[0] == '\0' || strlen(s) >= TXT) return 0;
    for (int i = 0; s[i]; i++)
        if (!isalnum((unsigned char)s[i]) && s[i] != '_' && s[i] != '-') return 0;
    return 1;
}

#define LIMITE_VALEUR 10000000.0   /* meme limite que la page web */

/* Une mesure avec le meme batiment, la meme ressource, la meme date et la meme heure existe deja ? */
static int existe_deja(const Mesure *m) {
    for (int i = 0; i < nb_mesures; i++)
        if (egal(mesures[i].batiment, m->batiment) && egal(mesures[i].ressource, m->ressource) &&
            strcmp(mesures[i].date, m->date) == 0 && strcmp(mesures[i].heure, m->heure) == 0)
            return 1;
    return 0;
}

/* Verifie une mesure. Retourne le message d'erreur, ou NULL si tout est correct. */
static const char *verifier(const Mesure *m) {
    if (m->id <= 0)                      return "id invalide (entier > 0)";
    if (trouver_id(m->id) >= 0)          return "id deja utilise";
    if (!nom_valide(m->batiment))        return "batiment invalide (lettres, chiffres, _ ou -)";
    if (num_ressource(m->ressource) < 0) return "ressource inconnue (electricite, eau, chauffage, gaz)";
    if (!(m->valeur >= 0))               return "valeur negative ou invalide";
    if (m->valeur > LIMITE_VALEUR)       return "valeur trop grande (10000000 maximum)";
    if (!(m->seuil > 0))                 return "seuil invalide (doit etre > 0)";
    if (m->seuil > LIMITE_VALEUR)        return "seuil trop grand (10000000 maximum)";
    if (!date_valide(m->date))           return "date invalide (AAAA-MM-JJ)";
    if (!heure_valide(m->heure))         return "heure invalide (HH:MM)";
    if (existe_deja(m))                  return "doublon (meme batiment, ressource, date et heure)";
    if (nb_mesures >= MAX_MESURES)       return "tableau plein (500 mesures maximum)";
    return NULL;
}

/* Ajoute une mesure si elle est valide. Retourne 1 si ajoutee, 0 sinon (erreur dans *erreur). */
int ajouter(const Mesure *m, const char **erreur) {
    const char *e = verifier(m);
    if (erreur) *erreur = e;
    if (e) return 0;
    mesures[nb_mesures++] = *m;
    return 1;
}

/* enleve les espaces au debut et a la fin d'un texte */
static char *nettoyer(char *s) {
    while (isspace((unsigned char)*s)) s++;
    char *fin = s + strlen(s);
    while (fin > s && isspace((unsigned char)fin[-1])) *--fin = '\0';
    return s;
}

/* Decoupe une ligne sur ',' ou ';' (les champs vides sont conserves). Retourne le nb de champs. */
static int decouper(char *s, char *champs[], int max) {
    int k = 0;
    champs[k++] = s;
    for (char *p = s; *p; p++)
        if (*p == ',' || *p == ';') {
            *p = '\0';
            if (k < max) champs[k] = p + 1;
            k++;
        }
    for (int i = 0; i < k && i < max; i++) champs[i] = nettoyer(champs[i]);
    return k;
}

static int lire_entier(const char *s, int *out) {
    char *fin;
    long v = strtol(s, &fin, 10);
    if (*s == '\0' || *fin != '\0' || v < 1 || v > 2000000000L) return 0;
    *out = (int)v;
    return 1;
}

static int lire_reel(const char *s, double *out) {
    char *fin;
    double v = strtod(s, &fin);
    if (*s == '\0' || *fin != '\0' || !isfinite(v)) return 0;
    *out = v;
    return 1;
}

/* affiche l'erreur d'une ligne du CSV (les 10 premieres seulement) */
static void rejeter(int *rejetees, int num, const char *motif) {
    (*rejetees)++;
    if (*rejetees <= 10) fprintf(stderr, "  ligne %d rejetee : %s\n", num, motif);
    else if (*rejetees == 11) fprintf(stderr, "  (les autres erreurs ne sont pas affichees)\n");
}

/* Lit le fichier CSV : id,batiment,ressource,valeur,date,heure,seuil (1re ligne = en-tete).
 * Une ligne incorrecte est rejetee (avec son motif), les autres sont chargees.
 * Retourne -1 si le fichier est absent, sinon le nombre de mesures chargees. */
int charger_csv(const char *fichier, int *chargees, int *rejetees) {
    static const char *noms[7] = { "id", "batiment", "ressource", "valeur", "date", "heure", "seuil" };
    *chargees = 0;
    *rejetees = 0;
    FILE *f = fopen(fichier, "r");
    if (!f) { perror("Ouverture du fichier"); return -1; }

    char ligne[512];
    int num = 0;
    while (fgets(ligne, sizeof ligne, f)) {
        num++;
        char *s = nettoyer(ligne);
        if (*s == '\0') continue;                              /* ligne vide */
        if (num == 1 && !isdigit((unsigned char)*s)) continue; /* en-tete */

        char *c[7];
        int k = decouper(s, c, 7);
        if (k != 7) {
            char msg[64];
            snprintf(msg, sizeof msg, "7 champs attendus, %d trouve(s)", k);
            rejeter(rejetees, num, msg);
            continue;
        }
        int vide = -1;
        for (int i = 0; i < 7 && vide < 0; i++)
            if (c[i][0] == '\0') vide = i;
        if (vide >= 0) {
            char msg[64];
            snprintf(msg, sizeof msg, "valeur manquante (%s)", noms[vide]);
            rejeter(rejetees, num, msg);
            continue;
        }

        Mesure m;
        memset(&m, 0, sizeof m);
        if (!lire_entier(c[0], &m.id))     { rejeter(rejetees, num, "id invalide (entier > 0)"); continue; }
        if (strlen(c[1]) >= TXT || strlen(c[2]) >= TXT)
                                           { rejeter(rejetees, num, "nom trop long"); continue; }
        if (!lire_reel(c[3], &m.valeur))   { rejeter(rejetees, num, "valeur non numerique"); continue; }
        if (strlen(c[4]) != 10)            { rejeter(rejetees, num, "date invalide (AAAA-MM-JJ)"); continue; }
        if (strlen(c[5]) != 5)             { rejeter(rejetees, num, "heure invalide (HH:MM)"); continue; }
        if (!lire_reel(c[6], &m.seuil))    { rejeter(rejetees, num, "seuil non numerique"); continue; }
        strcpy(m.batiment, c[1]);          /* tailles deja verifiees */
        strcpy(m.ressource, c[2]);
        for (char *p = m.ressource; *p; p++) *p = (char)tolower((unsigned char)*p);
        strcpy(m.date, c[4]);
        strcpy(m.heure, c[5]);

        const char *erreur;
        if (ajouter(&m, &erreur)) (*chargees)++;
        else rejeter(rejetees, num, erreur);
    }
    fclose(f);
    return *chargees;
}

/* ===================================================================== */
/*  3. AFFICHAGE, RECHERCHE, SUPPRESSION, TRI                             */
/* ===================================================================== */

static void entete_mesures(void) {
    printf("%-4s %-15s %-12s %10s %-4s %10s  %-10s %-5s  %s\n",
           "ID", "Batiment", "Ressource", "Valeur", "Unit", "Seuil", "Date", "Heure", "Etat");
    printf("---------------------------------------------------------------------------------------------\n");
}

static void ligne_mesure(const Mesure *m) {
    char etat[32];
    if (est_alerte(m)) snprintf(etat, sizeof etat, "ALERTE (+%.1f%%)", depassement(m));
    else               snprintf(etat, sizeof etat, "ok");
    printf("%-4d %-15.15s %-12s %10.2f %-4s %10.2f  %-10s %-5s  %s\n",
           m->id, m->batiment, m->ressource, m->valeur, unite(m->ressource),
           m->seuil, m->date, m->heure, etat);
}

void afficher_mesures(void) {
    entete_mesures();
    for (int i = 0; i < nb_mesures; i++) ligne_mesure(&mesures[i]);
    printf("(%d mesure(s))\n", nb_mesures);
}

/* Affiche les mesures qui correspondent aux criteres (un texte vide = pas de critere).
 * Retourne le nombre de resultats. */
int rechercher(const char *bat, const char *res, const char *debut, const char *fin) {
    int trouves = 0;
    for (int i = 0; i < nb_mesures; i++) {
        const Mesure *m = &mesures[i];
        if (bat[0]   && !egal(m->batiment, bat))   continue;
        if (res[0]   && !egal(m->ressource, res))  continue;
        if (debut[0] && strcmp(m->date, debut) < 0) continue;
        if (fin[0]   && strcmp(m->date, fin) > 0)   continue;
        if (trouves == 0) entete_mesures();
        ligne_mesure(m);
        trouves++;
    }
    return trouves;
}

/* Supprime la mesure d'id donne (on garde une copie pour pouvoir annuler) */
int supprimer(int id) {
    int i = trouver_id(id);
    if (i < 0) return 0;
    derniere = mesures[i];
    a_derniere = 1;
    for (int j = i; j < nb_mesures - 1; j++) mesures[j] = mesures[j + 1];   /* on decale */
    nb_mesures--;
    return 1;
}

int restaurer(const char **erreur) {
    if (!a_derniere) { *erreur = "aucune suppression a annuler"; return 0; }
    if (!ajouter(&derniere, erreur)) return 0;
    a_derniere = 0;
    return 1;
}

/* Retourne 1 si a et b doivent etre echanges pour respecter le critere */
static int doit_echanger(const Mesure *a, const Mesure *b, int critere) {
    int c;
    switch (critere) {
        case 1:  return a->valeur > b->valeur;
        case 2:  return a->valeur < b->valeur;
        case 3:  c = strcmp(a->date, b->date); if (c == 0) c = strcmp(a->heure, b->heure); return c > 0;
        case 4:  c = strcmp(a->date, b->date); if (c == 0) c = strcmp(a->heure, b->heure); return c < 0;
        default: c = comparer_texte(a->batiment, b->batiment);
                 if (c == 0) c = comparer_texte(a->ressource, b->ressource);
                 if (c == 0) c = strcmp(a->date, b->date);
                 if (c == 0) c = strcmp(a->heure, b->heure);
                 return c > 0;
    }
}

/* Tri a bulles : on echange deux voisins tant qu'ils ne sont pas dans le bon ordre */
void trier(int critere) {
    for (int i = 0; i < nb_mesures - 1; i++) {
        int echange = 0;
        for (int j = 0; j < nb_mesures - 1 - i; j++)
            if (doit_echanger(&mesures[j], &mesures[j + 1], critere)) {
                Mesure tmp = mesures[j];
                mesures[j] = mesures[j + 1];
                mesures[j + 1] = tmp;
                echange = 1;
            }
        if (!echange) break;                 /* deja trie */
    }
}

/* ===================================================================== */
/*  4. STATISTIQUES ET ALERTES                                            */
/* ===================================================================== */

static int trouver_stat(const Stat *st, int ns, const char *bat, const char *res) {
    for (int s = 0; s < ns; s++)
        if (egal(st[s].batiment, bat) && egal(st[s].ressource, res)) return s;
    return -1;
}

/* Une statistique par couple (batiment, ressource) : on ne melange jamais des unites differentes.
 * Le resultat est trie par batiment puis par ressource. Retourne le nombre de groupes. */
int calculer_stats(Stat *st) {
    int ns = 0;
    for (int i = 0; i < nb_mesures; i++) {
        const Mesure *m = &mesures[i];
        int k = trouver_stat(st, ns, m->batiment, m->ressource);
        if (k < 0) {                                         /* nouveau groupe */
            if (ns == MAX_STATS) continue;
            k = ns++;
            strcpy(st[k].batiment, m->batiment);
            strcpy(st[k].ressource, m->ressource);
            st[k].nb = 0;
            st[k].total = 0;
            st[k].nb_alertes = 0;
            st[k].min = st[k].max = m->valeur;
        }
        st[k].nb++;
        st[k].total += m->valeur;
        if (m->valeur < st[k].min) st[k].min = m->valeur;
        if (m->valeur > st[k].max) st[k].max = m->valeur;
        if (est_alerte(m)) st[k].nb_alertes++;
    }
    for (int s = 0; s < ns; s++) st[s].moyenne = st[s].total / st[s].nb;

    for (int i = 1; i < ns; i++) {                           /* tri par insertion */
        Stat x = st[i];
        int j = i - 1;
        while (j >= 0) {
            int c = comparer_texte(st[j].batiment, x.batiment);
            if (c == 0) c = num_ressource(st[j].ressource) - num_ressource(x.ressource);
            if (c <= 0) break;
            st[j + 1] = st[j];
            j--;
        }
        st[j + 1] = x;
    }
    return ns;
}

void afficher_stats(const Stat *st, int ns) {
    printf("%-15s %-12s %4s %6s %11s %10s %10s %10s %7s\n",
           "Batiment", "Ressource", "Unit", "Nb", "Total", "Moyenne", "Min", "Max", "Alertes");
    printf("-----------------------------------------------------------------------------------------\n");
    for (int s = 0; s < ns; s++)
        printf("%-15.15s %-12s %-4s %6d %11.2f %10.2f %10.2f %10.2f %7d\n",
               st[s].batiment, st[s].ressource, unite(st[s].ressource), st[s].nb,
               st[s].total, st[s].moyenne, st[s].min, st[s].max, st[s].nb_alertes);
}

int nb_alertes_total(void) {
    int n = 0;
    for (int i = 0; i < nb_mesures; i++)
        if (est_alerte(&mesures[i])) n++;
    return n;
}

/* Affiche les mesures dont valeur > seuil */
int afficher_alertes(void) {
    int n = 0;
    for (int i = 0; i < nb_mesures; i++) {
        if (!est_alerte(&mesures[i])) continue;
        if (n == 0) entete_mesures();
        ligne_mesure(&mesures[i]);
        n++;
    }
    return n;
}

/* Affiche les pics : valeur > 1.5 x moyenne de son groupe (groupe d'au moins 3 mesures) */
int afficher_pics(void) {
    Stat st[MAX_STATS];
    int ns = calculer_stats(st), n = 0;
    for (int i = 0; i < nb_mesures; i++) {
        const Mesure *m = &mesures[i];
        int k = trouver_stat(st, ns, m->batiment, m->ressource);
        if (k < 0 || st[k].nb < 3 || !(m->valeur > 1.5 * st[k].moyenne)) continue;
        if (n == 0) entete_mesures();
        ligne_mesure(m);
        n++;
    }
    return n;
}

/* Remplit noms[] avec les batiments (sans doublon, ordre alphabetique). Retourne leur nombre. */
int lister_batiments(char noms[][TXT]) {
    int nb = 0;
    for (int i = 0; i < nb_mesures; i++) {
        int deja = 0;
        for (int k = 0; k < nb; k++)
            if (egal(noms[k], mesures[i].batiment)) deja = 1;
        if (!deja && nb < MAX_STATS) strcpy(noms[nb++], mesures[i].batiment);
    }
    for (int i = 1; i < nb; i++) {                           /* tri par insertion */
        char x[TXT];
        strcpy(x, noms[i]);
        int j = i - 1;
        while (j >= 0 && comparer_texte(noms[j], x) > 0) { strcpy(noms[j + 1], noms[j]); j--; }
        strcpy(noms[j + 1], x);
    }
    return nb;
}

/* ===================================================================== */
/*  5. ANALYSES (BONUS)                                                   */
/* ===================================================================== */

/* Compare deux batiments ressource par ressource, sur la moyenne par mesure
 * (on ne compare que les ressources que les deux batiments ont en commun : meme unite). */
int comparer(const char *b1, const char *b2) {
    Stat st[MAX_STATS];
    int ns = calculer_stats(st);
    int communes = 0, alertes1 = 0, alertes2 = 0;

    printf("\n===== Comparaison : %s  /  %s =====\n", b1, b2);
    printf("(on compare la moyenne par mesure, ressource par ressource : meme unite)\n");

    for (int r = 0; r < NB_RESSOURCES; r++) {
        int i1 = trouver_stat(st, ns, b1, RESSOURCES[r]);
        int i2 = trouver_stat(st, ns, b2, RESSOURCES[r]);
        if (i1 >= 0) alertes1 += st[i1].nb_alertes;
        if (i2 >= 0) alertes2 += st[i2].nb_alertes;
        if (i1 < 0 && i2 < 0) continue;
        if (i1 < 0 || i2 < 0) {
            printf("\n--- %s : donnees uniquement pour %s -> non comparable\n",
                   RESSOURCES[r], i1 >= 0 ? b1 : b2);
            continue;
        }
        communes++;
        const Stat *a = &st[i1], *b = &st[i2];
        printf("\n--- %s (%s) ---\n", RESSOURCES[r], unite(RESSOURCES[r]));
        printf("%-10s %14.14s %14.14s\n", "", b1, b2);
        printf("%-10s %14d %14d\n",     "Mesures", a->nb, b->nb);
        printf("%-10s %14.2f %14.2f\n", "Moyenne", a->moyenne, b->moyenne);
        printf("%-10s %14.2f %14.2f\n", "Maximum", a->max, b->max);
        printf("%-10s %14d %14d\n",     "Alertes", a->nb_alertes, b->nb_alertes);
        if (a->moyenne <= 0 || b->moyenne <= 0) {
            printf("=> comparaison en pourcentage impossible (moyenne nulle)\n");
        } else {
            double haut = a->moyenne > b->moyenne ? a->moyenne : b->moyenne;
            double bas  = a->moyenne > b->moyenne ? b->moyenne : a->moyenne;
            double ecart = (haut - bas) / bas * 100.0;
            if (ecart < 1.0)
                printf("=> consommations quasi identiques (ecart < 1%%)\n");
            else
                printf("=> %s consomme %.1f%% de plus que %s (moyenne)\n",
                       a->moyenne > b->moyenne ? b1 : b2, ecart,
                       a->moyenne > b->moyenne ? b2 : b1);
        }
    }
    if (communes == 0)
        printf("\nAucune ressource commune : comparaison impossible (unites differentes).\n");
    printf("\nAlertes (toutes ressources) : %s = %d, %s = %d\n", b1, alertes1, b2, alertes2);
    return communes;
}

/* Classe les batiments pour une ressource (moyenne decroissante) avec des barres */
int classement(const char *ressource) {
    Stat st[MAX_STATS], sel[MAX_STATS];
    int ns = calculer_stats(st), n = 0;
    for (int s = 0; s < ns; s++)
        if (egal(st[s].ressource, ressource)) sel[n++] = st[s];

    printf("\n===== Classement - %s (moyenne par mesure, %s) =====\n", ressource, unite(ressource));
    if (n == 0) { printf("Aucune mesure pour cette ressource.\n"); return 0; }

    for (int i = 1; i < n; i++) {                            /* tri decroissant par moyenne */
        Stat x = sel[i];
        int j = i - 1;
        while (j >= 0 && sel[j].moyenne < x.moyenne) { sel[j + 1] = sel[j]; j--; }
        sel[j + 1] = x;
    }
    double max = sel[0].moyenne > 0 ? sel[0].moyenne : 1.0;
    for (int i = 0; i < n; i++) {
        int longueur = (int)(sel[i].moyenne / max * 30 + 0.5);   /* barre de 30 caracteres max */
        char barre[31];
        memset(barre, '#', (size_t)longueur);
        barre[longueur] = '\0';
        printf("%2d. %-15.15s %9.2f %-3s |%-30s| %d alerte(s)\n", i + 1, sel[i].batiment,
               sel[i].moyenne, unite(ressource), barre, sel[i].nb_alertes);
    }
    return n;
}
/* Score eco : part de mesures sans alerte -> note A (>= 95%), B (>= 85%), C (>= 70%), D */
void score_eco(void) {
    char noms[MAX_STATS][TXT];
    int nb = lister_batiments(noms);
    printf("\n===== Score eco par batiment (part de mesures sans alerte) =====\n");
    printf("%-15s %8s %8s %12s  %s\n", "Batiment", "Mesures", "Alertes", "Sans alerte", "Note");
    printf("---------------------------------------------------------\n");
    for (int b = 0; b < nb; b++) {
        int total = 0, alertes = 0;
        for (int i = 0; i < nb_mesures; i++)
            if (egal(mesures[i].batiment, noms[b])) {
                total++;
                if (est_alerte(&mesures[i])) alertes++;
            }
        double pct = total ? 100.0 * (total - alertes) / total : 100.0;
        char note = pct >= 95 ? 'A' : (pct >= 85 ? 'B' : (pct >= 70 ? 'C' : 'D'));
        printf("%-15.15s %8d %8d %11.1f%%  %c\n", noms[b], total, alertes, pct, note);
    }
    printf("Notes : A >= 95%%, B >= 85%%, C >= 70%%, D en dessous.\n");
}

static const char *conseil(const char *ressource) {
    if (egal(ressource, "electricite"))
        return "verifier l'eclairage et les equipements laisses allumes (heures creuses, veille).";
    if (egal(ressource, "eau"))
        return "rechercher une fuite ou un robinet/chasse d'eau qui coule.";
    if (egal(ressource, "chauffage"))
        return "verifier le reglage du thermostat et les fenetres ouvertes.";
    return "controler les appareils de cuisson/chauffage et leur reglage.";   /* gaz */
}

/* Un conseil par couple (batiment, ressource) qui a au moins une alerte */
int conseils(void) {
    Stat st[MAX_STATS];
    int ns = calculer_stats(st), n = 0;
    printf("\n===== Conseils d'economie (generiques) =====\n");
    for (int s = 0; s < ns; s++) {
        if (st[s].nb_alertes == 0) continue;
        double pic = 0;                                       /* plus gros depassement */
        for (int i = 0; i < nb_mesures; i++) {
            const Mesure *m = &mesures[i];
            if (egal(m->batiment, st[s].batiment) && egal(m->ressource, st[s].ressource)
                && est_alerte(m) && depassement(m) > pic)
                pic = depassement(m);
        }
        printf("- %s / %s : %d alerte(s), depassement max +%.1f%% -> %s\n", st[s].batiment,
               st[s].ressource, st[s].nb_alertes, pic, conseil(st[s].ressource));
        n++;
    }
    if (n == 0) printf("Aucune alerte : rien a signaler.\n");
    return n;
}

/* ===================================================================== */
/*  6. EXPORT                                                             */
/* ===================================================================== */

/* data.json : meta + mesures (avec alerte) + statistiques */
int exporter_json(const char *fichier) {
    Stat st[MAX_STATS];
    int ns = calculer_stats(st);
    FILE *f = fopen(fichier, "w");
    if (!f) { perror("Creation du fichier de sortie"); return 0; }

    char quand[32];
    time_t t = time(NULL);
    strftime(quand, sizeof quand, "%Y-%m-%d %H:%M:%S", localtime(&t));

    fprintf(f, "{\n  \"meta\": {\"genere_le\": \"%s\", \"nb_mesures\": %d, \"nb_alertes\": %d},\n",
            quand, nb_mesures, nb_alertes_total());
    fprintf(f, "  \"mesures\": [\n");
    for (int i = 0; i < nb_mesures; i++) {
        const Mesure *m = &mesures[i];
        fprintf(f, "    {\"id\": %d, \"batiment\": \"%s\", \"ressource\": \"%s\", \"unite\": \"%s\", "
                   "\"valeur\": %.2f, \"seuil\": %.2f, \"date\": \"%s\", \"heure\": \"%s\", \"alerte\": %s}%s\n",
                m->id, m->batiment, m->ressource, unite(m->ressource),
                m->valeur, m->seuil, m->date, m->heure,
                est_alerte(m) ? "true" : "false", i < nb_mesures - 1 ? "," : "");
    }
    fprintf(f, "  ],\n  \"statistiques\": [\n");
    for (int s = 0; s < ns; s++)
        fprintf(f, "    {\"batiment\": \"%s\", \"ressource\": \"%s\", \"unite\": \"%s\", \"nb\": %d, "
                   "\"total\": %.2f, \"moyenne\": %.2f, \"min\": %.2f, \"max\": %.2f, \"nb_alertes\": %d}%s\n",
                st[s].batiment, st[s].ressource, unite(st[s].ressource), st[s].nb,
                st[s].total, st[s].moyenne, st[s].min, st[s].max, st[s].nb_alertes,
                s < ns - 1 ? "," : "");
    fprintf(f, "  ]\n}\n");
    return fclose(f) == 0;
}

/* Sauvegarde les mesures au meme format que le fichier d'entree */
int exporter_csv(const char *fichier) {
    FILE *f = fopen(fichier, "w");
    if (!f) { perror("Creation du fichier CSV"); return 0; }
    fprintf(f, "id,batiment,ressource,valeur,date,heure,seuil\n");
    for (int i = 0; i < nb_mesures; i++) {
        const Mesure *m = &mesures[i];
        fprintf(f, "%d,%s,%s,%.2f,%s,%s,%.2f\n", m->id, m->batiment, m->ressource,
                m->valeur, m->date, m->heure, m->seuil);
    }
    return fclose(f) == 0;
}
