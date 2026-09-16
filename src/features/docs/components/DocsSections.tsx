import {
  Layers,
  Terminal,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  ShieldCheck,
  Server,
  Zap,
  Lock,
  Workflow,
  Sparkles,
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';

interface DocsSectionsProps {
  searchTerm: string;
}

export function DocsSections({ searchTerm }: DocsSectionsProps) {
  const highlightClass = (text: string) => {
    if (!searchTerm.trim()) return '';
    return text.toLowerCase().includes(searchTerm.toLowerCase()) ? 'bg-yellow-100 ring-2 ring-yellow-300 rounded' : '';
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Header Intro Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black text-white">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            Guide Développeur Officiel
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Par Yahia Naim
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Clean Architecture & DDD · Production Ready
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-black tracking-tight mb-3">
          CLEAN ARCHITECTURE : Du Template à la Production
        </h1>
        <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-4xl">
          Bienvenue dans la documentation complète du starter. Que vous découvriez la Clean Architecture ou que vous
          souhaitiez déployer une application SaaS robuste en production, ce guide détaille chaque couche, chaque
          mécanisme de sécurité et la démarche étape par étape pour étendre ce projet.
        </p>

        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-medium text-gray-500">
          <div>⚛️ <strong className="text-gray-800">React 19</strong> + Vite</div>
          <div>🛡️ <strong className="text-gray-800">TypeScript</strong> Strict</div>
          <div>⚡ <strong className="text-gray-800">Express 4</strong> + Ports/Adapters</div>
          <div>🗄️ <strong className="text-gray-800">SQLite / Postgres</strong> + Migrations</div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1 */}
      {/* ==================================================================== */}
      <section id="idee-fondamentale" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass("L'idée fondamentale")}`}>
              L'idée fondamentale
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Le découplage absolu entre règles métier et détails techniques</p>
          </div>
        </div>

        <div id="principe-central" className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-700" /> Le principe central
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Cette architecture repose sur une seule conviction : <strong className="text-black">votre logique métier doit être totalement indépendante de tout le reste</strong>.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Vos règles métier — <em>"un utilisateur doit avoir un email unique"</em>, <em>"une commande ne peut pas être validée si le stock est épuisé"</em>, ou <em>"l'accès expire après la période de grâce de 7 jours"</em> — constituent le cœur de votre application. Elles ne doivent jamais dépendre d'Express, de Fastify, de PostgreSQL, de SQLite, de React ou d'un fournisseur cloud. Ce sont tous des <strong>détails d'implémentation</strong>.
          </p>
        </div>

        {/* Callout Règle fondamentale */}
        <div id="regle-dependances" className="my-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm">
          <div className="flex items-center gap-2 font-bold mb-1 text-blue-950">
            <Info className="w-4 h-4 text-blue-600" /> La règle fondamentale des dépendances
          </div>
          <p className="text-blue-800 text-xs sm:text-sm leading-relaxed">
            <strong>Les dépendances pointent TOUJOURS vers l'INTÉRIEUR.</strong> Le centre (votre logique métier / domaine) ne connaît rien du monde extérieur. Le monde extérieur (bases de données, frameworks HTTP, interfaces graphiques) connaît le centre, mais jamais l'inverse.
          </p>
          <div className="mt-3 font-mono text-xs bg-blue-100/60 p-2.5 rounded-lg text-blue-950 text-center">
            API Layer & UI ➔ Domain Services ➔ Domain Entities ⮜ Ports (Interfaces) ⮜ Infrastructure Adapters
          </div>
        </div>

        {/* 4 Couches */}
        <div id="quatre-couches" className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-700" /> Les quatre couches expliquées simplement
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold">Couche</th>
                  <th className="py-2.5 px-3 font-semibold">Pensez-y comme...</th>
                  <th className="py-2.5 px-3 font-semibold">Emplacement dans le template</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">Domain</td>
                  <td className="py-2.5 px-3">Le cerveau métier. Logique pure, validation entité, zéro outil externe.</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-800">server/domain/entities/, services/, exceptions/, interfaces/</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">Infrastructure</td>
                  <td className="py-2.5 px-3">La plomberie technique. Connexion BDD (SQLite/Postgres), files de messages, mailer.</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-800">server/infrastructure/repositories/, database.ts, queue.ts</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">API Layer</td>
                  <td className="py-2.5 px-3">La porte d'entrée HTTP. Controllers, validation Zod, routes, middlewares.</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-800">server/api/controllers/, routes/, middleware/, dtos/</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-black">Frontend</td>
                  <td className="py-2.5 px-3">Ce que l'utilisateur voit et manipule dans son navigateur.</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-gray-800">src/features/, src/components/, src/lib/</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pourquoi ça change tout */}
        <div id="pourquoi-ca-change-tout" className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Pourquoi ça change tout ?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 text-xs sm:text-sm">
              <div className="font-bold text-red-900 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" /> Sans ce pattern (Code Spaghetti)
              </div>
              <ul className="space-y-2 text-red-800">
                <li>• Changer de base de données oblige à réécrire la moitié du code.</li>
                <li>• Écrire des tests requiert de mocker Express, la BDD, Redis et tous les sous-systèmes.</li>
                <li>• Un nouveau développeur doit lire 20 fichiers entremêlés pour comprendre un endpoint.</li>
                <li>• L'application grandit et la logique métier se disperse dans les controllers et middlewares.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs sm:text-sm">
              <div className="font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Avec Clean Architecture (Ce Starter)
              </div>
              <ul className="space-y-2 text-emerald-800">
                <li>• On change un fichier adapter dans <code className="font-mono text-emerald-950">infrastructure/</code> ; le service métier ne bouge pas.</li>
                <li>• On mocke uniquement l'interface du repository pour tester la logique pure en quelques millisecondes.</li>
                <li>• Chaque développeur lit une couche à la fois ; l'organisation est limpide.</li>
                <li>• La logique reste centralisée dans les services du domaine ; les controllers restent ultra-légers.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 2 */}
      {/* ==================================================================== */}
      <section id="demarrage-rapide" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass('Démarrage rapide')}`}>
              Démarrage rapide
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Lancement local de l'environnement de développement en 5 minutes</p>
          </div>
        </div>

        <div id="prerequis" className="mt-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-700" /> Prérequis
          </h3>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li><strong>Node.js 18+</strong> (recommandé v20+ ou v22 LTS) : vérifiez avec <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">node --version</code></li>
            <li><strong>npm v9+</strong> : vérifiez avec <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">npm --version</code></li>
            <li>Un terminal moderne et un éditeur de code (VS Code ou Cursor recommandé)</li>
          </ul>
        </div>

        <div id="installation" className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Installation & Lancement
          </h3>
          <CodeBlock
            language="bash"
            filename="Terminal"
            code={`# 1. Cloner le dépôt
git clone https://github.com/yahyanaim/Architecture.git
cd Architecture

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement local (.env)
cp .env.example .env

# 4. Lancer le serveur de développement (Express + Vite concurrently)
npm run dev`}
          />

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
            <strong>Port par défaut : 40001</strong>
            <p className="mt-1 text-amber-800">
              Contrairement aux templates traditionnels sur le port 3000, ce starter écoute par défaut sur le port <strong>40001</strong> pour éviter les conflits usuels avec macOS AirPlay Receiver ou d'autres services locaux. Vous pouvez le surcharger avec la variable d'environnement <code className="font-mono bg-amber-100 px-1 rounded">PORT=XXXX</code>.
            </p>
            <div className="mt-2 font-medium">
              • Application Web : <a href="http://localhost:40001" target="_blank" rel="noreferrer" className="underline font-mono">http://localhost:40001</a><br />
              • Documentation OpenAPI / Swagger : <a href="http://localhost:40001/api/docs" target="_blank" rel="noreferrer" className="underline font-mono">http://localhost:40001/api/docs</a>
            </div>
          </div>
        </div>

        {/* Commandes */}
        <div id="commandes" className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Commandes disponibles
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold font-mono">Commande</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm run dev</td>
                  <td className="py-2 px-3">Lance le backend Express et le frontend Vite ensemble avec HMR (Hot Module Replacement).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm run build</td>
                  <td className="py-2 px-3">Compile le bundle frontend Vite dans <code className="font-mono text-xs">dist/</code> et le serveur esbuild dans <code className="font-mono text-xs">dist-server/server.mjs</code>.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm start</td>
                  <td className="py-2 px-3">Démarre le serveur en mode production (<code className="font-mono text-xs">NODE_ENV=production</code>).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm test</td>
                  <td className="py-2 px-3">Exécute la suite complète de tests avec Vitest (92+ tests unitaires et d'intégration).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm run test:watch</td>
                  <td className="py-2 px-3">Lance Vitest en mode surveillance (relance automatique à chaque modification de fichier).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm run test:coverage</td>
                  <td className="py-2 px-3">Génère un rapport de couverture de code complet.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">npm run lint</td>
                  <td className="py-2 px-3">Vérification de conformité TypeScript stricte (<code className="font-mono text-xs">tsc --noEmit</code>).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Exploration */}
        <div id="exploration" className="mt-8 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Explorer l'application
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Une fois connecté, parcourez les différentes sections déjà prêtes à l'emploi :
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li><strong>Onglet Architecture & Ports :</strong> visualisation interactive de la composition des couches et des ports du système.</li>
            <li><strong>Onglet Live Demo (CRUD Utilisateurs) :</strong> cycle de vie complet avec formulaire Zod, mutations TanStack Query, et persistance SQLite.</li>
            <li><strong>Workspaces & Multi-Tenancy :</strong> création et bascule d'organisation isolée.</li>
            <li><strong>Clés API & Journal d'Audit :</strong> génération de clés révoquables et consultation des événements d'audit pour administrateurs.</li>
          </ul>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 3 */}
      {/* ==================================================================== */}
      <section id="comment-ca-fonctionne" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            3
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass('Comment ça fonctionne')}`}>
              Comment ça fonctionne ?
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Explication détaillée fichier par fichier, de la requête HTTP à la base de données</p>
          </div>
        </div>

        {/* Cycle de vie */}
        <div id="cycle-requete" className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Workflow className="w-4 h-4 text-gray-700" /> Le cycle de vie d'une requête (Exemple : Création d'utilisateur)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Voici le parcours exact suivi par les données lorsqu'un utilisateur soumet un formulaire :
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold">Étape</th>
                  <th className="py-2.5 px-3 font-semibold">Fichier & Couche</th>
                  <th className="py-2.5 px-3 font-semibold">Responsabilité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2 px-3 font-bold text-black">1. UI</td>
                  <td className="py-2 px-3 font-mono text-xs">CreateUserForm.tsx</td>
                  <td className="py-2 px-3">L'utilisateur saisit les informations et soumet le formulaire React.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">2. Client</td>
                  <td className="py-2 px-3 font-mono text-xs">userApi.ts + Axios</td>
                  <td className="py-2 px-3">Envoi d'un <code className="font-mono text-xs">POST /api/v1/users</code> avec cookies de session et token CSRF.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">3. Middleware Chain</td>
                  <td className="py-2 px-3 font-mono text-xs">server/app.ts</td>
                  <td className="py-2 px-3">Rate limiter ➔ CSRF validation ➔ requestId/traceId injection ➔ metrics tracking.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">4. Auth & Guards</td>
                  <td className="py-2 px-3 font-mono text-xs">authenticate.ts ➔ resolveTenant.ts</td>
                  <td className="py-2 px-3">Vérification JWT/cookie, validation compte actif, résolution de l'organisation (<code className="font-mono text-xs">req.tenant.orgId</code>).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">5. Controller</td>
                  <td className="py-2 px-3 font-mono text-xs">UserController.ts</td>
                  <td className="py-2 px-3">Validation Zod du payload DTO. Si invalide, rejette avec code 400. Sinon appelle le service.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">6. Domain Service</td>
                  <td className="py-2 px-3 font-mono text-xs">UserService.ts</td>
                  <td className="py-2 px-3">Vérifie l'unicité de l'email dans l'organisation, instancie l'entité <code className="font-mono text-xs">User</code>, appelle <code className="font-mono text-xs">save()</code>.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">7. Repository Port & Adapter</td>
                  <td className="py-2 px-3 font-mono text-xs">IUserRepository ➔ SqliteUserRepository</td>
                  <td className="py-2 px-3">Exécute la requête SQL préparée dans SQLite avec WAL mode (ou PostgreSQL via adapter).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-black">8. Réponse & Cache</td>
                  <td className="py-2 px-3 font-mono text-xs">UserController ➔ React Query</td>
                  <td className="py-2 px-3">L'entité est mappée en DTO sortant (201 Created). TanStack Query invalide et actualise la liste.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Couche Domain */}
        <div id="couche-domain" className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-700" /> 3.1 Couche Domain (Le Cerveau métier)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            La couche Domain encapsule les entités, interfaces (ports), services et exceptions. Elle ne dépend d'aucun module externe.
          </p>

          <h4 className="text-sm font-bold text-gray-800 mt-4">server/domain/entities/User.ts</h4>
          <CodeBlock
            language="typescript"
            filename="server/domain/entities/User.ts"
            code={`export class User {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public readonly createdAt: Date,
    public isActive: boolean = true,
    public readonly orgId?: string,
    public readonly role: 'admin' | 'user' = 'user'
  ) {}

  changeName(newName: string) {
    if (newName.trim().length < 2) throw new Error('Nom trop court (min 2 caractères)');
    this.name = newName.trim();
  }

  toggleActiveStatus() {
    this.isActive = !this.isActive;
  }
}`}
          />

          <h4 className="text-sm font-bold text-gray-800 mt-4">server/domain/interfaces/IUserRepository.ts (Le Port)</h4>
          <p className="text-xs text-gray-600">
            C'est le contrat officiel définissant les opérations requises par le métier. La méthode <code className="font-mono font-bold">delete()</code> est intégralement implémentée :
          </p>
          <CodeBlock
            language="typescript"
            filename="server/domain/interfaces/IUserRepository.ts"
            code={`export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailAndOrg(email: string, orgId: string): Promise<User | null>;
  findAllByOrg(orgId: string): Promise<User[]>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>; // Totalement implémenté avec cascade sur les sessions
}`}
          />

          <h4 className="text-sm font-bold text-gray-800 mt-4">server/domain/exceptions/</h4>
          <p className="text-xs text-gray-600">Des classes d'exceptions typées associées aux codes de statut HTTP correspondants :</p>
          <ul className="text-xs text-gray-700 space-y-1 pl-4 list-disc">
            <li><code className="font-mono font-semibold">AppError.ts</code> : classe de base héritant de <code className="font-mono text-xs">Error</code>.</li>
            <li><code className="font-mono font-semibold">BusinessException.ts (400)</code> : violation d'une règle métier (ex: email dupliqué dans l'organisation).</li>
            <li><code className="font-mono font-semibold">ValidationException.ts (422 / 400)</code> : échec de validation du schéma Zod.</li>
            <li><code className="font-mono font-semibold">NotFoundException.ts (404)</code> : ressource introuvable.</li>
          </ul>
        </div>

        {/* Couche Infrastructure */}
        <div id="couche-infrastructure" className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-700" /> 3.2 Couche Infrastructure (La Plomberie)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Cette couche implémente les interfaces définies par le domaine. Elle gère SQLite (<code className="font-mono text-xs">better-sqlite3</code>), les migrations ordonnées, la file d'attente durable et l'observabilité Sentry.
          </p>

          <h4 className="text-sm font-bold text-gray-800 mt-2">Durable Background Job Queue (server/infrastructure/queue.ts)</h4>
          <p className="text-xs text-gray-600">
            File de messages persistée en base avec verrouillage atomique (<code className="font-mono text-xs">UPDATE ... RETURNING *</code>), retries exponentiels, et détection de workers zombies :
          </p>
          <CodeBlock
            language="typescript"
            filename="server/infrastructure/queue.ts"
            code={`// Enregistrement d'un job asynchrone non-bloquant
