import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminCatalogService = vi.hoisted(() => ({
  getTeachers: vi.fn(),
  getDepartments: vi.fn(),
}));

const mockAdminService = vi.hoisted(() => ({
  createTeacher: vi.fn(),
  activateTeacher: vi.fn(),
  sendTeacherResetLink: vi.fn(),
  deactivateTeacher: vi.fn(),
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

import TeachersPage from "../TeachersPage";

const sampleTeachers = [
  {
    id: "teacher-1",
    name: "Dr. Smith",
    email: "smith@test.edu",
    dept: "Computer Science",
    employeeId: "TCH-001",
    subjects: 3,
    students: 45,
    status: "Active",
  },
  {
    id: "teacher-2",
    name: "Prof. Jones",
    email: "jones@test.edu",
    dept: "Mathematics",
    employeeId: "TCH-002",
    subjects: 2,
    students: 30,
    status: "Pending Activation",
  },
];

const sampleDepartments = [
  { id: "dept-1", name: "Computer Science" },
  { id: "dept-2", name: "Mathematics" },
];

describe("TeachersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminCatalogService.getTeachers.mockResolvedValue(sampleTeachers);
    mockAdminCatalogService.getDepartments.mockResolvedValue(sampleDepartments);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getTeachers on mount", async () => {
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Teachers")).toBeDefined();
    expect(mockAdminCatalogService.getTeachers).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminCatalogService.getTeachers.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Teachers")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminCatalogService.getTeachers.mockRejectedValue(new Error("Failed to load teachers"));
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );
    const errors = await screen.findAllByText("Failed to load teachers");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders teacher rows when data loads", async () => {
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );
    const smithNames = await screen.findAllByText(/Dr. Smith/);
    expect(smithNames.length).toBeGreaterThanOrEqual(1);
    const jonesNames = await screen.findAllByText(/Prof. Jones/);
    expect(jonesNames.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no teachers", async () => {
    mockAdminCatalogService.getTeachers.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Teachers")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText(/Dr. Smith|Prof. Jones/)).toBeNull();
    });
  });

  it("calls getTeachers again when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeachersPage />
      </MemoryRouter>,
    );
    await screen.findByText("Teachers");

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminCatalogService.getTeachers).toHaveBeenCalledTimes(2);
    });
  });
});
