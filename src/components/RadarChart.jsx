import React from 'react';
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Activity } from 'lucide-react';

export default function RadarChartComponent({ data }) {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">6-Axis Fundamental Health</h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md">360° Assessment</span>
      </div>

      <div className="w-full h-[260px] my-auto">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255, 255, 255, 0.15)" tick={false} />
            <Radar
              name="stock.ai Score"
              dataKey="score"
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.4}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f8fafc'
              }}
              formatter={(value) => [`${value} / 100`, 'Score']}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/60 text-center text-xs">
        {data.slice(0, 3).map((item, idx) => (
          <div key={idx} className="bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">{item.category}</span>
            <span className="font-bold text-emerald-400">{item.score}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
}
