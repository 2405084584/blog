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

const mockVerifyCaptchaToken = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/server/captcha", () => ({
  verifyToken: (...args: unknown[]) => mockVerifyCaptchaToken(...args),
}));

const mockGetConfig = vi.fn();
const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
  getConfigs: (...args: unknown[]) => mockGetConfigs(...args),
}));

const mockSendNotice = vi.fn();
vi.mock("@/lib/server/notice", () => ({
  sendNotice: (...args: unknown[]) => mockSendNotice(...args),
}));

const mockPrisma = {
  friendLink: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/server/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/server/url-security", () => ({
  fetchPublicHttpUrlBuffer: vi.fn(),
}));

vi.mock("@/lib/server/cron-task-runner", () => ({
  runFriendLinksCheck: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

// ============ Tests ============

describe("friendlink actions", () => {
  let getOwnFriendLink: typeof import("@/actions/friendlink").getOwnFriendLink;
  let updateOwnFriendLink: typeof import("@/actions/friendlink").updateOwnFriendLink;
  let deleteOwnFriendLink: typeof import("@/actions/friendlink").deleteOwnFriendLink;
  let getFriendLinksList: typeof import("@/actions/friendlink").getFriendLinksList;
  let getFriendLinksStats: typeof import("@/actions/friendlink").getFriendLinksStats;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/friendlink");
    getOwnFriendLink = mod.getOwnFriendLink;
    updateOwnFriendLink = mod.updateOwnFriendLink;
    deleteOwnFriendLink = mod.deleteOwnFriendLink;
    getFriendLinksList = mod.getFriendLinksList;
    getFriendLinksStats = mod.getFriendLinksStats;
  });

  // ---------- getOwnFriendLink ----------

  describe("getOwnFriendLink", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("无友链记录时返回 null", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue(null);

      const result = await getOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("成功获取友链信息", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue({
        id: 1,
        name: "Test",
        url: "https://test.com",
        avatar: "https://test.com/avatar.png",
        slogan: "Hello",
        friendLinkUrl: "https://test.com/friends",
        ignoreBacklink: false,
        group: null,
        order: 0,
        status: "PUBLISHED",
        checkSuccessCount: 10,
        checkFailureCount: 0,
        lastCheckedAt: new Date(),
        avgResponseTime: 100,
        applyNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        checkHistory: [],
        owner: { uid: 1, username: "user1", nickname: null },
        auditor: null,
      });

      const result = await getOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Test");
    });
  });

  // ---------- updateOwnFriendLink ----------

  describe("updateOwnFriendLink", () => {
    it("未找到友链记录时应返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue(null);

      const result = await updateOwnFriendLink({
        access_token: "token",
        name: "Test",
        url: "https://test.com",
        avatar: "https://test.com/a.png",
        slogan: "Hi",
        friendLinkUrl: "https://test.com/friends",
      });
      expect(result.success).toBe(false);
    });

    it("非发布状态时应返回 403", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue({
        id: 1,
        name: "Test",
        status: "PENDING",
      });

      const result = await updateOwnFriendLink({
        access_token: "token",
        name: "Test",
        url: "https://test.com",
        avatar: "https://test.com/a.png",
        slogan: "Hi",
        friendLinkUrl: "https://test.com/friends",
      });
      expect(result.success).toBe(false);
    });

    it("成功更新友链", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue({
        id: 1,
        name: "Test",
        status: "PUBLISHED",
      });
      mockPrisma.friendLink.update.mockResolvedValue({
        id: 1,
        updatedAt: new Date(),
      });

      const result = await updateOwnFriendLink({
        access_token: "token",
        name: "Updated",
        url: "https://test.com",
        avatar: "https://test.com/a.png",
        slogan: "Hi",
        friendLinkUrl: "https://test.com/friends",
      });
      expect(result.success).toBe(true);
    });
  });

  // ---------- deleteOwnFriendLink ----------

  describe("deleteOwnFriendLink", () => {
    it("未找到友链记录时应返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue(null);

      const result = await deleteOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("被拉黑时应返回 403", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue({
        id: 1,
        name: "Test",
        status: "BLOCKED",
      });

      const result = await deleteOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("成功删除友链", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.friendLink.findUnique.mockResolvedValue({
        id: 1,
        name: "Test",
        status: "PUBLISHED",
      });
      mockPrisma.friendLink.update.mockResolvedValue({});

      const result = await deleteOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(true);
    });
  });

  // ---------- getFriendLinksList ----------

  describe("getFriendLinksList", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getFriendLinksList({
        access_token: "token",
        page: 1,
        pageSize: 25,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      expect(result.success).toBe(false);
    });

    it("成功获取友链列表", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.friendLink.count.mockResolvedValue(1);
      mockPrisma.friendLink.findMany.mockResolvedValue([
        {
          id: 1,
          name: "Test",
          url: "https://test.com",
          avatar: "https://test.com/a.png",
          slogan: "Hello",
          friendLinkUrl: "https://test.com/friends",
          ignoreBacklink: false,
          group: null,
          order: 0,
          status: "PUBLISHED",
          checkSuccessCount: 10,
          checkFailureCount: 0,
          lastCheckedAt: null,
          avgResponseTime: null,
          applyNote: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          publishedAt: new Date(),
          checkHistory: [],
          owner: null,
          auditor: null,
        },
      ]);

      const result = await getFriendLinksList({
        access_token: "token",
        page: 1,
        pageSize: 25,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ---------- getFriendLinksStats ----------

  describe("getFriendLinksStats", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getFriendLinksStats({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("成功获取友链统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.friendLink.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(3) // pending
        .mockResolvedValueOnce(10) // published
        .mockResolvedValueOnce(2) // whitelist
        .mockResolvedValueOnce(1) // rejected
        .mockResolvedValueOnce(0) // blocked
        .mockResolvedValueOnce(2) // disconnect
        .mockResolvedValueOnce(1) // noBacklink
        .mockResolvedValueOnce(5) // withOwner
        .mockResolvedValueOnce(3); // problematic

      const result = await getFriendLinksStats({ access_token: "token" });
      expect(result.success).toBe(true);
      expect(result.data.total).toBe(20);
      expect(result.data.published).toBe(10);
    });
  });

  // ---------- 补充测试 ----------

  describe("getFriendLinksList 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getFriendLinksList({
        access_token: "token",
        page: 1,
      });
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getFriendLinksList({
        access_token: "token",
        page: 1,
      });
      expect(result.success).toBe(false);
    });

    it("成功获取友链列表", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.friendLink.count.mockResolvedValue(0);
      mockPrisma.friendLink.findMany.mockResolvedValue([]);

      const result = await getFriendLinksList({
        access_token: "token",
        page: 1,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getFriendLinksStats 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getFriendLinksStats({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getFriendLinksStats({ access_token: "token" });
      expect(result.success).toBe(false);
    });
  });

  describe("getOwnFriendLink 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getOwnFriendLink({ access_token: "token" });
      expect(result.success).toBe(false);
    });
  });
});
