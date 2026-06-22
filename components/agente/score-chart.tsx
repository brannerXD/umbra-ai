"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function ScoreChart({ evolution }: { evolution: number[] }) {
  const [color, setColor] = useState("#F5F5F0")
  const [grid, setGrid] = useState("rgba(245,245,240,0.08)")

  useEffect(() => {
    const read = () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light"
      setColor(isLight ? "#0A0A0A" : "#F5F5F0")
      setGrid(isLight ? "rgba(10,10,10,0.08)" : "rgba(245,245,240,0.08)")
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => obs.disconnect()
  }, [])

  if (!evolution || evolution.length < 2) {
    return (
      <div className="chart-empty">
        <p>El grafico aparecera despues de la segunda competencia.</p>
      </div>
    )
  }

  const data = evolution.map((value, i) => ({ name: `#${i}`, score: value }))

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            dataKey="name"
            stroke={grid}
            tick={{ fill: "var(--text-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={grid}
            tick={{ fill: "var(--text-3)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            domain={[0, "dataMax + 20"]}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: grid }}
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-2)",
              borderRadius: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text)",
            }}
            labelStyle={{ color: "var(--text-3)" }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            fill="url(#scoreFill)"
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5 }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
