"use client";

import { createTheme } from "@mui/material/styles";
import { projectMuiAThemeSpec } from "./project-mui-a-theme-spec";

/**
 * Project MUI A theme.
 *
 * Keep the canonical application colors in CSS variables. Static palette
 * fallbacks exist for MUI internals, while component overrides reference the
 * existing semantic tokens so light/dark mode remains owned by the current app.
 */
export const projectMuiATheme = createTheme({
  palette: {
    primary: {
      main: "#00a651",
      dark: "#008f46",
      contrastText: "#ffffff",
    },
    success: { main: "#34c759" },
    warning: { main: "#ff9500" },
    error: { main: "#ff3b30" },
    info: { main: "#007aff" },
    background: {
      default: "#f5f5f7",
      paper: "#ffffff",
    },
    text: {
      primary: "#1d1d1f",
      secondary: "#6e6e73",
      disabled: "#c7c7cc",
    },
    divider: "#e5e5ea",
  },
  typography: {
    fontFamily: projectMuiAThemeSpec.typography.fontFamily,
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: "var(--app-radius-md)",
          textTransform: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "var(--app-radius-xl)",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text-primary)",
          boxShadow: "var(--app-shadow-modal)",
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text-primary)",
          boxShadow: "var(--app-shadow-elevated)",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: "var(--app-radius-sm)",
          fontSize: "0.75rem",
        },
      },
    },
  },
});

export default projectMuiATheme;
