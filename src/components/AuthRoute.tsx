import { useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { MainApp } from '@/components/MainApp';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ProfileSettings } from '@/features/profile/pages/ProfileSettings';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

type Page = 'main' | 'profile' | 'register';

function ProfilePage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <Header onNavigate={onBack} />
      <main className="flex-grow w-full py-8 px-4">
        <ProfileSettings />
      </main>
      <Footer />
    </div>
  );
}

export function AuthRoute() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('main');

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-black font-medium">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (currentPage === 'register') {
      return <RegisterPage onNavigateToLogin={() => setCurrentPage('main')} />;
    }
    return <LoginPage onNavigateToRegister={() => setCurrentPage('register')} />;
  }

  if (currentPage === 'profile') {
    return <ProfilePage onBack={() => setCurrentPage('main')} />;
  }

  return <MainApp onNavigate={handleNavigate} />;
}