"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  searchable?: boolean;
  className?: string;
}

function Select({
  options,
  value,
  onChange,
  label,
  placeholder = "Select...",
  error,
  searchable = true,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const filtered = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label);

  return (
    <div className="w-full space-y-2 text-left" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-black dark:text-zinc-100">
          {label}
        </label>
      )}
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 px-4 py-3 text-left text-sm text-black focus:outline-none focus:ring-1 focus:ring-black dark:bg-neutral-900 dark:text-zinc-100",
            error ? "border-red-500" : ""
          )}
        >
          <span
            className={cn(
              "truncate",
              selectedLabels.length === 0 && "text-neutral-400"
            )}
          >
            {selectedLabels.length === 0
              ? placeholder
              : selectedLabels.length <= 3
              ? selectedLabels.join(", ")
              : `${selectedLabels.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
        </button>

        {open && (
          <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {searchable && (
              <div className="sticky top-0 bg-white p-2 dark:bg-neutral-900">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:outline-none dark:bg-neutral-800 dark:text-zinc-100"
                />
              </div>
            )}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-neutral-400">No matches</p>
            )}
            {filtered.map((o) => {
              const selected = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    selected && "font-medium"
                  )}
                >
                  <span>{o.label}</span>
                  {selected && <Check className="h-4 w-4 text-black dark:text-white" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {options
            .filter((o) => value.includes(o.value))
            .map((o) => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                {o.label}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => toggle(o.value)}
                />
              </span>
            ))}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default Select;
