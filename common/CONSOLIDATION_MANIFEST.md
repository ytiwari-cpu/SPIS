
## Second-pass updates

- Removed all `chats/` folders from module directories under `common/`.
- Removed `common/shared/` as requested.
- Moved previous `common/shared/db/*` assets into `common/infra/db/*` so no DB artifacts were lost.
- Added `common/DOCS/` and copied all documentation files there (see `common/DOCS/DOCS_MANIFEST.md`).

## Third-pass updates

- Flattened `common/DOCS/` into a single-level folder (no module-wise structure).
- Performed verified move+remove for requested categories from original locations.
- Included additional discovered DB migrations (`012`, `013`, `014`) in `common/infra/db/migrations/`.
- Detailed per-file move log: `common/RELOCATION_LOG.md`.
