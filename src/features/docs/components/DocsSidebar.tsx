import { useState } from 'react';
import { Search, ChevronRight, BookOpen, Menu, X } from 'lucide-react';
import { DOC_SECTIONS } from '../data/docsContent';

interface DocsSidebarProps {
  activeSection: string;
  onSelectSection: (sectionId: string, subId?: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function DocsSidebar({
  activeSection,
  onSelectSection,
  searchTerm,
  onSearchChange,
}: DocsSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filter sections based on search query
  const filteredSections = DOC_SECTIONS.filter((sec) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesTitle = sec.title.toLowerCase().includes(term);
    const matchesSummary = sec.summary.toLowerCase().includes(term);
    const matchesSub = sec.subsections.some((sub) => sub.title.toLowerCase().includes(term));
    return matchesTitle || matchesSummary || matchesSub;
  });

  const handleSelect = (sectionId: string, subId?: string) => {
    onSelectSection(sectionId, subId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Toggle */}
      <div className="lg:hidden mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-black" />
          <span className="font-semibold text-sm text-gray-900">Table des Matières</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          aria-label="Afficher le menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Container */}
      <aside
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } lg:block w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-6 lg:self-start mb-8 lg:mb-0`}
      >
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          {/* Search Box */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher dans la doc..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-gray-50/50"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
            Guide Développeur (7 Sections)
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
            {filteredSections.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                Aucun résultat pour "{searchTerm}"
              </div>
            ) : (
              filteredSections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <div key={section.id} className="space-y-0.5">
                    <button
                      onClick={() => handleSelect(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-black text-white shadow-xs'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                      }`}
                    >
                      <span className="truncate">{section.title}</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                          isActive ? 'rotate-90 text-white' : 'text-gray-400'
                        }`}
                      />
                    </button>

                    {/* Subsections list when active */}
                    {isActive && (
                      <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-gray-200 ml-3 my-1">
                        {section.subsections.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => handleSelect(section.id, sub.id)}
                            className="w-full text-left py-1 px-2 rounded text-xs text-gray-600 hover:text-black hover:bg-gray-100 transition-colors block truncate cursor-pointer"
                          >
                            {sub.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </nav>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span>Clean Architecture Starter</span>
            <span>v1.0 Production</span>
          </div>
        </div>
      </aside>
    </>
  );
}
