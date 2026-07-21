import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "./header";
import { usePathname } from "next/navigation";
import { LABELS } from "@/lib/copy";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: () => ({
    push: jest.fn(),
  }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("Header", () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("renders primary navigation links", () => {
    render(<Header />);
    expect(screen.getByText(LABELS.DASHBOARD)).toBeInTheDocument();
    expect(screen.getByText(LABELS.CHATS)).toBeInTheDocument();
    expect(screen.getByText(LABELS.STORES)).toBeInTheDocument();
  });

  it("marks the active navigation link", () => {
    (usePathname as jest.Mock).mockReturnValue("/chats");
    render(<Header />);
    const activeLink = screen.getByText(LABELS.CHATS);
    expect(activeLink).toHaveClass("font-semibold");
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("renders the global search input with a keyboard shortcut hint", () => {
    render(<Header />);
    const searchInput = screen.getByPlaceholderText(LABELS.GLOBAL_SEARCH_PLACEHOLDER);
    expect(searchInput).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("focuses search input on '/' key press", () => {
    render(<Header />);
    const searchInput = screen.getByPlaceholderText(LABELS.GLOBAL_SEARCH_PLACEHOLDER);
    fireEvent.keyDown(document, { key: "/" });
    expect(searchInput).toHaveFocus();
  });

  it("does not focus search input on '/' key press when typing in another input", () => {
    render(
      <div>
        <Header />
        <input data-testid="another-input" />
      </div>,
    );
    const searchInput = screen.getByPlaceholderText(LABELS.GLOBAL_SEARCH_PLACEHOLDER);
    const anotherInput = screen.getByTestId("another-input");

    anotherInput.focus();
    fireEvent.keyDown(anotherInput, { key: "/" });

    expect(searchInput).not.toHaveFocus();
  });

  it("renders user and settings menus", () => {
    render(<Header />);
    expect(screen.getByLabelText("Display Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("User Menu")).toBeInTheDocument();
  });

  it("does not render chat layout reset button on dashboard", () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    render(<Header />);
    expect(screen.queryByLabelText(LABELS.RESET_COLUMN_SIZES)).not.toBeInTheDocument();
  });

  it("renders chat layout reset button only on chats page", () => {
    (usePathname as jest.Mock).mockReturnValue("/chats/123");
    render(<Header />);
    expect(screen.getByLabelText(LABELS.RESET_COLUMN_SIZES)).toBeInTheDocument();
  });
});