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
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      console.error('[OpenRouter API] Error: OPENROUTER_API_KEY is not configured on server');
      return res.status(500).json({ 
        error: 'OPENROUTER_API_KEY is not configured on server',
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

    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const targetModel = model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';

    console.log(`[OpenRouter Proxy] Calling ${baseUrl}/chat/completions with model: ${targetModel}`);

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

    console.log(`[OpenRouter Proxy] Response status: ${status}`);

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.error || `HTTP ${status} from OpenRouter`;
      console.error(`[OpenRouter Proxy Error] Status ${status}:`, errorMsg);
      return res.status(status).json({
        error: errorMsg,
        status: status,
        category: status === 401 ? 'AUTH_ERROR' : status === 429 ? 'RATE_LIMIT' : status === 400 ? 'BAD_REQUEST' : 'UPSTREAM_ERROR'
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[OpenRouter Proxy Exception]:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Internal server error in OpenRouter proxy',
      category: 'SERVER_EXCEPTION'
    });
  }
}
