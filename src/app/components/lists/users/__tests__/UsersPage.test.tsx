import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminService = vi.hoisted(() => ({
  getUsers: vi.fn(),
  createAdmin: vi.fn(),
  activateUser: vi.fn(),
  deactivateUser: vi.fn(),
  sendUserResetLink: vi.fn(),
  resendUserActivation: vi.fn(),
  deleteUser: vi.fn(),
}));

const mockAssertConfirmedMailJob = vi.hoisted(() => vi.fn(() => "mail-job-1"));

vi.mock("../../../../lib/api/services", () => ({
  adminService: mockAdminService,
}));

vi.mock("../../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

vi.mock("../../../../lib/mailActionSafety", () => ({
  assertConfirmedMailJob: mockAssertConfirmedMailJob,
  getConfirmedMailJobId: vi.fn(() => "mail-job-1"),
}));

import UsersPage from "../UsersPage";

const sampleUsers = [
  {
    id: "user-1",
    displayIdentifier: "ADM-001",
    identifierLabel: "Employee ID",
    profileId: null,
    email: "admin@test.edu",
    role: "ADMIN",
    status: "Active",
    firstName: "Admin",
    lastName: "User",
    phone: "555-0100",
    office: "Main Office",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-06-01T00:00:00Z",
    profileLabel: "—",
    studentNumber: null,
    employeeId: "ADM-001",
    isSeedCandidate: false,
  },
  {
    id: "user-2",
    displayIdentifier: "STU-001",
    identifierLabel: "Student Number",
    profileId: "profile-1",
    email: "student@test.edu",
    role: "STUDENT",
    status: "Active",
    firstName: "Test",
    lastName: "Student",
    phone: "",
    office: "",
    createdAt: "2025-02-15T00:00:00Z",
    updatedAt: "2025-06-15T00:00:00Z",
    profileLabel: "profile-1",
    studentNumber: "STU-001",
    employeeId: null,
    isSeedCandidate: false,
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminService.getUsers.mockResolvedValue(sampleUsers);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getUsers on mount", async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Users")).toBeDefined();
    expect(mockAdminService.getUsers).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminService.getUsers.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Users")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminService.getUsers.mockRejectedValue(new Error("Failed to load users"));
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Failed to load users")).toBeDefined();
  });

  it("renders user rows when data loads", async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    const adminEmails = await screen.findAllByText("admin@test.edu");
    expect(adminEmails.length).toBeGreaterThanOrEqual(1);
    const studentEmails = await screen.findAllByText("student@test.edu");
    expect(studentEmails.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no users", async () => {
    mockAdminService.getUsers.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Users")).toBeDefined();
    const zeroElements = screen.getAllByText("0");
    expect(zeroElements.length).toBeGreaterThanOrEqual(1);
  });

  it("calls getUsers again when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    const adminEmails = await screen.findAllByText("admin@test.edu");
    expect(adminEmails.length).toBeGreaterThanOrEqual(1);

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminService.getUsers).toHaveBeenCalledTimes(2);
    });
  });
});
