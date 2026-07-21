"use client";

import { useRef } from "react";
import { CHAT_PANE_LIMITS } from "./resizable-panes";
import type { ChatSeparator } from "./resizable-panes";

export function ResizableSeparator({ separator, value, minimum, maximum, onResize }: { separator: ChatSeparator; value: number; minimum: number; maximum: number; onResize: (separator: ChatSeparator, delta: number) => void }) {
  const previousX = useRef(0);

  function stopDragging(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.removeAttribute("data-dragging");
    document.body.classList.remove("is-resizing-panes");
  }

  return <div
    role="separator"
    aria-label={separator === "sidebar" ? "Resize store sidebar" : "Resize conversation list"}
    aria-orientation="vertical"
    aria-valuemin={minimum}
    aria-valuemax={maximum}
    aria-valuenow={Math.round(value)}
    tabIndex={0}
    className="chat-resize-handle"
    onPointerDown={(event) => {
      event.preventDefault(); event.stopPropagation();
      previousX.current = event.clientX;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.setAttribute("data-dragging", "true");
      document.body.classList.add("is-resizing-panes");
    }}
    onPointerMove={(event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const delta = event.clientX - previousX.current;
      previousX.current = event.clientX;
      if (delta) onResize(separator, delta);
    }}
    onPointerUp={stopDragging}
    onPointerCancel={stopDragging}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      onResize(separator, event.key === "ArrowLeft" ? -CHAT_PANE_LIMITS.keyboardStep : CHAT_PANE_LIMITS.keyboardStep);
    }}
  ><span aria-hidden="true" /></div>;
}
