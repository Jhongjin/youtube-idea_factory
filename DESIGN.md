# Design System: YouTube Idea Factory

## 1. Visual Theme & Atmosphere

A focused production cockpit for YouTube automation. The default experience is calm,
sequential, and operator-led: one visible next action, compact evidence panels, and
advanced tools kept behind disclosure. Density is balanced for daily work, not a
marketing page.

- Density: 7/10, useful but not crowded.
- Variance: 4/10, predictable workflow with small asymmetry in inspector context.
- Motion: 3/10, restrained micro-interactions only.

## 2. Color Palette & Roles

- **Workspace Canvas** (#F4F6F8) — page background.
- **Pure Surface** (#FFFFFF) — primary cards, forms, tables.
- **Quiet Surface** (#F8FAFC) — contextual panels, grouped secondary controls.
- **Charcoal Ink** (#111827) — primary text.
- **Muted Steel** (#657386) — secondary text and helper copy.
- **Whisper Border** (#D9E0E8) — structural 1px borders.
- **Operator Blue** (#2563EB) — the single accent for primary CTA, active stage, focus.
- **Safe Green** (#0F9F6E) — pass/completed states only.
- **Review Amber** (#B7791F) — review and evidence-needed states only.
- **Risk Red** (#C2413D) — blocked/error states only.

Never use neon gradients, purple-blue AI glow, or pure black.

## 3. Typography Rules

- **Display/UI:** Geist Sans or system UI fallback. Use weight and spacing, not oversized
  type, to create hierarchy.
- **Body:** 13-15px, line-height 1.45-1.6, max readable line length near 65 characters.
- **Mono:** Geist Mono, Cascadia Code, or SF Mono for commands, run IDs, timestamps, and
  numeric diagnostics.
- Numbers in metrics and stage counters should use tabular numerals.
- Avoid title-case-heavy labels. Use short Korean labels and direct operational language.

## 4. Component Stylings

- **Primary CTA:** One visible primary action for the current run. Operator Blue fill,
  white text, 8px radius, no heavy shadow.
- **Secondary Actions:** White surface, 1px border, only near the relevant primary action.
- **Advanced Tools:** Always behind a disclosure. Never expose the full action matrix by
  default.
- **Cards/Panels:** 8px radius, 1px border, minimal or no shadow. Use panels only for
  hierarchy, not decoration.
- **Inspector:** Contextual. Show current stage summary first. Keep approvals, providers,
  generation, render, and feedback folded until the active stage needs them.
- **Status Badges:** Small, semantic, and color-coded: green for done, amber for review,
  red for blocked, gray for pending.
- **Inputs:** Label above input, helper text below when needed. No floating labels.
- **Errors:** Inline, specific, and actionable. Do not use alert popups for normal workflow
  failures.

## 5. Layout Principles

- The default route is a guided production workspace, not a dashboard dumping every tool.
- The main column starts with the current stage and its next action.
- The sidebar is navigation and run memory only.
- The right inspector is current-stage context only, with deeper controls folded.
- Use CSS Grid for stage and metric layouts. Collapse to one column below 860px.
- No horizontal overflow on mobile.
- Avoid cards inside cards. Use dividers, compact rows, and disclosures for hierarchy.

## 6. Motion & Interaction

- Use transitions for hover/focus/active states, 160-240ms.
- Animate only transform and opacity.
- Do not add cinematic scrolling, parallax, or decorative motion to the dashboard.
- Loading states should keep button labels and stage context visible.
- Focus rings must be visible for keyboard use.

## 7. Anti-Patterns

- No emojis.
- No broad top toolbar full of every possible action.
- No approval controls before the workflow reaches generation, render, or publishing.
- No paid generation, render, upload, or publish action without explicit human approval.
- No generic AI copy such as "seamless", "unleash", "next-gen", or "game-changer".
- No decorative gradients, blobs, or landing-page hero patterns.
- No hidden prerequisite failures. Show the missing provider, approval, transcript, or
  artifact before the operator clicks.
