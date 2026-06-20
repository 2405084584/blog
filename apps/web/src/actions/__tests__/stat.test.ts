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
  $queryRaw: vi.fn(),
  user: { count: vi.fn() },
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  tag: { count: vi.fn() },
  category: { count: vi.fn(), findMany: vi.fn() },
  page: { count: vi.fn(), groupBy: vi.fn() },
  post: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  project: { count: vi.fn() },
  pageView: { count: vi.fn() },
  pageViewArchive: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    findFirst: vi.fn(),
  },
  storageProvider: {},
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: vi.fn().mockReturnValue("cache:key"),
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

// ============ Tests ============

describe("stat actions", () => {
  let getUsersStats: typeof import("@/actions/stat").getUsersStats;
  let getPostsStats: typeof import("@/actions/stat").getPostsStats;
  let getTagsStats: typeof import("@/actions/stat").getTagsStats;
  let getPagesStats: typeof import("@/actions/stat").getPagesStats;
  let getAuditStats: typeof import("@/actions/stat").getAuditStats;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/stat");
    getUsersStats = mod.getUsersStats;
    getPostsStats = mod.getPostsStats;
    getTagsStats = mod.getTagsStats;
    getPagesStats = mod.getPagesStats;
    getAuditStats = mod.getAuditStats;
  });

  const adminParams = { access_token: "admin-token", force: false };

  // ---------- getUsersStats ----------

  describe("getUsersStats", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          role: "USER",
          total_count: BigInt(100),
          active_1d: BigInt(10),
          active_7d: BigInt(50),
          active_30d: BigInt(80),
          new_1d: BigInt(2),
          new_7d: BigInt(5),
          new_30d: BigInt(15),
        },
        {
          role: "ADMIN",
          total_count: BigInt(3),
          active_1d: BigInt(1),
          active_7d: BigInt(2),
          active_30d: BigInt(3),
          new_1d: BigInt(0),
          new_7d: BigInt(0),
          new_30d: BigInt(0),
        },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(103);
      expect(result.data.total.user).toBe(100);
      expect(result.data.total.admin).toBe(3);
      expect(result.data.active.lastDay).toBe(11);
    });
  });

  // ---------- getPostsStats ----------

  describe("getPostsStats", () => {
    it("非管理员/编辑/作者应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(50),
          new_7d: BigInt(3),
          new_30d: BigInt(10),
          new_1y: BigInt(40),
        },
        {
          status: "DRAFT",
          total_count: BigInt(5),
          new_7d: BigInt(1),
          new_30d: BigInt(2),
          new_1y: BigInt(5),
        },
      ]);
      mockPrisma.post.findFirst
        .mockResolvedValueOnce({ publishedAt: new Date("2024-06-01") })
        .mockResolvedValueOnce({ publishedAt: new Date("2023-01-01") });

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.published).toBe(50);
      expect(result.data.total.draft).toBe(5);
    });
  });

  // ---------- getTagsStats ----------

  describe("getTagsStats", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(20);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(15) }]) // tagsWithPosts
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(18) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(20);
      expect(result.data.total.withPosts).toBe(15);
    });
  });

  // ---------- getPagesStats ----------

  describe("getPagesStats", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(10);
      mockPrisma.page.groupBy
        .mockResolvedValueOnce([{ status: "ACTIVE", _count: { status: 8 } }])
        .mockResolvedValueOnce([
          { isSystemPage: true, _count: { isSystemPage: 3 } },
        ]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(10);
    });
  });

  // ---------- getAuditStats ----------

  describe("getAuditStats", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(500);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { userUid: 1 },
        { userUid: 2 },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          last_1d: BigInt(10),
          last_7d: BigInt(50),
          last_30d: BigInt(200),
        },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.logs).toBe(500);
      expect(result.data.total.activeUsers).toBe(2);
    });
  });

  // ---------- 补充测试 ----------

  describe("getUsersStats 补充测试", () => {
    it("应返回正确的活跃用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          role: "USER",
          total_count: BigInt(200),
          active_1d: BigInt(20),
          active_7d: BigInt(100),
          active_30d: BigInt(150),
          new_1d: BigInt(5),
          new_7d: BigInt(10),
          new_30d: BigInt(30),
        },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(200);
    });

    it("应处理空结果", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(0);
    });
  });

  describe("getPostsStats 补充测试", () => {
    it("应返回 published 和 draft 统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.published).toBe(100);
    });

    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试", () => {
    it("无标签时应返回 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(0), new_30d: BigInt(0), new_1y: BigInt(0) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(0);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试", () => {
    it("无页面时应返回 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(0);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(0);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试", () => {
    it("无审计日志时应返回 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(0), last_7d: BigInt(0), last_30d: BigInt(0) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.logs).toBe(0);
      expect(result.data.total.activeUsers).toBe(0);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });
});
