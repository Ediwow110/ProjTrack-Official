import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminService = vi.hoisted(() => ({
  getAuditLogs: vi.fn(),
  getAuditLogDetail: vi.fn(),
}));

vi.mock("../../../../lib/api/services", () => ({
  adminService: mockAdminService,
}));

vi.mock("../../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

import AuditLogsPage from "../AuditLogsPage";

const sampleLogs = [
  {
    id: "log-1",
    action: "CREATE",
    module: "Students",
    user: "Admin User",
    role: "ADMIN",
    actorUserId: "user-1",
    target: "Student Alice Johnson",
    entityId: "stu-1",
    time: "2026-06-24 10:30",
    result: "Success",
  },
  {
    id: "log-2",
    action: "UPDATE",
    module: "Submissions",
    user: "Admin User",
    role: "ADMIN",
    actorUserId: "user-1",
    target: "Submission Lab Report 1",
    entityId: "sub-1",
    time: "2026-06-24 11:00",
    result: "Queued",
  },
];

describe("AuditLogsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminService.getAuditLogs.mockResolvedValue(sampleLogs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getAuditLogs on mount", async () => {
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Audit Logs")).toBeDefined();
    expect(mockAdminService.getAuditLogs).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminService.getAuditLogs.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Audit Logs")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminService.getAuditLogs.mockRejectedValue(new Error("Unable to load audit logs"));
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );
    const errors = await screen.findAllByText("Unable to load audit logs");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders audit log rows when data loads", async () => {
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );
    const createActions = await screen.findAllByText("CREATE");
    expect(createActions.length).toBeGreaterThanOrEqual(1);
    const updateActions = await screen.findAllByText("UPDATE");
    expect(updateActions.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no audit logs", async () => {
    mockAdminService.getAuditLogs.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Audit Logs")).toBeDefined();
    const emptyText = screen.queryByText(/No audit events match/i);
    expect(emptyText).toBeDefined();
  });

  it("calls getAuditLogs again when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Audit Logs");

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminService.getAuditLogs).toHaveBeenCalledTimes(2);
    });
  });
});
