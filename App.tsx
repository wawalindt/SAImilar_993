
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import MovieCard from './components/MovieCard';
import MovieDetails from './components/MovieDetails';
import AdminPanel from './components/AdminPanel';
import AuthModal from './components/AuthModal';
import { Movie, ChatMessage, GeminAnalysisResult, Language, FilterOption, MediaType, AppSettings, SearchHistoryState, UserProfile, TestLogEntry, MovieSummary } from './types';
import { analyzeUserQuery } from './services/geminiService';
import { searchMedia, discoverMedia, getMediaIdByName, getSimilarMedia, getMediaDetails, fetchMoviesByTitles, discoverRandomMedia } from './services/tmdbService';
import { getSettings, saveSettings } from './services/storageService';
// FIX: Added removeFromWatched to imports
import { auth, getUserProfile, getWishlist, getWatched, addToWishlist, removeFromWishlist, addToWatched, removeFromWatched, updateMovieRating, logoutUser } from './services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

const TRANSLATIONS = {
  ru: {
    title: "SAImilar",
    reset: "Сброс",
    placeholder: "Введите ваш запрос...",
    welcome: "Привет! Я SAImilar. Намекните мне, что хотите сегодня посмотреть? Какой сюжет, атмосфера или актер Вас интересует?",
    welcome_title: "Расскажи мне о настроении",
    welcome_subtitle: "Киберпанк, но смешной",
    welcome_subtitle2: "Сериалы как Черное Зеркало",
    recommended: "Рекомендую посмотреть",
    wishlist_title: "Ваш список желаемого",
    wishlist_empty: "В списке пока пусто",
    watched_title: "Просмотренные",
    watched_empty: "Вы пока не отметили ни одного фильма как просмотренный",
    waiting: "Жду ваш запрос...",
    found_matches: "Найдено совпадений: ",
    start_journey: "Используйте чат",
    scanning: "Сканирую мультивселенную...",
    ready: "Готов рекомендовать",
    ready_desc: "Я анализирую тысячи фильмов и сериалов, чтобы найти скрытые жемчужины.",
    back: "Назад к результатам",
    ai_summary: "AI Описание",
    no_spoilers: "БЕЗ СПОЙЛЕРОВ",
    original_synopsis: "Оригинальное описание",
    show_original: "Показать оригинальное описание",
    hide_original: "Скрыть описание",
    director: "Режиссер/Создатель",
    cast: "В ролях",
    find_similar: "Найти похожие",
    rating: "Рейтинг",
    my_rating: "Моя оценка",
    year: "Год от",
    show_watched: "Просмотренные",
    filters: "Фильтры",
    loading: "Загрузка...",
    send: "Отправить",
    error_connection: "Проблемы с подключением. Попробуйте еще раз.",
    fresh_start: "Начнем сначала! Что хотите посмотреть?",
    applying_filter: "Применяю фильтр: ",
    wishlist: "Вишлист",
    next: "Следующие",
    load_more: "Загрузить еще",
    no_matches: "Нет совпадений по фильтрам.",
    clear_filters: "Очистить фильтры",
    previous: "Предыдущий запрос",
    random: "🎲 Случайная подборка",
    random_search: "Мне повезет!",
    mic_title: "Голосовой ввод",
    listening: "Слушаю...",
    chat_tab: "Чат",
    results_tab: "Результаты",
    login: "Войти",
    logout: "Выйти"
  },
  en: {
    title: "SAImilar",
    reset: "Reset",
    placeholder: "Type your request...",
    welcome: "Hi! I'm SAImilar. Give me a hint about what you'd like to watch today? What plot, atmosphere, or actor interests you?",
    welcome_title: "Tell me what you're in the mood for",
    welcome_subtitle: "Cyberpunk but funny",
    welcome_subtitle2: "Shows like Black Mirror",
    recommended: "Recommend to watch",
    wishlist_title: "Your Wishlist",
    wishlist_empty: "Wishlist is empty",
    watched_title: "Watched Movies",
    watched_empty: "You haven't marked any movies as watched yet",
    waiting: "Waiting for input...",
    found_matches: "Found matches: ",
    start_journey: "Use the chat",
    scanning: "Scanning the multiverse...",
    ready: "Ready to recommend",
    ready_desc: "I analyze thousands of movies and shows to find hidden gems.",
    back: "Back to results",
    ai_summary: "AI Summary",
    no_spoilers: "NO SPOILERS",
    original_synopsis: "Original Synopsis",
    show_original: "Show Original Synopsis",
    hide_original: "Hide Synopsis",
    director: "Director/Creator",
    cast: "Key Cast",
    find_similar: "Find Similar",
    rating: "Rating",
    my_rating: "My Rating",
    year: "Year From",
    show_watched: "Show Watched",
    filters: "Filters",
    loading: "Loading...",
    send: "Send",
    error_connection: "Connection trouble. Please try again.",
    fresh_start: "Fresh start! What are you in the mood for?",
    applying_filter: "Applying filter: ",
    wishlist: "Wishlist",
    next: "Next",
    load_more: "Load more",
    no_matches: "No matches for filters.",
    clear_filters: "Clear filters",
    previous: "Previous Request",
    random: "🎲 Random pick",
    random_search: "I'm feeling lucky!",
    mic_title: "Voice Input",
    listening: "Listening...",
    chat_tab: "Chat",
    results_tab: "Results",
    login: "Login",
    logout: "Logout"
  }
};

