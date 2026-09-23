"use client";

import type { ReactNode } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { projectMuiATheme } from "./project-mui-a-theme";

export function ProjectMuiAProvider({ children }: { children: ReactNode }) {
  return <MuiThemeProvider theme={projectMuiATheme}>{children}</MuiThemeProvider>;
}
