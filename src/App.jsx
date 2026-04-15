import React, { useEffect, useState } from 'react';

const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    diff >= 0 ? gains += diff : losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
};

const calculateMVRV = (price, avg7d) => avg7d > 0 ? price / avg7d : null;

const calculateRiskScore = ({ rsi, mvrv, change24h, volume }, isBTC) => {
  let score = 0;
  if (typeof rsi === 'number' && rsi > 70) score += rsi > 75 ? 25 : 15;
  if (typeof mvrv === 'number') {
    const mult = isBTC ? 1 : 0.7;
    if (mvrv > 3 * mult) score += 30;
    else if (mvrv > 2.2 * mult) score += 20;
  }
  if (change24h > 7) score += change24h > 12 ? 15 : 10;
  if (volume > 20) score += 10;
  return Math.min(score, 100);
};

export default function App() {
  const [tokens, setTokens] = useState(['bitcoin','ethereum','solana']);
  const [data, setData] = useState({});

  useEffect(() => {
    async function load() {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokens.join(',')}&sparkline=true&price_change_percentage=24h&volume_change_percentage=24h`);
      const market = await res.json();
      const out = {};
      for (const c of market) {
        const prices = c.sparkline_in_7d.price;
        const avg7d = prices.reduce((a,b)=>a+b,0)/prices.length;
        const rsi = calculateRSI(prices);
        const mvrv = calculateMVRV(c.current_price, avg7d);
        const score = calculateRiskScore({ rsi, mvrv, change24h: c.price_change_percentage_24h, volume: c.volume_change_percentage_24h }, c.id === 'bitcoin');
        out[c.id] = { ...c, rsi, mvrv, score };
      }
      setData(out);
    }
    load();
  }, []);

  return (
    <div style={{padding:16,maxWidth:420,margin:'0 auto'}}>
      <h2>Crypto Risk Monitor</h2>
      {Object.values(data).map(c => (
        <div key={c.id} style={{marginBottom:12,padding:12,borderRadius:12,background:c.score>60?'#ef4444':c.score>30?'#facc15':'#22c55e'}}>
          <b>{c.name}</b> – ${c.current_price}<br/>
          RSI: {c.rsi?.toFixed(1)} | MVRV: {c.mvrv?.toFixed(2)} | Score: {c.score}
        </div>
      ))}
    </div>
  );
}