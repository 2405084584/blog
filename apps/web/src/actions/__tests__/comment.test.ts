import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

const {
  mockLimitControl,
  mockAuthVerify,
  mockValidateData,
  mockHeaders,
  mockGetConfig,
  mockGetConfigs,
  mockVerifyToken,
  mockGetClientIP,
  mockResolveIpLocation,
  mockCalculateMD5,
  mockNormalizePageSlug,
  mockResolvePageAllowComments,
  mockIsAkismetEnabled,
  mockLogAuditEvent,
  mockGenerateCacheKey,
  mockGetCache,
  mockSetCache,
  mockPrismaCommentFindMany,
  mockPrismaCommentFindUnique,
  mockPrismaCommentFindFirst,
  mockPrismaCommentCreate,
  mockPrismaCommentUpdate,
  mockPrismaCommentUpdateMany,
  mockPrismaCommentCount,
  mockPrismaCommentLikeFindMany,
  mockPrismaCommentLikeFindUnique,
  mockPrismaPostFindUnique,
  mockPrismaPageFindUnique,
  mockPrismaPageFindFirst,
  mockPrismaUserFindMany,
  mockPrismaUserFindUnique,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockLimitControl: vi.fn(),
  mockAuthVerify: vi.fn(),
  mockValidateData: vi.fn(),
  mockHeaders: vi.fn(),
  mockGetConfig: vi.fn(),
  mockGetConfigs: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockGetClientIP: vi.fn(),
  mockResolveIpLocation: vi.fn(),
  mockCalculateMD5: vi.fn(),
  mockNormalizePageSlug: vi.fn(),
  mockResolvePageAllowComments: vi.fn(),
  mockIsAkismetEnabled: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockGenerateCacheKey: vi.fn(),
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn(),
  mockPrismaCommentFindMany: vi.fn(),
  mockPrismaCommentFindUnique: vi.fn(),
  mockPrismaCommentFindFirst: vi.fn(),
  mockPrismaCommentCreate: vi.fn(),
  mockPrismaCommentUpdate: vi.fn(),
  mockPrismaCommentUpdateMany: vi.fn(),
  mockPrismaCommentCount: vi.fn(),
  mockPrismaCommentLikeFindMany: vi.fn(),
  mockPrismaCommentLikeFindUnique: vi.fn(),
  mockPrismaPostFindUnique: vi.fn(),
  mockPrismaPageFindUnique: vi.fn(),
  mockPrismaPageFindFirst: vi.fn(),
  mockPrismaUserFindMany: vi.fn(),
  mockPrismaUserFindUnique: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    comment: {
      findMany: mockPrismaCommentFindMany,
      findUnique: mockPrismaCommentFindUnique,
      findFirst: mockPrismaCommentFindFirst,
      create: mockPrismaCommentCreate,
      update: mockPrismaCommentUpdate,
      updateMany: mockPrismaCommentUpdateMany,
      count: mockPrismaCommentCount,
    },
    commentLike: {
      findMany: mockPrismaCommentLikeFindMany,
      findUnique: mockPrismaCommentLikeFindUnique,
      create: vi.fn(),
      delete: vi.fn(),
    },
    post: { findUnique: mockPrismaPostFindUnique },
    page: {
      findUnique: mockPrismaPageFindUnique,
      findFirst: mockPrismaPageFindFirst,
    },
    user: {
      findMany: mockPrismaUserFindMany,
      findUnique: mockPrismaUserFindUnique,
    },
    $transaction: mockPrismaTransaction,
  },
}));
vi.mock("@/lib/server/auth-verify", () => ({ authVerify: mockAuthVerify }));
vi.mock("@/lib/server/rate-limit", () => ({ default: mockLimitControl }));
vi.mock("@/lib/server/validator", () => ({ validateData: mockValidateData }));
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
  getConfigs: mockGetConfigs,
}));
vi.mock("@/lib/server/captcha", () => ({ verifyToken: mockVerifyToken }));
vi.mock("@/lib/server/get-client-info", () => ({
  getClientIP: mockGetClientIP,
}));
vi.mock("@/lib/server/ip-utils", () => ({
  resolveIpLocation: mockResolveIpLocation,
}));
vi.mock("@/lib/server/crypto", () => ({ calculateMD5: mockCalculateMD5 }));
vi.mock("@/lib/server/page-comments", () => ({
  normalizePageSlug: mockNormalizePageSlug,
  resolvePageAllowComments: mockResolvePageAllowComments,
}));
vi.mock("@/lib/server/post-access", () => ({
  PUBLIC_POST_STATUSES: ["PUBLISHED", "ARCHIVED"],
}));
vi.mock("@/lib/server/akismet", () => ({
  checkSpam: vi.fn(),
  isAkismetEnabled: mockIsAkismetEnabled,
}));
vi.mock("@/lib/server/audit", () => ({ logAuditEvent: mockLogAuditEvent }));
vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: mockGenerateCacheKey,
  getCache: mockGetCache,
  setCache: mockSetCache,
}));
vi.mock("next/headers", () => ({ headers: mockHeaders }));
vi.mock("next/server", () => ({
  NextResponse: { json: vi.fn() },
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));
vi.mock("@/lib/server/notice", () => ({ sendNotice: vi.fn() }));

// ============================================================================
// Imports
// ============================================================================

import {
  getPostComments,
  createComment,
  updateCommentStatus,
  deleteComments,
  getCommentsAdmin,
  getCommentHistory,
  getCommentStats,
  likeComment,
  unlikeComment,
  deleteOwnComment,
} from "@/actions/comment";

// ============================================================================
// Helpers
// ============================================================================

const ADMIN_USER = { uid: 1, username: "admin", role: "ADMIN" as const };
const EDITOR_USER = { uid: 2, username: "editor", role: "EDITOR" as const };
const REGULAR_USER = { uid: 4, username: "user", role: "USER" as const };

const COMMENT_RECORD = {
  id: "comment-1",
  content: "Great post!",
  status: "APPROVED",
  createdAt: new Date("2025-01-01"),
  parentId: null,
  postId: 1,
  pageId: null,
  post: { slug: "test-post", title: "Test Post", publishedAt: new Date() },
  page: null,
  userUid: 4,
  authorName: "User",
  authorEmail: "user@test.com",
  authorWebsite: null,
  ipAddress: "127.0.0.1",
  userAgent: "Mozilla/5.0",
  depth: 0,
  path: "comment-1",
  sortKey: "0000000001",
  replyCount: 0,
  likeCount: 0,
  user: {
    uid: 4,
    username: "user",
    nickname: "User",
    avatar: null,
    website: null,
  },
  parent: null,
};

function mockAuthSuccess(user = ADMIN_USER) {
  mockAuthVerify.mockResolvedValue(user);
}
function mockAuthFailure() {
  mockAuthVerify.mockResolvedValue(null);
}
function mockRateLimitAllowed() {
  mockLimitControl.mockResolvedValue(true);
}
function mockValidationSuccess() {
  mockValidateData.mockReturnValue(null);
}

// ============================================================================
// Tests
// ============================================================================

describe("comment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAllowed();
    mockValidationSuccess();
    mockHeaders.mockResolvedValue(new Headers());
    mockGetConfig.mockResolvedValue(true);
    mockGetConfigs.mockResolvedValue([true, true, true, false, false]);
    mockGetClientIP.mockResolvedValue("127.0.0.1");
    mockResolveIpLocation.mockReturnValue(null);
    mockCalculateMD5.mockReturnValue("md5hash");
    mockIsAkismetEnabled.mockResolvedValue(false);
    mockGenerateCacheKey.mockReturnValue("cache-key");
    mockNormalizePageSlug.mockImplementation((s: string) => s);
  });

  describe("getPostComments", () => {
    it("成功获取评论列表", async () => {
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: true,
        userUid: 1,
        publishedAt: new Date(),
      });
      mockAuthVerify.mockResolvedValue(null);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentCount.mockResolvedValue(1);
      mockPrismaCommentLikeFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("评论功能关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("目标不存在时返回 404", async () => {
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPageFindFirst.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await getPostComments(
        { slug: "nonexistent", pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("评论关闭的文章返回禁止", async () => {
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: false,
        userUid: 1,
        publishedAt: new Date(),
      });
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("速率限制时返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("createComment", () => {
    it("登录用户成功创建评论", async () => {
      mockVerifyToken.mockResolvedValue({ success: true });
      mockGetConfigs.mockResolvedValue([true, true, true, false, false]);
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: true,
        userUid: 1,
        publishedAt: new Date(),
      });
      mockAuthSuccess(REGULAR_USER);
      mockPrismaUserFindUnique.mockResolvedValue({
        uid: 4,
        username: "user",
        nickname: "User",
        email: "user@test.com",
        avatar: null,
        website: null,
      });
      mockPrismaCommentCreate.mockResolvedValue({ id: "new-comment" });
      mockPrismaCommentUpdate.mockResolvedValue({});
      mockPrismaCommentFindUnique.mockResolvedValue({
        ...COMMENT_RECORD,
        id: "new-comment",
      });
      const result = await createComment(
        {
          slug: "test-post",
          content: "Nice article!",
          captcha_token: "captcha",
          access_token: "token",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("验证码失败时返回错误", async () => {
      mockVerifyToken.mockResolvedValue({ success: false });
      const result = await createComment(
        {
          slug: "test-post",
          content: "Comment",
          captcha_token: "bad",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("匿名评论关闭时未登录用户返回未授权", async () => {
      mockVerifyToken.mockResolvedValue({ success: true });
      mockGetConfigs.mockResolvedValue([false, true, true, false, false]);
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: true,
        userUid: 1,
        publishedAt: new Date(),
      });
      mockAuthFailure();
      const result = await createComment(
        {
          slug: "test-post",
          content: "Comment",
          captcha_token: "captcha",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("updateCommentStatus", () => {
    it("ADMIN 成功更新评论状态", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentUpdateMany.mockResolvedValue({ count: 1 });
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "REJECTED" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("deleteComments", () => {
    it("ADMIN 成功删除评论", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentUpdateMany.mockResolvedValue({ count: 1 });
      const result = await deleteComments(
        { ids: ["comment-1"] },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getCommentsAdmin", () => {
    it("成功返回管理评论列表", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaCommentCount.mockResolvedValue(1);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentLikeFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        { page: 1, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await getCommentsAdmin(
        { page: 1, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getCommentHistory", () => {
    it("成功返回评论历史", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentHistory(
        { access_token: "token", days: 7 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(7);
    });
  });

  describe("getCommentStats", () => {
    it("成功返回评论统计", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockGetCache.mockResolvedValue(null);
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(0);
    });
  });

  describe("likeComment", () => {
    it("成功点赞评论", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue({ id: "comment-1" });
      mockPrismaTransaction.mockImplementation(async (fn: Function) =>
        fn({
          commentLike: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
          comment: {
            update: vi.fn().mockResolvedValue({ likeCount: 1 }),
            findUnique: vi.fn().mockResolvedValue({ likeCount: 1 }),
          },
        }),
      );
      const result = await likeComment(
        { commentId: "comment-1" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未登录时返回未授权", async () => {
      mockAuthFailure();
      const result = await likeComment(
        { commentId: "comment-1" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("评论不存在时返回 404", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await likeComment(
        { commentId: "nonexistent" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("unlikeComment", () => {
    it("成功取消点赞", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaTransaction.mockImplementation(async (fn: Function) =>
        fn({
          commentLike: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ commentId: "c1", userUid: 4 }),
            delete: vi.fn(),
          },
          comment: {
            update: vi.fn().mockResolvedValue({ likeCount: 0 }),
            findUnique: vi.fn().mockResolvedValue({ likeCount: 0 }),
          },
        }),
      );
      const result = await unlikeComment(
        { commentId: "comment-1" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("deleteOwnComment", () => {
    it("成功删除自己的评论", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        userUid: 4,
      });
      mockPrismaCommentUpdate.mockResolvedValue({});
      const result = await deleteOwnComment(
        { commentId: "comment-1" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("删除他人评论时返回禁止", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        userUid: 999,
      });
      const result = await deleteOwnComment(
        { commentId: "comment-1" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("评论不存在时返回 404", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await deleteOwnComment(
        { commentId: "nonexistent" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });
});
