export interface DocSubSection {
  id: string;
  title: string;
}

export interface DocSection {
  id: string;
  number: number;
  title: string;
  summary: string;
  subsections: DocSubSection[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'idee-fondamentale',
    number: 1,
    title: "1. L'idée fondamentale",
    summary: 'Le principe coeur de la Clean Architecture : découpler la logique métier de la technologie.',
    subsections: [
      { id: 'principe-central', title: 'Le principe central' },
      { id: 'regle-dependances', title: 'La règle des dépendances' },
      { id: 'quatre-couches', title: 'Les quatre couches' },
      { id: 'pourquoi-ca-change-tout', title: 'Pourquoi ça change tout ?' },
    ],
  },
  {
    id: 'demarrage-rapide',
    number: 2,
    title: '2. Démarrage rapide',
    summary: 'Installez, configurez et lancez le starter sur le port 40001 en moins de 5 minutes.',
    subsections: [
      { id: 'prerequis', title: 'Prérequis' },
      { id: 'installation', title: 'Installation & Lancement' },
      { id: 'commandes', title: 'Commandes disponibles' },
      { id: 'exploration', title: "Explorer l'application" },
    ],
  },
  {
    id: 'comment-ca-fonctionne',
    number: 3,
    title: '3. Comment ça fonctionne ?',
    summary: 'Parcours complet du cycle de vie des requêtes, des middlewares et de chaque couche du code.',
    subsections: [
      { id: 'cycle-requete', title: "Le cycle de vie d'une requête" },
      { id: 'couche-domain', title: 'Couche Domain (Le Cerveau métier)' },
      { id: 'couche-infrastructure', title: 'Couche Infrastructure (La Plomberie)' },
      { id: 'couche-api', title: "Couche API (La Porte d'entrée)" },
      { id: 'architecture-frontend', title: 'Architecture Frontend' },
    ],
  },
  {
    id: 'cas-utilisation',
    number: 4,
    title: "4. Cas d'utilisation",
    summary: 'Quand adopter la Clean Architecture et quand privilégier une approche plus directe.',
    subsections: [
      { id: 'situations-ideales', title: 'Situations idéales' },
      { id: 'situations-moins-adaptees', title: 'Situations moins adaptées' },
      { id: 'regle-decision', title: 'Règle de décision' },
    ],
  },
  {
    id: 'ajouter-fonctionnalite',
    number: 5,
    title: '5. Ajouter une nouvelle fonctionnalité',
    summary: "Guide pas à pas avec l'exemple concret d'un module Products de bout en bout.",
    subsections: [
      { id: 'etapes-backend', title: 'Étapes Backend (Domain → Ports → Adapters → API)' },
      { id: 'etapes-frontend', title: 'Étapes Frontend (Types → API Client → UI)' },
      { id: 'recap-pattern', title: 'Le pattern systématique' },
    ],
  },
  {
    id: 'passer-en-production',
    number: 6,
    title: '6. Passer en production',
    summary: "Checklist de durcissement : authentification, sécurité, multi-tenancy, Sentry et Docker.",
    subsections: [
      { id: 'auth-sessions', title: 'Authentification & Sessions' },
      { id: 'multi-tenancy', title: 'Multi-Tenancy & Isolation' },
      { id: 'base-donnees', title: 'Base de données & Migrations' },
      { id: 'variables-env', title: "Variables d'environnement" },
      { id: 'securite-conformite', title: 'Sécurité, CSRF & RGPD' },
      { id: 'observabilite', title: 'Observabilité (Sentry & OpenTelemetry)' },
      { id: 'deploiement-docker', title: 'Graceful Shutdown & Docker' },
    ],
  },
  {
    id: 'ressources-liens',
    number: 7,
    title: '7. Ressources & Liens utiles',
    summary: 'Documentation officielle, outils recommandés, livres de référence et crédits du template.',
    subsections: [
      { id: 'auteur-template', title: 'Le Template & Auteur' },
      { id: 'stack-officielle', title: 'Documentation officielle de la stack' },
      { id: 'services-cloud', title: 'Bases de données & Observabilité' },
      { id: 'lectures-recommandees', title: 'Lectures recommandées' },
    ],
  },
];
