import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';

export function Forbidden403({
  title = 'Access Forbidden',
  message = 'You do not have administrative permissions to view this resource.',
}: {
  title?: string;
  message?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4 animate-in fade-in zoom-in duration-300">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-950 mb-2">
        {title}
      </h1>
      <p className="text-gray-500 max-w-md mb-6 text-sm">
        {message}
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </Button>
        <Button
          onClick={() => navigate('/')}
          className="bg-black hover:bg-gray-800 text-white"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
