import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { primaryNavigationState } from "../src/app/primary-navigation.ts";
import {
  applyThemeToRoot,
  loadTheme,
  resolveTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from "../src/app/theme-logic.ts";

function createStorage(initialValue: string | null = null) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set(THEME_STORAGE_KEY, initialValue);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("restores a saved theme and defaults invalid or missing values to system", () => {
  assert.equal(loadTheme(createStorage("dark")), "dark");
  assert.equal(loadTheme(createStorage("light")), "light");
  assert.equal(loadTheme(createStorage("invalid")), "system");
  assert.equal(loadTheme(createStorage()), "system");
});

test("persists explicit light, dark, and system selections", () => {
  const storage = createStorage();
  for (const theme of ["light", "dark", "system"] as const) {
    saveTheme(storage, theme);
    assert.equal(loadTheme(storage), theme);
  }
});

test("resolves system changes while explicit themes remain stable", () => {
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("switching light to dark to light removes stale root theme state", () => {
  const classes = new Set(["dark", "light"]);
  const root = {
    classList: {
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
    },
    dataset: { theme: "dark" },
    style: { colorScheme: "dark" },
  };

  applyThemeToRoot(root, "light");
  applyThemeToRoot(root, "dark");
  applyThemeToRoot(root, "light");

  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");
  assert.deepEqual([...classes], []);
});

test("representative navigation, text, and controls use paired semantic tokens", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  for (const token of [
    "--background",
    "--foreground",
    "--surface",
    "--border",
    "--input-background",
    "--selected-navigation",
    "--button-primary-bg",
    "--button-primary-text",
    "--button-primary-disabled-bg",
    "--button-primary-disabled-text",
  ]) {
    assert.match(css, new RegExp(`:root[\\s\\S]*${token}:`));
    assert.match(css, new RegExp(`html\\[data-theme="dark"\\][\\s\\S]*${token}:`));
  }
  for (const semanticClass of [
    "app-shell",
    "app-surface",
    "app-nav-item",
    "app-input",
    "app-button-primary",
    "app-empty-state",
  ]) {
    assert.match(page, new RegExp(semanticClass));
  }
});

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("enabled and disabled primary buttons remain readable in both themes", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const lightBlock = css.slice(css.indexOf(":root {"), css.indexOf("html[data-theme=\"dark\"]"));
  const darkStart = css.indexOf("html[data-theme=\"dark\"]");
  const darkBlock = css.slice(darkStart, css.indexOf("@theme", darkStart));
  const token = (block: string, name: string) => {
    const value = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    assert.ok(value, `Missing ${name}`);
    return value;
  };

  for (const block of [lightBlock, darkBlock]) {
    assert.ok(contrastRatio(token(block, "--button-primary-bg"), token(block, "--button-primary-text")) >= 4.5);
    assert.ok(contrastRatio(token(block, "--button-primary-disabled-bg"), token(block, "--button-primary-disabled-text")) >= 4.5);
  }
});

test("switching dark to light to dark also clears stale root state", () => {
  const classes = new Set(["dark", "light"]);
  const root = {
    classList: { remove: (...names: string[]) => names.forEach((name) => classes.delete(name)) },
    dataset: { theme: "light" },
    style: { colorScheme: "light" },
  };
  applyThemeToRoot(root, "dark");
  applyThemeToRoot(root, "light");
  applyThemeToRoot(root, "dark");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(root.style.colorScheme, "dark");
  assert.deepEqual([...classes], []);
});

test("Dashboard and Store Management expose only their contextual primary action", () => {
  assert.deepEqual(primaryNavigationState("dashboard"), {
    dashboardActive: true,
    storesActive: false,
    showStoreManagementAction: false,
  });
  assert.deepEqual(primaryNavigationState("stores"), {
    dashboardActive: false,
    storesActive: true,
    showStoreManagementAction: true,
  });
});
