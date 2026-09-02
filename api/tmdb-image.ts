export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const imagePath = urlObj.searchParams.get('path') || (req.query && req.query.path);

    if (!imagePath) {
      return res.status(400).send('Image path missing');
    }

    const tmdbUrl = `https://image.tmdb.org/t/p/w500${imagePath}`;
    const imgRes = await fetch(tmdbUrl);

    if (!imgRes.ok) {
      return res.status(imgRes.status).send('Failed to fetch image from TMDB');
    }

    const buffer = await imgRes.arrayBuffer();
    res.setHeader('Content-Type', imgRes.headers.get('Content-Type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[TMDB Image Proxy Exception]:', error?.message || error);
    return res.status(500).send('Error fetching image');
  }
}
