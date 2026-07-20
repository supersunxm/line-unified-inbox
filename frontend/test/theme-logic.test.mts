import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
    "--button-background",
    "--button-foreground",
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