await jobQueue.enqueue('email.send', {
  to: user.email,
  subject: 'Activez votre compte',
  text: \`Cliquez sur le lien pour valider votre compte: \${verifyUrl}\`,
  kind: 'verify'
});`}
          />

          <h4 className="text-sm font-bold text-gray-800 mt-2">Observabilité, Sentry & TraceId (server/infrastructure/observability.ts)</h4>
          <p className="text-xs text-gray-600">
            Propagation distribuée du <code className="font-mono text-xs">traceId</code> via Node.js <code className="font-mono text-xs">AsyncLocalStorage</code>, masquage PII automatique des emails et tokens, et capture d'exceptions Sentry :
          </p>
          <CodeBlock
            language="typescript"
            filename="server/infrastructure/observability.ts"
            code={`// Logging JSON structuré avec injection automatique du traceId actif
logger.info('[auth] user login succeeded', { userId: user.id });

// Rapport d'erreur avec tags Sentry et fallback webhook
reportError(err, { traceId, url: req.url, method: req.method });`}
          />
        </div>

        {/* Couche API */}
        <div id="couche-api" className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gray-700" /> 3.3 Couche API (La Porte d'entrée)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Les controllers ne contiennent aucune logique métier : ils valident, délèguent au service et renvoient un DTO.
          </p>
          <CodeBlock
            language="typescript"
            filename="server/api/controllers/UserController.ts"
            code={`export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validation de l'entrée via Zod
      const validated = CreateUserSchema.parse(req.body);
      const orgId = (req as any).tenant?.orgId;

      // 2. Appel du service domaine
      const user = await this.userService.createUser(validated.name, validated.email, orgId);

      // 3. Mapping vers le DTO de réponse (jamais d'exposition directe d'entité)
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString()
      });
    } catch (err) {
      next(err); // Transmis à errorHandler centralisé
    }
  };
}`}
          />
        </div>

        {/* Frontend */}
        <div id="architecture-frontend" className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-700" /> 3.4 Architecture Frontend
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Le frontend reproduit l'organisation par domaine du backend dans <code className="font-mono text-xs">src/features/</code>. Chaque domaine regroupe ses composants, hooks, formulaires et appels API Axios :
          </p>
          <ul className="text-xs text-gray-700 space-y-1.5 pl-4 list-disc">
            <li><code className="font-mono font-semibold">src/features/users/api/userApi.ts</code> : requêtes HTTP Axios pour le CRUD.</li>
            <li><code className="font-mono font-semibold">src/features/users/components/UserList.tsx</code> : tableau réactif avec <code className="font-mono text-xs">useQuery</code>.</li>
            <li><code className="font-mono font-semibold">src/features/users/components/CreateUserForm.tsx</code> : formulaire contrôlé et validation.</li>
            <li><code className="font-mono font-semibold">src/lib/axios.ts</code> : instance Axios avec gestion des tokens CSRF et redirection automatique si upgrade requis.</li>
          </ul>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 4 */}
      {/* ==================================================================== */}
      <section id="cas-utilisation" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            4
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass("Cas d'utilisation")}`}>
              Cas d'utilisation
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Quand choisir la Clean Architecture et quand privilégier une solution plus simple</p>
          </div>
        </div>

        <div id="situations-ideales" className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            4.1 Situations idéales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold">Type de projet</th>
                  <th className="py-2.5 px-3 font-semibold">Pourquoi ça convient</th>
                  <th className="py-2.5 px-3 font-semibold">Comment exploiter le template</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Plateforme SaaS Multi-Tenant</td>
                  <td className="py-2 px-3">Isolation des organisations, règles de facturation complexes, abonnements Stripe.</td>
                  <td className="py-2 px-3">Dupliquer le pattern du module users pour chaque nouveau domaine (Billing, Workspaces, Projects).</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Backend API-First</td>
                  <td className="py-2 px-3">Swagger / OpenAPI intégré, versioning naturel (<code className="font-mono text-xs">/api/v1</code>), DTOs stricts.</td>
                  <td className="py-2 px-3">Étendre les annotations Swagger. Chaque version d'API possède ses propres DTOs type-safe.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Portail d'Administration</td>
                  <td className="py-2 px-3">RBAC strict, journaux d'audit de conformité, clés API développeur.</td>
                  <td className="py-2 px-3">Exploiter les middleware <code className="font-mono text-xs">authorizeAdmin</code> et la table d'audit intégrée.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Monolithe évoluant vers Microservices</td>
                  <td className="py-2 px-3">Le code est compartimenté par domaine sans dépendance circulaire.</td>
                  <td className="py-2 px-3">Extraire un service consiste simplement à déplacer un dossier et remplacer un adapter.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Équipe de plusieurs développeurs</td>
                  <td className="py-2 px-3">Conventions de couches strictes, aucun débat sur l'emplacement du code.</td>
                  <td className="py-2 px-3">Utiliser <code className="font-mono text-xs">ARCHITECTURE.md</code> comme standard d'ingénierie d'équipe.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div id="situations-moins-adaptees" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            4.2 Situations moins adaptées
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold">Situation</th>
                  <th className="py-2.5 px-3 font-semibold">Le problème</th>
                  <th className="py-2.5 px-3 font-semibold">Alternative recommandée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Prototype rapide ou hackathon (1-2 jours)</td>
                  <td className="py-2 px-3">Le découpage en couches ajoute du cérémonial initial inutile.</td>
                  <td className="py-2 px-3">Écrire un script Express direct ou Next.js rapide. Ajouter la structure après validation.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Script utilitaire ou outil CLI</td>
                  <td className="py-2 px-3">Trois niveaux d'abstraction pour 50 lignes de logique est contre-productif.</td>
                  <td className="py-2 px-3">Créer un simple script TypeScript exécuté directement avec <code className="font-mono text-xs">npx tsx</code>.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Application 100% temps réel (Chat, Jeu)</td>
                  <td className="py-2 px-3">Ce template est axé sur les architectures REST / HTTP d'entreprise.</td>
                  <td className="py-2 px-3">Ajouter un adaptateur WebSocket (Socket.io) dans <code className="font-mono text-xs">infrastructure/</code>.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Application lourde en streaming média</td>
                  <td className="py-2 px-3">Nécessite des pipelines de transcodage et des flux CDN dédiés.</td>
                  <td className="py-2 px-3">Brancher un adaptateur <code className="font-mono text-xs">S3Storage</code> (déjà présent) avec URLs présignées.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div id="regle-decision" className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-700">
          <strong>La règle générale :</strong> Si votre projet comportera plus de 3 ou 4 entités métier, plusieurs développeurs, et une durée de vie supérieure à 6 mois, la Clean Architecture vous fera gagner un temps inestimable. Pour tout ce qui est plus modeste, faites appel à votre discernement.
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 5 */}
      {/* ==================================================================== */}
      <section id="ajouter-fonctionnalite" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            5
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass('Ajouter une nouvelle fonctionnalité')}`}>
              Ajouter une nouvelle fonctionnalité
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Tutoriel pratique pas à pas : implémentation complète d'un module "Products"</p>
          </div>
        </div>

        <div id="etapes-backend" className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            5.1 Étapes Backend (Le Pattern Systématique)
          </h3>

          <div className="space-y-4">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-gray-500">Étape 1 : Créer l'entité Domain</span>
              <CodeBlock
                language="typescript"
                filename="server/domain/entities/Product.ts"
                code={`export class Product {
  constructor(
    public readonly id: string,
    public readonly orgId: string,
    public name: string,
    public price: number,
    public readonly createdAt: Date,
    public isAvailable: boolean = true
  ) {}

  updatePrice(newPrice: number) {
    if (newPrice < 0) throw new Error('Le prix ne peut pas être négatif');
    this.price = newPrice;
  }
}`}
              />
            </div>

            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-gray-500">Étape 2 : Définir le Port (Interface Repository)</span>
              <CodeBlock
                language="typescript"
                filename="server/domain/interfaces/IProductRepository.ts"
                code={`import { Product } from '../entities/Product';

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findAllByOrg(orgId: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
  delete(id: string): Promise<void>;
}`}
              />
            </div>

            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-gray-500">Étape 3 : Écrire le Service Métier</span>
              <CodeBlock
                language="typescript"
                filename="server/domain/services/ProductService.ts"
                code={`import crypto from 'crypto';
import { Product } from '../entities/Product';
import { IProductRepository } from '../interfaces/IProductRepository';

export class ProductService {
  constructor(private readonly productRepo: IProductRepository) {}

  async createProduct(name: string, price: number, orgId: string): Promise<Product> {
    const product = new Product(crypto.randomUUID(), orgId, name, price, new Date());
    await this.productRepo.save(product);
    return product;
  }

  async listProducts(orgId: string): Promise<Product[]> {
    return this.productRepo.findAllByOrg(orgId);
  }
}`}
              />
            </div>

            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-gray-500">Étape 4 : Implémenter l'Adaptateur SQLite & Singleton</span>
              <CodeBlock
                language="typescript"
                filename="server/infrastructure/repositories/SqliteProductRepository.ts"
                code={`import { db } from '../database';
import { Product } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/interfaces/IProductRepository';

export class SqliteProductRepository implements IProductRepository {
  async findById(id: string): Promise<Product | null> {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!row) return null;
    return new Product(row.id, row.org_id, row.name, row.price, new Date(row.created_at), Boolean(row.is_available));
  }

  async findAllByOrg(orgId: string): Promise<Product[]> {
    const rows = db.prepare('SELECT * FROM products WHERE org_id = ? ORDER BY created_at DESC').all(orgId) as any[];
    return rows.map((r) => new Product(r.id, r.org_id, r.name, r.price, new Date(r.created_at), Boolean(r.is_available)));
  }

  async save(p: Product): Promise<void> {
    db.prepare(
      'INSERT INTO products (id, org_id, name, price, is_available, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(p.id, p.orgId, p.name, p.price, p.isAvailable ? 1 : 0, p.createdAt.toISOString());
  }

  async delete(id: string): Promise<void> {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
}`}
              />
            </div>

            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-gray-500">Étape 5 : DTOs (Zod) & Controller</span>
              <CodeBlock
                language="typescript"
                filename="server/api/controllers/ProductController.ts"
                code={`import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProductService } from '../../domain/services/ProductService';

export const CreateProductSchema = z.object({
  name: z.string().min(2, 'Le nom doit faire au moins 2 caractères'),
  price: z.number().positive('Le prix doit être strictement positif')
});

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateProductSchema.parse(req.body);
      const orgId = (req as any).tenant?.orgId;
      const product = await this.productService.createProduct(data.name, data.price, orgId);
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  };
}`}
              />
            </div>

            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-gray-500">Étape 6 : Brancher les routes dans server/app.ts</span>
              <CodeBlock
                language="typescript"
                filename="server/app.ts"
                code={`// Câblage dans le composition root
import { productRoutes } from './api/routes/productRoutes';

v1Router.use('/products', productRoutes);`}
              />
            </div>
          </div>
        </div>

        <div id="etapes-frontend" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            5.2 Étapes Frontend
          </h3>
          <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
            <li><strong>Types :</strong> créer <code className="font-mono text-xs">src/features/products/types/index.ts</code> avec les interfaces TypeScript synchronisées avec les DTOs backend.</li>
            <li><strong>API Client :</strong> créer <code className="font-mono text-xs">src/features/products/api/productApi.ts</code> exploitant l'instance Axios partagée.</li>
            <li><strong>Composants UI :</strong> créer <code className="font-mono text-xs">ProductList.tsx</code> et <code className="font-mono text-xs">CreateProductForm.tsx</code> avec TanStack Query (<code className="font-mono text-xs">useQuery</code>, <code className="font-mono text-xs">useMutation</code>).</li>
            <li><strong>Navigation :</strong> intégrer le composant ou la route dans <code className="font-mono text-xs">src/router.tsx</code>.</li>
          </ol>
        </div>

        <div id="recap-pattern" className="mt-6 p-4 rounded-xl bg-gray-900 text-white flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Le Pattern d'Or</div>
            <div className="font-mono text-xs sm:text-sm text-emerald-400 font-bold mt-1">
              Entité ➔ Interface (Port) ➔ Service ➔ Repository (Adapter) ➔ DTO ➔ Controller ➔ Route ➔ Câblage
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 6 */}
      {/* ==================================================================== */}
      <section id="passer-en-production" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            6
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass('Passer en production')}`}>
              Passer en production
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Checklist de durcissement, sécurité, observabilité et conteneurisation</p>
          </div>
        </div>

        {/* Auth & Sessions */}
        <div id="auth-sessions" className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-700" /> 6.1 Authentification & Sessions
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Le template intègre une gestion de sessions de niveau bancaire :
          </p>
          <ul className="text-xs sm:text-sm text-gray-600 space-y-1.5 pl-5 list-disc">
            <li><strong>Access Token court (15m) :</strong> stocké en cookie HTTP-only (<code className="font-mono text-xs">SameSite=Lax</code>, <code className="font-mono text-xs">Secure</code> en production). Réduit drastiquement l'impact en cas de compromission.</li>
            <li><strong>Refresh Token opaque rotatif (30 jours) :</strong> persisté sous forme hachée. Chaque renouvellement génère une nouvelle paire et révoque la précédente. Toute tentative de réutilisation déclenche une <strong>révocation immédiate de la chaîne entière</strong> (détection de vol).</li>
            <li><strong>WebAuthn / FIDO2 Passkeys :</strong> authentification biométrique sans mot de passe via TouchID / FaceID / Windows Hello.</li>
            <li><strong>OAuth 2.0 / OIDC :</strong> connexion sécurisée avec Google et GitHub en échange de code d'autorisation direct.</li>
          </ul>
        </div>

        {/* Multi-Tenancy */}
        <div id="multi-tenancy" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            6.2 Multi-Tenancy & Isolation des données
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Chaque requête authentifiée traverse le middleware <code className="font-mono text-xs font-bold">resolveTenant</code>. Le tenant n'est <strong>jamais extrait d'une entrée utilisateur non vérifiée</strong> mais validé à partir de la session base de données.
          </p>
          <div className="p-3 bg-gray-50 rounded-lg font-mono text-xs text-gray-800">
            SELECT * FROM users WHERE org_id = ? AND id = ?
          </div>
        </div>

        {/* Base de données */}
        <div id="base-donnees" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            6.3 Base de données & Migrations
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            En développement et test, SQLite (<code className="font-mono text-xs">data/app.db</code>) fonctionne avec le journal WAL (<code className="font-mono text-xs">Write-Ahead Logging</code>) garantissant des écritures concurrentes non-bloquantes. Pour la production multi-instance, configurez simplement <code className="font-mono text-xs">DATABASE_URL</code> pour basculer sur PostgreSQL sans modifier le code domaine.
          </p>
          <p className="text-xs text-gray-500">
            Toutes les migrations sont versionnées dans <code className="font-mono text-xs">server/infrastructure/db/migrations/</code> et tracées dans la table <code className="font-mono text-xs">schema_migrations</code>.
          </p>
        </div>

        {/* Variables d'environnement */}
        <div id="variables-env" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            6.4 Variables d'environnement
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold font-mono">Variable</th>
                  <th className="py-2.5 px-3 font-semibold">Utilité</th>
                  <th className="py-2.5 px-3 font-semibold">Exemple</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">JWT_SECRET</td>
                  <td className="py-2 px-3">Signature des JWT (refus strict de démarrage en prod si non défini).</td>
                  <td className="py-2 px-3 font-mono text-xs">cle-secrete-tres-longue-64-caracteres</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">PORT</td>
                  <td className="py-2 px-3">Port d'écoute du serveur.</td>
                  <td className="py-2 px-3 font-mono text-xs">40001</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">CORS_ORIGIN</td>
                  <td className="py-2 px-3">Liste blanche des origines autorisées (séparées par virgule).</td>
                  <td className="py-2 px-3 font-mono text-xs">https://monapp.com</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">DATABASE_URL</td>
                  <td className="py-2 px-3">Connexion PostgreSQL (optionnelle, active le mode multi-instance).</td>
                  <td className="py-2 px-3 font-mono text-xs">postgres://user:pass@host:5432/db</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">REDIS_URL</td>
                  <td className="py-2 px-3">Cache distribué, rate limiting et métriques.</td>
                  <td className="py-2 px-3 font-mono text-xs">redis://localhost:6379</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-medium text-black">SENTRY_DSN</td>
                  <td className="py-2 px-3">Capture et traçage des exceptions de production.</td>
                  <td className="py-2 px-3 font-mono text-xs">https://cle@sentry.io/123456</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sécurité */}
        <div id="securite-conformite" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            6.5 Sécurité, Protection CSRF & Conformité RGPD
          </h3>
          <ul className="text-xs sm:text-sm text-gray-600 space-y-1.5 pl-5 list-disc">
            <li><strong>Protection CSRF Double-Submit :</strong> toute requête mutante avec cookie de session exige le header correspondant <code className="font-mono text-xs">X-CSRF-Token</code>.</li>
            <li><strong>Conformité RGPD :</strong> export complet des données personnelles (<code className="font-mono text-xs">GET /api/v1/me/export</code>) et droit à l'oubli (<code className="font-mono text-xs">DELETE /api/v1/me/purge</code>) avec anonymisation d'audit.</li>
            <li><strong>En-têtes de sécurité :</strong> Helmet avec Content Security Policy (CSP) en production.</li>
            <li><strong>Throttling & Throttling par compte :</strong> limitation globale par IP et par compte utilisateur pour bloquer les attaques par force brute.</li>
          </ul>
        </div>

        {/* Observabilité & Docker */}
        <div id="observabilite" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            6.6 Observabilité (Sentry & OpenTelemetry)
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Les erreurs 5xx sont automatiquement expédiées à Sentry avec leur identifiant de trace (<code className="font-mono text-xs">traceId</code>). L'interface <code className="font-mono text-xs">telemetry.ts</code> permet de créer des spans OpenTelemetry avec zéro overhead.
          </p>
        </div>

        <div id="deploiement-docker" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            6.7 Graceful Shutdown & Docker
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Lors d'un arrêt de conteneur (<code className="font-mono text-xs">SIGTERM</code>), le serveur cesse d'accepter de nouvelles requêtes, laisse terminer les requêtes en vol, arrête les workers de queue, draine les pools de base de données, déconnecte Redis et flashe les événements Sentry.
          </p>
          <CodeBlock
            language="bash"
            filename="Terminal"
            code={`# Démarrage de la stack locale complète (App + PostgreSQL + Redis + Mailpit)
