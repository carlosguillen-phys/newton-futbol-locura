import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { es } from '../i18n/es'
import { toBarData } from '../lib/format'
import type { DownYards } from '../types'

interface DownYardsChartProps {
  data?: DownYards[] | null
}

const TICK = { fill: '#cbd5e1', fontSize: 12 }
const AXIS_LABEL = { fill: '#cbd5e1', fontSize: 12 }

export default function DownYardsChart({ data }: DownYardsChartProps) {
  const bars = toBarData(data)
  const empty = bars.length === 0

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-50">{es.chart.title}</h2>
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
            <CartesianGrid stroke="#475569" strokeDasharray="3 3" />
            <XAxis
              dataKey="down"
              tick={TICK}
              stroke="#cbd5e1"
              label={{ value: es.chart.xAxis, position: 'insideBottom', offset: -12, ...AXIS_LABEL }}
            />
            <YAxis
              tick={TICK}
              stroke="#cbd5e1"
              label={{ value: es.chart.yAxis, angle: -90, position: 'insideLeft', ...AXIS_LABEL }}
            />
            {!empty && (
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569' }}
                labelStyle={{ color: '#f1f5f9' }}
                itemStyle={{ color: '#f1f5f9' }}
                cursor={{ fill: 'rgba(148,163,184,0.15)' }}
              />
            )}
            <Bar dataKey="avg_yards" name={es.chart.yAxis} fill="#38bdf8" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-slate-300">
            {es.noData}
          </p>
        )}
      </div>
    </section>
  )
}
