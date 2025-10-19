"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { useAccount } from "wagmi";
import { Loader2, X } from "lucide-react";
import clsx from "clsx";

type UploadState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; contentId: string; txHash?: string | null }
  | { status: "error"; error: string };

export default function CreatorPage() {
  const { address, status } = useAccount();
  const connected = status === "connected" && !!address;

  const [isOpen, setIsOpen] = useState(true);
  const [gameTitle, setGameTitle] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [state, setState] = useState<UploadState>({ status: "idle" });

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const tagList = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !address) {
      setState({ status: "error", error: "请先连接钱包后再投稿。" });
      return;
    }
    if (!gameTitle.trim() || !title.trim() || !content.trim()) {
      setState({ status: "error", error: "请完整填写必填项。" });
      return;
    }
    if (content.trim().length > 50000) {
      setState({
        status: "error",
        error: "内容长度超出限制（最多 50,000 字符）。",
      });
      return;
    }

    setState({ status: "submitting" });
    try {
      const response = await fetch(`${API_BASE_URL}/api/content/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: address,
          gameTitle: gameTitle.trim(),
          title: title.trim(),
          content: content.trim(),
          tags: tagList,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "上传失败，请稍后重试。");
      }

      const data = await response.json();
      setState({
        status: "success",
        contentId: data.contentId,
        txHash: data.rewardTxHash,
      });
      setContent("");
      setTags("");
      setTitle("");
      setGameTitle("");
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "上传失败，请稍后重试。",
      });
    }
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 text-white">
        <h1 className="text-2xl font-semibold">创作者贡献中心</h1>
        <p className="mt-2 text-sm text-white/60">
          点击下方按钮打开创作者投稿弹窗。填写攻略后即可自动领取 1
          $GAME，成功记录将同步到知识库。
        </p>
        <button
          onClick={() => setIsOpen(true)}
          className="mt-6 inline-flex items-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2 text-sm font-semibold shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400"
        >
          打开投稿弹窗
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-md">
          <div className="relative w-full max-w-3xl rounded-3xl border border-white/15 bg-[#10021f] p-6 text-white shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-full border border-white/10 p-1 text-white/70 hover:text-white"
              aria-label="关闭弹窗"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-xl font-semibold">上传游戏攻略</h2>
            <p className="mt-2 text-sm text-white/60">
              上传文本后系统会自动审核并同步到知识库。成功提交即可获得 1
              $GAME 代币奖励。
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4 text-sm text-white"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    游戏名称 *
                  </span>
                  <input
                    value={gameTitle}
                    onChange={(event) => setGameTitle(event.target.value)}
                    placeholder="Elden Ring / 原神 / DOTA2 ..."
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    攻略标题 *
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="玛尔基特 无名女王打法"
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-white/60">
                  标签（用逗号分隔，可选）
                </span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="boss, 策略, PVP"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-white/60">
                  攻略正文（最多 50,000 字符）*
                </span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={10}
                  placeholder="详细描述你的攻略思路、装备、站位、技能释放顺序等内容..."
                  className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
                />
              </label>

              {state.status === "error" && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {state.error}
                </p>
              )}

              {state.status === "success" && (
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-200">
                  <p>上传成功！内容 ID：{state.contentId}</p>
                  {state.txHash && (
                    <p className="mt-1">
                      奖励交易哈希：{" "}
                      <a
                        href={`https://sepolia.basescan.org/tx/${state.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-dotted underline-offset-4"
                      >
                        {state.txHash.slice(0, 10)}...
                      </a>
                    </p>
                  )}
                  {!state.txHash && (
                    <p className="mt-1">
                      代币奖励正在发放中，请稍后在钱包中确认。
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/40 hover:text-white"
                >
                  稍后再说
                </button>
                <button
                  type="submit"
                  disabled={state.status === "submitting"}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400",
                    state.status === "submitting" &&
                      "cursor-not-allowed opacity-60"
                  )}
                >
                  {state.status === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    "确认上传并领取 1 $GAME"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
