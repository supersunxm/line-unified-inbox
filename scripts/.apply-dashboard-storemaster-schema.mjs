import fs from 'node:fs';

const schemaPath = 'backend/prisma/schema.prisma';
let source = fs.readFileSync(schemaPath, 'utf8');

if (!source.includes('dashboardTier')) {
  const fieldAnchor = `  province              String?\n  region                String?\n  source                String`;
  const fieldReplacement = `  province              String?\n  region                String?\n  dashboardTier         String?\n  kpiPlan               String?\n  dashboardArea         String?\n  bmName                String?\n  source                String`;
  if (!source.includes(fieldAnchor)) throw new Error('StoreMaster field anchor not found');
  source = source.replace(fieldAnchor, fieldReplacement);

  const indexAnchor = `  @@index([province])\n  @@index([region])\n  @@index([isActive])\n}`;
  const indexReplacement = `  @@index([province])\n  @@index([region])\n  @@index([dashboardTier])\n  @@index([kpiPlan])\n  @@index([dashboardArea])\n  @@index([bmName])\n  @@index([isActive])\n}`;
  if (!source.includes(indexAnchor)) throw new Error('StoreMaster index anchor not found');
  source = source.replace(indexAnchor, indexReplacement);
  fs.writeFileSync(schemaPath, source);
}

for (const helper of [
  'scripts/.apply-dashboard-storemaster-schema.mjs',
  '.github/workflows/.apply-dashboard-storemaster-schema.yml',
]) {
  if (fs.existsSync(helper)) fs.rmSync(helper);
}
