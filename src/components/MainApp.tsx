import { useState } from 'react';
import { SiReact, SiVite, SiTailwindcss, SiReactquery, SiShadcnui, SiExpress, SiSqlite, SiSwagger, SiStripe } from 'react-icons/si';
import { 
  TbShieldLock, TbRefreshDot, TbBuildingSkyscraper, TbUserShield, 
  TbFingerprint, TbReceiptTax, TbServerCog 
} from 'react-icons/tb';
import { HiCheckBadge } from 'react-icons/hi2';
import { 
  Workflow, Briefcase, Layers, FolderTree, KeyRound, CheckCircle2, Zap, Lock, Activity 
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UserList } from '@/features/users/components/UserList';
import { CreateUserForm } from '@/features/users/components/CreateUserForm';

interface MainAppProps {
  initialTab?: 'architecture' | 'security' | 'billing' | 'demo';
}

export function MainApp({ initialTab = 'architecture' }: MainAppProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'architecture' | 'security' | 'billing' | 'demo'>(initialTab);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>92 Vitest Tests Passing · Audit-Hardened Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-black tracking-tight">
            Clean Architecture Template
          </h2>
          <p className="text-gray-500 mt-3 max-w-2xl mx-auto text-base sm:text-lg">
            A production-ready SaaS boilerplate with Hexagonal Ports & Adapters, strict Multi-Tenancy isolation, automated token refresh, and durable background jobs.
          </p>

          {/* Navigation Tabs */}
          <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'architecture'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Architecture & Ports</span>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'security'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <TbShieldLock className="w-4 h-4" />
              <span>Security & Tenancy</span>
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'billing'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <TbReceiptTax className="w-4 h-4" />
              <span>Billing & Job Queue</span>
            </button>
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'demo'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Workflow className="w-4 h-4" />
              <span>Live Demo (Users Feature)</span>
            </button>
          </div>

          {/* TAB 1: Architecture Overview */}
          {activeTab === 'architecture' && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <SiReact className="w-5 h-5 text-sky-500" />
                  Frontend Layer
                </h3>
                <ul className="text-sm text-gray-600 space-y-3">
                  <li className="flex items-center gap-3">
                    <SiReact className="w-5 h-5 text-gray-700" />
                    <span>React 19 + Vite + React Router</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <SiTailwindcss className="w-5 h-5 text-gray-700" />
                    <span>Tailwind CSS 4 + Shadcn UI</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <SiReactquery className="w-5 h-5 text-gray-700" />
                    <span>TanStack React Query</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <TbRefreshDot className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-gray-900">Axios 401 Auto-Refresh Interceptor</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <SiExpress className="w-5 h-5 text-gray-900" />
                  Backend Layer
                </h3>
                <ul className="text-sm text-gray-600 space-y-3">
                  <li className="flex items-center gap-3">
                    <SiExpress className="w-5 h-5 text-gray-700" />
                    <span>Express 4 Composition Root</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <SiSqlite className="w-5 h-5 text-gray-700" />
                    <span>SQLite (WAL) + Postgres Ready</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <SiSwagger className="w-5 h-5 text-gray-700" />
                    <a href="/api/docs" className="hover:underline text-gray-900 font-medium">Swagger API Docs</a>
                  </li>
                  <li className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    <span>Bounded Route Metrics & Error Hook</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" />
                  Domain & Ports
                </h3>
                <ul className="text-sm text-gray-600 space-y-3">
                  <li className="flex items-center gap-3">
                    <Workflow className="w-5 h-5 text-gray-700" />
                    <span>Hexagonal Ports & Adapters</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-700" />
                    <span className="font-medium text-gray-900">IPasswordHasher Port (Bcrypt)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-gray-700" />
                    <span className="font-medium text-gray-900">ITokenService Port (JWT/Crypto)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-gray-700" />
                    <span>Repository Pattern & DI</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: Security & Tenancy */}
          {activeTab === 'security' && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-5xl mx-auto animate-in fade-in duration-300">
              <div className="group bg-white p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 mb-4 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <TbRefreshDot className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                </div>
                <h3 className="font-semibold text-black text-lg mb-2">Automated Token Refresh (No Lockout)</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Dual-token security: short-lived 15m access JWTs paired with 30-day hashed rotating refresh tokens. The frontend Axios client intercepts 401s, silently issues a replacement pair via <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">/api/auth/refresh</code>, and replays requests transparently without dropping active users.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-600 gap-1.5 font-medium">
                  <HiCheckBadge className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chain revocation on theft replay</span>
                </div>
              </div>

              <div className="group bg-white p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 mb-4 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <TbBuildingSkyscraper className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-black text-lg mb-2">Multi-Tenancy Guard Tripwire</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Shared-schema tenancy enforced by <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">resolveTenant</code> middleware and database-hydrated accounts. CI includes an automated tripwire test that parses all repository SQL statements and route definitions, preventing cross-tenant data leaks.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-600 gap-1.5 font-medium">
                  <HiCheckBadge className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Verified by tenancy-guard.test.ts</span>
                </div>
              </div>

              <div className="group bg-white p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 mb-4 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <TbUserShield className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-black text-lg mb-2">Real-Time RBAC Demotion Gate</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  The <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">authorizeAdmin</code> middleware verifies roles against freshly hydrated database accounts (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">req.account.role</code>) rather than stateless JWT claims alone, immediately revoking privileged access upon admin demotion.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-600 gap-1.5 font-medium">
                  <HiCheckBadge className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Zero privilege drift window</span>
                </div>
              </div>

              <div className="group bg-white p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600 mb-4 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <TbFingerprint className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-black text-lg mb-2">Sole-Admin & Verification Shields</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Workspace safety invariants prevent callers from deactivating their own accounts or deleting the sole admin of an organization. Updating an email in the profile resets verification status, preventing email spoofing.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-600 gap-1.5 font-medium">
                  <HiCheckBadge className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Prevents orphaned workspaces</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Billing & Job Queue */}
          {activeTab === 'billing' && (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-5xl mx-auto animate-in fade-in duration-300">
              <div className="group bg-white p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-[#635BFF] mb-4 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <SiStripe className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-black text-lg mb-2">SDK-Free Stripe Billing Seam</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Direct REST integration with raw HMAC-SHA256 signature verification and timing-safe checks. Features an idempotent webhook ledger (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">webhook_events</code>), dunning grace periods (7-day access upon payment failure), and real-time plan synchronization between organizations and subscriptions.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-600 gap-1.5 font-medium">
                  <HiCheckBadge className="w-4 h-4 text-[#635BFF] shrink-0" />
                  <span>Stripe Checkout & Customer Portal wired</span>
                </div>
              </div>

              <div className="group bg-white p-6 rounded-2xl shadow-xs border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600 mb-4 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <TbServerCog className="w-6 h-6 group-hover:rotate-45 transition-transform duration-500" />
                </div>
                <h3 className="font-semibold text-black text-lg mb-2">Durable Job Queue & Zombie Recovery</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  SQLite-backed background queue with exponential backoff and dead-letter parking (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">dead</code>). Includes atomic job leases (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">status = 'running'</code>) to prevent double-execution, plus an automatic zombie recovery reaper for tasks interrupted by worker restarts.
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-600 gap-1.5 font-medium">
                  <HiCheckBadge className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Non-blocking async audit file logging</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Live Demo (Users Feature) */}
          {activeTab === 'demo' && (
            <div className="mt-10 max-w-3xl mx-auto text-left animate-in fade-in duration-300 h-full">
              <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-black">Users Feature Demo</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Traces the complete hexagonal lifecycle: Component → React Query → Axios (with auto-refresh) → Controller → Service → Ports → SQLite Adapter.
                </p>
              </div>

              {isAdmin ? (
                <>
                  <CreateUserForm />
                  <UserList />
                </>
              ) : (
                <div className="text-gray-500 text-center py-12 bg-white rounded-xl border border-gray-200">
                  <p className="font-medium text-gray-700">The users directory is visible to admins only.</p>
                  <p className="text-sm mt-1">You are currently signed in as a regular user.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
