import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminCatalogService = vi.hoisted(() => ({
  getRequests: vi.fn(),
}));

vi.mock("../../../../lib/api/services", () => ({
  adminCatalogService: mockAdminCatalogService,
}));

vi.mock("../../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

import RequestsPage from "../RequestsPage";

const sampleRequests = [
  {
    id: "req-1",
    type: "Section Transfer",
    requester: "Alice Johnson",
    role: "Student",
    subject: "BSIT 3A → BSIT 3B",
    details: "Requesting transfer due to schedule conflict.",
    date: "2026-06-23",
    status: "Pending",
  },
  {
    id: "req-2",
    type: "Grade Review",
    requester: "Bob Smith",
    role: "Student",
    subject: "CS101 - Lab Report 1",
    details: "Requesting grade review for Lab Report 1.",
    date: "2026-06-22",
    status: "Approved",
  },
];

describe("RequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminCatalogService.getRequests.mockResolvedValue(sampleRequests);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getRequests on mount", async () => {
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Requests")).toBeDefined();
    expect(mockAdminCatalogService.getRequests).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminCatalogService.getRequests.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Requests")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminCatalogService.getRequests.mockRejectedValue(new Error("Unable to load requests"));
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    );
    const errors = await screen.findAllByText("Unable to load requests");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders request rows when data loads", async () => {
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    );
    const transferTypes = await screen.findAllByText("Section Transfer");
    expect(transferTypes.length).toBeGreaterThanOrEqual(1);
    const gradeTypes = await screen.findAllByText("Grade Review");
    expect(gradeTypes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no requests", async () => {
    mockAdminCatalogService.getRequests.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Requests")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText(/Section Transfer|Grade Review/)).toBeNull();
    });
  });

  it("calls getRequests again when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Requests");

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminCatalogService.getRequests).toHaveBeenCalledTimes(2);
    });
  });
});
