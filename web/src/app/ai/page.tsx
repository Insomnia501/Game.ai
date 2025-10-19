"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { API_BASE_URL } from "@/lib/config";
import { ArrowUp, Loader2, MessageCircle, Plus } from "lucide-react";
import clsx from "clsx";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

type ChatResponse = {
  answer: string;
  conversationId: string;
  messageId: string;
  subscriptionStatus?: {
    isActive: boolean;
    daysRemaining?: number;
  };
};

const STORAGE_KEY_PREFIX = "game-ai-chat-history";

export default function AiChatPage() {
  const { address, status } = useAccount();
  const connected = status === "connected" && !!address;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionInactive, setSubscriptionInactive] = useState(false);

  const storageKey = useMemo(() => {
    if (!address) return null;
    return `${STORAGE_KEY_PREFIX}-${address.toLowerCase()}`;
  }, [address]);

  useEffect(() => {
    if (!storageKey) {
      setHistory([]);
      setMessages([]);
      setConversationId(null);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        setHistory(parsed);
        if (parsed.length > 0) {
          const latest = parsed[0];
          setConversationId(latest.id);
          setMessages(latest.messages);
        }
      } else {
        setHistory([]);
        setMessages([]);
        setConversationId(null);
      }
    } catch {
      setHistory([]);
      setMessages([]);
      setConversationId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(history));
    }
  }, [history, storageKey]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!connected || !address) {
      setError("请先连接钱包再提问。");
      return;
    }
    if (!input.trim()) {
      return;
    }
    setError(null);
    setSubscriptionInactive(false);
    setIsSending(true);
    const userMessage: ChatMessage = {
      id: `${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/inference/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: address,
          question: input.trim(),
          conversationId,
        }),
      });

      if (response.status === 403) {
        setSubscriptionInactive(true);
        setError("订阅已失效，请前往个人中心续费后再试。");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "发送失败，请稍后重试。");
      }

      const data = (await response.json()) as ChatResponse;
      const aiMessage: ChatMessage = {
        id: data.messageId,
        role: "assistant",
        content: data.answer,
      };

      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, aiMessage]);

      const updatedHistory = updateHistory({
        history,
        newMessage: aiMessage,
        userMessage,
        conversationId: data.conversationId,
      });
      setHistory(updatedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试。");
    } finally {
      setIsSending(false);
      setInput("");
    }
  };

  const handleSelectConversation = (id: string) => {
    setConversationId(id);
    const conversation = history.find((c) => c.id === id);
    setMessages(conversation ? conversation.messages : []);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setSubscriptionInactive(false);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <aside className="hidden flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:flex">
        <button
          type="button"
          onClick={handleNewConversation}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400"
        >
          <Plus className="h-4 w-4" />
          新建对话
        </button>
        <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
          {history.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">
              暂无历史对话。开始提问，系统会自动保存最近的 20 条对话。
            </p>
          )}
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectConversation(item.id)}
              className={clsx(
                "flex w-full flex-col gap-1 rounded-xl border border-transparent px-3 py-2 text-left text-sm transition hover:border-white/20 hover:bg-white/10",
                item.id === conversationId && "border-violet-400/60 bg-white/10"
              )}
            >
              <span className="line-clamp-1 font-medium text-white/90">
                {item.title}
              </span>
              <span className="text-xs text-white/50">
                {new Date(item.updatedAt).toLocaleString("zh-CN", {
                  hour12: false,
                })}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-col rounded-3xl border border-white/10 bg-white/5">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-white/70 sm:px-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-violet-300" />
            <span>AI 游戏咨询</span>
          </div>
          {connected ? (
            <span className="text-xs text-emerald-300">
              已连接：{address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          ) : (
            <span className="text-xs text-amber-300">
              请连接钱包以使用完整功能
            </span>
          )}
        </header>

        {subscriptionInactive && (
          <div className="border-b border-white/10 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:px-6">
            订阅无效：请前往个人中心 /me 续费后再试。
          </div>
        )}

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-white/60">
              连接钱包后输入你的游戏问题，例如：
              <br />
              “艾尔登法环 玛尔基特应该如何破防？”
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={clsx(
                  "max-w-full rounded-2xl px-4 py-3 text-sm sm:max-w-[70%]",
                  message.role === "user"
                    ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white"
                    : "bg-black/40 text-white/90"
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-black/30 px-4 py-3 text-sm text-white/80">
                <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                AI 正在思考...
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-white/10 px-4 py-4 sm:px-6">
          {error && (
            <p className="mb-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </p>
          )}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3 rounded-2xl border border-white/10 bg-black/30 p-3"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                connected
                  ? "请输入游戏攻略或策略问题，按 Enter 发送"
                  : "请先连接钱包以开启 AI 对话"
              }
              disabled={!connected || isSending}
              className="h-20 w-full resize-none rounded-xl border border-transparent bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none focus:ring-0"
            />
            <button
              type="submit"
              disabled={!connected || isSending || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </form>
        </footer>
      </section>
    </div>
  );
}

function updateHistory({
  history,
  conversationId,
  userMessage,
  newMessage,
}: {
  history: Conversation[];
  conversationId: string;
  userMessage: ChatMessage;
  newMessage: ChatMessage;
}) {
  const title = userMessage.content.slice(0, 24);
  const updatedAt = new Date().toISOString();

  const existing = history.find((item) => item.id === conversationId);
  const payload: Conversation = existing
    ? {
        ...existing,
        title: existing.title || title,
        messages: [...existing.messages, userMessage, newMessage],
        updatedAt,
      }
    : {
        id: conversationId,
        title,
        messages: [userMessage, newMessage],
        updatedAt,
      };

  const filtered = history.filter((item) => item.id !== conversationId);
  const next = [payload, ...filtered];

  return next.slice(0, 20);
}
