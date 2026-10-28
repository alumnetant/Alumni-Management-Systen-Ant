# Implementation Plan: Live Animated Area Curve Graph for Command Center System Activity

## Executive Summary
Transform the Command Center's **System Activity** view in `AdminDashboardOverview.tsx` from static segmented column blocks into a **live animated SVG area curve graph with glowing gradients and live pulsing data nodes**.

---

## Proposed Changes

### `src/components/admin/AdminDashboardOverview.tsx`
1. **Live Activity Data Resolution**:
   - Compute real 7-day activity metrics based on actual `auditLogs` timestamps, calculating hourly and daily event density.
2. **Smooth Bezier Spline SVG Engine**:
   - Generate smooth cubic bezier SVG path coordinates (`path` with `C` control points) for an organic, modern curve.
   - Construct a closed SVG area with a St. Cecilia crimson-to-amber glowing gradient (`#8B181B` to transparent).
3. **Animations & Live Indicators**:
   - Use `framer-motion` for a fluid path drawing entrance animation (`pathLength: 0` -> `1`).
   - Add a live pulsing radar beacon on the current day's node ("Today / Live") with animated ping rings (`animate-ping`).
4. **Interactive Hover & Tooltip**:
   - Interactive hover points showing exact event counts, active security logs, and operational status.
   - Subtle grid lines and day labels (`Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Today`) aligned beneath data coordinates.

---

## Verification Plan
1. Run `lint_applet` (`tsc --noEmit`) to verify clean type-checking.
2. Run `compile_applet` (`npm run build`) to ensure build succeeds.
3. Test interaction in Command Center when switching between "All", "Directory", and "System Activity" filter pills.
