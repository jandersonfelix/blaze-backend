const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const BLAZE_ENDPOINTS = [
  'https://blaze1.space/api/roulette_games/recent',
  'https://blaze.com/api/roulette_games/recent',
];

function fetchBlaze(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://blaze1.space/',
        'Origin': 'https://blaze1.space',
      },
    };
    const req = https.get(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (Array.isArray(data) && data.length > 0) resolve(data);
          else reject(new Error('empty'));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

let cache = { data: null, ts: 0 };

async function getData() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < 6000) return cache.data;
  for (const url of BLAZE_ENDPOINTS) {
    try {
      const data = await fetchBlaze(url);
      cache = { data, ts: now };
      return data;
    } catch(e) { console.log(`Falhou ${url}: ${e.message}`); }
  }
  return null;
}

app.get('/api/double', async (req, res) => {
  const data = await getData();
  if (!data) return res.status(503).json({ error: 'Blaze indisponível' });
  res.json(data);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ status: 'blaze-backend online' }));

app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
