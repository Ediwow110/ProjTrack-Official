import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminService = vi.hoisted(() => ({
  getStudents: vi.fn(),
  deactivateStudent: vi.fn(),
  sendStudentSetupInvite: vi.fn(),
  sendStudentResetLink: vi.fn(),
  createStudent: vi.fn(),
  parseStudentImport: vi.fn(),
  confirmStudentImport: vi.fn(),
  downloadStudentTemplate: vi.fn(),
}));

const mockAdminCatalogService = vi.hoisted(() => ({
  getSections: vi.fn(),
  getAcademicYears: vi.fn(),
}));

vi.mock("../../../../lib/api/services", () => ({
  adminService: mockAdminService,
  adminCatalogService: mockAdminCatalogService,
}));

vi.mock("../../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

vi.mock("../../../../lib/mailActionSafety", () => ({
  assertConfirmedMailJob: vi.fn(() => "mail-job-1"),
  getConfirmedMailJobId: vi.fn(() => "mail-job-1"),
}));

import StudentsPage from "../StudentsPage";

const sampleStudents = [
  {
    id: "stu-1",
    studentId: "2024-0001",
    firstName: "Alice",
    lastName: "Johnson",
    middleInitial: "M",
    email: "alice@test.edu",
    section: "BSIT 3A",
    sectionId: "sec-1",
    course: "BSIT",
    yearLevel: "3rd Year",
    academicYear: "2024-2025",
    status: "Active",
    activationStatus: "Active",
    activationEmailStatus: "Sent",
    lastActive: "2026-06-20",
    lastLoginAt: "2026-06-20T10:00:00Z",
    createdAt: "2024-06-01T00:00:00Z",
  },
  {
    id: "stu-2",
    studentId: "2024-0002",
    firstName: "Bob",
    lastName: "Smith",
    middleInitial: "",
    email: "bob@test.edu",
    section: "BSIT 3B",
    sectionId: "sec-2",
    course: "BSIT",
    yearLevel: "3rd Year",
    academicYear: "2024-2025",
    status: "Pending Activation",
    activationStatus: "Pending",
    activationEmailStatus: "Not Sent",
    lastActive: "—",
    lastLoginAt: "",
    createdAt: "2025-01-15T00:00:00Z",
  },
];

const sampleSections = [
  { id: "sec-1", code: "BSIT 3A", program: "BSIT", yearLevelName: "3rd Year", yearLevelId: "yl-3", academicYear: "2024-2025", academicYearId: "ay-1", ay: "2024-2025" },
  { id: "sec-2", code: "BSIT 3B", program: "BSIT", yearLevelName: "3rd Year", yearLevelId: "yl-3", academicYear: "2024-2025", academicYearId: "ay-1", ay: "2024-2025" },
];

const sampleAcademicYears = [
  { id: "ay-1", name: "2024-2025", status: "Active" },
];

describe("StudentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminService.getStudents.mockResolvedValue(sampleStudents);
    mockAdminCatalogService.getSections.mockResolvedValue(sampleSections);
    mockAdminCatalogService.getAcademicYears.mockResolvedValue(sampleAcademicYears);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getStudents on mount", async () => {
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Students")).toBeDefined();
    expect(mockAdminService.getStudents).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminService.getStudents.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Students")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminService.getStudents.mockRejectedValue(new Error("Failed to load students"));
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );
    const errors = await screen.findAllByText("Failed to load students");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders student rows when data loads", async () => {
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );
    const aliceNames = await screen.findAllByText(/Alice/);
    expect(aliceNames.length).toBeGreaterThanOrEqual(1);
    const bobNames = await screen.findAllByText(/Bob/);
    expect(bobNames.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no students", async () => {
    mockAdminService.getStudents.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Students")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText(/Alice|Bob/)).toBeNull();
    });
  });

  it("calls getStudents again when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Students");

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminService.getStudents).toHaveBeenCalledTimes(2);
    });
  });
});
