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
   Risk score
========================= */

const calculateRiskScore = (
  { rsi, mvrv, change24h, volumeChange },
  isBTC,
  fearGreed
) => {
  let score = 0;

  if (typeof rsi === 'number') {
    if (rsi > 80) score += 30;
    else if (rsi > 70) score += 20;
  }

  if (typeof mvrv === 'number') {
    const f = isBTC ? 1 : 0.7;
    if (mvrv > 3 * f) score += 30;
    else if (mvrv > 2.2 * f) score += 20;
  }

  if (typeof change24h === 'number') {
    if (change24h > 12) score += 15;
    else if (change24h > 7) score += 10;
  }

  if (typeof volumeChange === 'number' && volumeChange > 20) {
    score += 10;
  }

  if (typeof fearGreed === 'number') {
    if (fearGreed > 75) score += 15;
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
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    localStorage.setItem('tokens', JSON.stringify(tokens));
  }, [tokens]);

  /* Fear & Greed – once on app open */
  useEffect(() => {
    fetch('https://api.alternative.me/fng/')
      .then(r => r.json())
      .then(d => setFearGreed(Number(d.data[0].value)))
      .catch(() => {});
  }, []);

  /* Load token data */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ids = tokens.join(',');
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h&volume_change_percentage=24h`
        );

        if (!res.ok) throw new Error('CoinGecko hiba');

        const market = await res.json();
        if (!Array.isArray(market)) throw new Error('Invalid response');

        const out = {};
        for (const coin of market) {
          const prices = coin.sparkline_in_7d?.price || [];
          const avg7d =
            prices.length > 0
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
      } catch (err) {
        alert(
          'Hiba az adatok betöltésekor.\nLehetséges ok: rossz token ID vagy CoinGecko limit.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens, fearGreed]);

  /* =========================
     Token add with validation
  ========================= */

  const addToken = async () => {
    const id = prompt(
      'CoinGecko token ID\n(pl: avalanche-2, chainlink, polygon-pos)'
    );
    if (!id || tokens.includes(id)) return;

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}`
      );
      if (!res.ok) throw new Error('Invalid token');

      setTokens([...tokens, id]);
    } catch {
      alert(
        'Ismeretlen CoinGecko ID.\nPélda egy helyes ID-re: avalanche-2'
      );
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Crypto Risk Monitor</h2>

      {fearGreed !== null && (
        <p>Fear & Greed Index: <strong>{fearGreed}</strong></p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading && <p>Loading…</p>}

        {!loading && Object.values(data).map(c => (
          <div
            key={c.id}
            onClick={() => setSelected(c)}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: riskColor(c.score),
              cursor: 'pointer'
            }}
          >
            <strong>{c.name}</strong> — ${c.current_price}
            <div style={{ fontSize: 14 }}>
              RSI: {c.rsi?.toFixed(1)} | MVRV: {c.mvrv?.toFixed(2)}
              <br />
              Risk score: {c.score}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addToken}
        style={{
          marginTop: 10,
          padding: 14,
          borderRadius: 12,
          background: '#000',
          color: '#fff'
        }}
      >
        + Token hozzáadása
      </button>

      {/* DETAIL MODAL */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              padding: 20,
              borderRadius: 16,
              margin: '10vh 16px'
            }}
          >
            <h3>{selected.name}</h3>
            <p>RSI: {selected.rsi} → {selected.rsi < 30 ? 'Alulvett' : selected.rsi > 70 ? 'Túlvetett' : 'Semleges'}</p>
            <p>MVRV: {selected.mvrv?.toFixed(2)} → {selected.mvrv > 2.5 ? 'Túlfeszített' : 'Normál'}</p>
            <p>24h változás: {selected.price_change_percentage_24h?.toFixed(2)}%</p>
            <p><strong>Risk score:</strong> {selected.score}</p>
            <p>{selected.score > 70 ? 'Csúcs közeli kockázat' : selected.score > 40 ? 'Figyelendő' : 'Alacsony kockázat'}</p>
            <button style={{ marginTop: 10 }} onClick={() => setSelected(null)}>Bezár</button>
          </div>
        </div>
      )}
    </div>
  );
}