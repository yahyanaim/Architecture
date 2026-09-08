import { useState } from 'react';
import { SiReact, SiVite, SiTailwindcss, SiReactquery, SiShadcnui, SiExpress, SiSqlite, SiSwagger } from 'react-icons/si';
import { Workflow, Briefcase, Layers, FolderTree } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UserList } from '@/features/users/components/UserList';
import { CreateUserForm } from '@/features/users/components/CreateUserForm';

type Page = 'main' | 'profile' | 'pricing' | 'billing';

interface MainAppProps {
  onNavigate?: (page: Page) => void;
}

export function MainApp({ onNavigate }: MainAppProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'architecture' | 'demo'>('architecture');

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <Header onNavigate={onNavigate} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        <div className="text-center py-10">
          <h2 className="text-3xl font-bold text-black">Clean Architecture Template</h2>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
            A full-stack starter with clean architecture, DDD, and a working users feature out of the box.
          </p>

          <div className="mt-8 flex justify-center space-x-4">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'architecture'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              Architecture Overview
            </button>
            <button
              onClick={() => setActiveTab('demo')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'demo'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              Live Demo (Users Feature)
            </button>
          </div>

          {activeTab === 'architecture' && (
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-6xl mx-auto animate-in fade-in duration-500">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="3" width="18" height="13" rx="2" stroke="black" strokeWidth="1.5" />
                    <line x1="7" y1="16" x2="13" y2="16" stroke="black" strokeWidth="1.5" />
                    <line x1="10" y1="16" x2="10" y2="19" stroke="black" strokeWidth="1.5" />
                    <line x1="7" y1="19" x2="13" y2="19" stroke="black" strokeWidth="1.5" />
                    <line x1="1" y1="13" x2="19" y2="13" stroke="black" strokeWidth="1.5" />
                  </svg>
                  Frontend
                </h3>
                <ul className="text-sm text-gray-600 space-y-3">
                  <li className="flex items-center gap-3 group">
                    <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-[#61DAFB] transition-colors">
                      <SiReact className="w-5 h-5 text-gray-700 group-hover:text-[#61DAFB] transition-colors" />
                      <span>React 19 + Vite</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-[#06B6D4] transition-colors">
                      <SiTailwindcss className="w-5 h-5 text-gray-700 group-hover:text-[#06B6D4] transition-colors" />
                      <span>Tailwind CSS 4</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://tanstack.com/query/latest" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-[#FF4154] transition-colors">
                      <SiReactquery className="w-5 h-5 text-gray-700 group-hover:text-[#FF4154] transition-colors" />
                      <span>React Query</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-black transition-colors">
                      <SiShadcnui className="w-5 h-5 text-gray-700 group-hover:text-black transition-colors" />
                      <span>Shadcn UI</span>
                    </a>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="2" width="18" height="5" rx="1.5" stroke="black" strokeWidth="1.5" />
                    <rect x="1" y="8" width="18" height="5" rx="1.5" stroke="black" strokeWidth="1.5" />
                    <rect x="1" y="14" width="18" height="5" rx="1.5" stroke="black" strokeWidth="1.5" />
                    <circle cx="16" cy="4.5" r="1" fill="black" />
                    <circle cx="16" cy="10.5" r="1" fill="black" />
                    <circle cx="16" cy="16.5" r="1" fill="black" />
                  </svg>
                  Backend
                </h3>
                <ul className="text-sm text-gray-600 space-y-3">
                  <li className="flex items-center gap-3 group">
                    <a href="https://expressjs.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-black transition-colors">
                      <SiExpress className="w-5 h-5 text-gray-700 group-hover:text-black transition-colors" />
                      <span>Express.js</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://www.sqlite.org/docs.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-[#003B57] transition-colors">
                      <SiSqlite className="w-5 h-5 text-gray-700 group-hover:text-[#003B57] transition-colors" />
                      <span>SQLite / Postgres</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="/api/docs" className="flex items-center gap-3 cursor-pointer hover:text-[#85EA2D] transition-colors">
                      <SiSwagger className="w-5 h-5 text-gray-700 group-hover:text-[#85EA2D] transition-colors" />
                      <span>Swagger Docs</span>
                    </a>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="1" width="4" height="4" rx="1" fill="black" />
                    <rect x="1" y="8" width="4" height="4" rx="1" fill="black" />
                    <rect x="8" y="8" width="4" height="4" rx="1" fill="black" />
                    <rect x="15" y="8" width="4" height="4" rx="1" fill="black" />
                    <rect x="4" y="15" width="4" height="4" rx="1" fill="black" />
                    <rect x="12" y="15" width="4" height="4" rx="1" fill="black" />
                    <line x1="10" y1="5" x2="10" y2="8" stroke="black" strokeWidth="1.5" />
                    <line x1="10" y1="10" x2="3" y2="10" stroke="black" strokeWidth="1.5" />
                    <line x1="10" y1="10" x2="17" y2="10" stroke="black" strokeWidth="1.5" />
                    <line x1="3" y1="12" x2="6" y2="15" stroke="black" strokeWidth="1.5" />
                    <line x1="17" y1="12" x2="14" y2="15" stroke="black" strokeWidth="1.5" />
                  </svg>
                  Structure
                </h3>
                <ul className="text-sm text-gray-600 space-y-3">
                  <li className="flex items-center gap-3 group">
                    <a href="https://domain-driven-design.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-blue-500 transition-colors">
                      <Workflow className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Domain-Driven Design</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://blog.cleancoder.com/uncle-bob/2012/08/13/TheCleanArchitecture.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-blue-500 transition-colors">
                      <Layers className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Clean Architecture</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://martinfowler.com/eaaCatalog/repository.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-blue-500 transition-colors">
                      <Briefcase className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Repository Pattern</span>
                    </a>
                  </li>
                  <li className="flex items-center gap-3 group">
                    <a href="https://feature-sliced.design" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 cursor-pointer hover:text-blue-500 transition-colors">
                      <FolderTree className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Feature-based Folders</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'demo' && (
            <div className="mt-12 max-w-3xl mx-auto text-left animate-in fade-in duration-500 h-full">
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-black">Users Feature Demo</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Traces the full request path: Component → React Query → Axios → Controller → Service → Repository.
                </p>
              </div>
              {/* User directory is admin-only (GET /api/users returns 403 for
                  regular users). Render it only for admins so non-admins get
                  an explanation instead of a failed request. */}
              {isAdmin ? (
                <>
                  <CreateUserForm />
                  <UserList />
                </>
              ) : (
                <div className="text-gray-500 text-center py-12">
                  <p>The users directory is visible to admins only.</p>
                  <p className="mt-2">You are signed in as a regular user.</p>
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
