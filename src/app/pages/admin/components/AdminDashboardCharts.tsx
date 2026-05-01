import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PortalPanel } from "../../../components/portal/PortalPage";
import type {
  AdminDashboardStatusPoint,
  AdminDashboardTrendPoint,
} from "../../../lib/api/contracts";

interface AdminDashboardChartsProps {
  submissionTrend: AdminDashboardTrendPoint[];
  statusDist: AdminDashboardStatusPoint[];
}

export default function AdminDashboardCharts({
  submissionTrend,
  statusDist,
}: AdminDashboardChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PortalPanel
        title="Submission Trend"
        description="Recent volume across the platform."
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={submissionTrend} barCategoryGap="36%">
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "none",
                borderRadius: 16,
                color: "#f8fafc",
                fontSize: 12,
              }}
              cursor={{ fill: "#e2e8f0" }}
            />
            <Bar dataKey="count" fill="#1f2937" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </PortalPanel>

      <PortalPanel
        title="Status Distribution"
        description="How platform outcomes are currently spread."
      >
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={statusDist}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={86}
              paddingAngle={4}
              dataKey="value"
            >
              {statusDist.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </PortalPanel>
    </div>
  );
}
