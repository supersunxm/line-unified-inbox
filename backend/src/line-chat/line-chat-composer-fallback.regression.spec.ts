import { describe, expect, it } from "vitest";
import { findSoleManagerTextarea } from "./line-chat-composer-fallback";

type FakeTextarea = {
  count: () => Promise<number>;
  first: () => FakeTextarea;
  evaluate: <T>(fn: (element: HTMLTextAreaElement) => T) => Promise<T>;
  isEditable: () => Promise<boolean>;
};

function fakeFrame(options: { editable: boolean; placeholder?: string; ariaLabel?: string }) {
  const element = {
    getAttribute(name: string) {
      if (name === "placeholder") return options.placeholder ?? "Message";
      if (name === "aria-label") return options.ariaLabel ?? "";
      return null;
    },
  } as HTMLTextAreaElement;

  const textarea: FakeTextarea = {
    count: async () => 1,
    first: () => textarea,
    evaluate: async <T>(fn: (el: HTMLTextAreaElement) => T) => fn(element),
    isEditable: async () => options.editable,
  };

  return {
    locator: (selector: string) => {
      expect(selector).toBe("textarea");
      return textarea;
    },
  } as never;
}

describe("findSoleManagerTextarea", () => {
  it("returns the sole non-search textarea when LINE Manager exposes it as editable", async () => {
    const result = await findSoleManagerTextarea(fakeFrame({ editable: true }));
    expect(result).not.toBeNull();
  });

  it("does not force-enable a disabled or readonly textarea", async () => {
    const result = await findSoleManagerTextarea(fakeFrame({ editable: false }));
    expect(result).toBeNull();
  });

  it("rejects search textareas", async () => {
    const result = await findSoleManagerTextarea(fakeFrame({ editable: true, placeholder: "Search" }));
    expect(result).toBeNull();
  });
});
