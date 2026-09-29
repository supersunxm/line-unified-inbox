"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

export function StoreChatsOverflowMenu({ language, resetPaneSizes }: { language: "th" | "en" | "zh"; resetPaneSizes: () => void }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorEl);
  const label = language === "th" ? "ตัวเลือกแชทร้านค้า" : language === "zh" ? "门店聊天选项" : "Store Chats options";
  const resetLabel = language === "th" ? "รีเซ็ตขนาดหน้าต่าง" : language === "zh" ? "重置面板大小" : "Reset pane sizes";

  const closeMenu = () => setAnchorEl(null);

  return (
    <>
      <IconButton
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        size="small"
        sx={{
          width: 36,
          height: 36,
          border: "1px solid var(--app-border)",
          borderRadius: "var(--app-radius-md)",
          color: "var(--app-text-secondary)",
          backgroundColor: "var(--app-surface)",
          "&:hover": {
            color: "var(--app-text-primary)",
            backgroundColor: "var(--app-surface-hover)",
          },
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "1.1rem", lineHeight: 1 }}>⋯</span>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={closeMenu}
        MenuListProps={{ "aria-label": label, dense: true }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 192,
              border: "1px solid var(--app-border)",
              borderRadius: "var(--app-radius-lg)",
              color: "var(--app-text-primary)",
              backgroundColor: "var(--app-surface)",
              boxShadow: "var(--app-shadow-elevated)",
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            resetPaneSizes();
            closeMenu();
          }}
          sx={{
            mx: 0.5,
            my: 0.25,
            minHeight: 36,
            borderRadius: "var(--app-radius-md)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: "var(--app-surface-hover)",
            },
          }}
        >
          {resetLabel}
        </MenuItem>
      </Menu>
    </>
  );
}
