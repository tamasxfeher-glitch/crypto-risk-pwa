import React, { useEffect, useState } from 'react';

/* =========================
   Indicator calculations
========================= */

const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    diff >= 0 ? gains += diff : losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
};

const calculateMVRV = (price, avg7d) =>
  avg7d && avg7d > 0 ? price / avg7d : null;

/* =========================
   Risk score (with F&G)
========================= */

const calculateRiskScore = (
  { rsi, mvrv, change24h, volumeChange },
  isBTC,
  fearGreed
) => {
  let score = 0;

  // RSI
  if (typeof rsi === 'number') {
    if (rsi > 75) score += 25;
    else if (rsi > 70) score += 15;
  }

  // MVRV (altcoin damped)
  if (typeof mvrv === 'number') {
    const f = isBTC ? 1 : 0.7;
    if (mvrv > 3 * f) score += 30;
    else if (mvrv > 2.2 * f) score += 20;
  }

  // Momentum
  if (typeof change24h === 'number') {
    if (change24h > 12) score += 15;
    else if (change24h > 7) score += 10;
  }

  // Volume confirmation
  if (typeof volumeChange === 'number' && volumeChange > 20) {
    score += 10;
  }

  // 🧠 Fear & Greed (global sentiment)
  if (typeof fearGreed === 'number') {
    if (fearGreed > 80) score += 15;
    else if (fearGreed > 70) score += 10;
    else if (fearGreed < 30) score -= 10;
  }

  return Math.min(Math.max(score, 0), 100);
};

const riskColor = score =>
  score < 30 ? '#22c55e' : score < 60 ? '#facc15' : '#ef4444';

/* =========================
   Main App
========================= */

export default function App() {
  const [tokens, setTokens] = useState(() => {
    const saved = localStorage.getItem('tokens');
    return saved ? JSON.parse(saved) : ['bitcoin', 'ethereum', 'solana'];
  });

  const [data, setData] = useState({});
  const [fearGreed, setFearGreed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    localStorage.setItem('tokens', JSON.stringify(tokens));
  }, [tokens]);

  // Load Fear & Greed ONCE on app open
  useEffect(() => {
    fetch('https://api.alternative.me/fng/')
      .then(r => r.json())
      .then(d => setFearGreed(Number(d.data[0].value)))
      .catch(() => {});
  }, []);

  // Load crypto data on open / token change
  useEffect(() => {
    async function load() {
      setLoading(true);
      const ids = tokens.join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h&volume_change_percentage=24h`
      );
      const market = await res.json();
      const out = {};

      for (const coin of market) {
        const prices = coin.sparkline_in_7d?.price || [];
        const avg7d = prices.length
          ? prices.reduce((a, b) => a + b, 0) / prices.length
          : null;

        const rsi = calculateRSI(prices);
        const mvrv = calculateMVRV(coin.current_price, avg7d);

        const score = calculateRiskScore(
          {
            rsi,
            mvrv,
            change24h: coin.price_change_percentage_24h,
            volumeChange: coin.volume_change_percentage_24h
          },
          coin.id === 'bitcoin',
          fearGreed
        );

        out[coin.id] = { ...coin, rsi, mvrv, score };
      }

      setData(out);
      setLoading(false);
    }

    load();
  }, [tokens, fearGreed]);

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Crypto Risk Monitor</h2>

      {/* Fear & Greed display */}
      {fearGreed !== null && (
        <p style={{ fontSize: 14 }}>
          Fear & Greed Index: <strong>{fearGreed}</strong>
        </p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading && <p>Loading...</p>}

        {!loading &&
          Object.values(data).map(c => (
            <div key={c.id} style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: riskColor(c.score), position: 'relative' }}>
              <button
                onClick={() => setTokens(tokens.filter(t => t !== c.id))}
                style={{ position: 'absolute', top: 6, right: 10, background: 'transparent', border: 'none', fontSize: 18 }}
              >
                ❌
              </button>

              <div onClick={() => setSelected(c)}>
                <strong>{c.name}</strong> — ${c.current_price}
                <div style={{ fontSize: 14, marginTop: 6 }}>
                  RSI: {c.rsi?.toFixed(1) ?? '–'}<br />
                  MVRV: {c.mvrv?.toFixed(2) ?? '–'}<br />
                  24h: {c.price_change_percentage_24h?.toFixed(2)}%<br />
                  Risk score: {c.score}
                </div>
              </div>
            </div>
          ))}
      </div>

      <button
        style={{ marginTop: 10, padding: 14, borderRadius: 12, background: '#000', color: '#fff' }}
        onClick={() => {
          const id = prompt('CoinGecko token ID (pl: avalanche-2, chainlink)');
          if (id && !tokens.includes(id)) {
            setTokens([...tokens, id]);
          }
        }}
      >
        + Token hozzáadása
      </button>
    </div>
  );
}