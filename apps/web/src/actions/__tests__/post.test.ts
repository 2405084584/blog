import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

const {
  mockLimitControl,
  mockAuthVerify,
  mockValidateData,
  mockHeaders,
  mockLogAuditEvent,
  mockPrismaPostFindMany,
  mockPrismaPostFindUnique,
  mockPrismaPostFindFirst,
  mockPrismaPostCreate,
  mockPrismaPostUpdate,
  mockPrismaPostUpdateMany,
  mockPrismaPostCount,
  mockPrismaCategoryFindMany,
  mockPrismaCategoryFindFirst,
  mockPrismaCategoryFindUnique,
  mockPrismaCategoryCreate,
  mockPrismaCategoryUpdate,
  mockPrismaTagFindUnique,
  mockPrismaMediaReferenceDeleteMany,
  mockPrismaMediaReferenceCreate,
  mockPrismaTransaction,
  mockSlugify,
  mockGetConfig,
  mockFindMediaIdByUrl,
  mockGetFeaturedImageUrl,
  mockGenerateSignature,
  mockMarkdownToPlainText,
  mockAnalyzeText,
  mockBuildTocFromSource,
  mockVerifyToken,
  mockEvaluatePostAccess,
  mockNormalizePostAccessInput,
  mockValidatePostAccessInput,
  mockHasPostAccessChanged,
  mockClearPostAccessCookie,
  mockSetPostAccessCookie,
  mockIsPostLicenseValue,
  mockToStoredPostLicense,
  mockTextVersionImpl,
} = vi.hoisted(() => ({
  mockLimitControl: vi.fn(),
  mockAuthVerify: vi.fn(),
  mockValidateData: vi.fn(),
  mockHeaders: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockPrismaPostFindMany: vi.fn(),
  mockPrismaPostFindUnique: vi.fn(),
  mockPrismaPostFindFirst: vi.fn(),
  mockPrismaPostCreate: vi.fn(),
  mockPrismaPostUpdate: vi.fn(),
  mockPrismaPostUpdateMany: vi.fn(),
  mockPrismaPostCount: vi.fn(),
  mockPrismaCategoryFindMany: vi.fn(),
  mockPrismaCategoryFindFirst: vi.fn(),
  mockPrismaCategoryFindUnique: vi.fn(),
  mockPrismaCategoryCreate: vi.fn(),
  mockPrismaCategoryUpdate: vi.fn(),
  mockPrismaTagFindUnique: vi.fn(),
  mockPrismaMediaReferenceDeleteMany: vi.fn(),
  mockPrismaMediaReferenceCreate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockSlugify: vi.fn(),
  mockGetConfig: vi.fn(),
  mockFindMediaIdByUrl: vi.fn(),
  mockGetFeaturedImageUrl: vi.fn(),
  mockGenerateSignature: vi.fn(),
  mockMarkdownToPlainText: vi.fn(),
  mockAnalyzeText: vi.fn(),
  mockBuildTocFromSource: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockEvaluatePostAccess: vi.fn(),
  mockNormalizePostAccessInput: vi.fn(),
  mockValidatePostAccessInput: vi.fn(),
  mockHasPostAccessChanged: vi.fn(),
  mockClearPostAccessCookie: vi.fn(),
  mockSetPostAccessCookie: vi.fn(),
  mockIsPostLicenseValue: vi.fn(),
  mockToStoredPostLicense: vi.fn(),
  mockTextVersionImpl: {} as Record<string, unknown>,
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    post: {
      findMany: mockPrismaPostFindMany,
      findUnique: mockPrismaPostFindUnique,
      findFirst: mockPrismaPostFindFirst,
      create: mockPrismaPostCreate,
      update: mockPrismaPostUpdate,
      updateMany: mockPrismaPostUpdateMany,
      count: mockPrismaPostCount,
    },
    category: {
      findMany: mockPrismaCategoryFindMany,
      findFirst: mockPrismaCategoryFindFirst,
      findUnique: mockPrismaCategoryFindUnique,
      create: mockPrismaCategoryCreate,
      update: mockPrismaCategoryUpdate,
    },
    tag: { findUnique: mockPrismaTagFindUnique },
    mediaReference: {
      deleteMany: mockPrismaMediaReferenceDeleteMany,
      create: mockPrismaMediaReferenceCreate,
    },
    $transaction: mockPrismaTransaction,
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/server/auth-verify", () => ({ authVerify: mockAuthVerify }));
vi.mock("@/lib/server/rate-limit", () => ({ default: mockLimitControl }));
vi.mock("@/lib/server/validator", () => ({ validateData: mockValidateData }));
vi.mock("@/lib/server/audit", () => ({ logAuditEvent: mockLogAuditEvent }));
vi.mock("@/lib/server/slugify", () => ({ slugify: mockSlugify }));
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
}));
vi.mock("@/lib/server/media-reference", () => ({
  findMediaIdByUrl: mockFindMediaIdByUrl,
  getFeaturedImageUrl: mockGetFeaturedImageUrl,
}));
vi.mock("@/lib/server/image-crypto", () => ({
  generateSignature: mockGenerateSignature,
}));
vi.mock("@/lib/server/search", () => ({
  markdownToPlainText: mockMarkdownToPlainText,
}));
vi.mock("@/lib/server/tokenizer", () => ({
  analyzeText: mockAnalyzeText,
}));
vi.mock("@/lib/server/rich-text-outline", () => ({
  buildTocFromSource: mockBuildTocFromSource,
}));
vi.mock("@/lib/server/captcha", () => ({
  verifyToken: mockVerifyToken,
}));
vi.mock("@/lib/server/post-access", () => ({
  evaluatePostAccess: mockEvaluatePostAccess,
  normalizePostAccessInput: mockNormalizePostAccessInput,
  validatePostAccessInput: mockValidatePostAccessInput,
  hasPostAccessChanged: mockHasPostAccessChanged,
  clearPostAccessCookie: mockClearPostAccessCookie,
  setPostAccessCookie: mockSetPostAccessCookie,
  LISTABLE_POST_PUBLISHED_WHERE: {},
  PUBLIC_POST_STATUSES: ["PUBLISHED", "ARCHIVED"],
}));
vi.mock("@/lib/shared/post-license", () => ({
  isPostLicenseValue: mockIsPostLicenseValue,
  toStoredPostLicense: mockToStoredPostLicense,
}));
vi.mock("text-version", () => ({
  TextVersion: class MockTextVersion {
    commit = vi.fn();
    export = vi.fn();
    log = vi.fn();
    show = vi.fn();
    reset = vi.fn();
    squash = vi.fn();
    constructor() {
      Object.assign(this, mockTextVersionImpl);
    }
  },
}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mockHeaders }));
vi.mock("next/server", () => ({
  NextResponse: { json: vi.fn() },
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

// ============================================================================
// Imports
// ============================================================================

import {
  getPostsList,
  getPostDetail,
  createPost,
  updatePost,
  deletePosts,
  getPostsTrends,
  getPostHistory,
  getPostVersion,
} from "@/actions/post";

// ============================================================================
// Helpers
// ============================================================================

const ADMIN_USER = { uid: 1, username: "admin", role: "ADMIN" as const };
const EDITOR_USER = { uid: 2, username: "editor", role: "EDITOR" as const };
const AUTHOR_USER = { uid: 3, username: "author", role: "AUTHOR" as const };

const POST_RECORD = {
  id: 1,
  title: "Test Post",
  slug: "test-post",
  content: "# Hello World",
  excerpt: "Test excerpt",
  status: "PUBLISHED",
  isPinned: false,
  allowComments: true,
  accessMode: "PUBLIC",
  minRole: null,
  accessPasswords: [],
  publishedAt: new Date("2025-01-01"),
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  metaDescription: null,
  metaKeywords: null,
  robotsIndex: true,
  postMode: "MARKDOWN",
  license: "default",
  userUid: 1,
  versionMetadata: null,
  accessVersion: 1,
  author: { uid: 1, username: "admin", nickname: "Admin" },
  categories: [{ id: 1, name: "技术", fullSlug: "tech" }],
  tags: [{ name: "test", slug: "test" }],
  mediaRefs: [],
  viewCount: { cachedCount: 10 },
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

describe("post actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAllowed();
    mockValidationSuccess();
    mockHeaders.mockResolvedValue(new Headers());
    mockSlugify.mockResolvedValue("test-post");
    mockGetFeaturedImageUrl.mockReturnValue(null);
    mockGenerateSignature.mockReturnValue("sig");
    mockMarkdownToPlainText.mockResolvedValue("Hello World");
    mockAnalyzeText.mockResolvedValue(["hello", "world"]);
    mockIsPostLicenseValue.mockReturnValue(true);
    mockToStoredPostLicense.mockReturnValue("default");
    mockNormalizePostAccessInput.mockImplementation((input: unknown) => input);
    mockValidatePostAccessInput.mockReturnValue(null);
    mockHasPostAccessChanged.mockReturnValue(false);
    mockFindMediaIdByUrl.mockResolvedValue(null);
    mockGetConfig.mockResolvedValue(true);
    mockPrismaCategoryFindMany.mockResolvedValue([]);
    // Reset mockTextVersionImpl
    for (const key of Object.keys(mockTextVersionImpl)) {
      delete mockTextVersionImpl[key];
    }
  });

  describe("getPostsList", () => {
    it("成功获取文章列表", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaPostFindMany.mockResolvedValue([POST_RECORD]);
      mockPrismaPostCount.mockResolvedValue(1);
      const result = await getPostsList(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await getPostsList(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("速率限制时返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsList(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getPostDetail", () => {
    it("成功获取文章详情", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaPostFindUnique.mockResolvedValue(POST_RECORD);
      const result = await getPostDetail(
        { access_token: "token", slug: "test-post" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("文章不存在时返回 404", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await getPostDetail(
        { access_token: "token", slug: "nonexistent" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("AUTHOR 查看他人文章时返回禁止", async () => {
      mockAuthSuccess(AUTHOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue({
        ...POST_RECORD,
        userUid: 999,
      });
      const result = await getPostDetail(
        { access_token: "token", slug: "test-post" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("createPost", () => {
    it("成功创建文章", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue(null); // slug check
      mockPrismaPostCreate.mockResolvedValue({
        id: 2,
        slug: "new-post",
        status: "DRAFT",
        publishedAt: null,
        tags: [],
        categories: [{ fullSlug: "uncategorized" }],
      });
      mockPrismaCategoryFindFirst.mockResolvedValue({
        id: 1,
        slug: "uncategorized",
        path: "1",
        depth: 0,
        fullSlug: "uncategorized",
      });
      const mockTvInstance = {
        commit: vi.fn(),
        export: vi.fn().mockReturnValue({
          metadata: "metadata",
          snapshot: "snapshot",
        }),
        log: vi.fn().mockReturnValue([]),
      };
      Object.assign(mockTextVersionImpl, mockTvInstance);
      const result = await createPost(
        {
          access_token: "token",
          title: "New Post",
          content: "# New Post Content",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("slug 已存在时返回错误", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue({ id: 1, slug: "existing" });
      const result = await createPost(
        {
          access_token: "token",
          title: "New Post",
          slug: "existing",
          content: "content",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("updatePost", () => {
    it("成功更新文章", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue(POST_RECORD);
      mockPrismaTransaction.mockImplementation(async (fn: Function) =>
        fn({
          mediaReference: { deleteMany: vi.fn() },
          post: {
            update: vi.fn().mockResolvedValue({
              id: 1,
              title: "Updated Title",
              slug: "test-post",
              status: "PUBLISHED",
              accessMode: "PUBLIC",
              minRole: null,
              accessPasswords: [],
              accessVersion: 1,
              publishedAt: new Date(),
              categories: [{ fullSlug: "tech" }],
              tags: [{ slug: "test" }],
            }),
          },
        }),
      );
      const result = await updatePost(
        {
          access_token: "token",
          slug: "test-post",
          title: "Updated Title",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("文章不存在时返回 404", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await updatePost(
        {
          access_token: "token",
          slug: "nonexistent",
          title: "Updated",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("deletePosts", () => {
    it("成功删除文章", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaPostFindMany.mockResolvedValue([POST_RECORD]);
      mockPrismaPostUpdateMany.mockResolvedValue({ count: 1 });
      const result = await deletePosts(
        { access_token: "token", ids: [1] },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await deletePosts(
        { access_token: "token", ids: [1] },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsTrends", () => {
    it("成功获取文章趋势", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaPostFindMany.mockResolvedValue([]);
      const result = await getPostsTrends(
        { access_token: "token", days: 7, count: 7 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getPostHistory", () => {
    it("成功获取文章历史", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        content: "# Hello",
        versionMetadata: "metadata",
        userUid: 2,
      });
      const mockTvInstance = {
        log: vi.fn().mockReturnValue([
          {
            version: "2:2025-01-01T00:00:00.000Z:更新内容",
            isSnapshot: true,
          },
        ]),
      };
      Object.assign(mockTextVersionImpl, mockTvInstance);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        content: "# Hello",
        versionMetadata: "metadata",
        userUid: 2,
      });
      // Mock user query for version user
      const prisma = await import("@/lib/server/prisma");
      (prisma.default as Record<string, unknown>).user = {
        findUnique: vi.fn().mockResolvedValue({
          uid: 2,
          username: "editor",
          nickname: "Editor",
        }),
      };
      const result = await getPostHistory(
        { access_token: "token", slug: "test-post" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getPostVersion", () => {
    it("成功获取版本内容", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        content: "# Hello",
        versionMetadata: "metadata",
        userUid: 2,
      });
      const mockTvInstance = {
        log: vi.fn().mockReturnValue([
          {
            version: "2:2025-01-01T00:00:00.000Z:更新内容",
            isSnapshot: true,
          },
        ]),
        show: vi.fn().mockReturnValue("# Hello World"),
      };
      Object.assign(mockTextVersionImpl, mockTvInstance);
      const prisma = await import("@/lib/server/prisma");
      (prisma.default as Record<string, unknown>).user = {
        findUnique: vi.fn().mockResolvedValue({
          uid: 2,
          username: "editor",
          nickname: "Editor",
        }),
      };
      const result = await getPostVersion(
        {
          access_token: "token",
          slug: "test-post",
          timestamp: "2025-01-01T00:00:00.000Z",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });
});
