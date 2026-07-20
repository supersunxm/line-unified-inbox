# Product classification catalog

The catalog uses the existing hierarchy `ProductSeries` (family) → `ProductModel` (canonical classification) → `ProductAlias`, with `ProductGroup` stored on each family. The source catalog is `backend/src/classification/product-catalog.ts`.

Commands from `backend`:

```sh
npm run product-catalog:validate
npm run product-catalog:seed
npm run classification:backfill-products -- --dry-run --batch-size=100
npm run classification:backfill-products -- --batch-size=100
```

Catalog synchronization is safe to repeat and does not delete unrelated records. Validation rejects empty, too-short, or normalized aliases that point to different canonical products. Backfill is batched and idempotent, and skips conversations with a manual product classification.

Add products by creating a catalog entry with its group, family, canonical name, specificity level, priority, and aliases. Validate before synchronizing. Ambiguous generic words should include explicit OPPO context; do not add short fragments such as `tv`, `pad`, `band`, or `เครื่อง` without context.

Automatic classifications record confidence, matched phrase, matching method, and source message. Manual selections remain authoritative during re-analysis. Removing the manual selection through the existing edit flow allows the next re-analysis/backfill to restore automatic classification.
