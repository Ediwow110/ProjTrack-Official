import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminService = vi.hoisted(() => ({
  getSubmissions: vi.fn(),
  exportSubmissionsCsv: vi.fn(),
  createSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
}));

vi.mock("../../../../lib/api/services", () => ({
  adminService: mockAdminService,
}));

vi.mock("../../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

import SubmissionsPage from "../SubmissionsPage";

const sampleSubmissions = [
  {
    id: "sub-1",
    title: "Lab Report 1",
    student: "John Doe",
    teacher: "Dr. Smith",
    subject: "CS101",
    section: "BSIT 3A",
    due: "2026-01-15",
    submitted: "2026-01-14",
    status: "Graded",
    grade: "95",
    taskId: "task-1",
    subjectId: "subj-1",
    studentId: "stu-1",
    groupId: null,
    feedback: "Great work",
    notes: "",
    externalLinks: [],
  },
  {
    id: "sub-2",
    title: "Homework 3",
    student: "Jane Doe",
    teacher: "Dr. Smith",
    subject: "CS102",
    section: "BSIT 3B",
    due: "2026-02-01",
    submitted: "2026-02-03",
    status: "Late",
    grade: "—",
    taskId: "task-2",
    subjectId: "subj-2",
    studentId: "stu-2",
    groupId: null,
    feedback: "",
    notes: "",
    externalLinks: [],
  },
];

describe("SubmissionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminService.getSubmissions.mockResolvedValue(sampleSubmissions);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getSubmissions on mount", async () => {
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Submissions")).toBeDefined();
    expect(mockAdminService.getSubmissions).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminService.getSubmissions.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Submissions")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminService.getSubmissions.mockRejectedValue(new Error("Failed to load submissions"));
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Failed to load submissions")).toBeDefined();
  });

  it("renders submission rows when data loads", async () => {
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    const titles = await screen.findAllByText("Lab Report 1");
    expect(titles.length).toBeGreaterThanOrEqual(1);
    const moreTitles = await screen.findAllByText("Homework 3");
    expect(moreTitles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no submissions", async () => {
    mockAdminService.getSubmissions.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Submissions")).toBeDefined();
    const zeroElements = screen.getAllByText("0");
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
  });

  it("calls reload when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    const titles = await screen.findAllByText("Homework 3");
    expect(titles.length).toBeGreaterThanOrEqual(1);

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminService.getSubmissions).toHaveBeenCalledTimes(2);
    });
  });

  it("calls exportSubmissionsCsv when Export button is clicked", async () => {
    mockAdminService.exportSubmissionsCsv.mockResolvedValue(undefined);
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>,
    );
    const titles = await screen.findAllByText("Homework 3");
    expect(titles.length).toBeGreaterThanOrEqual(1);

    const exportBtn = screen.getByText(/Export/i);
    await user.click(exportBtn);

    expect(mockAdminService.exportSubmissionsCsv).toHaveBeenCalledTimes(1);
    const args = mockAdminService.exportSubmissionsCsv.mock.calls[0][0];
    expect(args).toHaveLength(2);
    expect(args[0].title).toBe("Homework 3");
    expect(args[1].title).toBe("Lab Report 1");
  });
});
