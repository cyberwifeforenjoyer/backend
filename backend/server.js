import express from 'express';
import fetch from 'node-fetch';

const BOT_TOKEN = process.env.BOT_TOKEN || 'ВСТАВЬ_ТОКЕН_ИЗ_BOTFATHER';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

/* CORS — чтобы Mini App мог обращаться */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ===================== ОНЛАЙН-СЧЁТЧИК ===================== */
const sessions = new Map();
const ONLINE_WINDOW_MS = 60 * 1000; // онлайн = активен за последние 60 сек

function cleanup() {
  const now = Date.now();
  for (const [id, last] of sessions) {
    if (now - last > ONLINE_WINDOW_MS) sessions.delete(id);
  }
}

app.post('/api/heartbeat', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'no userId' });
  sessions.set(String(userId), Date.now());
  res.json({ ok: true });
});

app.post('/api/offline', (req, res) => {
  const { userId } = req.body;
  if (userId) sessions.delete(String(userId));
  res.json({ ok: true });
});

app.get('/api/online', (req, res) => {
  cleanup();
  res.json({ online: sessions.size });
});

/* ===================== ДОНАТЫ ===================== */
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { amount, userId } = req.body;
    if (!amount || amount < 1 || amount > 100000) {
      return res.status(400).json({ error: 'invalid amount' });
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Поддержка на ${amount} ⭐`,
          description: 'Спасибо за поддержку проекта!',
          payload: `donate_${userId}_${Date.now()}`,
          currency: 'XTR',
          prices: [{ label: `${amount} звёзд`, amount }],
          provider_token: '',
        }),
      }
    );

    const data = await tgRes.json();
    if (!data.ok) throw new Error(data.description);
    res.json({ invoiceLink: data.result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* Проверка, что сервер жив */
app.get('/', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Server on port ${PORT}`));