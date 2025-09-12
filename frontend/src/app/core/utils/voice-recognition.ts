/**
 * Voice Recognition Utility for Search Service
 * 
 * Provides a simplified wrapper around the Web Speech API for voice search functionality.
 * Handles browser compatibility, error handling, and timeout management.
 */

export interface VoiceRecognitionOptions {
  language?: string;
  timeout?: number;
  continuous?: boolean;
  maxAlternatives?: number;
  grammars?: SpeechGrammarList;
  onStart?: () => void;
  onResult: (results: string) => void;
  onError: (error: string) => void;
  onTimeout?: () => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export interface VoiceRecognition {
  start: (options: VoiceRecognitionOptions) => void;
  stop: () => void;
  isSupported: () => boolean;
  getSupportedLanguages: () => string[];
}

class WebVoiceRecognition implements VoiceRecognition {
  private recognition: SpeechRecognition | null = null;
  private options: VoiceRecognitionOptions | null = null;
  private timeoutTimer: number | null = null;
  private isListening = false;

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    if (!this.isSupported()) {
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition|| 
                             (window as any).mozSpeechRecognition || 
                             (window as any).msSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.setupDefaultListeners();
      }
    } catch (error) {
      console.warn('Failed to initialize speech recognition:', error);
    }
  }

  private setupDefaultListeners(): void {
    if (!this.recognition) return;

    // Handle recognition start
    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.options?.onStart) {
        this.options.onStart();
      }
    };

    // Handle speech start
    this.recognition.onspeechstart = () => {
      if (this.options?.onSpeechStart) {
        this.options.onSpeechStart();
      }
    };

    // Handle speech end
    this.recognition.onspeechend = () => {
      if (this.options?.onSpeechEnd) {
        this.options.onSpeechEnd();
      }
      // Automatically stop recognition after speech ends
      setTimeout(() => this.stop(), 500);
    };

    // Handle recognition results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.clearTimeout();
      
      const results = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          results.push(result[0].transcript);
        }
      }

      const finalResults = results.join(' ');
      if (this.options) {
        this.options.onResult(finalResults);
      }
    };

    // Handle recognition errors
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event.error);
      this.clearTimeout();
      
      if (this.options) {
        this.handleRecognitionError(event.error);
      }
    };

    // Handle recognition end
    this.recognition.onend = () => {
      this.isListening = false;
      this.clearTimeout();
    };
  }

  private handleRecognitionError(error: string): void {
    if (!this.options) return;

    const errorMessage = this.getErrorMessage(error);
    
    // Don't treat these as errors in the traditional sense
    if (error === 'no-speech' || error === 'audio-capture') {
      return;
    }

    this.options.onError(errorMessage);
  }

  private getErrorMessage(error: string): string {
    const errorMessages: { [key: string]: string } = {
      'no-speech': 'No speech was detected. Please try speaking again.',
      'audio-capture': 'Audio capture failed. Please check your microphone.',
      'network': 'Network error occurred during voice recognition.',
      'not-allowed': 'Permission denied. Please allow microphone access.',
      'service-not-allowed': 'Voice recognition service is not available.',
      'bad-grammar': 'Grammar error occurred.',
      'language-not-supported': 'Selected language is not supported.',
      'no-grammar': 'No grammar was specified.',
      'aborted': 'Voice recognition was aborted.',
      'timeout': 'Voice recognition timed out.',
      'error': 'An unknown error occurred during voice recognition.'
    };

    return errorMessages[error] || 'Voice recognition error occurred.';
  }

  private setupTimeout(timeout: number): void {
    this.clearTimeout();
    this.timeoutTimer = window.setTimeout(() => {
      this.timeout();
    }, timeout);
  }

  private clearTimeout(): void {
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  private timeout(): void {
    this.stop();
    if (this.options?.onTimeout) {
      this.options.onTimeout();
    }
  }

  start(options: VoiceRecognitionOptions): void {
    if (!this.isSupported()) {
      options.onError('Voice recognition is not supported in this browser.');
      return;
    }

    if (!this.recognition) {
      options.onError('Speech recognition not initialized properly.');
      return;
    }

    if (this.isListening) {
      options.onError('Voice recognition is already active.');
      return;
    }

    this.options = { ...options };

    try {
      // Configure recognition
      this.recognition.lang = options.language || 'en-US';
      this.recognition.continuous = options.continuous || false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = options.maxAlternatives || 1;
      
      if (options.grammars) {
        this.recognition.grammars = options.grammars;
      }

      // Setup timeout
      const timeout = options.timeout || 10000;
      this.setupTimeout(timeout);

      // Start recognition
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      options.onError('Failed to start voice recognition.');
    }
  }

  stop(): void {
    this.clearTimeout();
    
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.warn('Error stopping voice recognition:', error);
      }
    }
  }

  isSupported(): boolean {
    // Check for standard SpeechRecognition API
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  getSupportedLanguages(): string[] {
    return [
      'en-US', // English (US)
      'en-GB', // English (UK)  
      'en-AU', // English (Australia)
      'es-ES', // Spanish (Spain)
      'es-MX', // Spanish (Mexico)
      'fr-FR', // French (France)
      'de-DE', // German (Germany)
      'it-IT', // Italian (Italy)
      'pt-BR', // Portuguese (Brazil)
      'ru-RU', // Russian (Russia)
      'ja-JP', // Japanese (Japan)
      'ko-KR', // Korean (South Korea)
      'zh-CN', // Chinese (China)
      'zh-TW', // Chinese (Taiwan)
      'ar-SA', // Arabic (Saudi Arabia)
      'hi-IN', // Hindi (India)
    ];
  }
}

// Create singleton instance
const voiceRecognition: VoiceRecognition = new WebVoiceRecognition();

export default voiceRecognition;

// TypeScript declarations for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    mozSpeechRecognition: any;
    msSpeechRecognition: any;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    grammars: SpeechGrammarList;
    onstart: (this: SpeechRecognition, ev: Event) => any;
    onend: (this: SpeechRecognition, ev: Event) => any;
    onresult: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any;
    onerror: (this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any;
    onspeechstart: (this: SpeechRecognition, ev: Event) => any;
    onspeechend: (this: SpeechRecognition, ev: Event) => any;
    start: () => void;
    stop: () => void;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    confidence: number;
    transcript: string;
  }

  interface SpeechGrammarList {
    length: number;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }
}