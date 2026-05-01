import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CompletionRatePoint,
  TrendPoint,
} from "../../../lib/api/contracts";

interface AdminReportsChartsProps {
  completionData: CompletionRatePoint[];
  lateData: TrendPoint[];
  turnaroundData: TrendPoint[];
}

export default function AdminReportsCharts({
  completionData,
  lateData,
  turnaroundData,
}: AdminReportsChartsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
          <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-4">Completion Rate by Subject</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={completionData} barCategoryGap="40%" layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={140} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f8fafc", fontSize: 11 }} />
              <Bar dataKey="rate" fill="#1e40af" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
          <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-4">Late Submissions Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f8fafc", fontSize: 11 }} />
              <Line type="monotone" dataKey="late" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3, fill: "#f43f5e" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
        <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-4">Average Review Turnaround</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={turnaroundData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f8fafc", fontSize: 11 }} />
            <Line type="monotone" dataKey="days" stroke="#0f766e" strokeWidth={2} dot={{ r: 3, fill: "#0f766e" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
