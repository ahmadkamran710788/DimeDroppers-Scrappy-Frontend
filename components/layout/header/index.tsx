"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/utils/routes";
import { cn } from "@/utils/cn";

const LINKS = [
  { href: routes.ui.indexRoute, label: "MaxPreps (High Schools)" },
  { href: routes.ui.middleSchools, label: "GoFan (Middle Schools)" },
];

function Header() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-6 py-3">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-black text-white dark:bg-zinc-100 dark:text-black"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default Header;
