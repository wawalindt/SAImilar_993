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
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      console.error('[Gemini API] Error: GEMINI_API_KEY is not configured on server');
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
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

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Missing request body' });
    }

    const { model = 'gemini-2.5-flash', contents, config } = body;
    if (!contents) {
      return res.status(400).json({ error: 'Missing contents in request' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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

    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[Gemini API Exception]:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
