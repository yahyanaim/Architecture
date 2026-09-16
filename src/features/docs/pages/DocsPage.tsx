import { useState } from 'react';
import { DocsSidebar } from '../components/DocsSidebar';
import { DocsSections } from '../components/DocsSections';

export function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>('idee-fondamentale');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleSelectSection = (sectionId: string, subId?: string) => {
    setActiveSection(sectionId);
    const targetId = subId || sectionId;
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="lg:flex lg:gap-8 items-start">
        {/* Sticky Table of Contents Sidebar */}
        <DocsSidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* Main Documentation Body */}
        <main className="flex-1 min-w-0">
          <DocsSections searchTerm={searchTerm} />
        </main>
      </div>
    </div>
  );
}

export default DocsPage;
