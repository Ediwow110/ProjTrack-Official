import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PortalPanel } from "../../../components/portal/PortalPage";
import type { TeacherDashboardResponse } from "../../../lib/api/contracts";

interface TeacherDashboardChartProps {
  chartData: TeacherDashboardResponse["chartData"];
}

export default function TeacherDashboardChart({
  chartData,
}: TeacherDashboardChartProps) {
  return (
    <PortalPanel
      title="Submission Status Overview"
      description="A quick view of where the review queue and class progress stand."
      className="xl:col-span-2"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="name"
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
          />
          <Bar dataKey="value" radius={[10, 10, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </PortalPanel>
  );
}
