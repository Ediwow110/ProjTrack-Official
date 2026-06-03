import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

// ---------------------------------------------------------------------------
// Mock dependencies before any imports that use them
// ---------------------------------------------------------------------------

const mockSession = vi.hoisted(() => ({
  getAuthSession: vi.fn<() => { role: string; identifier: string; accessToken?: string; refreshToken?: string } | null>(),
  clearAuthSession: vi.fn(),
  productionRuntime: vi.fn(() => false),
}));

vi.mock("../../lib/mockAuth", () => ({
  getAuthSession: mockSession.getAuthSession,
  clearAuthSession: mockSession.clearAuthSession,
  productionRuntime: mockSession.productionRuntime,
}));

const mockAuthService = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<{ id: string; role: string; identifier: string; email: string; name: string; status: string } | null>>(),
}));

vi.mock("../../lib/api/services", () => ({
  authService: mockAuthService,
}));

// Mock runtime so useBackend is true
vi.mock("../../lib/api/runtime", () => ({
  apiRuntime: { useBackend: true, baseUrl: "http://test.local:3001", publicAppUrl: "http://test.local:5173" },
}));

// Now import the component under test
import ProtectedPortal from "../ProtectedPortal";

// ---------------------------------------------------------------------------
// Helper to render a ProtectedPortal inside a MemoryRouter route
// ---------------------------------------------------------------------------
function renderPortal(role: "student" | "teacher" | "admin", initialRoute = "/student/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/:role/dashboard"
          element={
            <ProtectedPortal role={role}>
              <div data-testid="protected-content">Protected dashboard content</div>
            </ProtectedPortal>
          }
        />
        {/* Login route for redirect detection */}
        <Route path="/:role/login" element={<div data-testid="login-page">Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ProtectedPortal — auth/route guard (Target A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "student",
      identifier: "STU-001",
      email: "student@test.edu",
      name: "Test Student",
      status: "ACTIVE",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Unauthenticated user redirected to login
  // -----------------------------------------------------------------------
  it("redirects to login when there is no auth session", async () => {
    mockSession.getAuthSession.mockReturnValue(null);

    renderPortal("student");

    // Protected content must NOT appear
    expect(screen.queryByTestId("protected-content")).toBeNull();
    // Should have navigated to login
    expect(await screen.findByTestId("login-page")).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Authenticated user with matching role sees protected content
  // -----------------------------------------------------------------------
  it("renders children when session exists, role matches, and verification passes", async () => {
    mockSession.getAuthSession.mockReturnValue({
      role: "student",
      identifier: "STU-001",
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
    });
    mockAuthService.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "student",
      identifier: "STU-001",
      email: "student@test.edu",
      name: "Test Student",
      status: "ACTIVE",
    });

    renderPortal("student");

    // Should eventually show the protected content
    expect(await screen.findByTestId("protected-content")).toBeDefined();
    // Login page must NOT be visible
    expect(screen.queryByTestId("login-page")).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 3. Authenticated user with wrong role is denied
  // -----------------------------------------------------------------------
  it("redirects to login when session role does not match required role", async () => {
    // Session says admin, but the route is for student
    mockSession.getAuthSession.mockReturnValue({
      role: "admin",
      identifier: "ADM-001",
      accessToken: "admin-token",
      refreshToken: "admin-refresh",
    });
    // Backend returns admin role
    mockAuthService.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "admin",
      identifier: "ADM-001",
      email: "admin@test.edu",
      name: "Test Admin",
      status: "ACTIVE",
    });

    renderPortal("student");

    // Should redirect to login because role doesn't match "student"
    expect(await screen.findByTestId("login-page")).toBeDefined();
    // Protected content must NOT be visible
    expect(screen.queryByTestId("protected-content")).toBeNull();
    // Session should have been cleared
    expect(mockSession.clearAuthSession).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 4. Auth failure (401/403) clears session and redirects
  // -----------------------------------------------------------------------
  it("clears session and redirects on authorization failure (401/403)", async () => {
    mockSession.getAuthSession.mockReturnValue({
      role: "student",
      identifier: "STU-001",
      accessToken: "stale-token",
      refreshToken: "stale-refresh",
    });
    mockAuthService.getCurrentUser.mockRejectedValue(new Error("Unauthorized (401)"));

    renderPortal("student");

    expect(await screen.findByTestId("login-page")).toBeDefined();
    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(mockSession.clearAuthSession).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 5. Non-auth API error shows verification error (not redirect)
  // -----------------------------------------------------------------------
  it("shows verification error when getCurrentUser fails with non-auth error", async () => {
    mockSession.getAuthSession.mockReturnValue({
      role: "student",
      identifier: "STU-001",
      accessToken: "token",
      refreshToken: "refresh",
    });
    mockAuthService.getCurrentUser.mockRejectedValue(new Error("Network error"));

    renderPortal("student");

    // Should show the verification error alert, not redirect
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/Session verification is temporarily unavailable/i)).toBeDefined();
    // Should NOT show protected content
    expect(screen.queryByTestId("protected-content")).toBeNull();
    // Should NOT have cleared the session (not an auth failure)
    expect(mockSession.clearAuthSession).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 6. Loading state while verifying
  // -----------------------------------------------------------------------
  it("shows loading indicator while verification is in progress", async () => {
    // Return a promise that doesn't resolve immediately
    mockAuthService.getCurrentUser.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        id: "user-1",
        role: "student",
        identifier: "STU-001",
        email: "student@test.edu",
        name: "Test Student",
        status: "ACTIVE",
      }), 500)),
    );
    mockSession.getAuthSession.mockReturnValue({
      role: "student",
      identifier: "STU-001",
      accessToken: "token",
      refreshToken: "refresh",
    });

    renderPortal("student");

    // Before the promise resolves, the loading indicator should be visible
    expect(screen.getByText(/Checking session/i)).toBeDefined();

    // Wait for the promise to resolve
    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeDefined();
    });

    // Loading indicator should be gone
    expect(screen.queryByText(/Checking session/i)).toBeNull();
  });
});
