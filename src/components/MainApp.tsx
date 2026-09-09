import { useState } from 'react';
import { SiReact, SiVite, SiTailwindcss, SiReactquery, SiShadcnui, SiExpress, SiSqlite, SiSwagger } from 'react-icons/si';
import { 
  Workflow, Briefcase, Layers, FolderTree, KeyRound, CheckCircle2, Zap, Lock, Activity, RefreshCw 
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UserList } from '@/features/users/components/UserList';
import { CreateUserForm } from '@/features/users/components/CreateUserForm';

interface MainAppProps {
  initialTab?: 'architecture' | 'demo';
}

export function MainApp({ initialTab = 'architecture' }: MainAppProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'architecture' | 'demo'>(initialTab);

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
                    <RefreshCw className="w-5 h-5 text-emerald-600" />
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

          {/* TAB 2: Live Demo (Users Feature) */}
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
