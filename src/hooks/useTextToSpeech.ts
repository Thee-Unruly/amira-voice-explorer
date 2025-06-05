
import { useCallback } from 'react';

interface TextToSpeechHook {
  speak: (text: string) => Promise<void>;
}

export const useTextToSpeech = (): TextToSpeechHook => {
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings for a more natural female voice
      utterance.rate = 0.85;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      
      // Try to find a female voice
      const voices = speechSynth.getVoices();
      const femaleVoice = voices.find(voice => 
        (voice.name.includes('female') || voice.name.includes('Female')) && 
        voice.lang.includes('en')
      );
      
      // Use a female voice if found, otherwise try to select one by name
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      } else {
        // Common female voice names across different platforms
        const preferredVoices = [
          'Google US English Female',
          'Microsoft Zira',
          'Samantha',
          'Female'
        ];
        
        for (const name of preferredVoices) {
          const voice = voices.find(v => v.name.includes(name) && v.lang.includes('en'));
          if (voice) {
            utterance.voice = voice;
            break;
          }
        }
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis error: ${event}`));
      };

      // Cancel any ongoing speech
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }, []);

  return { speak };
};

// Create a shorthand for the speech synthesis API
const speechSynth = window.speechSynthesis;
