import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";

type MetricsResponse = {
  price: number;
  marketCap: number;
  holders: number;
  volume24h: number;
  updatedAt: string;
};

async function fetchMetrics(): Promise<MetricsResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/metrics`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      throw new Error("Bad response");
    }
    return (await res.json()) as MetricsResponse;
  } catch {
    // Fallback mock data for local development
    return {
      price: 0.00012,
      marketCap: 3200,
      holders: 184,
      volume24h: 540,
      updatedAt: new Date().toISOString(),
    };
  }
}

function formatNumber(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

export default async function Home() {
  const metrics = await fetchMetrics();
  const activationCap = 4200;
  const redpillCap = 420000;

  const activationProgress = Math.min(
    100,
    Math.round((metrics.marketCap / activationCap) * 100)
  );
  const redpillProgress = Math.min(
    100,
    Math.round((metrics.marketCap / redpillCap) * 100)
  );

  const milestoneItems = [
    {
      label: "$4.2K 激活",
      target: activationCap,
      progress: activationProgress,
      description: "完成 Virtuals Forum 激活，开放全部功能",
    },
    {
      label: "$420K 红丸",
      target: redpillCap,
      progress: redpillProgress,
      description: "升级为 ERC20 并开启 DEX 流动性池",
    },
  ];

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-violet-500/5 backdrop-blur md:p-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-100">
              Virtuals Protocol Agent
            </span>
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              GAME.ai · 游戏玩家的集体智慧，化作你的个性化 AI 顾问
            </h1>
            <p className="text-base text-white/70 sm:text-lg">
              上传攻略赢取 $GAME，订阅 AI 咨询即享实时分红。
              连接钱包后可快速进入 AI 咨询与创作者中心。
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <p>
              最新更新 ·{" "}
              <span className="font-mono text-white">
                {new Date(metrics.updatedAt).toLocaleString("zh-CN", {
                  hour12: false,
                })}
              </span>
            </p>
            <div className="inline-flex items-center gap-2 text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              正在运行 · Base Network
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="https://forum.virtuals.io/"
            target="_blank"
            className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-400 hover:to-indigo-400"
          >
            购买 $VIRTUAL
          </Link>
          <Link
            href="/me"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            了解订阅与分红
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="当前价格（$GAME）"
          value={`$${metrics.price.toFixed(5)}`}
          helper="来自 Bonding Curve 最新成交"
        />
        <MetricCard
          label="市值"
          value={`$${formatNumber(metrics.marketCap, {
            maximumFractionDigits: 0,
          })}`}
          helper="目标 $420K 红丸升级"
        />
        <MetricCard
          label="持有者数量"
          value={formatNumber(metrics.holders)}
          helper="链上唯一钱包地址"
        />
        <MetricCard
          label="24h 交易量"
          value={`$${formatNumber(metrics.volume24h, {
            maximumFractionDigits: 0,
          })}`}
          helper="Virtuals Forum 数据"
        />
      </section>

      <section className="rounded-3xl border border-white/5 bg-white/5 p-6 md:p-8">
        <h2 className="text-xl font-semibold text-white">里程碑进度</h2>
        <p className="mt-2 text-sm text-white/60">
          追踪 GAME.ai 代币经济的成长路线。达到激活和红丸门槛后，将解锁更多功能与分红能力。
        </p>
        <div className="mt-6 space-y-6">
          {milestoneItems.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span className="font-medium text-white">{item.label}</span>
                <span>
                  {formatNumber(metrics.marketCap, {
                    maximumFractionDigits: 0,
                  })}
                  /{formatNumber(item.target, { maximumFractionDigits: 0 })} USD
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <p className="text-xs text-white/50">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">AI 咨询入口</h3>
          <p className="mt-2 text-sm text-white/60">
            基于 Dify + 用户上传内容的游戏知识库。
            订阅后即可在 /ai 页面发起 ChatGPT 风格对话并查看历史记录。
          </p>
          <Link
            href="/ai"
            className="mt-4 inline-flex items-center text-sm font-medium text-violet-200 hover:text-violet-100"
          >
            开始对话 →
          </Link>
        </div>
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">创作者奖励</h3>
          <p className="mt-2 text-sm text-white/60">
            上传游戏攻略即可获得 1 $GAME，
            内容通过审核后自动同步到 Notion 与 Dify 知识库。
          </p>
          <Link
            href="/creator"
            className="mt-4 inline-flex items-center text-sm font-medium text-violet-200 hover:text-violet-100"
          >
            立即投稿 →
          </Link>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-violet-500/10">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-1 text-xs text-white/50">{helper}</p>}
    </div>
  );
}
