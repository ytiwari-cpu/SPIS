# Frontend Instructions

These instructions apply to everything under `frontend/`.
Read and follow them before making any frontend change.

## Current flow to preserve

- Keep the existing route flow based on `frontend/src/config/routeConfig.ts`.
- Route-facing page files must stay thin and should continue exporting `requiredPermission`.
- Page files should primarily import and render the actual component to be shown.
- Permission wiring belongs at the page/route layer first, not inside deeply nested UI files unless it is for small action-level control.

## Required structure for new frontend features

For every new feature, create matching folders in both:

- `frontend/src/pages/<feature>/`
- `frontend/src/components/<feature>/`

Use this pattern:

```text
frontend/src/pages/payments/PaymentsPage.tsx
frontend/src/components/payments/Payments/Payments.tsx
frontend/src/components/payments/Payments/payments.service.ts
```

### `src/pages/<feature>/`

- Contains route/page wrappers only.
- Exports `requiredPermission`.
- Imports the actual component from `src/components/<feature>/...`.
- Keeps page logic minimal: route params, permission reference, and page-level composition only.

### `src/components/<feature>/`

- Contains the actual React implementation for the feature.
- Each major component should live in its own folder.
- If the component needs API access, keep all API calls in a colocated service file inside that component folder.
- Do not call APIs directly inside `.tsx` React files.

Recommended pattern:

```text
src/components/<feature>/<FeatureName>/<FeatureName>.tsx
src/components/<feature>/<FeatureName>/<featureName>.service.ts
```

## API rule

- No direct `fetch`, `axios`, or raw API invocation inside React component files.
- React files should import service functions and use them.
- Keep request building, response mapping, and API-specific logic in the service file.
- Reuse existing shared API utilities from `frontend/src/services/` when possible, but access them through the feature service layer instead of directly from the component.

## Common component rule

- Reuse common components as much as possible.
- Make shared components dynamic through props, configuration, columns, actions, filters, and service-backed data loaders.
- If multiple roles/features use the same layout, build **one** shared component in `frontend/src/components/common/` and change only the data source / permissions / actions.
- Data differences must not lead to duplicated layout components.

Example expectation:

- `grievances` for admin, citizen, and programme should use one shared grievance UI when the layout is the same.
- Admin, citizen, and programme may call different service methods and receive different data sets.
- The UI component should stay the same unless the layout truly differs in a meaningful way.

## Anti-pattern to avoid

- Do **not** create a “common” wrapper that simply switches between separate role-specific full-page components when the layout is actually shared.
- Do **not** repeat the family mistake where multiple role-specific implementations exist and a common wrapper chooses one of them.
- A shared feature should be implemented as one reusable component, not three separate components behind one selector.

## Folder design guidance

- Prefer feature-first organization for new work instead of increasing role-based duplication.
- Keep `pages` for route entry points and permissions.
- Keep `components` for actual UI implementation.
- Keep shared building blocks in `frontend/src/components/common/`.
- If a feature has multiple internal helpers, keep them inside that feature folder instead of scattering them across unrelated directories.

## Decision rule before adding a new component

Before creating a new role-specific component, check:

1. Can an existing common component be reused?
2. Can the current component be made dynamic with props/config?
3. Is the difference only in API/data access?

If the answer is yes to any of the above, extend the shared component instead of creating a new duplicate UI.

## When modifying existing frontend code

- Use the current route + permission flow as the reference implementation.
- Move the codebase toward this structure incrementally.
- Do not introduce new direct API calls inside `.tsx` files.
- Do not add new duplicate role-based UI files when a shared layout is possible.
