# USDA CI lint hotfix

This branch fixes the three lint errors reported by `npm run test:all` after the USDA search integration:

- handles the import failure-status update catch explicitly instead of leaving an empty block;
- preserves the original NDJSON parse exception as `Error.cause`;
- removes `@ts-nocheck` from the USDA Edge Function and declares the narrow Deno runtime surface it uses.

This file exists only to document the hotfix scope and can be removed before merge if desired.
