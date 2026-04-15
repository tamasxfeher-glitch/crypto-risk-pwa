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
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  if (losses === 0) return 100;

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
};

const calculateMVRV = (currentPrice, avg7d) => {
  if (!avg7d || avg7d <= 0) return null;
  return currentPrice / avg7d;
};

const calculateRiskScore = ({ rsi, mvrv, change24h, volumeChange }, isBTC) => {
  let score = 0;

  if (typeof rsi === 'number') {
    if (rsi > 75) score += 25;
    else if (rsi > 70) score += 15;
  }

  if (typeof mvrv === 'number') {
    const factor = isBTC ? 1 : 0.7;
    if (mvrv > 3 * factor) score += 30;
    else if (mvrv > 2.2 * factor) score += 20;
  }

  if (typeof change24h === 'number') {
    if (change24h > 12) score += 15;
    else if (change24h > 7) score += 10;
  }

  if (typeof volumeChange === 'number' && volumeChange > 20) {
    score += 10;
  }

  return Math.min(score, 100);
};

const riskColor = score => {
  if (score < 30) return '#22c55e';
  if (score < 60) return '#facc15';
  return '#ef4444';
};

/* =========================
   Main App
========================= */

export default function App() {
  const [tokens, setTokens] = useState(() => {
    const saved = localStorage.getItem('tokens');
    return saved ? JSON.parse(saved) : ['bitcoin', 'ethereum', 'solana'];
  });

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    localStorage.setItem('tokens', JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const ids = tokens.join(',');
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h&volume_change_percentage=24h`
        );
        const market = await res.json();

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
            coin.id === 'bitcoin'
          );

          out[coin.id] = { ...coin, rsi, mvrv, score };
        }

        setData(out);
      } catch (e) {
        console.error('Load error', e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens]);

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 420,
        margin: '0 auto',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* HEADER */}
      <h2 style={{ marginBottom: 12 }}>Crypto Risk Monitor</h2>

      {/* SCROLLABLE TOKEN LIST */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingRight: 4
        }}
      >
        {loading && <p>Loading…</p>}

        {!loading &&
          Object.values(data).map(c => (
            <div
              key={c.id}
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: riskColor(c.score),
                position: 'relative'
              }}
            >
              {/* DELETE TOKEN */}
              <button
                onClick={() =>
                  setTokens(tokens.filter(t => t !== c.id))
                }
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 10,
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  cursor: 'pointer'
                }}
              >
                ❌
              </button>

              {/* OPEN DETAIL */}
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

      {/* ADD TOKEN BUTTON */}
      <button
        style={{
          marginTop: 10,
          width: '100%',
          padding: 14,
          borderRadius: 12,
          background: '#000',
          color: '#fff',
          fontSize: 16
        }}
        onClick={() => {
          const id = prompt(
            'CoinGecko token ID\n(pl: avalanche-2, chainlink, polygon-pos)'
          );
          if (id && !tokens.includes(id)) {
            setTokens([...tokens, id]);
          }
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
            background: 'rgba(0,0,0,0.6)',
            zIndex: 10
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '80vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: '#fff',
              padding: 20,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16
            }}
          >
            <h3>{selected.name}</h3>
            <p>Price: ${selected.current_price}</p>
            <p>24h change: {selected.price_change_percentage_24h?.toFixed(2)}%</p>
            <p>
              RSI: {selected.rsi?.toFixed(1)} —{' '}
              {selected.rsi > 70 ? 'Overbought' : 'Neutral'}
            </p>
            <p>MVRV: {selected.mvrv?.toFixed(2)}</p>
            <p>
              <strong>Risk score:</strong> {selected.score}
            </p>

            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 12,
                width: '100%',
                padding: 12,
                borderRadius: 10,
                background: '#000',
                color: '#fff'
              }}
            >
              Bezárás
            </button>
          </div>
        </div>
      )}
    </div>
  );
}