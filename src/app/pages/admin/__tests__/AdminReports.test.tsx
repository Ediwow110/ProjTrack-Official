import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockAdminService = vi.hoisted(() => ({
  getReports: vi.fn(),
  exportReportsCsv: vi.fn(),
}));

vi.mock("../../../lib/api/services", () => ({
  adminService: mockAdminService,
}));

vi.mock("../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

import AdminReports from "../Reports";

const sampleReportsData = {
  metrics: [
    { label: "Total Submissions", value: "1,234", delta: "+12%", good: true },
    { label: "On-Time Rate", value: "78%", delta: "+5%", good: true },
    { label: "Late Submissions", value: "156", delta: "-3%", good: false },
    { label: "Avg Turnaround", value: "2.4d", delta: "-0.3d", good: true },
  ],
  completionData: [
    { name: "BSIT 3A", rate: 85 },
    { name: "BSIT 3B", rate: 72 },
  ],
  lateData: [
    { month: "Jan", late: 12 },
    { month: "Feb", late: 8 },
  ],
  turnaroundData: [
    { month: "Jan", days: 3.2 },
    { month: "Feb", days: 2.8 },
  ],
  tableRows: [
    { subject: "CS101", section: "BSIT 3A", completionRate: "92%", pending: 3, graded: 35, avgReview: "1.8d" },
    { subject: "CS102", section: "BSIT 3B", completionRate: "78%", pending: 8, graded: 22, avgReview: "2.5d" },
  ],
  isTruncated: false,
  rowLimit: 5000,
  totalMatchingRows: 2,
};

describe("AdminReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminService.getReports.mockResolvedValue(sampleReportsData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading skeleton while data is being fetched", async () => {
    mockAdminService.getReports.mockImplementation(
      () => new Promise(() => {}),
    );
    render(<AdminReports />);
    const loadingElements = screen.getAllByText(/Loading reports/i);
    expect(loadingElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminService.getReports.mockRejectedValue(new Error("Failed to load report data"));
    render(<AdminReports />);
    expect(await screen.findByText("Failed to load report data")).toBeDefined();
  });

  it("renders empty state when no metrics returned", async () => {
    mockAdminService.getReports.mockResolvedValue({
      ...sampleReportsData,
      metrics: [],
      tableRows: [],
      totalMatchingRows: 0,
    });
    render(<AdminReports />);
    expect(await screen.findByText(/No report data is available/i)).toBeDefined();
  });

  it("renders metric cards and table when data loads", async () => {
    render(<AdminReports />);
    expect(await screen.findByText("Total Submissions")).toBeDefined();
    expect(screen.getByText("1,234")).toBeDefined();
    expect(screen.getByText("On-Time Rate")).toBeDefined();
    const pctElements = screen.getAllByText("78%");
    expect(pctElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CS101")).toBeDefined();
    expect(screen.getByText("CS102")).toBeDefined();
    expect(screen.getByText("92%")).toBeDefined();
  });

  it("shows truncation warning when isTruncated is true", async () => {
    mockAdminService.getReports.mockResolvedValue({
      ...sampleReportsData,
      isTruncated: true,
      totalMatchingRows: 7500,
    });
    render(<AdminReports />);
    expect(await screen.findByText(/Showing first 5,000 of 7,500 matching submissions/i)).toBeDefined();
  });

  it("calls getReports with filter values when selects change", async () => {
    const user = userEvent.setup();
    render(<AdminReports />);
    await screen.findByText("Total Submissions");

    const semesterLabel = screen.getByText(/Semester:/i);
    const semesterSelect = semesterLabel.parentElement!.querySelector("select")!;
    await user.selectOptions(semesterSelect, "1st Semester");

    await waitFor(() => {
      expect(mockAdminService.getReports).toHaveBeenLastCalledWith({
        schoolYear: "2025–2026",
        semester: "1st Semester",
        section: "All Sections",
      });
    });
  });

  it("calls exportReportsCsv when Export button is clicked", async () => {
    mockAdminService.exportReportsCsv.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AdminReports />);
    await screen.findByText("Total Submissions");

    const exportBtn = screen.getByText(/Export Current View/i);
    await user.click(exportBtn);

    expect(mockAdminService.exportReportsCsv).toHaveBeenCalledWith(
      sampleReportsData.tableRows,
      "All Sections",
    );
  });

  it("calls reload when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminReports />);
    await screen.findByText("Total Submissions");

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminService.getReports).toHaveBeenCalledTimes(2);
    });
  });

  it("shows export error when exportReportsCsv fails", async () => {
    mockAdminService.exportReportsCsv.mockRejectedValue(new Error("fail"));
    const user = userEvent.setup();
    render(<AdminReports />);
    await screen.findByText("Total Submissions");

    const exportBtn = screen.getByText(/Export Current View/i);
    await user.click(exportBtn);

    expect(await screen.findByText(/Unable to export/i)).toBeDefined();
  });

  it("shows row count in the heading", async () => {
    render(<AdminReports />);
    const rowElements = await screen.findAllByText(/2 rows/i);
    expect(rowElements.length).toBeGreaterThanOrEqual(1);
  });
});
