import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { Activity, Loader2 } from 'lucide-react';
import { fetchHistorical } from '../utils/api';

export default function StockChart({ symbol, currentPrice }) {
  const [data, setData] = useState([]);
  const [range, setRange] = useState('1y');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const hist = await fetchHistorical(symbol, range);
        if (active) {
          // Add current price as the very last data point if it's the 1D/1W view
          // But usually the history endpoint already has the latest close.
          setData(hist);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [symbol, range]);

  const ranges = [
    { label: '1W', val: '1w' },
    { label: '1M', val: '1m' },
    { label: '3M', val: '3m' },
    { label: '6M', val: '6m' },
    { label: '1Y', val: '1y' },
    { label: '5Y', val: '5y' }
  ];

  // Determine trend color based on the first and last data points
  const isPositive = data.length > 1 ? data[data.length - 1].close >= data[0].close : true;
  const strokeColor = isPositive ? '#4d6d13' : '#af3029';
  const fillColor = isPositive ? 'url(#colorPositive)' : 'url(#colorNegative)';

  // Calculate absolute and percentage change for the selected range
  let changeAbs = 0;
  let changePct = 0;
  if (data.length > 1) {
    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    changeAbs = lastPrice - firstPrice;
    changePct = (changeAbs / firstPrice) * 100;
  }

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-success" />
            <h3 className="text-base font-bold text-foreground tracking-wide">Historical Price Chart</h3>
          </div>
          {data.length > 1 && (
            <div className={`text-sm font-bold font-mono mt-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? '+' : ''}₹{changeAbs.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              <span className="text-xs text-muted-foreground font-sans font-medium ml-2">in past {ranges.find(r => r.val === range)?.label}</span>
            </div>
          )}
        </div>

        {/* Range Selector */}
        <div className="flex items-center bg-muted/60 p-1 rounded-full border border-border/40 self-start sm:self-auto">
          {ranges.map((r) => (
            <button
              key={r.val}
              onClick={() => setRange(r.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r.val
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="w-full h-72 relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/60 flex items-center justify-center rounded-xl">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        )}
        
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4d6d13" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4d6d13" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#af3029" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#af3029" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.06)" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#6f6e69', fontSize: 11 }} 
                tickMargin={10}
                minTickGap={30}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{ fill: '#6f6e69', fontSize: 11 }}
                tickFormatter={(val) => `₹${val.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(51, 59%, 95%)',
                  borderColor: 'hsl(51, 21%, 88%)',
                  borderRadius: '8px',
                  color: '#100f0f',
                  fontSize: '12px'
                }}
                itemStyle={{ color: '#100f0f', fontWeight: 'bold' }}
                labelStyle={{ color: '#6f6e69', marginBottom: '4px' }}
                formatter={(value) => [`₹${value.toLocaleString()}`, 'Close Price']}
              />
              <Area 
                type="monotone" 
                dataKey="close" 
                stroke={strokeColor} 
                strokeWidth={2}
                fill={fillColor} 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : !loading && (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No historical data available for this range.
          </div>
        )}
      </div>
    </div>
  );
}
