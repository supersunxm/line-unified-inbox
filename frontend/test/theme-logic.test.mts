import assert from "node:assert/strict";
import test from "node:test";
import {
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
