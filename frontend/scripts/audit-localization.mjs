import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// U+0E3F is the baht currency symbol, not Thai-language text.
const thaiLanguageCharacter = /[\u0e00-\u0e3e\u0e40-\u0e7e]/;

// Only direct rendered copy is flagged. Dictionaries, comments, logs, enums and
// customer/API values are excluded. Model-generated copy still needs manual review.
export function findHardcodedThaiUi(source, filename = "component.tsx") {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const isRenderedJsxString = (node) => {
    let current = node;
    while (current.parent && !ts.isJsxExpression(current.parent) && !ts.isJsxAttribute(current.parent)) {
      const parent = current.parent;
      if (ts.isConditionalExpression(parent) && parent.condition === current) return false;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
      if (ts.isCallExpression(parent) || ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) return false;
      current = parent;
    }
    const boundary = current.parent;
    if (boundary && ts.isJsxAttribute(boundary)) {
      return ["alt", "aria-label", "placeholder", "title"].includes(boundary.name.getText(ast));
    }
    return Boolean(boundary && ts.isJsxExpression(boundary)
      && (ts.isJsxElement(boundary.parent) || ts.isJsxFragment(boundary.parent)));
  };
  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const tagName = ts.isIdentifier(node.openingElement.tagName) ? node.openingElement.tagName.text : "";
      if (tagName === "style" || tagName === "script") return;
    }
    const rendered = ts.isJsxText(node) || (ts.isStringLiteralLike(node) && isRenderedJsxString(node));
    if (rendered && thaiLanguageCharacter.test(node.text)) {
      const text = node.text.trim();
      if (text) findings.push({ line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, text });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}

export function auditDirectory(directory) {
  const findings = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filename = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (filename.endsWith(".tsx") && !filename.includes(".test.")) {
        for (const finding of findHardcodedThaiUi(fs.readFileSync(filename, "utf8"), filename)) {
          findings.push({ file: filename, ...finding });
        }
      }
    }
  };
  walk(directory);
  return findings;
}

function normalizePath(filename, repositoryRoot) {
  const value = path.isAbsolute(filename) ? path.relative(repositoryRoot, filename) : filename;
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Match the live AST sweep one-for-one against the reviewed historical audit.
 * New occurrences cannot inherit a classification after the reviewed count for
 * that source phrase is exhausted.
 */
export function classifyCurrentFindings(findings, audit, repositoryRoot) {
  const buckets = new Map();
  for (const source of [...(audit.findings ?? []), ...(audit.liveFindings ?? [])]) {
    const key = `${normalizePath(source.file, repositoryRoot)}\0${normalizeText(source.text)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(source);
    buckets.set(key, bucket);
  }

  const results = findings.map((finding) => {
    const key = `${normalizePath(finding.file, repositoryRoot)}\0${normalizeText(finding.text)}`;
    const source = buckets.get(key)?.shift();
    if (!source) return { ...finding, classification: "UNCLASSIFIED", auditStatus: "NO_REVIEWED_SOURCE_MATCH" };
    if (source.classification === "BUG" && (source.status !== "FIXED" || !source.translationKey)) {
      return { ...finding, classification: "BUG", auditStatus: "BUG_NOT_PROVEN_FIXED", translationKey: source.translationKey };
    }
    if (!["BUG", "NON_UI", "INTENTIONAL_UI"].includes(source.classification) || !source.reason?.trim()) {
      return { ...finding, classification: "UNCLASSIFIED", auditStatus: "INVALID_REVIEW_RECORD" };
    }
    return {
      ...finding,
      classification: source.classification,
      auditStatus: source.classification === "BUG" ? "FIXED" : "REVIEWED",
      translationKey: source.translationKey,
    };
  });

  return {
    status: results.every((finding) => ["FIXED", "REVIEWED"].includes(finding.auditStatus)) ? "PASS" : "REVIEW_REQUIRED",
    metrics: {
      currentCandidates: results.length,
      BUGFixed: results.filter((finding) => finding.classification === "BUG" && finding.auditStatus === "FIXED").length,
      NON_UI: results.filter((finding) => finding.classification === "NON_UI").length,
      INTENTIONAL_UI: results.filter((finding) => finding.classification === "INTENTIONAL_UI").length,
      unclassified: results.filter((finding) => finding.auditStatus === "NO_REVIEWED_SOURCE_MATCH" || finding.auditStatus === "INVALID_REVIEW_RECORD").length,
      unfixedBugs: results.filter((finding) => finding.auditStatus === "BUG_NOT_PROVEN_FIXED").length,
    },
    findings: results,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const frontendRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const directory = path.join(frontendRoot, "src");
  const findings = auditDirectory(directory);
  if (process.argv.includes("--classified")) {
    const repositoryRoot = path.resolve(frontendRoot, "..");
    const auditPath = path.join(repositoryRoot, "docs/localization/FINAL_THAI_CLASSIFICATION.json");
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    const result = classifyCurrentFindings(findings, audit, repositoryRoot);
    process.stdout.write(JSON.stringify({ ...result, auditPath: path.relative(repositoryRoot, auditPath) }, null, 2) + "\n");
    if (result.status !== "PASS") process.exitCode = 1;
  } else {
    process.stdout.write(JSON.stringify({ status: findings.length ? "REVIEW_REQUIRED" : "PASS", findings }, null, 2) + "\n");
  }
}
