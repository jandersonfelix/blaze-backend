const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const ENDPOINTS = [
  { host: 'blaze1.space', path: '/api/roulette_games/recent', https: true },
  { host: 'blaze.com', path: '/api/roulette_games/recent', https: true },
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://blaze1.space/pt-BR/games/double',
  'Origin': 'https://blaze1.space',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

function fetchEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const lib = endpoint.https ? https : http;
    const options = {
      hostname: endpoint.host,
      path: endpoint.path,
      method: 'GET',
      headers: BROWSER_HEADERS,
      timeout: 12000,
    };

    const req = lib.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          const url = new URL(location);
          return fetchEndpoint({
            host: url.hostname,
            path: url.pathname + url.search,
            https: url.protocol === 'https:',
          }).then(resolve).catch(reject);
        }
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString();
          const data = JSON.parse(body);
          if (Array.isArray(data) && data.length > 0) resolve(data);
          else reject(new Error('Resposta vazia'));
        } catch(e) {
          reject(new Error('JSON inválido'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.setTimeout(12000);
    req.end();
  });
}

let cache = { data: null, ts: 0 };

async function getData() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < 8000) return cache.data;

  const errors = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const data = await fetchEndpoint(endpoint);
      cache = { data, ts: now };
      console.log(`✅ ${endpoint.host}: ${data.length} rodadas`);
      return data;
    } catch(e) {
      console.log(`❌ ${endpoint.host}: ${e.message}`);
      errors.push(`${endpoint.host}: ${e.message}`);
    }
  }

  if (cache.data) return cache.data;
  throw new Error(errors.join(' | '));
}

app.get('/api/double', async (req, res) => {
  try {
    const data = await getData();
    res.json(data);
  } catch(e) {
    res.status(503).json({ error: 'Blaze indisponível', detalhe: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', cached: !!cache.data }));
app.get('/', (req, res) => res.json({ status: 'blaze-backend v2 online' }));

app.listen(PORT, () => console.log(`🚀 Porta ${PORT}`));
