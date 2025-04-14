import { Loader2 } from 'lucide-react';

const Spinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
    </div>
  );
};

export default Spinner;
