export default async function handler(req: any, res: any) {
  // CORS & Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) {
      console.error('[Groq API] Error: GROQ_API_KEY is not configured on server');
      return res.status(500).json({ 
        error: 'GROQ_API_KEY is not configured on server',
        category: 'CONFIG_ERROR'
      });
    }

    // Parse body if not already parsed
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    } else if (!body && typeof req.on === 'function') {
      const chunks: any[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Missing request body' });
    }

    const { model, messages, temperature = 0.7, max_tokens = 3000, response_format } = body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const targetModel = model || 'allam-2-7b';
    const baseUrl = 'https://api.groq.com/openai/v1';

    console.log(`[Groq Proxy] Calling ${baseUrl}/chat/completions with model: ${targetModel}`);

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

    console.log(`[Groq Proxy] Response status: ${status} for model: ${targetModel}`);

    if (!response.ok) {
      const rawErrorMsg = data?.error?.message || data?.error || `HTTP ${status} from Groq`;
      // Redact potential keys or sensitive tokens
      const safeErrorMsg = typeof rawErrorMsg === 'string'
        ? rawErrorMsg.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED]')
        : JSON.stringify(rawErrorMsg);

      console.error(`[Groq Proxy Error] Status ${status}:`, safeErrorMsg);
      return res.status(status).json({
        error: safeErrorMsg,
        status: status,
        category: status === 401 ? 'AUTH_ERROR' : status === 429 ? 'RATE_LIMIT' : status === 404 ? 'MODEL_NOT_FOUND' : 'UPSTREAM_ERROR'
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[Groq Proxy Exception]:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Internal server error in Groq proxy',
      category: 'SERVER_EXCEPTION'
    });
  }
}
