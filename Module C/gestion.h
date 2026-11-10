#ifndef GESTION_H
#define GESTION_H

/* EcoCampus - Module C : structures et fonctions (version simplifiee) */

#define MAX_MESURES   500    /* taille du tableau de mesures */
#define MAX_STATS     128    /* nb max de groupes (batiment, ressource) */
#define NB_RESSOURCES 4
#define TXT           32     /* taille max d'un nom */

extern const char *RESSOURCES[NB_RESSOURCES];   /* electricite, eau, chauffage, gaz */

/* Un point de mesure */
typedef struct {
    int    id;
    char   batiment[TXT];
    char   ressource[TXT];
    double valeur;
    char   date[11];     /* AAAA-MM-JJ */
    char   heure[6];     /* HH:MM      */
    double seuil;        /* alerte si valeur > seuil */
} Mesure;

/* Statistiques d'un couple (batiment, ressource) */
typedef struct {
    char   batiment[TXT];
    char   ressource[TXT];
    int    nb;
    double total, moyenne, min, max;
    int    nb_alertes;
} Stat;

/* Le tableau des mesures (variables globales) */
extern Mesure mesures[MAX_MESURES];
extern int    nb_mesures;

/* ---- Outils ---- */
int         egal(const char *a, const char *b);      /* egalite sans tenir compte des majuscules */
const char *unite(const char *ressource);            /* kWh ou m3 */
int         date_valide(const char *s);
int         heure_valide(const char *s);
void        date_du_jour(char out[11]);
void        heure_actuelle(char out[6]);

/* ---- Mesures ---- */
int    charger_csv(const char *fichier, int *chargees, int *rejetees);   /* -1 si fichier absent */
int    ajouter(const Mesure *m, const char **erreur);
int    supprimer(int id);
int    restaurer(const char **erreur);               /* annule la derniere suppression */
int    trouver_id(int id);                           /* indice ou -1 */
int    prochain_id(void);
int    est_alerte(const Mesure *m);                  /* valeur > seuil */
double depassement(const Mesure *m);                 /* % au-dessus du seuil */

/* ---- Affichage, recherche, tri ---- */
void afficher_mesures(void);
int  rechercher(const char *bat, const char *res, const char *debut, const char *fin);
void trier(int critere);   /* 1 valeur croiss., 2 valeur decroiss., 3 date croiss., 4 date decroiss., 5 batiment */

/* ---- Statistiques et alertes ---- */
int  calculer_stats(Stat *st);
void afficher_stats(const Stat *st, int ns);
int  nb_alertes_total(void);
int  afficher_alertes(void);
int  afficher_pics(void);                            /* valeur > 1.5 x moyenne du groupe */
int  lister_batiments(char noms[][TXT]);

/* ---- Analyses (bonus) ---- */
int  comparer(const char *b1, const char *b2);
int  classement(const char *ressource);
void score_eco(void);
int  conseils(void);

/* ---- Export ---- */
int  exporter_json(const char *fichier);
int  exporter_csv(const char *fichier);

#endif
