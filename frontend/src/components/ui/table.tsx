"use client";

import React, { forwardRef } from "react";

export const TableContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function TableContainer({ className = "", children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`w-full overflow-x-auto rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-card)] ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

export const Table = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  function Table({ className = "", children, ...rest }, ref) {
    return (
      <table ref={ref} className={`min-w-full text-left text-xs ${className}`} {...rest}>
        {children}
      </table>
    );
  }
);

export function TableHeader({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-[var(--app-surface-subtle)] border-b border-[var(--app-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)] select-none ${className}`}
      {...rest}
    >
      {children}
    </thead>
  );
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
}

export function TableHead({
  align = "left",
  className = "",
  children,
  ...rest
}: TableHeadProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  return (
    <th className={`px-4 py-3 font-semibold ${alignClass} ${className}`} {...rest}>
      {children}
    </th>
  );
}

export function TableBody({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[var(--app-border-subtle)] text-[var(--app-text-primary)] ${className}`} {...rest}>
      {children}
    </tbody>
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
  isClickable?: boolean;
}

export function TableRow({
  isSelected = false,
  isClickable = false,
  className = "",
  children,
  ...rest
}: TableRowProps) {
  const selectedClass = isSelected
    ? "bg-[var(--app-surface-active)]"
    : "hover:bg-[var(--app-surface-hover)]";
  const cursorClass = isClickable ? "cursor-pointer" : "";

  return (
    <tr
      className={`transition-colors duration-120 ${selectedClass} ${cursorClass} ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  numeric?: boolean;
}

export function TableCell({
  align = "left",
  numeric = false,
  className = "",
  children,
  ...rest
}: TableCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];
  const numericClass = numeric ? "font-tabular" : "";

  return (
    <td className={`px-4 py-3 text-xs ${alignClass} ${numericClass} ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function TableEmptyState({
  colSpan,
  message = "ไม่พบข้อมูล",
  className = "",
}: {
  colSpan: number;
  message?: string;
  className?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`px-4 py-12 text-center text-xs text-[var(--app-text-secondary)] ${className}`}
      >
        <p>{message}</p>
      </td>
    </tr>
  );
}
