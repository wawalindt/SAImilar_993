
import React from 'react';
import { Movie } from '../types';

interface MovieCardProps {
  movie: Movie;
  onClick: (movie: Movie) => void;
  isWatched?: boolean;
  onToggleWatched: (e: React.MouseEvent, movie: Movie) => void;
  isWishlisted?: boolean;
  onToggleWishlist: (e: React.MouseEvent, movie: Movie) => void;
}

const MovieCard: React.FC<MovieCardProps> = ({ 
    movie, 
    onClick, 
    isWatched, 
    onToggleWatched,
    isWishlisted,
    onToggleWishlist
}) => {
  const imageUrl = movie.poster_path 
    ? `/api/tmdb-image?path=${movie.poster_path}`
    : `https://picsum.photos/seed/${movie.id}/300/450`;

  const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';

  return (
    <div 
      className="group relative bg-surface rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 ease-out transform hover:-translate-y-1 border border-white/5"
      onClick={() => onClick(movie)}
    >
      {/* Poster Image */}
      <div className="aspect-[2/3] w-full relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={movie.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        
        {/* Rating Badges */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            {/* TMDb Rating */}
            <div className="bg-black/60 backdrop-blur-sm text-yellow-400 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 border border-white/10">
               <i className="fa-solid fa-star text-[10px]"></i> {movie.vote_average.toFixed(1)}
            </div>
            {/* User Rating */}
            {movie.userRating && movie.userRating > 0 && (
                <div className="bg-secondary/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 border border-white/10 shadow-lg">
                    {movie.userRating}/10
                </div>
            )}
        </div>

        {/* Wishlist Button (Top Left) */}
        <button
            className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-20 ${
                isWishlisted ? 'bg-secondary text-white' : 'bg-black/40 text-white/70 hover:bg-secondary hover:text-white'
            }`}
            onClick={(e) => onToggleWishlist(e, movie)}
            title="Add to Wishlist"
        >
            <i className={`${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-bookmark text-xs`}></i>
        </button>
      </div>

      {/* Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
         <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {movie.title}
         </h3>
         <div className="flex justify-between items-end">
            <div className="flex items-center gap-2 text-textMuted text-xs font-medium">
                <span>{year}</span>
                {movie.media_type === 'tv' && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">TV</span>}
            </div>
            
            {/* Watched Checkbox */}
            <div 
                className={`w-6 h-6 rounded border cursor-pointer flex items-center justify-center transition-all z-20 ${isWatched ? 'bg-primary border-primary' : 'bg-transparent border-textMuted hover:border-white'}`}
                onClick={(e) => onToggleWatched(e, movie)}
                title="Mark as watched"
            >
                {isWatched && <i className="fa-solid fa-check text-white text-xs"></i>}
            </div>
         </div>
      </div>
    </div>
  );
};

export default MovieCard;
