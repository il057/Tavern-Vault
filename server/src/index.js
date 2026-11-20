import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import itemsRouter from './routes/items.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3456);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tavern-vault' });
});

app.use('/api', itemsRouter);

// Serve built Vue frontend in production / self-hosted mode
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler (including multer file size errors)
app.use((err, _req, res, _next) => {
  console.error('[Tavern Vault Error]', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '单个文件不能超过 100 MB' });
  }
  res.status(err.status || 500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, HOST, () => {
  console.log(`\n  ✦ Tavern Vault (酒馆典藏柜) 已启动`);
  console.log(`  ✦ 本地访问地址: http://localhost:${PORT}\n`);
});
