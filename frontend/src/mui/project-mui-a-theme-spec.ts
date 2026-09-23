/**
 * Project MUI A — design contract.
 *
 * This file intentionally has no @mui imports yet. It gives the MUI migration
 * a stable mapping to the app's existing semantic CSS tokens before the
 * runtime provider is introduced.
 *
 * Runtime impact: none until imported by the MUI provider.
 */

export const projectMuiAThemeSpec = {
  typography: {
    fontFamily:
      'var(--font-geist-sans), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    buttonTextTransform: "none",
  },
  shape: {
    radiusSm: "var(--app-radius-sm)",
    radiusMd: "var(--app-radius-md)",
    radiusLg: "var(--app-radius-lg)",
    radiusXl: "var(--app-radius-xl)",
  },
  palette: {
    background: {
      default: "var(--app-bg)",
      paper: "var(--app-surface)",
      subtle: "var(--app-surface-subtle)",
      hover: "var(--app-surface-hover)",
      active: "var(--app-surface-active)",
    },
    text: {
      primary: "var(--app-text-primary)",
      secondary: "var(--app-text-secondary)",
      tertiary: "var(--app-text-tertiary)",
      disabled: "var(--app-text-disabled)",
    },
    primary: {
      main: "var(--app-accent)",
      hover: "var(--app-accent-hover)",
      soft: "var(--app-accent-soft)",
      contrastText: "var(--app-accent-contrast)",
    },
    success: {
      main: "var(--app-success)",
      soft: "var(--app-success-soft)",
    },
    warning: {
      main: "var(--app-warning)",
      soft: "var(--app-warning-soft)",
    },
    error: {
      main: "var(--app-danger)",
      soft: "var(--app-danger-soft)",
    },
    info: {
      main: "var(--app-info)",
      soft: "var(--app-info-soft)",
    },
    divider: "var(--app-border)",
  },
  elevation: {
    card: "var(--app-shadow-card)",
    elevated: "var(--app-shadow-elevated)",
    modal: "var(--app-shadow-modal)",
  },
} as const;

export type ProjectMuiAThemeSpec = typeof projectMuiAThemeSpec;
