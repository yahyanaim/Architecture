import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';
import { Toaster } from '@/components/ui/sonner';
import { Linkedin, Instagram, Facebook, X, Workflow, Briefcase, Layers, FolderTree } from 'lucide-react';
import { SiReact, SiVite, SiTailwindcss, SiReactquery, SiShadcnui, SiExpress, SiSqlite, SiSwagger } from 'react-icons/si';
import { useState } from 'react';
import { UserList } from './features/users/components/UserList';
import { CreateUserForm } from './features/users/components/CreateUserForm';

export default function App() {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<'architecture' | 'demo'>('architecture');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
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
                {/* Frontend Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                  <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                    Frontend
                  </h3>
                  <ul className="text-sm text-gray-600 space-y-3">
                    <li className="flex items-center gap-3 group">
                      <SiReact className="w-5 h-5 text-gray-700 group-hover:text-[#61DAFB] transition-colors" />
                      <span>React 19 + Vite</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <SiTailwindcss className="w-5 h-5 text-gray-700 group-hover:text-[#06B6D4] transition-colors" />
                      <span>Tailwind CSS 4</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <SiReactquery className="w-5 h-5 text-gray-700 group-hover:text-[#FF4154] transition-colors" />
                      <span>React Query</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <SiShadcnui className="w-5 h-5 text-gray-700 group-hover:text-black transition-colors" />
                      <span>Shadcn UI</span>
                    </li>
                  </ul>
                </div>

                {/* Backend Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                  <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                    Backend
                  </h3>
                  <ul className="text-sm text-gray-600 space-y-3">
                    <li className="flex items-center gap-3 group">
                      <SiExpress className="w-5 h-5 text-gray-700 group-hover:text-black transition-colors" />
                      <span>Express.js</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <SiSqlite className="w-5 h-5 text-gray-700 group-hover:text-[#003B57] transition-colors" />
                      <span>SQLite / Postgres</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <SiSwagger className="w-5 h-5 text-gray-700 group-hover:text-[#85EA2D] transition-colors" />
                      <span>Swagger Docs</span>
                    </li>
                  </ul>
                </div>

                {/* Structure Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                  <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                    Structure
                  </h3>
                  <ul className="text-sm text-gray-600 space-y-3">
                    <li className="flex items-center gap-3 group">
                      <Workflow className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Domain-Driven Design</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <Layers className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Clean Architecture</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <Briefcase className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Repository Pattern</span>
                    </li>
                    <li className="flex items-center gap-3 group">
                      <FolderTree className="w-5 h-5 text-gray-700 group-hover:text-blue-500 transition-colors" />
                      <span>Feature-based Folders</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'demo' && (
              <div className="mt-12 max-w-3xl mx-auto text-left animate-in fade-in duration-500">
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-black">Users Feature Demo</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Traces the full request path: Component → React Query → Axios → Controller → Service → Repository.
                  </p>
                </div>
                <CreateUserForm />
                <UserList />
              </div>
            )}
          </div>
        </main>

        <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-gray-600 font-medium">Architected by Yahia Naim</p>
              <p className="text-gray-400 text-sm mt-1">© {currentYear} All rights reserved</p>
            </div>
            <div className="flex items-center gap-6 mt-2">
              <a href="https://www.linkedin.com/in/yahia-naim/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#0A66C2] transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="https://x.com/yahya_naim" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors" aria-label="X (Twitter)">
                <X className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/yahia_naiiiim/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#E4405F] transition-colors" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.facebook.com/yaaahya.naim/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#1877F2] transition-colors" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
        </footer>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
