"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Columns3,
  MoreVertical,
  ChevronDown,
} from "lucide-react";

export type ChartType = "column" | "bar" | "line" | "pie";

interface AnalyticsChartProps {
  title: string;
  subtitle?: string;
  data: Array<{
    name: string;
    value: number;
    secondary?: number;
    color?: string;
  }>;
  primaryKeyLabel?: string;
  secondaryKeyLabel?: string;
  unitPrefix?: string;
  unitSuffix?: string;
}

const DEFAULT_COLORS = [
  "#4f46e5", // Indigo
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#8b5cf6", // Purple
];

export default function AnalyticsChart({
  title,
  subtitle,
  data,
  primaryKeyLabel = "Usage",
  secondaryKeyLabel,
  unitPrefix = "",
  unitSuffix = "",
}: AnalyticsChartProps) {
  const [chartType, setChartType] = useState<ChartType>("column");
  const [menuOpen, setMenuOpen] = useState(false);

  const chartOptions: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: "column", label: "Column Chart (Default)", icon: Columns3 },
    { type: "line", label: "Line Chart View", icon: LineChartIcon },
    { type: "pie", label: "Pie Chart", icon: PieChartIcon },
    { type: "bar", label: "Horizontal Bar", icon: BarChart3 },
  ];

  return (
    <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm hover:shadow-md transition-shadow relative">
      {/* Chart Header & Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-[var(--coffee)] tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>

        {/* Dropdown / 3-dots Menu */}
        <div className="relative flex items-center gap-2 self-end sm:self-auto">
          {/* Quick Dropdown Selector */}
          <div className="relative">
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="appearance-none bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-semibold py-1.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-[var(--coffee)]"
            >
              <option value="column">Column View</option>
              <option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option>
              <option value="bar">Bar Chart</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 3-Dots Action Button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors"
            title="Chart Display Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* 3-Dots Popup Menu */}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-10 z-30 w-52 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Switch Visual Style
                </div>
                {chartOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = chartType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        setChartType(opt.type);
                        setMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                          : "hover:bg-[var(--bg-surface)] text-[var(--coffee)]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Render Chart Based on State */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "column" ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${unitPrefix}${val}${unitSuffix}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
                formatter={(val: any) => [`${unitPrefix}${val}${unitSuffix}`, primaryKeyLabel]}
              />
              <Bar dataKey="value" name={primaryKeyLabel} fill="#4f46e5" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                ))}
              </Bar>
              {secondaryKeyLabel && (
                <Bar dataKey="secondary" name={secondaryKeyLabel} fill="#f59e0b" radius={[6, 6, 0, 0]} />
              )}
            </BarChart>
          ) : chartType === "bar" ? (
            <BarChart layout="vertical" data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `${unitPrefix}${val}${unitSuffix}`}
              />
              <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
                formatter={(val: any) => [`${unitPrefix}${val}${unitSuffix}`, primaryKeyLabel]}
              />
              <Bar dataKey="value" name={primaryKeyLabel} fill="#4f46e5" radius={[0, 6, 6, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-bar-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${unitPrefix}${val}${unitSuffix}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
                formatter={(val: any) => [`${unitPrefix}${val}${unitSuffix}`, primaryKeyLabel]}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={primaryKeyLabel}
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ r: 4, fill: "#4f46e5" }}
                activeDot={{ r: 6 }}
              />
              {secondaryKeyLabel && (
                <Line
                  type="monotone"
                  dataKey="secondary"
                  name={secondaryKeyLabel}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                />
              )}
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-color)",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
                formatter={(val: any) => [`${unitPrefix}${val}${unitSuffix}`, primaryKeyLabel]}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="46%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={4}
              >
                {data.map((entry, index) => (
                  <Cell key={`pie-cell-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