docker compose up -d`}
          />
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 7 */}
      {/* ==================================================================== */}
      <section id="ressources-liens" className="scroll-mt-6 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm">
            7
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold text-black ${highlightClass('Ressources & Liens')}`}>
              Ressources & Liens utiles
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">Documentation officielle, outils conseillés et lectures fondamentales</p>
          </div>
        </div>

        <div id="auteur-template" className="mt-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            7.1 Le Template
          </h3>
          <p className="text-sm text-gray-600">
            <strong>Auteur du template :</strong> Yahia Naim<br />
            <strong>Dépôt GitHub :</strong>{' '}
            <a
              href="https://github.com/yahyanaim/Architecture"
              target="_blank"
              rel="noreferrer"
              className="text-black font-semibold underline inline-flex items-center gap-1"
            >
              github.com/yahyanaim/Architecture <ExternalLink className="w-3 h-3" />
            </a>
            <br />
            <strong>X / Twitter :</strong>{' '}
            <a
              href="https://x.com/yahya_naim"
              target="_blank"
              rel="noreferrer"
              className="text-black font-semibold underline inline-flex items-center gap-1"
            >
              x.com/yahya_naim <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        <div id="stack-officielle" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            7.2 Documentation officielle de la stack
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm">
            <a href="https://nodejs.org/docs" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">Node.js</div>
              <div className="text-gray-500 text-xs">Runtime JavaScript serveur</div>
            </a>
            <a href="https://expressjs.com" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">Express.js</div>
              <div className="text-gray-500 text-xs">Framework HTTP & middlewares</div>
            </a>
            <a href="https://www.typescriptlang.org/docs" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">TypeScript</div>
              <div className="text-gray-500 text-xs">Typage statique & generics</div>
            </a>
            <a href="https://react.dev" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">React 19</div>
              <div className="text-gray-500 text-xs">Bibliothèque d'interface UI</div>
            </a>
            <a href="https://vite.dev" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">Vite</div>
              <div className="text-gray-500 text-xs">Build tool frontend ultra-rapide</div>
            </a>
            <a href="https://tanstack.com/query/latest" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">TanStack Query</div>
              <div className="text-gray-500 text-xs">Gestion d'état serveur & cache</div>
            </a>
            <a href="https://zod.dev" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">Zod</div>
              <div className="text-gray-500 text-xs">Schémas de validation type-safe</div>
            </a>
            <a href="https://ui.shadcn.com" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">Shadcn UI</div>
              <div className="text-gray-500 text-xs">Composants accessibles & Tailwind</div>
            </a>
            <a href="https://vitest.dev" target="_blank" rel="noreferrer" className="p-3 rounded-lg border border-gray-200 hover:border-black transition-colors block">
              <div className="font-bold text-black">Vitest</div>
              <div className="text-gray-500 text-xs">Framework de test unitaire rapide</div>
            </a>
          </div>
        </div>

        <div id="services-cloud" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            7.3 Écosystème & Hébergement
          </h3>
          <ul className="text-xs sm:text-sm text-gray-600 space-y-1 pl-5 list-disc">
            <li><strong>Neon (Postgres Serverless) :</strong> <a href="https://neon.tech" target="_blank" rel="noreferrer" className="underline text-black">neon.tech</a></li>
            <li><strong>Supabase (Postgres + Auth + Storage) :</strong> <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline text-black">supabase.com</a></li>
            <li><strong>Sentry (Error Tracking & APM) :</strong> <a href="https://sentry.io" target="_blank" rel="noreferrer" className="underline text-black">sentry.io</a></li>
            <li><strong>OpenTelemetry :</strong> <a href="https://opentelemetry.io" target="_blank" rel="noreferrer" className="underline text-black">opentelemetry.io</a></li>
          </ul>
        </div>

        <div id="lectures-recommandees" className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            7.4 Lectures recommandées
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <th className="py-2.5 px-3 font-semibold">Ouvrage / Ressource</th>
                  <th className="py-2.5 px-3 font-semibold">Auteur</th>
                  <th className="py-2.5 px-3 font-semibold">Pourquoi le lire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Clean Architecture</td>
                  <td className="py-2 px-3">Robert C. Martin ("Uncle Bob")</td>
                  <td className="py-2 px-3">La théorie fondatrice expliquant pourquoi isoler le domaine métier.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Domain-Driven Design</td>
                  <td className="py-2 px-3">Eric Evans</td>
                  <td className="py-2 px-3">Contextes bornés, agrégats et modélisation du domaine d'entreprise.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold text-black">Node.js Best Practices</td>
                  <td className="py-2 px-3">Goldberg Yoni (GitHub)</td>
                  <td className="py-2 px-3">Patterns d'ingénierie Node.js en production, gestion d'erreurs et sécurité.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          — Fin du Guide Développeur — Fait avec passion par Yahia Naim
        </div>
      </section>
    </div>
  );
}
