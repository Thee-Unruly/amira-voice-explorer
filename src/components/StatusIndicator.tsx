
import React from 'react';
import { Loader2 } from 'lucide-react';

interface StatusIndicatorProps {
  status: string;
  isActive: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, isActive }) => {
  return (
    <div className="flex items-center justify-center gap-2 text-lg">
      {isActive && <Loader2 className="w-5 h-5 animate-spin" />}
      <span className={`transition-colors ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
        {status}
      </span>
    </div>
  );
};

export default StatusIndicator;
