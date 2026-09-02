
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, FilterOption, Language, LLMProvider } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReset: () => void;
  isTyping: boolean;
  onFilterClick: (filter: FilterOption) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  t: any; // Translations object
  onRandom: () => void;
  activeModel?: string;
  onModelChange?: (model: string) => void;
  userRole?: string; // Added userRole to control model visibility
  llmProvider?: LLMProvider;
  onOpenSettings?: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
    messages, 
    onSendMessage, 
    onReset, 
    isTyping, 
    onFilterClick,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    onRandom,
    llmProvider = 'groq',
    onOpenSettings,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleVoiceInput = () => {
    if (isListening) {
        setIsListening(false);
        return; 
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support voice input.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onend = () => {
        setIsListening(false);
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             const msg = language === 'ru' 
                ? "Доступ к микрофону запрещен. Пожалуйста, разрешите доступ в настройках браузера." 
                : "Microphone access denied. Please allow access in browser settings.";
             alert(msg);
        }
        setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-surfaceHover transition-colors duration-300">
      {/* Header - Standardized Height h-16 (64px) */}
      <div className="h-16 px-4 border-b border-surfaceHover flex justify-between items-center bg-background/50 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300 gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/20">
                AI
            </div>
            {/* REMOVED 'hidden sm:block' to show on mobile */}
            <h1 className="text-lg font-semibold tracking-tight text-textMain">{t.title}</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-3 flex-1 justify-end min-w-0">
            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                {/* Theme Toggle */}
                <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="text-textMuted hover:text-textMain transition-colors border border-white/10 px-1.5 sm:px-2 py-1 rounded w-7 h-7 sm:w-8 flex items-center justify-center"
                    title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                </button>

                {/* Language Toggle */}
                <button 
                    onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
                    className="text-[10px] sm:text-xs font-medium text-textMuted hover:text-textMain transition-colors border border-white/10 px-1.5 sm:px-2 py-1 rounded w-7 h-7 sm:w-8 flex items-center justify-center"
                >
                    {/* Show TARGET language, not current */}
                    {language === 'ru' ? 'EN' : 'RU'}
                </button>

                {/* Reset / Clear Chat Button */}
                <button 
                    onClick={onReset}
                    className="text-textMuted hover:text-textMain transition-colors border border-white/10 px-1.5 sm:px-2 py-1 rounded w-7 h-7 sm:w-8 flex items-center justify-center"
                    title={t.reset}
                >
                    <i className="fa-solid fa-broom"></i>
                </button>
            </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-surfaceHover scrollbar-track-transparent">
        {messages.length === 0 && (
            <div className="text-center mt-10 opacity-50">
                <div className="text-4xl mb-4">🎬</div>
                <p className="text-sm text-textMain">{t.welcome_title}</p>
                <p className="text-xs mt-2 text-textMuted">"{t.welcome_subtitle}"</p>
                <p className="text-xs text-textMuted">"{t.welcome_subtitle2}"</p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-surfaceHover text-textMain rounded-br-none border border-white/10' // Neutral color for user
                  : 'bg-surfaceHover/50 text-textMain rounded-bl-none border border-white/5'
              }`}
            >
              {msg.content}
            </div>
            
            {/* Render Filters if present */}
            {msg.suggestedFilters && msg.suggestedFilters.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-[85%]">
                    {msg.suggestedFilters.map((filter, idx) => (
                        <button 
                            key={idx}
                            onClick={() => onFilterClick(filter)}
                            className="text-xs bg-background border border-surfaceHover hover:border-primary/50 hover:text-primary text-textMuted px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer text-left"
                        >
                           {filter.selected ? '✓ ' : '+ '} {filter.label}
                        </button>
                    ))}
                </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex items-start">
            <div className="bg-surfaceHover/50 px-4 py-3 rounded-2xl rounded-bl-none border border-white/5">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-textMuted/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-textMuted/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-textMuted/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input - Compact Footer (p-3) */}
      <div className="p-3 bg-surface border-t border-surfaceHover transition-colors duration-300">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? t.listening : t.placeholder}
            className={`w-full bg-background text-textMain text-sm rounded-xl pl-4 pr-28 py-3 focus:outline-none focus:ring-1 focus:ring-primary/50 border border-surfaceHover transition-all shadow-inner ${isListening ? 'ring-1 ring-red-500/50' : ''}`}
          />
          
          {/* Icons Group inside input */}
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {/* Random Dice Button */}
              <button
                type="button"
                onClick={onRandom}
                title={t.random_search}
                className="p-2 text-textMuted hover:text-secondary transition-colors"
              >
                <i className="fa-solid fa-dice text-base"></i>
              </button>

              {/* Microphone Button */}
              <button
                type="button"
                onClick={handleVoiceInput}
                title={t.mic_title}
                className={`p-2 transition-all ${isListening ? 'text-red-500 animate-pulse scale-110' : 'text-textMuted hover:text-primary'}`}
              >
                <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'} text-base`}></i>
              </button>

              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="bg-primary hover:bg-red-700 text-white w-9 h-9 rounded-lg transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ml-1"
              >
                <i className="fa-solid fa-paper-plane text-[10px]"></i>
              </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
