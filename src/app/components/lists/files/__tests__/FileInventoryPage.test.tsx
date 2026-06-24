import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const mockAdminService = vi.hoisted(() => ({
  getFileInventory: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("../../../../lib/api/services", () => ({
  adminService: mockAdminService,
}));

vi.mock("../../../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

import FileInventoryPage from "../FileInventoryPage";

const sampleFiles = [
  {
    fileName: "report.pdf",
    storedName: "abc123-report.pdf",
    relativePath: "submissions/abc123-report.pdf",
    scope: "submissions",
    sizeBytes: 102400,
    uploadedAt: "2026-06-20T10:00:00Z",
    submissionId: "sub-1",
    subjectId: "subject-1",
  },
  {
    fileName: "image.png",
    storedName: "def456-image.png",
    relativePath: "submissions/def456-image.png",
    scope: "submissions",
    sizeBytes: 204800,
    uploadedAt: "2026-06-21T14:00:00Z",
    submissionId: "sub-2",
    subjectId: "subject-1",
  },
];

describe("FileInventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminService.getFileInventory.mockResolvedValue(sampleFiles);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders title and calls getFileInventory on mount", async () => {
    render(
      <MemoryRouter>
        <FileInventoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("File Inventory")).toBeDefined();
    expect(mockAdminService.getFileInventory).toHaveBeenCalledTimes(1);
  });

  it("renders loading state without crashing", async () => {
    mockAdminService.getFileInventory.mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <MemoryRouter>
        <FileInventoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("File Inventory")).toBeDefined();
  });

  it("renders error banner when fetch fails", async () => {
    mockAdminService.getFileInventory.mockRejectedValue(new Error("Unable to load file inventory"));
    render(
      <MemoryRouter>
        <FileInventoryPage />
      </MemoryRouter>,
    );
    const errors = await screen.findAllByText("Unable to load file inventory");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders file rows when data loads", async () => {
    render(
      <MemoryRouter>
        <FileInventoryPage />
      </MemoryRouter>,
    );
    const reportFiles = await screen.findAllByText("report.pdf");
    expect(reportFiles.length).toBeGreaterThanOrEqual(1);
    const imageFiles = await screen.findAllByText("image.png");
    expect(imageFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no files", async () => {
    mockAdminService.getFileInventory.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <FileInventoryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("File Inventory")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText("report.pdf")).toBeNull();
    });
  });

  it("calls getFileInventory again when Refresh button is clicked", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FileInventoryPage />
      </MemoryRouter>,
    );
    await screen.findByText("File Inventory");

    const refreshBtn = screen.getByText(/Refresh/i);
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockAdminService.getFileInventory).toHaveBeenCalledTimes(2);
    });
  });
});
