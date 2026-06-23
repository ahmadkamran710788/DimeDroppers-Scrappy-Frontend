import { cn } from "@/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

function Input({ error, label, className = "", id, ...props }: InputProps) {
  return (
    <div className="w-full space-y-2 text-left">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-black dark:text-zinc-100"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full rounded-lg border border-neutral-300 px-4 py-3 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black dark:bg-neutral-900 dark:text-zinc-100",
          error ? "border-red-500 focus:ring-red-500" : "",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default Input;
