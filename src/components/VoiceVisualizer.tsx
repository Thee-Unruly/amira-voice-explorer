
import React from 'react';

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isListening, isSpeaking }) => {
  const isActive = isListening || isSpeaking;
  
  return (
    <div className="flex items-center justify-center space-x-2 h-20">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`
            w-1 bg-gradient-to-t from-purple-500 to-blue-500 rounded-full transition-all duration-300
            ${isActive ? 'voice-wave' : 'h-4'}
          `}
          style={{
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
};

export default VoiceVisualizer;
