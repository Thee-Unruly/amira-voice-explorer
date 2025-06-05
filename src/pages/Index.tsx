import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Brain, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import VoiceVisualizer from '@/components/VoiceVisualizer';
import StatusIndicator from '@/components/StatusIndicator';
import ResponseDisplay from '@/components/ResponseDisplay';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { searchAndSummarize } from '@/utils/searchAndSummarize';

const Index: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('Ready to listen');

  const { toast } = useToast();
  const { startListening, stopListening, transcript, isSupported } = useSpeechRecognition();
  const { speak } = useTextToSpeech();

  useEffect(() => {
    if (transcript) {
      setQuery(transcript);
      setIsListening(false);
      processQuery(transcript);
    }
  }, [transcript]);

  const processQuery = async (userQuery: string) => {
    if (!userQuery.trim()) return;

    setIsProcessing(true);
    setStatus('Searching and processing...');

    try {
      console.log('Processing query:', userQuery);
      const result = await searchAndSummarize(userQuery);

      const fullResponse = ` ${result}`;
      setResponse(fullResponse);
      setStatus('Speaking response...');
      setIsSpeaking(true);

      await speak(fullResponse);
      setIsSpeaking(false);
      setStatus('Ready to listen');
    } catch (error) {
      console.error('Error processing query:', error);
      const errorResponse = "Sorry, I encountered an error while processing your request.";
      setResponse(errorResponse);
      setStatus('Speaking error message...');
      setIsSpeaking(true);

      await speak(errorResponse);
      setIsSpeaking(false);
      setStatus('Ready to listen');

      toast({
        title: "Error",
        description: "Failed to process your query. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      stopListening();
      setIsListening(false);
      setStatus('Ready to listen');
    } else {
      setQuery('');
      setResponse('');
      startListening();
      setIsListening(true);
      setStatus('Listening... Speak now');
    }
  };

  const isActive = isListening || isProcessing || isSpeaking;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-white">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold gradient-text mb-2">AGILE</h1>
          <p className="text-xl text-gray-300">AI Voice Assistant for Web Search</p>
          <StatusIndicator status={status} isActive={isActive} />
        </div>

        {/* Voice Visualizer */}
        <div className="flex justify-center">
          <VoiceVisualizer isListening={isListening} isSpeaking={isSpeaking} />
        </div>

        {/* Main Control */}
        <div className="flex justify-center">
          <Button
            onClick={handleMicClick}
            disabled={isProcessing || isSpeaking}
            size="lg"
            className={`
              w-24 h-24 rounded-full transition-all duration-300 
              ${isListening 
                ? 'bg-red-500 hover:bg-red-600 voice-pulse' 
                : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
              }
              ${isActive ? 'scale-110' : 'scale-100'}
              shadow-lg hover:shadow-xl
            `}
          >
            {isListening ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </Button>
        </div>

        {/* Query Display */}
        {query && (
          <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <Search className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Your Query</h3>
            </div>
            <p className="text-gray-200">{query}</p>
          </Card>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <Card className="p-6 bg-white/10 backdrop-blur border-white/20">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
              <span className="text-white">Processing with AI...</span>
            </div>
          </Card>
        )}

        {/* Response Display */}
        <ResponseDisplay response={response} isSpeaking={isSpeaking} />
      </div>
    </div>
  );
};

export default Index;