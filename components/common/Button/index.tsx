"use client";

import { cn } from "@/utils/cn";
import Loader from "@/components/common/Loader";

type ButtonVariant = "primary" | "secondary" | "outline" | "disabled";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-black text-white hover:bg-neutral-800",
  secondary: "bg-red-600 text-white hover:bg-red-700",
  outline:
    "border border-neutral-300 bg-white text-black hover:bg-neutral-100",
  disabled: "bg-neutral-200 text-neutral-400",
};

function Button({
  variant = "primary",
  isLoading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading || variant === "disabled";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_STYLES[variant],
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {isLoading && <Loader size="sm" />}
      {children}
    </button>
  );
}

export default Button;
