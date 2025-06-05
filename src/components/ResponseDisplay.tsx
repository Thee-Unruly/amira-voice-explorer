
import React from 'react';
import { Card } from '@/components/ui/card';
import { Volume2 } from 'lucide-react';

interface ResponseDisplayProps {
  response: string;
  isSpeaking: boolean;
}

const ResponseDisplay: React.FC<ResponseDisplayProps> = ({ response, isSpeaking }) => {
  if (!response) return null;

  return (
    <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
      <div className="flex items-center gap-3 mb-3">
        <Volume2 className={`w-5 h-5 text-green-400 ${isSpeaking ? 'animate-pulse' : ''}`} />
        <h3 className="text-lg font-semibold text-white">AMIRA's Response</h3>
      </div>
      <p className="text-gray-200 leading-relaxed">{response}</p>
    </Card>
  );
};

export default ResponseDisplay;
