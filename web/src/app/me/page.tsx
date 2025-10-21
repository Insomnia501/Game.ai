"use client";

import { useMemo, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  DIVIDEND_POOL_ADDRESS,
  INFERENCE_PAYMENT_ADDRESS,
  VIRTUAL_TOKEN_ADDRESS,
  VIRTUAL_TOKEN_DECIMALS,
} from "@/lib/config";
import { Loader2, RefreshCcw } from "lucide-react";
import clsx from "clsx";
import { parseUnits } from "viem";

const erc20Abi = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "success", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const dividendPoolAbi = [
  {
    inputs: [],
    name: "claimDividend",
    outputs: [
      {
        internalType: "uint256",
        name: "claimable",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type SubscriptionStatus = {
  isActive: boolean;
  expiresAt: number | null;
  daysRemaining: number;
  transactionHash: string | null;
  startedAt: number | null;
};

type DividendInfo = {
  dividend: {
    pending: { virtual: string };
    claimed: { virtual: string };
    totalEarnable: { virtual: string };
  };
};

export default function MePage() {
  const { address, status } = useAccount();
  const connected = status === "connected" && !!address;

  const [subscriptionTxHash, setSubscriptionTxHash] = useState<
    `0x${string}` | undefined
  >(undefined);
  const [claimTxHash, setClaimTxHash] =
    useState<`0x${string}` | undefined>(undefined);

  const {
    data: subscriptionStatus,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription", address],
    enabled: connected,
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/subscription/status?address=${address}`
      );
      if (!response.ok) {
        throw new Error("无法获取订阅信息");
      }
      return (await response.json()) as SubscriptionStatus;
    },
    retry: false,
  });

  const {
    data: dividendInfo,
    isLoading: dividendLoading,
    refetch: refetchDividend,
  } = useQuery<DividendInfo>({
    queryKey: ["dividend", address],
    enabled: connected,
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/dividend/balance?userAddress=${address}`
      );
      if (!response.ok) {
        throw new Error("无法获取分红信息");
      }
      return (await response.json()) as DividendInfo;
    },
    retry: false,
  });

  const { writeContractAsync: tokenTransferAsync, data: subscribeHash } =
    useWriteContract();
  const { writeContractAsync: claimAsync, data: claimHash } = useWriteContract();

  const {
    isLoading: subscribeWaiting,
    isSuccess: subscribeSuccess,
    isError: subscribeError,
  } = useWaitForTransactionReceipt({
    hash: subscriptionTxHash || subscribeHash,
    chainId: undefined,
  });

  const {
    isLoading: claimWaiting,
    isSuccess: claimSuccess,
    isError: claimError,
  } = useWaitForTransactionReceipt({
    hash: claimTxHash || claimHash,
    chainId: undefined,
  });

  const pendingDividend = useMemo(() => {
    if (!dividendInfo?.dividend?.pending?.virtual) return "0";
    return dividendInfo.dividend.pending.virtual;
  }, [dividendInfo]);

  const handleSubscribe = async () => {
    if (!address) return;
    if (!INFERENCE_PAYMENT_ADDRESS) {
      alert("请在 .env.local 中配置 NEXT_PUBLIC_INFERENCE_PAYMENT_ADDRESS。");
      return;
    }
    if (!VIRTUAL_TOKEN_ADDRESS) {
      alert("请在 .env.local 中配置 NEXT_PUBLIC_VIRTUAL_TOKEN_ADDRESS。");
      return;
    }
    try {
      const hash = await tokenTransferAsync({
        abi: erc20Abi,
        functionName: "transfer",
        address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
        args: [
          INFERENCE_PAYMENT_ADDRESS as `0x${string}`,
          parseUnits("10", VIRTUAL_TOKEN_DECIMALS),
        ],
      });
      setSubscriptionTxHash(hash);
      await waitForHash(hash);
      const backendResponse = await fetch(`${API_BASE_URL}/api/subscription/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          transactionHash: hash,
          amount: "10",
        }),
      });
      if (!backendResponse.ok) {
        console.warn("订阅同步失败", await backendResponse.text());
      }
      await refetchSubscription();
    } catch (error) {
      console.error(error);
      alert("订阅交易失败，请稍后重试。");
    }
  };

  const handleClaim = async () => {
    if (!address) return;
    if (!DIVIDEND_POOL_ADDRESS) {
      alert("请在 .env.local 中配置 NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS。");
      return;
    }
    if (Number.parseFloat(pendingDividend) <= 0) {
      alert("暂无可提取分红。");
      return;
    }
    try {
      const hash = await claimAsync({
        abi: dividendPoolAbi,
        functionName: "claimDividend",
        address: DIVIDEND_POOL_ADDRESS as `0x${string}`,
      });
      setClaimTxHash(hash);
      await waitForHash(hash);
      const backendResponse = await fetch(`${API_BASE_URL}/api/dividend/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          transactionHash: hash,
        }),
      });
      if (!backendResponse.ok) {
        console.warn("分红记录保存失败", await backendResponse.text());
      }
      await refetchDividend();
    } catch (error) {
      console.error(error);
      alert("领取分红失败，请稍后重试。");
    }
  };

  const renderStatus = () => {
    if (!connected) {
      return (
        <p className="text-sm text-white/60">
          请连接钱包后查看订阅与分红信息。
        </p>
      );
    }
    if (subscriptionLoading) {
      return (
        <p className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
          正在加载订阅状态...
        </p>
      );
    }
    if (!subscriptionStatus) {
      return (
        <p className="text-sm text-white/60">
          暂无订阅记录，点击下方按钮开通服务。
        </p>
      );
    }
    return (
      <div className="space-y-2 text-sm text-white/80">
        <p>
          状态：
          {subscriptionStatus.isActive ? (
            <span className="text-emerald-300"> 已激活</span>
          ) : (
            <span className="text-amber-300"> 已过期</span>
          )}
        </p>
        {subscriptionStatus.expiresAt && (
          <p>
            到期时间：
            {new Date(subscriptionStatus.expiresAt * 1000).toLocaleString(
              "zh-CN",
              { hour12: false }
            )}
          </p>
        )}
        <p>剩余天数：{subscriptionStatus.daysRemaining} 天</p>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">订阅状态</h2>
          <button
            onClick={() => refetchSubscription()}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:text-white"
          >
            <RefreshCcw className="h-3 w-3" />
            刷新
          </button>
        </div>
        <p className="mt-2 text-sm text-white/60">
          包月价格：10 $VIRTUAL · 激活后可在 /ai 发起无限制对话。
        </p>
        <div className="mt-6 rounded-2xl border border-white/5 bg-black/30 p-4">
          {renderStatus()}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleSubscribe}
            disabled={
              !connected ||
              subscribeWaiting ||
              !INFERENCE_PAYMENT_ADDRESS ||
              subscriptionLoading
            }
            className={clsx(
              "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400",
              (!connected || subscribeWaiting || !INFERENCE_PAYMENT_ADDRESS) &&
                "cursor-not-allowed opacity-60"
            )}
          >
            {subscribeWaiting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                等待链上确认...
              </>
            ) : (
              "立即订阅 / 续费"
            )}
          </button>
          {subscribeSuccess && (
            <span className="text-xs text-emerald-300">
              订阅交易已确认，后台正在同步状态。
            </span>
          )}
          {subscribeError && (
            <span className="text-xs text-amber-300">
              订阅交易失败，请稍后重试。
            </span>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">分红中心</h2>
          <button
            onClick={() => refetchDividend()}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:text-white"
          >
            <RefreshCcw className="h-3 w-3" />
            刷新
          </button>
        </div>
        <p className="mt-2 text-sm text-white/60">
          订阅收入的 70% 将进入分红池，根据持仓实时累积可提取金额。
        </p>

        <div className="mt-6 grid gap-3 rounded-2xl border border-white/5 bg-black/30 p-4 text-sm text-white">
          {dividendLoading ? (
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
              正在加载分红信息...
            </p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-white/50">
                可提取分红
              </p>
              <p className="text-3xl font-semibold text-white">
                {Number.parseFloat(pendingDividend).toFixed(4)} $VIRTUAL
              </p>
              <p className="text-xs text-white/50">
                请确保已持有 $GAME 代币且满足分红条件。
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleClaim}
            disabled={
              !connected ||
              claimWaiting ||
              !DIVIDEND_POOL_ADDRESS ||
              Number.parseFloat(pendingDividend) <= 0
            }
            className={clsx(
              "inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20",
              (!connected ||
                claimWaiting ||
                !DIVIDEND_POOL_ADDRESS ||
                Number.parseFloat(pendingDividend) <= 0) &&
                "cursor-not-allowed opacity-60"
            )}
          >
            {claimWaiting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                链上领取中...
              </>
            ) : (
              "立即 Claim"
            )}
          </button>
          {claimSuccess && (
            <span className="text-xs text-emerald-300">
              分红已领取，稍后在钱包中查看余额。
            </span>
          )}
          {claimError && (
            <span className="text-xs text-amber-300">
              领取失败，请确认分红金额后重试。
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

async function waitForHash(hash: `0x${string}`) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/utils/wait-for-receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionHash: hash }),
    });
    if (!response.ok) {
      return;
    }
  } catch (error) {
    console.warn("wait-for-receipt helper unavailable:", error);
  }
}
