import { Instagram, Facebook, X, Linkedin } from 'lucide-react';
import { SiDevdotto, SiDiscord } from 'react-icons/si';

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-gray-600 font-medium">Architected by Yahia Naim</p>
          <p className="text-gray-400 text-sm mt-1">© {currentYear} All rights reserved</p>
        </div>
        <div className="flex items-center gap-6 mt-2">
          <a href="https://dev.to/yahyanaim" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors" aria-label="Dev.to">
            <SiDevdotto className="w-5 h-5" />
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
          <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#5865F2] transition-colors" aria-label="Discord">
            <SiDiscord className="w-5 h-5" />
          </a>
          <a href="https://www.linkedin.com/in/yahia-naim" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#0A66C2] transition-colors" aria-label="LinkedIn">
            <Linkedin className="w-5 h-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
