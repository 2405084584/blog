import { beforeEach, describe, expect, it, vi } from "vitest";

// ============ Mocks ============

const mockHeaders = vi.fn().mockReturnValue(new Headers());
vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

const mockLimitControl = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/server/rate-limit", () => ({
  default: (...args: unknown[]) => mockLimitControl(...args),
}));

const mockAuthVerify = vi.fn();
vi.mock("@/lib/server/auth-verify", () => ({
  authVerify: (...args: unknown[]) => mockAuthVerify(...args),
}));

const mockPrisma = {
  pageView: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  pageViewArchive: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    aggregate: vi
      .fn()
      .mockResolvedValue({ _sum: { totalViews: 0, uniqueVisitors: 0 } }),
    findFirst: vi.fn().mockResolvedValue(null),
  },
  config: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  searchLog: {
    create: vi.fn(),
  },
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

const mockRedis = {
  set: vi.fn().mockResolvedValue("OK"),
  eval: vi.fn().mockResolvedValue(1),
  hmget: vi.fn().mockResolvedValue(["10", "20"]),
};
vi.mock("@/lib/server/redis", () => ({ default: mockRedis }));

vi.mock("@/lib/server/analytics-flush", () => ({
  BATCH_SIZE: 50,
  flushEventsToDatabase: vi.fn().mockResolvedValue(undefined),
  REDIS_QUEUE_KEY: "np:analytics:queue",
  REDIS_VIEW_COUNT_KEY: "np:analytics:viewCount",
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/server/get-client-info", () => ({
  getClientIP: vi.fn().mockResolvedValue("127.0.0.1"),
  getClientUserAgent: vi.fn().mockResolvedValue("Mozilla/5.0"),
}));

vi.mock("@/lib/server/ip-utils", () => ({
  resolveIpLocation: vi.fn().mockReturnValue(null),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue("-- lua script placeholder"),
  };
});

vi.mock("ua-parser-js", () => ({
  UAParser: vi.fn().mockImplementation(() => ({
    getResult: () => ({
      browser: { name: "Chrome", version: "120" },
      os: { name: "Windows", version: "11" },
      device: { type: undefined, model: undefined, vendor: undefined },
    }),
  })),
}));

vi.mock("ua-parser-js/helpers", () => ({
  isBot: vi.fn().mockReturnValue(false),
  isAIBot: vi.fn().mockReturnValue(false),
}));

// ============ Tests ============

describe("analytics actions", () => {
  let trackPageView: typeof import("@/actions/analytics").trackPageView;
  let getAnalyticsStats: typeof import("@/actions/analytics").getAnalyticsStats;
  let batchGetViewCounts: typeof import("@/actions/analytics").batchGetViewCounts;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/analytics");
    trackPageView = mod.trackPageView;
    getAnalyticsStats = mod.getAnalyticsStats;
    batchGetViewCounts = mod.batchGetViewCounts;
  });

  // ---------- trackPageView ----------

  describe("trackPageView", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await trackPageView({
        path: "/test",
        visitorId: "v1",
      });
      expect(result.success).toBe(false);
    });

    it("成功追踪页面浏览", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.eval.mockResolvedValue(1);

      const result = await trackPageView({
        path: "/test",
        visitorId: "v1",
      });
      expect(result.success).toBe(true);
    });

    it("重复请求应静默返回成功", async () => {
      mockRedis.set.mockResolvedValue(null); // dedup check fails

      const result = await trackPageView({
        path: "/test",
        visitorId: "v1",
      });
      expect(result.success).toBe(true);
    });
  });

  // ---------- getAnalyticsStats ----------

  describe("getAnalyticsStats", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAnalyticsStats({
        access_token: "token",
        days: 7,
      });
      expect(result.success).toBe(false);
    });

    it("成功获取分析统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });

      const result = await getAnalyticsStats({
        access_token: "token",
        days: 7,
      });
      expect(result.success).toBe(true);
      expect(result.data.overview).toBeDefined();
      expect(result.data.dailyTrend).toBeDefined();
    });
  });

  // ---------- batchGetViewCounts ----------

  describe("batchGetViewCounts", () => {
    it("速率限制时应抛出异常", async () => {
      mockLimitControl.mockResolvedValue(false);
      await expect(batchGetViewCounts(["/test"])).rejects.toThrow();
    });

    it("空数组时应抛出异常", async () => {
      await expect(batchGetViewCounts([])).rejects.toThrow();
    });

    it("超过20个路径时应抛出异常", async () => {
      const paths = Array.from({ length: 21 }, (_, i) => `/page${i}`);
      await expect(batchGetViewCounts(paths)).rejects.toThrow();
    });

    it("成功获取访问量", async () => {
      mockRedis.hmget.mockResolvedValue(["100", "200"]);

      const result = await batchGetViewCounts(["/page1", "/page2"]);
      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(100);
      expect(result[1].count).toBe(200);
    });
  });
});
