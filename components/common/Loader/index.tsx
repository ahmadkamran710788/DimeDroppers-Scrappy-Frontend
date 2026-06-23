import { cn } from "@/utils/cn";

interface LoaderProps {
  size?: "sm" | "md";
  className?: string;
}

const DOT_SIZE = {
  sm: "h-1.5 w-1.5",
  md: "h-2.5 w-2.5",
};

function Loader({ size = "md", className }: LoaderProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="status"
      aria-label="Loading"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "animate-bounce rounded-full bg-current",
            DOT_SIZE[size]
          )}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default Loader;
