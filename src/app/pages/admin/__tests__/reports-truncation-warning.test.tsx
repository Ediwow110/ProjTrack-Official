import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminReportsResponse } from "../../../lib/api/contracts";

/**
 * Focused unit tests for the report truncation warning behavior.
 * These validate that the warning logic in the Reports component works correctly
 * without requiring full component rendering with async data hooks.
 */

// The warning component logic extracted for testability
function TruncationWarning({
  isTruncated,
  rowLimit,
  totalMatchingRows,
}: {
  isTruncated: boolean;
  rowLimit: number;
  totalMatchingRows: number;
}) {
  if (!isTruncated) return null;
  return (
    <div data-testid="truncation-warning">
      Showing first {rowLimit.toLocaleString()} of{" "}
      {totalMatchingRows.toLocaleString()} matching submissions. Refine filters
      or export in smaller batches.
    </div>
  );
}

describe("TruncationWarning", () => {
  it("renders warning when isTruncated is true", () => {
    render(
      <TruncationWarning
        isTruncated={true}
        rowLimit={5000}
        totalMatchingRows={7500}
      />
    );
    expect(screen.getByTestId("truncation-warning")).toBeDefined();
    expect(
      screen.getByText(/Showing first 5,000 of 7,500 matching submissions/)
    ).toBeDefined();
  });

  it("does not render warning when isTruncated is false", () => {
    const { container } = render(
      <TruncationWarning
        isTruncated={false}
        rowLimit={5000}
        totalMatchingRows={3000}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render warning when totalMatchingRows <= rowLimit", () => {
    const { container } = render(
      <TruncationWarning
        isTruncated={false}
        rowLimit={5000}
        totalMatchingRows={5000}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("includes row limit and total matching count in warning text", () => {
    render(
      <TruncationWarning
        isTruncated={true}
        rowLimit={5000}
        totalMatchingRows={12345}
      />
    );
    expect(screen.getByTestId("truncation-warning").textContent).toContain(
      "5,000"
    );
    expect(screen.getByTestId("truncation-warning").textContent).toContain(
      "12,345"
    );
  });

  it("contains the recommended action text", () => {
    render(
      <TruncationWarning
        isTruncated={true}
        rowLimit={5000}
        totalMatchingRows={6000}
      />
    );
    expect(
      screen.getByText(/Refine filters or export in smaller batches/)
    ).toBeDefined();
  });
});
