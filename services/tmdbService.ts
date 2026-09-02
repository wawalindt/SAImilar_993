import { Movie, Language, MediaType } from '../types';
import { API_KEYS } from '../config';

const getLangCode = (lang: Language) => lang === 'ru' ? 'ru-RU' : 'en-US';

// Normalizes TV and Movie responses into a single Movie interface
const normalizeResult = (item: any): Movie => {
  return {
    id: item.id,
    title: item.title || item.name, // TV shows use 'name'
    overview: item.overview,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date || item.first_air_date, // TV shows use 'first_air_date'
    vote_average: item.vote_average,
    genre_ids: item.genre_ids,
    media_type: item.title ? 'movie' : 'tv',
    original_language: item.original_language
  };
};

// Unified fetcher: Always via Proxy for security
const fetchFromTMDB = async (
  endpoint: string,
  params: Record<string, string> = {},
  lang: Language = 'ru'
) => {
  try {
    const url = '/api/tmdb';
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: endpoint,
        params: {
          language: getLangCode(lang),
          include_adult: 'false',
          ...params
        }
      })
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      console.warn('TMDb Error:', response.status);
      return { results: [] };
    }

    return await response.json();
  } catch (error) {
    console.error('TMDb Fetch Error:', error);
    return { results: [] };
  }
};

const getGenreId = async (name: string, type: 'movie' | 'tv'): Promise<string | undefined> => {
  const genres: Record<string, number> = {
    'action': 28,
    'adventure': 12,
    'animation': 16,
    'comedy': 35,
    'crime': 80,
    'documentary': 99,
    'drama': 18,
    'family': 10751,
    'fantasy': 14,
    'history': 36,
    'horror': 27,
    'music': 10402,
    'mystery': 9648,
    'romance': 10749,
    'science fiction': 878,
    'sci-fi': 878,
    'tv movie': 10770,
    'thriller': 53,
    'war': 10752,
    'western': 37,
    'action & adventure': 10759,
    'sci-fi & fantasy': 10765
  };

  return genres[name.toLowerCase()]?.toString();
};

export const searchMedia = async (
  query: string,
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<Movie[]> => {
  const endpoint = mediaType === 'movie' ? '/search/movie' : '/search/tv';
  let targetEndpoint = endpoint;
  if (mediaType === 'anime') targetEndpoint = '/search/tv';

  const data = await fetchFromTMDB(targetEndpoint, { query }, lang);
  let results = data.results?.map(normalizeResult) || [];

  if (mediaType === 'anime') {
    results = results.filter(
      (m: Movie) => m.genre_ids.includes(16) && m.original_language === 'ja'
    );
  }

  return results.slice(0, 10);
};

export const fetchMoviesByTitles = async (
  titles: string[],
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<Movie[]> => {
  const results: Movie[] = [];
  const uniqueIds = new Set();

  for (const title of titles) {
    const searchResults = await searchMedia(title, mediaType, lang);
    if (searchResults.length > 0) {
      const bestMatch = searchResults[0];
      if (!uniqueIds.has(bestMatch.id)) {
        uniqueIds.add(bestMatch.id);
        results.push(bestMatch);
      }
    }
  }

  return results;
};

export const discoverMedia = async (
  genreNames: string[] = [],
  keywords: string = '',
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<Movie[]> => {
  const endpoint = mediaType === 'movie' ? '/discover/movie' : '/discover/tv';
  const params: Record<string, string> = { sort_by: 'popularity.desc' };
  const genreIds: string[] = [];

  if (mediaType === 'anime') {
    genreIds.push('16');
    params.with_original_language = 'ja';
  } else if (genreNames.length > 0) {
    for (const g of genreNames) {
      const id = await getGenreId(g, mediaType === 'movie' ? 'movie' : 'tv');
      if (id) genreIds.push(id);
    }
  }

  if (genreIds.length > 0) params.with_genres = genreIds.join(',');

  const data = await fetchFromTMDB(endpoint, params, lang);
  return data.results?.map(normalizeResult).slice(0, 10) || [];
};

export const getMediaIdByName = async (
  name: string,
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<number | null> => {
  const movies = await searchMedia(name, mediaType, lang);
  return movies.length > 0 ? movies[0].id : null;
};

export const getSimilarMedia = async (
  id: number,
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<Movie[]> => {
  const endpointType = mediaType === 'movie' ? 'movie' : 'tv';
  const targetType = mediaType === 'anime' ? 'tv' : endpointType;
  const data = await fetchFromTMDB(`/${targetType}/${id}/recommendations`, {}, lang);
  return data.results?.map(normalizeResult).slice(0, 10) || [];
};

export const getMediaDetails = async (
  id: number,
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<Movie | null> => {
  const endpointType = mediaType === 'movie' ? 'movie' : 'tv';
  const targetType = mediaType === 'anime' ? 'tv' : endpointType;
  const data = await fetchFromTMDB(`/${targetType}/${id}`, { append_to_response: 'credits' }, lang);

  if (!data || !data.id) return null;

  const normalized = normalizeResult(data);
  const director = data.credits?.crew?.find(
    (c: any) => c.job === 'Director' || c.job === 'Executive Producer'
  )?.name;
  const cast = data.credits?.cast?.slice(0, 5).map((c: any) => c.name);

  return {
    ...normalized,
    director,
    cast,
    genres: data.genres,
    runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 0)
  };
};

export const discoverRandomMedia = async (
  mediaType: MediaType,
  lang: Language = 'ru'
): Promise<Movie[]> => {
  const endpoint = mediaType === 'movie' ? '/discover/movie' : '/discover/tv';
  const page = Math.floor(Math.random() * 20) + 1;
  const params: Record<string, string> = {
    sort_by: 'popularity.desc',
    page: page.toString(),
    'vote_count.gte': '200',
    'vote_average.gte': '6'
  };

  if (mediaType === 'anime') {
    params.with_genres = '16';
    params.with_original_language = 'ja';
  }

  const data = await fetchFromTMDB(endpoint, params, lang);
  let results = data.results?.map(normalizeResult) || [];

  if (mediaType === 'anime') {
    results = results.filter(
      (m: Movie) => m.genre_ids.includes(16) && m.original_language === 'ja'
    );
  }

  return results.sort(() => 0.5 - Math.random()).slice(0, 10);
};
