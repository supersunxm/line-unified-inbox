import { loadEnvFile } from "node:process";
import { PrismaService } from "../src/prisma.service";
import { TranslationQualityReportService } from "../src/translation/translation-quality-report.service";

try { loadEnvFile(".env"); } catch { /* Railway and other managed runtimes inject configuration directly. */ }

const prisma = new PrismaService();

async function main() {
  await prisma.$connect();
  try {
    const report = await new TranslationQualityReportService(prisma).createReport();
    console.log(JSON.stringify(report));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error(JSON.stringify({ error: "TRANSLATION_QUALITY_REPORT_FAILED" }));
  process.exitCode = 1;
});
