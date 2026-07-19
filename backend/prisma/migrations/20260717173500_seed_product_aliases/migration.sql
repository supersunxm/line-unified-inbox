INSERT INTO "ProductAlias" ("id", "productModelId", "alias", "normalizedAlias", "language", "isActive")
SELECT gen_random_uuid()::text, pm."id", aliases.alias, aliases.normalized, 'multi', true
FROM "ProductModel" pm
JOIN (VALUES
  ('OPPO Reno16 Pro 5G', 'Reno 16', 'reno16'),
  ('OPPO Reno16 Pro 5G', 'Reno16 Pro', 'reno16pro'),
  ('OPPO A6 Pro 5G', 'A6 Pro', 'a6pro'),
  ('OPPO Find X9', 'Find X9', 'findx9'),
  ('OPPO Pad 3', 'OPPO Pad', 'pad'),
  ('OPPO Pad 3', 'Pad 3', 'pad3')
) AS aliases(model_name, alias, normalized) ON pm."name" = aliases.model_name
ON CONFLICT ("normalizedAlias") DO NOTHING;
