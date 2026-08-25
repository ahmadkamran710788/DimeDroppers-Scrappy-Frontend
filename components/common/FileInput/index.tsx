"use client";

import { useRef } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import Button from "@/components/common/Button";
import { cn } from "@/utils/cn";

interface FileInputProps {
  label?: string;
  error?: string;
  accept?: string;
  file: File | null;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function FileInput({
  label,
  error,
  accept = ".csv",
  file,
  disabled = false,
  onSelect,
}: FileInputProps) {
  // The native input stays hidden: it can't be styled, and clearing a selection
  // requires resetting its value so re-picking the same file still fires onChange.
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    if (inputRef.current) inputRef.current.value = "";
    onSelect(null);
  };

  return (
    <div className="w-full space-y-2 text-left">
      {label && (
        <span className="block text-sm font-medium text-black dark:text-zinc-100">
          {label}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />

      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed border-neutral-300 px-4 py-3 dark:border-neutral-700",
          error ? "border-red-500" : "",
          disabled ? "opacity-60" : ""
        )}
      >
        {file ? (
          <>
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-black dark:text-zinc-100">
                {file.name}
              </p>
              <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label="Remove file"
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed dark:hover:bg-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 shrink-0 text-neutral-400" />
            <p className="flex-1 text-sm text-neutral-500">
              No file selected — choose a {accept} file
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="px-4 py-2"
              onClick={() => inputRef.current?.click()}
            >
              Browse
            </Button>
          </>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default FileInput;
