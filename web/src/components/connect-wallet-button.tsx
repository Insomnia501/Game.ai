"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { LogOut, User } from "lucide-react";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, status } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();

  const isConnected = status === "connected" && !!address;

  const handleConnect = useCallback(() => {
    connect({ connector: injected({ shimDisconnect: true }) });
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const label = useMemo(() => {
    if (isConnecting) {
      return "连接中...";
    }
    if (isDisconnecting) {
      return "断开中...";
    }
    if (isConnected && address) {
      return truncateAddress(address);
    }
    return "连接钱包";
  }, [isConnecting, isDisconnecting, isConnected, address]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/me"
          className="inline-flex items-center gap-2 rounded-full border border-violet-400/50 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-white transition hover:border-violet-300 hover:bg-violet-500/20"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-semibold text-white">
            <User className="h-4 w-4" />
          </span>
          {truncateAddress(address)}
        </Link>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-3 w-3" />
          {isDisconnecting ? "断开中..." : "断开"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
    >
      {label}
    </button>
  );
}
