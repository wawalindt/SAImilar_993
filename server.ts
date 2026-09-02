import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// --- Security Middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://aistudiocdn.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://images.tmdb.org", "https://picsum.photos"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://openrouter.ai", "https://api.groq.com", "https://api.themoviedb.org", "https://*.firebaseio.com", "https://*.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://ais-dev-eyiyhbm5r5kvq7apnrmfji-559832738461.europe-west2.run.app", "https://ais-pre-eyiyhbm5r5kvq7apnrmfji-559832738461.europe-west2.run.app"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// --- API Routes ---

// Gemini Proxy
app.post('/api/gemini', async (req, res) => {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { model, contents, config } = req.body;
    
    // Basic Validation
    if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: 'Invalid contents' });
    }

    const targetModel = model || 'gemini-2.5-flash';
    // Whitelist models to prevent abuse of expensive ones
    const allowedModels = ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
    if (!allowedModels.includes(targetModel)) {
        // Log but allow for now if not strictly enforced, or return 400
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: config?.responseMimeType,
          temperature: 0.7,
        },
        systemInstruction: config?.systemInstruction ? {
          parts: [{ text: config.systemInstruction }]
        } : undefined
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Groq Proxy
app.post('/api/groq', async (req, res) => {
  try {
    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured on server', category: 'CONFIG_ERROR' });
    }

    const { model, messages, temperature = 0.7, max_tokens = 3000, response_format } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const targetModel = model || 'allam-2-7b';
    const baseUrl = 'https://api.groq.com/openai/v1';

    console.log(`[Server Groq Proxy] Calling ${baseUrl}/chat/completions with model: ${targetModel}`);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature,
        max_tokens,
        ...(response_format ? { response_format } : {}),
      }),
    });

    const status = response.status;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const rawErrorMsg = data?.error?.message || data?.error || `HTTP ${status} from Groq`;
      const safeErrorMsg = typeof rawErrorMsg === 'string'
        ? rawErrorMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
        : JSON.stringify(rawErrorMsg);

      console.error(`[Server Groq Proxy Error] Status ${status}:`, safeErrorMsg);
      return res.status(status).json({
        error: safeErrorMsg,
        status: status,
        category: status === 401 ? 'AUTH_ERROR' : status === 429 ? 'RATE_LIMIT' : status === 404 ? 'MODEL_NOT_FOUND' : 'UPSTREAM_ERROR'
      });
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error('[Server Groq Proxy Exception]:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Internal server error', category: 'SERVER_EXCEPTION' });
  }
});

// OpenRouter Proxy
app.post('/api/openrouter', async (req, res) => {
  try {
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on server', category: 'CONFIG_ERROR' });
    }

    const { model, messages, temperature = 0.7, max_tokens = 3000, response_format } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const targetModel = model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';

    console.log(`[Server OpenRouter Proxy] Calling ${baseUrl}/chat/completions with model: ${targetModel}`);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://saimilar.app',
        'X-Title': 'SAImilar',
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature,
        max_tokens,
        ...(response_format ? { response_format } : {}),
      }),
    });

    const status = response.status;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.error || `HTTP ${status} from OpenRouter`;
      console.error(`[Server OpenRouter Proxy Error] Status ${status}:`, errorMsg);
      return res.status(status).json({
        error: errorMsg,
        status: status,
        category: status === 401 ? 'AUTH_ERROR' : status === 429 ? 'RATE_LIMIT' : 'UPSTREAM_ERROR'
      });
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error('[Server OpenRouter Proxy Exception]:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Internal server error', category: 'SERVER_EXCEPTION' });
  }
});

// TMDb Proxy
app.post('/api/tmdb', async (req, res) => {
  try {
    const API_KEY = process.env.TMDB_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { endpoint, params } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Invalid endpoint' });
    }

    const baseUrl = 'https://api.themoviedb.org/3';
    const queryParams = new URLSearchParams({
      api_key: API_KEY,
      ...params
    });

    const url = `${baseUrl}${endpoint}?${queryParams.toString()}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
