import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
        watch: {
          ignored: ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/*.log'],
        },
      },
      plugins: [
        {
          name: 'strip-reload',
          transform(code, id) {
            if (id.includes('client.mjs') || id.includes('@vite/client')) {
              return code.replaceAll('location.reload()', 'console.warn("[vite] reload disabled")');
            }
          }
        },
        react(),
        {
          name: 'api-middleware',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              if (!req.url?.startsWith('/api/')) return next();

              try {
                const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                const endpointPath = urlObj.pathname.replace('/api/', '');

                // Handle Image Proxy (GET)
                if (endpointPath === 'tmdb-image') {
                  const imagePath = urlObj.searchParams.get('path');
                  if (!imagePath) {
                    res.statusCode = 400;
                    return res.end('Image path missing');
                  }
                  
                  // Use w500 by default for optimization, or original if specified in path
                  const tmdbUrl = `https://image.tmdb.org/t/p/w500${imagePath}`;
                  const imgRes = await fetch(tmdbUrl);
                  
                  if (!imgRes.ok) {
                    res.statusCode = imgRes.status;
                    return res.end('Failed to fetch image from TMDB');
                  }

                  const buffer = await imgRes.arrayBuffer();
                  res.setHeader('Content-Type', imgRes.headers.get('Content-Type') || 'image/jpeg');
                  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for a year
                  return res.end(Buffer.from(buffer));
                }

                // Handle API requests (POST)
                const endpoint = endpointPath;
                const chunks: any[] = [];
                req.on('data', chunk => chunks.push(chunk));
                
                req.on('end', async () => {
                  const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : {};
                  
                  if (endpoint === 'gemini') {
                    const API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
                    if (!API_KEY) {
                      res.statusCode = 500;
                      return res.end(JSON.stringify({ error: 'GEMINI_API_KEY missing' }));
                    }
                    const targetModel = body.model || 'gemini-2.5-flash';
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${API_KEY}`;
                    const response = await fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: body.contents,
                        generationConfig: {
                          responseMimeType: body.config?.responseMimeType,
                          temperature: 0.7,
                        },
                        systemInstruction: body.config?.systemInstruction ? {
                          parts: [{ text: body.config.systemInstruction }]
                        } : undefined
                      }),
                    });
                    const data = await response.json();
                    res.statusCode = response.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  } 
                  else if (endpoint === 'groq') {
                    const API_KEY = env.GROQ_API_KEY || process.env.GROQ_API_KEY;
                    if (!API_KEY) {
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      return res.end(JSON.stringify({ error: 'GROQ_API_KEY missing on server', category: 'CONFIG_ERROR' }));
                    }

                    const targetModel = body.model || 'allam-2-7b';
                    const baseUrl = 'https://api.groq.com/openai/v1';

                    console.log(`[Vite Dev Groq Proxy] Request to ${baseUrl}/chat/completions for model: ${targetModel}`);

                    const response = await fetch(`${baseUrl}/chat/completions`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        ...body,
                        model: targetModel
                      }),
                    });

                    const data = await response.json().catch(() => ({}));
                    res.statusCode = response.status;
                    res.setHeader('Content-Type', 'application/json');

                    if (!response.ok) {
                      const rawErrorMsg = data?.error?.message || data?.error || `HTTP ${response.status} from Groq`;
                      const safeErrorMsg = typeof rawErrorMsg === 'string'
                        ? rawErrorMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
                        : JSON.stringify(rawErrorMsg);

                      console.error(`[Vite Dev Groq Proxy Error] Status ${response.status}:`, safeErrorMsg);
                      return res.end(JSON.stringify({
                        error: safeErrorMsg,
                        status: response.status,
                        category: response.status === 401 ? 'AUTH_ERROR' : response.status === 429 ? 'RATE_LIMIT' : response.status === 404 ? 'MODEL_NOT_FOUND' : 'UPSTREAM_ERROR'
                      }));
                    }

                    res.end(JSON.stringify(data));
                  }
                  else if (endpoint === 'openrouter') {
                    const API_KEY = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
                    if (!API_KEY) {
                      res.statusCode = 500;
                      res.setHeader('Content-Type', 'application/json');
                      return res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY missing on server', category: 'CONFIG_ERROR' }));
                    }

                    const baseUrl = env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
                    const targetModel = body.model || env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';

                    console.log(`[Vite Dev OpenRouter Proxy] Request to ${baseUrl}/chat/completions for model: ${targetModel}`);

                    const response = await fetch(`${baseUrl}/chat/completions`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://saimilar.app',
                        'X-Title': 'SAImilar',
                      },
                      body: JSON.stringify({
                        ...body,
                        model: targetModel
                      }),
                    });

                    const data = await response.json().catch(() => ({}));
                    res.statusCode = response.status;
                    res.setHeader('Content-Type', 'application/json');
                    
                    if (!response.ok) {
                      const errorMsg = data?.error?.message || data?.error || `HTTP ${response.status} from OpenRouter`;
                      console.error(`[Vite Dev OpenRouter Proxy Error] Status ${response.status}:`, errorMsg);
                      return res.end(JSON.stringify({
                        error: errorMsg,
                        status: response.status,
                        category: response.status === 401 ? 'AUTH_ERROR' : response.status === 429 ? 'RATE_LIMIT' : 'UPSTREAM_ERROR'
                      }));
                    }

                    res.end(JSON.stringify(data));
                  }
                  else if (endpoint === 'tmdb') {
                    const API_KEY = env.TMDB_API_KEY || process.env.TMDB_API_KEY;
                    if (!API_KEY) {
                      console.error('❌ TMDB_API_KEY is missing in .env or process.env');
                      res.statusCode = 500;
                      return res.end(JSON.stringify({ error: 'TMDB_API_KEY missing' }));
                    }
                    const { endpoint: tmdbEndpoint, params } = body;
                    console.log(`🎬 TMDB Proxy Request: ${tmdbEndpoint}`);
                    const queryParams = new URLSearchParams({
                      api_key: API_KEY,
                      ...params
                    });
                    const url = `https://api.themoviedb.org/3${tmdbEndpoint}?${queryParams.toString()}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    res.statusCode = response.status;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  }
                  else {
                    next();
                  }
                });
              } catch (error: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          }
        }
      ],
      define: {
        // Do not expose sensitive keys to the client. 
        // Use proxies /api/* instead.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
