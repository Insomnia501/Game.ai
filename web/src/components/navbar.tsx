"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const NAV_ITEMS = [
  { label: "AI 咨询", href: "/ai" },
  { label: "创作者贡献", href: "/creator" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 font-semibold">
            G
          </div>
          <div>
            <span className="text-lg font-semibold">GAME.ai</span>
            <p className="text-xs text-white/60 hidden sm:block">
              游戏社区 AI 代理
            </p>
          </div>
        </Link>

        <nav className="hidden gap-6 text-sm font-medium text-white/70 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "transition hover:text-white",
                pathname === item.href && "text-white"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <ConnectWalletButton />
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-white/10 p-2 text-white hover:bg-white/10 md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="菜单"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-black/80 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-white/80">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "transition hover:text-white",
                  pathname === item.href && "text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
            <ConnectWalletButton />
          </nav>
        </div>
      )}
    </header>
  );
}
