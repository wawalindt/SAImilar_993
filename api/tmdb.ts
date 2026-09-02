export default async function handler(req: any, res: any) {
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
    const API_KEY = process.env.TMDB_API_KEY;
    if (!API_KEY) {
      console.error('[TMDB API] Error: TMDB_API_KEY is missing');
      return res.status(500).json({ error: 'TMDB_API_KEY is missing on server' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
    } else if (!body && typeof req.on === 'function') {
      const chunks: any[] = [];
      for await (const chunk of req) { chunks.push(chunk); }
      if (chunks.length > 0) {
        try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
      }
    }

    const { endpoint, params = {} } = body || {};
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing endpoint' });
    }

    const queryParams = new URLSearchParams({
      api_key: API_KEY,
      ...params
    });

    const url = `https://api.themoviedb.org/3${endpoint}?${queryParams.toString()}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[TMDB API Exception]:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
