import { execSync } from "node:child_process";

console.log("Bundling extension scripts with esbuild...");
execSync("npx --yes esbuild src/content_script.ts --bundle --outfile=content_script.js --format=iife --target=chrome87", { stdio: "inherit" });
execSync("npx --yes esbuild src/dashboard_bridge.ts --bundle --outfile=dashboard_bridge.js --format=iife --target=chrome87", { stdio: "inherit" });
console.log("Built content_script.js and dashboard_bridge.js successfully.");
