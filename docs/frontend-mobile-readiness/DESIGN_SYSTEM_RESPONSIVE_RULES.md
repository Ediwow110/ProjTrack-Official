# Responsive Design System Rules

Generated: 2026-05-29

## Primitives

Use existing portal primitives first:

- `PortalPage`
- `PortalPanel`
- `PortalHero`
- `PortalMetricCard`
- `DataTableCard`

`DataTableCard` now renders desktop tables at `sm` and above, and mobile cards below `sm`.

## Rules

1. Use tables for tablet/desktop data density.
2. Use mobile cards for phone primary workflows.
3. Horizontal scroll is acceptable only for secondary dense comparison views, not core phone workflows.
4. Keep page actions reachable at 360px.
5. Icon-only controls require `aria-label`.
6. Avoid full-card click targets when nested buttons exist; provide explicit actions instead.
7. Respect reduced motion and avoid hover-only affordances on touch.
8. All new critical pages require responsive E2E coverage.

## Mobile card content standard

Each mobile card should expose:

- Primary title
- Secondary metadata
- Status/role/grade chip when relevant
- Date or key metric
- Primary action

## Review checklist

- No document-level horizontal overflow.
- Main landmark visible.
- Topbar/menu reachable.
- Focus states visible.
- Keyboard navigation preserved.
- Loading/error/empty states fit on phone.
