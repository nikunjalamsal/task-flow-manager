# Product Catalog Module

This module currently lives inside the BSS Task Calendar project so you can iterate quickly with a live preview, but it is **designed to be extracted into its own git repository** later.

## Files that belong to the Catalog module

```
src/lib/catalogTypes.ts
src/context/CatalogContext.tsx
src/pages/CatalogPage.tsx
src/assets/catalog-reference.png
```

Plus the route registration in `src/App.tsx` (`/catalog`) and the nav button in `src/pages/Dashboard.tsx`.

## How to split into a separate git repo

1. Create a new Vite + React + TypeScript + Tailwind project (same stack as this one).
2. Copy the files listed above into the new project's `src/`.
3. Install the same shadcn/ui components used here: `button`, `input`, `label`, `textarea`, `dialog`, `tabs`, `sonner`.
4. Copy `src/lib/utils.ts` (for `generateId` and `cn`) and the design tokens from `src/index.css` and `tailwind.config.ts`.
5. Replace `useAuth` with whatever auth your standalone app uses (it only needs `user.name`, `user.id`, `isManager`, and `logout`).
6. Replace `localStorage` persistence with a backend if you want multi-user catalog state (currently catalog data is per-browser).
7. Remove the `<Link to="/">` Task Calendar nav button if standalone.

## Approval workflow (current behavior)

- Any logged-in user can submit **add / modify / delete** requests with a reason.
- Requests appear in the **Catalog Approvals** tab and are pending until reviewed.
- Only **managers** can approve or reject requests with a comment.
- On approval, the catalog table updates and the change is recorded in each item's history log.