const App: React.FC = () => {
  // --- Persistent State ---
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [language, setLanguage] = useState<Language>(settings.language || 'ru');
  const [theme, setTheme] = useState<'dark' | 'light'>(settings.theme || 'dark');
  const [currentUser, setCurrentUser] = useState<UserProfile | undefined>(undefined);
  
  // Load user-specific data (or guest if currentUser is undefined)
  const [wishlist, setWishlist] = useState<Movie[]>([]);
  const [watchedMovies, setWatchedMovies] = useState<Movie[]>([]);

  // Apply Theme Side Effect
  useEffect(() => {
    if (theme === 'light') {
        document.documentElement.classList.add('light');
    } else {
        document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const t = TRANSLATIONS[language];

  // Helper for initial message
  const getInitMessage = (): ChatMessage => ({ 
    id: 'init', 
    role: 'assistant', 
    content: t.welcome,
    suggestedFilters: [
        { category: 'Type', label: language === 'ru' ? 'Фильмы' : 'Movies', value: language === 'ru' ? 'Фильмы' : 'Movies', selected: false },
        { category: 'Type', label: language === 'ru' ? 'Сериалы' : 'TV Shows', value: language === 'ru' ? 'Сериалы' : 'TV Shows', selected: false },
        { category: 'Type', label: language === 'ru' ? 'Аниме' : 'Anime', value: language === 'ru' ? 'Аниме' : 'Anime', selected: false },
        { category: 'Type', label: language === 'ru' ? 'Мультфильмы' : 'Cartoons', value: language === 'ru' ? 'Мультфильмы' : 'Cartoons', selected: false },
    ]
  });

  // --- ACTIVE MODEL STATE ---
  const [activeModel, setActiveModel] = useState<string>(settings.activeModel || 'stealth');

  // --- FIREBASE AUTH & SYNC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Logged In
            const profile = await getUserProfile(user.uid);
            const userProfile: UserProfile = {
                id: user.uid,
                username: profile?.nickname || user.displayName || 'User',
                email: user.email || undefined,
                provider: user.providerData[0]?.providerId === 'google.com' ? 'google' : 'local',
                role: profile?.role || 'user',
                createdAt: 0
            };
            setCurrentUser(userProfile);
            
            // Sync Data
            const wList = await getWishlist(user.uid);
            const wMovies = await getWatched(user.uid);
            setWishlist(wList);
            setWatchedMovies(wMovies);

            // Load user-specific active model
            const savedModel = localStorage.getItem(`saimilar_model_${user.uid}`);
            if (savedModel) {
                // Security Check: If saved model is Gemini but user is not admin, fallback
                if (savedModel === 'gemini' && userProfile.role !== 'admin' && userProfile.role !== 'owner') {
                     setActiveModel('glm52');
                } else {
                     setActiveModel(savedModel);
                }
            }
        } else {
            // Logged Out
            setCurrentUser(undefined);
            setWishlist([]);
            setWatchedMovies([]);
        }
    });
    return () => unsubscribe();
  }, []); 

  // Sync settings when language/theme changes
  useEffect(() => {
    const newSettings = { ...settings, language, theme };
    saveSettings(newSettings);
    setSettings(newSettings);
  }, [language, theme]);

  // --- UI State with Session Persistence ---
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('saimilar_session_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [movies, setMovies] = useState<Movie[]>(() => {
    try {
      const saved = sessionStorage.getItem('saimilar_session_movies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);
  const [currentMediaType, setCurrentMediaType] = useState<MediaType>('movie');
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Sync search & messages to session storage so reloads never lose results
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem('saimilar_session_messages', JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  useEffect(() => {
    try {
      sessionStorage.setItem('saimilar_session_movies', JSON.stringify(movies));
    } catch {}
  }, [movies]);

  // --- Mobile View State ---
  const [mobileView, setMobileView] = useState<'chat' | 'results'>('chat');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // --- History Stack ---
  const [historyStack, setHistoryStack] = useState<SearchHistoryState[]>([]);

  // View Mode
  const [viewMode, setViewMode] = useState<'recommendations' | 'wishlist' | 'watched'>('recommendations');

  // Filters State
  const [minRating, setMinRating] = useState<number>(0);
  const [filterYear, setFilterYear] = useState<string>('');
  const [showWatched, setShowWatched] = useState<boolean>(true);

  // --- PARALLEL TESTING STATE ---
  const [testLogs, setTestLogs] = useState<TestLogEntry[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testModels, setTestModels] = useState<string[]>([]);

  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
        setMessages([getInitMessage()]);
    }
  }, [language, messages.length]);


  // --- Touch / Swipe Handlers ---
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && mobileView === 'chat') {
        setMobileView('results');
    }
    if (isRightSwipe && mobileView === 'results') {
        setMobileView('chat');
    }
  };

  // --- Handlers ---

  const handleAdminSave = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleModelChange = (model: string) => {
      setActiveModel(model);
      const newSettings = { ...settings, activeModel: model };
      setSettings(newSettings);
      saveSettings(newSettings);
      setMessages([]); 
      
      // Save locally per user
      if (currentUser) {
          localStorage.setItem(`saimilar_model_${currentUser.id}`, model);
      }
  };

  const handleToggleWishlist = async (e: React.MouseEvent | null, movie: Movie) => {
      if (e) e.stopPropagation();
      if (!currentUser) {
          setIsAuthOpen(true);
          return;
      }

      const exists = wishlist.find(m => m.id === movie.id);
      if (exists) {
          await removeFromWishlist(currentUser.id, movie.id);
          setWishlist(prev => prev.filter(m => m.id !== movie.id));
      } else {
          await addToWishlist(currentUser.id, movie);
          setWishlist(prev => [...prev, movie]);
      }
  };

  const handleToggleWatched = async (e: React.MouseEvent | null, movie: Movie) => {
      if (e) e.stopPropagation();
      if (!currentUser) {
          setIsAuthOpen(true);
          return;
      }

      const exists = watchedMovies.find(m => m.id === movie.id);
      if (exists) {
          await removeFromWatched(currentUser.id, movie.id);
          setWatchedMovies(prev => prev.filter(m => m.id !== movie.id));
      } else {
          await addToWatched(currentUser.id, movie);
          setWatchedMovies(prev => [...prev, movie]);
      }
  };

  const handleRateMovie = async (movie: Movie, rating: number) => {
      if (!currentUser) {
          setIsAuthOpen(true);
          return;
      }

      // Update state locally first for immediate UI feedback
      const updatedMovie = { ...movie, userRating: rating };
      
      // Update selectedMovie if it's the one being rated
      if (selectedMovie && selectedMovie.id === movie.id) {
          setSelectedMovie(prev => prev ? ({ ...prev, userRating: rating }) : null);
      }

      // 1. Remove from Wishlist if exists
      const existsInWishlist = wishlist.find(m => m.id === movie.id);
      if (existsInWishlist) {
          await removeFromWishlist(currentUser.id, movie.id);
          setWishlist(prev => prev.filter(m => m.id !== movie.id));
      }

      // 2. Add/Update Watched list
      // Force update Firestore regardless of local state to ensure consistency
      await updateMovieRating(currentUser.id, movie.id, rating);
      
      setWatchedMovies(prev => {
          const exists = prev.find(m => m.id === movie.id);
          if (exists) {
              return prev.map(m => m.id === movie.id ? { ...m, userRating: rating } : m);
          }
          return [...prev, updatedMovie];
      });

      // 3. Update local state list
      setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, userRating: rating } : m));
  };

  const handleSaveSummary = async (movie: Movie, summary: MovieSummary) => {
      // Logic moved to MovieDetails.tsx via global service
      // This remains for potential local state updates or legacy callbacks
  };

  const handleAuthLogin = (user: UserProfile) => {
      // Handled by onAuthStateChanged
  };

  const handleLogout = () => {
      logoutUser();
  };

  const handleSendMessage = async (text: string, append: boolean = false) => {
    if (!append && movies.length > 0) {
        setHistoryStack(prev => [...prev, {
            movies: [...movies],
            messages: [...messages],
            query: messages[messages.length - 1]?.content || '',
            viewMode: viewMode
        }]);
    }

    setViewMode('recommendations');
    
    if (!append) {
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
    }
    
    setIsTyping(true);
    if (!append) setIsLoadingMovies(true);
    else setIsLoadingMore(true);

    if (!append) {
        setMobileView('results');
    }

    try {
        const currentHistory = messages.map(m => `${m.role}: ${m.content}`);
        if (!append) currentHistory.push(`user: ${text}`);
        
        let queryText = text;
        if (append && movies.length > 0) {
            const currentTitles = movies.map(m => m.title).join(", ");
            queryText = `${text}. IMPORTANT: Exclude these titles: ${currentTitles}`;
        }

        const analysis: GeminAnalysisResult = await analyzeUserQuery(queryText, currentHistory, language, settings);

        // === LOG PRIMARY MODEL INTERACTION (Always) ===
        const usedModel = analysis.usedModel || settings.modelsConfig?.[settings.llmProvider]?.find(m => m.enabled)?.id || 'default';
        const usedProvider = analysis.usedProvider || settings.llmProvider;
        
        setTestLogs(prev => [...prev, {
            id: Date.now().toString(),
            timestamp: Date.now(),
            model: usedModel,
            provider: usedProvider,
            query: text,
            response: analysis,
            fallback_used: analysis.fallback_used,
            attempts: analysis.attempts,
            metadata: {
                inputTokens: analysis.usage?.inputTokens || 0,
                outputTokens: analysis.usage?.outputTokens || 0,
                cost: analysis.usage?.cost || 0,
                responseTime: analysis.usage?.responseTime || 0
            }
        }]);
        // ===============================================
        
        if (analysis.isFallback) {
             if (append) {
                 setIsTyping(false);
                 setIsLoadingMore(false);
                 return;
             }
             const searchResults = await searchMedia(text, 'movie', language);
             setMovies(searchResults);
             setMessages(prev => [...prev, {
                 id: (Date.now() + 1).toString(),
                 role: 'assistant',
                 content: analysis.chat_response
             }]);
             setIsTyping(false);
             setIsLoadingMovies(false);
             return;
        }

        if (!append) setCurrentMediaType(analysis.media_type);

        let results: Movie[] = [];
        if (!append) {
             setSelectedMovie(null); 
             setFilterYear('');
             setMinRating(0);
        }

        const isGenericQuery = analysis.query_type === 'TYPE_3_GENERAL' && 
                              (!analysis.recommended_titles || analysis.recommended_titles.length === 0) &&
                              (!analysis.search_parameters.genres || analysis.search_parameters.genres.length === 0) &&
                              (!analysis.search_parameters.keywords || analysis.search_parameters.keywords.length === 0);

        if (isGenericQuery && !append) {
             results = await discoverRandomMedia('movie', language);
        } else if (analysis.recommended_titles && analysis.recommended_titles.length > 0) {
            results = await fetchMoviesByTitles(analysis.recommended_titles, analysis.media_type, language);
        }
        else if (analysis.query_type === 'TYPE_2_SPECIFIC_FILM' && analysis.search_parameters.similar_to_movie) {
            const mediaId = await getMediaIdByName(analysis.search_parameters.similar_to_movie, analysis.media_type, language);
            if (mediaId) {
                results = await getSimilarMedia(mediaId, analysis.media_type, language);
            } else {
                results = await searchMedia(analysis.search_parameters.similar_to_movie, analysis.media_type, language);
            }
        } 
        else {
             const keywords = analysis.search_parameters.keywords?.join(' ');
             const genres = analysis.search_parameters.genres || [];
             if (genres.length > 0 || keywords) {
                 results = await discoverMedia(genres, keywords, analysis.media_type, language);
             } else if (append) {
                  results = [];
             }
        }

        if (results.length > 0) {
            const resultsWithRatings = results.map(m => {
                const wM = watchedMovies.find(wm => wm.id === m.id);
                if (wM && wM.userRating) return { ...m, userRating: wM.userRating };
                return m;
            });

            if (append) {
                const existingIds = new Set(movies.map(m => m.id));
                const newMovies = resultsWithRatings.filter(m => !existingIds.has(m.id));
                setMovies(prev => [...prev, ...newMovies]);
            } else {
                setMovies(resultsWithRatings);
            }
        } else if (!append && !isGenericQuery) {
             setMovies([]);
        }
        
        if (!append) {
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: analysis.chat_response,
                suggestedFilters: analysis.suggested_filters?.map(f => ({ ...f, selected: false })) || []
            };
            setMessages(prev => [...prev, aiMsg]);
        }

    } catch (error: any) {
        console.error("Orchestration Error:", error);
        if (!append) {
            const rawError = error?.message || '';
            const safeError = rawError.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
            const displayContent = safeError.includes('OpenRouter Error') || safeError.includes('HTTP')
                ? `${t.error_connection}\n\n🔍 [Diagnostic info]: ${safeError}`
                : t.error_connection;

            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: displayContent }]);
        }
    } finally {
        setIsTyping(false);
        setIsLoadingMovies(false);
        setIsLoadingMore(false);
    }
  };

  const handleRandom = () => {
      setIsTyping(true);
      setIsLoadingMovies(true);
      setHistoryStack(prev => [...prev, {
            movies: [...movies],
            messages: [...messages],
            query: 'Random',
            viewMode: viewMode
      }]);
      setViewMode('recommendations');
      setMobileView('results');

      discoverRandomMedia('movie', language).then(results => {
          setMovies(results);
          setMessages(prev => [
              ...prev, 
              { id: Date.now().toString(), role: 'user', content: t.random },
              { id: (Date.now()+1).toString(), role: 'assistant', content: t.random_search }
          ]);
          setIsTyping(false);
          setIsLoadingMovies(false);
      });
  };

  const handleBack = () => {
      if (historyStack.length === 0) return;
      const previousState = historyStack[historyStack.length - 1];
      const newStack = historyStack.slice(0, -1);
      setHistoryStack(newStack);
      setMovies(previousState.movies);
      setMessages(previousState.messages);
      setViewMode(previousState.viewMode);
      setSelectedMovie(null);
  };

  const handleLoadMore = () => {
      handleSendMessage("Show me more recommendations similar to the previous request", true);
  };

  const handleFilterClick = (filter: FilterOption) => {
      if (filter.category === 'Type') {
          handleSendMessage(filter.value, false);
      } else {
          handleSendMessage(`${t.applying_filter} ${filter.label}`, false);
      }
  };

  const handleReset = () => {
      try {
        sessionStorage.removeItem('saimilar_session_messages');
        sessionStorage.removeItem('saimilar_session_movies');
      } catch {}
      setMessages([getInitMessage()]);
      setMovies([]);
      setHistoryStack([]);
      setSelectedMovie(null);
      setMinRating(0);
      setFilterYear('');
      setViewMode('recommendations');
      setMobileView('chat'); 
  };

  const handleMovieClick = async (movie: Movie) => {
      const type = movie.media_type || currentMediaType;
      const fullDetails = await getMediaDetails(movie.id, type, language);
      const finalMovie = fullDetails || { ...movie, media_type: type };
      
      const existing = [...watchedMovies, ...movies].find(m => m.id === movie.id);
      if (existing && existing.userRating) finalMovie.userRating = existing.userRating;

      setSelectedMovie(finalMovie);
  };

  const handleFindSimilarFromDetails = (movie: Movie) => {
      handleSendMessage(`${t.find_similar}: "${movie.title}"`, false);
      setMobileView('results');
  };

  let sourceList: Movie[] = [];
  let title = '';
  let countLabel = '';

  if (viewMode === 'wishlist') {
      sourceList = wishlist;
      title = t.wishlist_title;
      countLabel = `${wishlist.length} items`;
  } else if (viewMode === 'watched') {
      sourceList = watchedMovies;
      title = t.watched_title;
      countLabel = `${watchedMovies.length} items`;
  } else {
      sourceList = movies;
      title = movies.length > 0 ? t.recommended : t.waiting;
      countLabel = movies.length > 0 ? `${t.found_matches} ${movies.length}` : t.start_journey;
  }

  const yearBounds = useMemo(() => {
    if (sourceList.length === 0) return { min: 1990, max: new Date().getFullYear() };
    const years = sourceList.map(m => parseInt(m.release_date?.split('-')[0] || '0')).filter(y => y > 0);
    return { min: Math.min(...years) || 1990, max: Math.max(...years) || new Date().getFullYear() };
  }, [sourceList]);

  const filteredMovies = useMemo(() => {
    return sourceList.filter(movie => {
        if (movie.vote_average < minRating) return false;
        if (filterYear) {
            const year = parseInt(movie.release_date?.split('-')[0] || '0');
            if (year < parseInt(filterYear)) return false;
        }
        if (viewMode === 'recommendations' && !showWatched) {
            if (watchedMovies.some(wm => wm.id === movie.id)) return false;
        }
        return true;
    });
  }, [sourceList, minRating, filterYear, showWatched, watchedMovies, viewMode]);

  const hasAdminAccess = (user?: UserProfile) => {
      if (!user) return false;
      return !!user.role && user.role !== 'user';
  };

  return (
    <div 
        className="flex h-screen bg-background text-textMain font-sans overflow-hidden relative transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
      <AdminPanel 
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        settings={settings}
        onSave={handleAdminSave}
        testLogs={testLogs}
        onClearLogs={() => setTestLogs([])}
        isTestMode={isTestMode}
        setIsTestMode={setIsTestMode}
        testModels={testModels}
        setTestModels={setTestModels}
        userRole={currentUser?.role}
      />
      
      <AuthModal
         isOpen={isAuthOpen}
         onClose={() => setIsAuthOpen(false)}
         onLogin={handleAuthLogin}
      />

      <div 
        className={`w-full md:w-1/4 h-full min-w-[320px] z-30 shadow-2xl flex flex-col border-r border-white/5 absolute md:relative transition-transform duration-300 ease-in-out bg-background ${
            mobileView === 'chat' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 min-h-0 relative">
            <ChatInterface 
                messages={messages} 
                onSendMessage={(msg) => handleSendMessage(msg, false)} 
                onReset={handleReset}
                isTyping={isTyping}
                onFilterClick={handleFilterClick}
                language={language}
                setLanguage={setLanguage}
                theme={theme}
                setTheme={(t) => setTheme(t)}
                t={t}
                onRandom={handleRandom}
                llmProvider={settings.llmProvider}
                onOpenSettings={() => setIsAdminOpen(true)}
                userRole={currentUser?.role}
            />
        </div>
        <div className="p-4 bg-surface/50 border-t border-white/5 flex justify-between items-center text-xs pb-20 md:pb-4 flex-shrink-0">
            <button 
                type="button"
                id="llm-service-settings-btn"
                onClick={() => setIsAdminOpen(true)}
                className="flex items-center gap-1.5 bg-surfaceHover hover:bg-white/10 text-xs font-semibold text-textMain border border-white/10 hover:border-primary/50 px-2.5 py-1.5 rounded-lg transition-all"
                title={language === 'ru' ? 'Сервис LLM и настройки' : 'LLM Service & Settings'}
            >
                <span className="text-primary font-bold">
                    {settings.llmProvider === 'openrouter' ? 'OpenRouter' : 'Groq'}
                </span>
                <i className="fa-solid fa-sliders text-[11px] text-textMuted ml-0.5"></i>
            </button>
            
            {currentUser ? (
                <div className="flex items-center gap-3">
                    <span className="text-secondary font-bold" title={`Role: ${currentUser.role}`}>{currentUser.username}</span>
                    <button onClick={handleLogout} className="text-textMuted hover:text-white" title={t.logout}>
                        <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsAuthOpen(true)}
                    className="text-textMuted hover:text-primary flex items-center gap-2"
                >
                    <i className="fa-solid fa-right-to-bracket"></i> {t.login}
                </button>
            )}
        </div>
      </div>

      <div 
        className={`flex-1 h-full relative overflow-hidden bg-background flex flex-col absolute md:relative w-full md:w-auto transition-transform duration-300 ease-in-out ${
            mobileView === 'results' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none"></div>

        {selectedMovie ? (
            <MovieDetails 
                movie={selectedMovie} 
                onBack={() => setSelectedMovie(null)} 
                onFindSimilar={handleFindSimilarFromDetails}
                language={language}
                t={t}
                isWishlisted={!!wishlist.find(m => m.id === selectedMovie.id)}
                onToggleWishlist={(movie) => handleToggleWishlist(null, movie)}
                userRating={selectedMovie.userRating}
                onRateMovie={handleRateMovie}
                onSaveSummary={(s) => handleSaveSummary(selectedMovie, s)}
                settings={{ ...settings, activeModel }} // Pass current model settings
            />
        ) : (
            <>
                <div className="h-16 px-4 md:px-6 flex flex-row justify-between items-center gap-2 relative z-40 bg-background border-b border-white/5 sticky top-0 shadow-lg shadow-black/20 min-h-[55px]">
                     <div className="min-w-0 flex flex-col justify-center">
                        <h2 className="text-lg md:text-xl font-bold text-textMain tracking-tight flex items-center gap-2 truncate">
                            {viewMode === 'wishlist' && <i className="fa-solid fa-bookmark text-secondary flex-shrink-0"></i>}
                            {viewMode === 'watched' && <i className="fa-solid fa-check-circle text-primary flex-shrink-0"></i>}
                            <span className="truncate">{title}</span>
                        </h2>
                        <p className="text-textMuted text-[10px] truncate leading-tight">
                            {viewMode === 'recommendations' && movies.length === 0 ? t.start_journey : countLabel}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 bg-surface/50 p-1 rounded-xl border border-white/5 shadow-xl flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                            <button 
                                onClick={() => setViewMode(viewMode === 'wishlist' ? 'recommendations' : 'wishlist')}
                                className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors border ${
                                    viewMode === 'wishlist' 
                                    ? 'bg-secondary text-white border-secondary' 
                                    : 'bg-transparent text-textMuted hover:text-textMain border-transparent hover:bg-white/5'
                                }`}
                                title={t.wishlist}
                            >
                                <i className={`${viewMode === 'wishlist' ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
                                <span className="text-xs font-bold uppercase hidden lg:inline">{t.wishlist}</span>
                            </button>

                            <div className={`flex items-center rounded-lg border transition-all ${viewMode === 'watched' ? 'border-primary bg-primary/10' : 'border-transparent bg-transparent hover:bg-white/5 hover:border-white/10'}`}>
                                <button
                                    onClick={() => setViewMode(viewMode === 'watched' ? 'recommendations' : 'watched')}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-l-lg transition-colors ${
                                        viewMode === 'watched' ? 'text-primary' : 'text-textMuted hover:text-textMain'
                                    }`}
                                    title={t.show_watched}
                                >
                                    <i className="fa-solid fa-check"></i>
                                    <span className="text-xs font-bold uppercase hidden xl:inline">{t.show_watched}</span>
                                </button>
                                <div className="w-px h-3 bg-white/10"></div>
                                <label className="flex items-center px-2 py-1 cursor-pointer rounded-r-lg" title="Filter watched">
                                    <div className="relative">
                                        <input type="checkbox" checked={showWatched} onChange={(e) => setShowWatched(e.target.checked)} className="sr-only"/>
                                        <div className={`w-6 h-3 rounded-full transition-colors ${showWatched ? 'bg-primary' : 'bg-surfaceHover border border-textMuted/50'}`}></div>
                                        <div className={`absolute top-0.5 left-0.5 bg-white w-2 h-2 rounded-full transition-transform ${showWatched ? 'translate-x-3' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="hidden sm:block w-px h-4 bg-white/10 mx-1"></div>

                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-2 px-1 sm:px-2">
                                <span className="text-xs text-textMuted uppercase font-bold hidden xl:inline">{t.rating}</span>
                                <select 
                                    value={minRating} 
                                    onChange={(e) => setMinRating(Number(e.target.value))}
                                    className="bg-background text-textMain text-xs border border-surfaceHover rounded px-2 py-1 outline-none focus:border-primary appearance-none pr-6 relative"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a1a1aa' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: `right 0.2rem center`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.2em 1.2em'
                                    }}
                                >
                                    <option value="0">-</option>
                                    <option value="6">6+</option>
                                    <option value="7">7+</option>
                                    <option value="8">8+</option>
                                    <option value="9">9+</option>
                                </select>
                            </div>
                            
                            <div className="flex items-center gap-2 px-1 sm:px-2 border-l border-white/5">
                                <span className="text-xs text-textMuted uppercase font-bold hidden xl:inline">{t.year}</span>
                                <input 
                                    type="number" 
                                    placeholder={yearBounds.min.toString()}
                                    min={yearBounds.min}
                                    max={new Date().getFullYear()}
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                    className="bg-background text-textMain text-xs border border-surfaceHover rounded px-2 py-1 w-16 md:w-20 outline-none focus:border-primary placeholder-textMuted/50"
                                    style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:px-10 relative scrollbar-thin scrollbar-thumb-surfaceHover pb-24">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-24">
                         {filteredMovies.map((movie) => (
                             <MovieCard 
                                key={movie.id} 
                                movie={movie} 
                                onClick={handleMovieClick}
                                isWatched={!!watchedMovies.find(m => m.id === movie.id)}
                                onToggleWatched={handleToggleWatched}
                                isWishlisted={!!wishlist.find(m => m.id === movie.id)}
                                onToggleWishlist={handleToggleWishlist}
                             />
                         ))}
                    </div>

                    {filteredMovies.length === 0 && viewMode !== 'recommendations' && (
                        <div className="text-center mt-20 text-textMuted">
                            <i className={`fa-solid ${viewMode === 'wishlist' ? 'fa-bookmark' : 'fa-check-circle'} text-4xl mb-4 opacity-20`}></i>
                            <p>{viewMode === 'wishlist' ? t.wishlist_empty : t.watched_empty}</p>
                        </div>
                    )}

                    {filteredMovies.length === 0 && viewMode === 'recommendations' && movies.length > 0 && (
                        <div className="text-center mt-20 text-textMuted">
                             <p>{t.no_matches}</p>
                             <button 
                                onClick={() => { setMinRating(0); setFilterYear(''); setShowWatched(true); }}
                                className="mt-4 text-primary hover:text-textMain underline"
                             >
                                {t.clear_filters}
                             </button>
                        </div>
                    )}

                    {isLoadingMovies && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-primary font-medium animate-pulse">{t.scanning}</p>
                        </div>
                    )}
                    
                    <div ref={resultsEndRef} />
                </div>

                {(historyStack.length > 0 || (movies.length > 0 && viewMode === 'recommendations')) && (
                    <div className="py-2 px-4 bg-background/90 backdrop-blur-md border-t border-white/5 flex items-center justify-between z-30 absolute bottom-12 md:bottom-0 w-full min-h-[40px]">
                        <div className="flex-1">
                            {historyStack.length > 0 && viewMode === 'recommendations' && (
                                <button
                                    onClick={handleBack}
                                    className="bg-surface hover:bg-surfaceHover text-textMain px-4 py-2 rounded-full border border-white/10 text-sm font-medium flex items-center gap-2 shadow-lg transition-all"
                                >
                                    <i className="fa-solid fa-arrow-left"></i> {t.previous}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 flex justify-end md:justify-center">
                            {!isLoadingMovies && movies.length > 0 && viewMode === 'recommendations' && filteredMovies.length > 0 && (
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="bg-surface border border-white/10 hover:bg-surfaceHover text-textMain px-6 py-2 rounded-full font-medium transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isLoadingMore ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t.loading}</>
                                    ) : (
                                        <>{t.load_more} <i className="fa-solid fa-arrow-down"></i></>
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="flex-1"></div>
                    </div>
                )}
            </>
        )}
      </div> 

      <div className="fixed bottom-0 left-0 w-full h-12 bg-surface/90 backdrop-blur-md border-t border-white/5 md:hidden z-50 flex justify-around items-center">
        <button 
            onClick={() => setMobileView('chat')}
            className={`flex flex-col items-center justify-center w-full h-full ${mobileView === 'chat' ? 'text-primary' : 'text-textMuted'}`}
        >
            <i className="fa-solid fa-comment text-lg"></i>
            <span className="text-[10px]">{t.chat_tab}</span>
        </button>
        <div className="w-px h-6 bg-white/10"></div>
        <button 
            onClick={() => setMobileView('results')}
            className={`flex flex-col items-center justify-center w-full h-full ${mobileView === 'results' ? 'text-primary' : 'text-textMuted'}`}
        >
            <i className="fa-solid fa-layer-group text-lg"></i>
            <span className="text-[10px]">{t.results_tab}</span>
        </button>
      </div>
    </div>
  );
};

export default App;
