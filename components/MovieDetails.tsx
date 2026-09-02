import React, { useEffect, useState } from 'react';
import { Movie, MovieSummary, Language, AppSettings } from '../types';
import { generateSpoilerFreeSummary } from '../services/geminiService';
import { getCachedSummary, cacheSummary } from '../services/storageService';
import { getGlobalMovieSummary, saveGlobalMovieSummary } from '../services/firebaseService';

interface MovieDetailsProps {
  movie: Movie;
  onBack: () => void;
  onFindSimilar: (movie: Movie) => void;
  language: Language;
  t: any;
  isWishlisted: boolean;
  onToggleWishlist: (movie: Movie) => void;
  userRating?: number;
  onRateMovie: (movie: Movie, rating: number) => void;
  onSaveSummary?: (summary: MovieSummary) => void;
  settings?: AppSettings; // Added settings prop
}

const MovieDetails: React.FC<MovieDetailsProps> = ({ 
    movie, 
    onBack, 
    onFindSimilar, 
    language, 
    t,
    isWishlisted,
    onToggleWishlist,
    userRating,
    onRateMovie,
    onSaveSummary,
    settings
}) => {
  const [summary, setSummary] = useState<MovieSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [showOriginalSynopsis, setShowOriginalSynopsis] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
        setLoadingSummary(true);
        
        // 1. Check Local Device Cache (Memory/LocalStorage)
        const cached = getCachedSummary(movie.id, language);
        if (cached) {
            if (isMounted) {
                setSummary(cached);
                setLoadingSummary(false);
            }
            return;
        }

        // 2. Check Global Firestore Cache (moviedetails collection)
        // This works for ANY user (auth or guest) if Firestore Rules allow public read.
        try {
            const globalCached = await getGlobalMovieSummary(movie.id, language);
            if (globalCached) {
                if (isMounted) {
                    setSummary(globalCached);
                    setLoadingSummary(false);
                    // Update local cache for next time
                    cacheSummary(movie.id, language, globalCached);
                }
                return;
            }
        } catch (e) {
            console.warn("Global cache check skipped", e);
        }

        // 3. Generate with AI
        try {
            // Pass settings so it uses the active model (Gemini/Perplexity)
            const result = await generateSpoilerFreeSummary(movie.title, movie, language, settings);
            
            if (isMounted) {
                setSummary(result);
                setLoadingSummary(false);
                
                // 4. Save to Global Firestore Cache
                // This works for ANY user if Firestore Rules allow public write for this collection.
                saveGlobalMovieSummary(movie.id, movie.title, language, result);

                // Update local cache
                cacheSummary(movie.id, language, result);
            }
        } catch (e) {
            console.error("Summary generation failed", e);
            if (isMounted) setLoadingSummary(false);
        }
    };
    fetchSummary();
    return () => { isMounted = false; };
  }, [movie.id, language, settings]); // Re-run if settings (model) changes

  const imageUrl = movie.poster_path 
    ? `/api/tmdb-image?path=${movie.poster_path}`
    : `https://picsum.photos/seed/${movie.id}/300/450`;

  const backdropUrl = movie.backdrop_path
    ? `/api/tmdb-image?path=${movie.backdrop_path}`
    : `https://picsum.photos/seed/${movie.id}/1280/720`;

  const handleRatingClick = (rating: number) => {
      onRateMovie(movie, rating);
  };

  return (
    <div className="h-full overflow-y-auto relative animate-fadeIn bg-background">
        {/* Backdrop Header */}
        <div className="relative h-64 md:h-80 w-full overflow-hidden">
            <img src={backdropUrl} alt="Backdrop" className="w-full h-full object-cover opacity-40 blur-sm scale-105" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
            
            <button 
                onClick={onBack}
                className="absolute top-8 left-8 z-50 bg-black/60 hover:bg-white/10 text-white px-5 py-2.5 rounded-full backdrop-blur-md transition-all border border-white/10 text-sm font-medium flex items-center gap-2 shadow-lg"
            >
                <i className="fa-solid fa-arrow-left"></i> {t.back}
            </button>
        </div>

        <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-10 pb-20">
            <div className="flex flex-col xl:flex-row gap-8">
                {/* Poster - Sticky on larger screens */}
                <div className="flex-shrink-0 w-48 md:w-72 mx-auto xl:mx-0 shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-white/10 relative">
                    <img src={imageUrl} alt={movie.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                        onClick={() => onToggleWishlist(movie)}
                        className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all z-20 ${isWishlisted ? 'bg-secondary text-white' : 'bg-black/50 text-white hover:bg-secondary'}`}
                    >
                        <i className={`${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
                    </button>
                </div>

                {/* Info */}
                <div className="flex-1 pt-4 xl:pt-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-textMain leading-tight mb-2 tracking-tight">
                        {movie.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-textMuted mb-6">
                        <span className="bg-surfaceHover px-2 py-0.5 rounded text-textMain">{movie.release_date?.split('-')[0]}</span>
                        <div className="flex items-center gap-1 text-yellow-400">
                            <i className="fa-solid fa-star"></i> {movie.vote_average.toFixed(1)}
                        </div>
                        {movie.runtime && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
                        {movie.media_type && <span className="uppercase text-xs border border-surfaceHover px-1.5 py-0.5 rounded text-textMuted">{movie.media_type}</span>}
                    </div>

                    {/* USER RATING SECTION */}
                    <div className="mb-6 p-4 bg-surface/30 border border-white/5 rounded-xl">
                        <p className="text-xs text-textMuted uppercase font-bold mb-2">{t.my_rating || "My Rating"}</p>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => handleRatingClick(star)}
                                    className="focus:outline-none transition-transform hover:scale-110 p-0.5"
                                >
                                    <i className={`fa-star text-lg transition-colors ${
                                        star <= (hoverRating || userRating || 0) 
                                        ? 'fa-solid text-secondary' // Active
                                        : 'fa-regular text-textMuted/30' // Inactive
                                    }`}></i>
                                </button>
                            ))}
                            <span className="ml-3 text-sm font-bold text-secondary">
                                {hoverRating || userRating || 0}/10
                            </span>
                        </div>
                    </div>

                    {/* AI Summary Section */}
                    <div className="bg-surface/50 border border-white/5 rounded-2xl p-6 mb-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                            <i className="fa-solid fa-sparkles text-3xl text-secondary"></i>
                        </div>
                        <h3 className="text-sm font-bold text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                             {t.ai_summary} <span className="text-[10px] bg-secondary/20 px-1.5 py-0.5 rounded text-secondary/80">{t.no_spoilers}</span>
                        </h3>
                        
                        {loadingSummary ? (
                            <div className="space-y-2 animate-pulse">
                                <div className="h-4 bg-white/5 rounded w-full"></div>
                                <div className="h-4 bg-white/5 rounded w-5/6"></div>
                                <div className="h-4 bg-white/5 rounded w-4/6"></div>
                            </div>
                        ) : (
                            <div className="prose prose-invert max-w-none">
                                <p className="text-lg text-textMain leading-relaxed italic border-l-2 border-secondary pl-4 mb-4">
                                    "{summary?.summary.split('.')[0]}."
                                </p>
                                <p className="text-textMuted text-sm leading-relaxed">
                                    {summary?.summary.split('.').slice(1).join('.')}
                                </p>
                                {/* Tone Value without Label */}
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                                     <i className="fa-solid fa-sliders text-textMuted text-xs"></i>
                                     <span className="text-sm text-textMain capitalize bg-surfaceHover px-2 py-0.5 rounded">{summary?.tone}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Standard Overview (Hidden under spoiler) */}
                    <div className="mb-8 border-t border-white/10 pt-4">
                         <button 
                            onClick={() => setShowOriginalSynopsis(!showOriginalSynopsis)}
                            className="flex items-center gap-2 text-textMuted hover:text-textMain transition-colors text-sm font-medium w-full group"
                         >
                             <i className={`fa-solid fa-chevron-right transition-transform duration-300 ${showOriginalSynopsis ? 'rotate-90' : ''}`}></i>
                             {t.original_synopsis}
                         </button>
                         
                         <div className={`mt-3 overflow-hidden transition-all duration-500 ease-in-out ${showOriginalSynopsis ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                             <p className="text-textMuted text-sm leading-relaxed bg-surfaceHover p-4 rounded-lg border border-surfaceHover/50">
                                 {movie.overview}
                             </p>
                         </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {movie.director && (
                            <div>
                                <span className="text-xs text-textMuted block">{t.director}</span>
                                <span className="text-sm text-textMain">{movie.director}</span>
                            </div>
                        )}
                         {movie.cast && (
                            <div>
                                <span className="text-xs text-textMuted block">{t.cast}</span>
                                <span className="text-sm text-textMain">{movie.cast.join(', ')}</span>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={() => onFindSimilar(movie)}
                        className="bg-primary hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 w-full md:w-auto justify-center"
                    >
                        <i className="fa-solid fa-magnifying-glass"></i> {t.find_similar}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default MovieDetails;