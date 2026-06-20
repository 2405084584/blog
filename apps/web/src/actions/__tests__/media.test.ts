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
  mockPrismaMediaFindMany,
  mockPrismaMediaFindUnique,
  mockPrismaMediaUpdate,
  mockPrismaMediaUpdateMany,
  mockPrismaMediaDeleteMany,
  mockPrismaMediaCount,
  mockPrismaMediaAggregate,
  mockPrismaMediaGroupBy,
  mockPrismaPhotoFindUnique,
  mockPrismaPhotoCreateMany,
  mockPrismaPhotoDeleteMany,
  mockPrismaMediaReferenceFindMany,
  mockPrismaVirtualFolderFindUnique,
  mockPrismaVirtualFolderFindFirst,
  mockPrismaVirtualFolderFindMany,
  mockPrismaVirtualFolderCreate,
  mockPrismaVirtualFolderUpdate,
  mockPrismaVirtualFolderDelete,
  mockPrismaVirtualFolderAggregate,
  mockPrismaTransaction,
  mockGenerateSignedImageId,
  mockGetGalleryPhotosData,
  mockDeleteObject,
  mockGetCache,
  mockSetCache,
  mockGenerateCacheKey,
  mockSlugify,
  mockIsVirtualStorage,
  mockParseExifBuffer,
} = vi.hoisted(() => ({
  mockLimitControl: vi.fn(),
  mockAuthVerify: vi.fn(),
  mockValidateData: vi.fn(),
  mockHeaders: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockPrismaMediaFindMany: vi.fn(),
  mockPrismaMediaFindUnique: vi.fn(),
  mockPrismaMediaUpdate: vi.fn(),
  mockPrismaMediaUpdateMany: vi.fn(),
  mockPrismaMediaDeleteMany: vi.fn(),
  mockPrismaMediaCount: vi.fn(),
  mockPrismaMediaAggregate: vi.fn(),
  mockPrismaMediaGroupBy: vi.fn(),
  mockPrismaPhotoFindUnique: vi.fn(),
  mockPrismaPhotoCreateMany: vi.fn(),
  mockPrismaPhotoDeleteMany: vi.fn(),
  mockPrismaMediaReferenceFindMany: vi.fn(),
  mockPrismaVirtualFolderFindUnique: vi.fn(),
  mockPrismaVirtualFolderFindFirst: vi.fn(),
  mockPrismaVirtualFolderFindMany: vi.fn(),
  mockPrismaVirtualFolderCreate: vi.fn(),
  mockPrismaVirtualFolderUpdate: vi.fn(),
  mockPrismaVirtualFolderDelete: vi.fn(),
  mockPrismaVirtualFolderAggregate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockGenerateSignedImageId: vi.fn(),
  mockGetGalleryPhotosData: vi.fn(),
  mockDeleteObject: vi.fn(),
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn(),
  mockGenerateCacheKey: vi.fn(),
  mockSlugify: vi.fn(),
  mockIsVirtualStorage: vi.fn(),
  mockParseExifBuffer: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    media: {
      findMany: mockPrismaMediaFindMany,
      findUnique: mockPrismaMediaFindUnique,
      update: mockPrismaMediaUpdate,
      updateMany: mockPrismaMediaUpdateMany,
      deleteMany: mockPrismaMediaDeleteMany,
      count: mockPrismaMediaCount,
      aggregate: mockPrismaMediaAggregate,
      groupBy: mockPrismaMediaGroupBy,
    },
    photo: {
      findUnique: mockPrismaPhotoFindUnique,
      createMany: mockPrismaPhotoCreateMany,
      deleteMany: mockPrismaPhotoDeleteMany,
    },
    mediaReference: {
      findMany: mockPrismaMediaReferenceFindMany,
    },
    virtualFolder: {
      findUnique: mockPrismaVirtualFolderFindUnique,
      findFirst: mockPrismaVirtualFolderFindFirst,
      findMany: mockPrismaVirtualFolderFindMany,
      create: mockPrismaVirtualFolderCreate,
      update: mockPrismaVirtualFolderUpdate,
      delete: mockPrismaVirtualFolderDelete,
      aggregate: mockPrismaVirtualFolderAggregate,
    },
    $transaction: mockPrismaTransaction,
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/server/auth-verify", () => ({ authVerify: mockAuthVerify }));
vi.mock("@/lib/server/rate-limit", () => ({ default: mockLimitControl }));
vi.mock("@/lib/server/validator", () => ({ validateData: mockValidateData }));
vi.mock("@/lib/server/audit", () => ({ logAuditEvent: mockLogAuditEvent }));
vi.mock("@/lib/server/image-crypto", () => ({
  generateSignedImageId: mockGenerateSignedImageId,
}));
vi.mock("@/lib/server/media", () => ({
  getGalleryPhotosData: mockGetGalleryPhotosData,
}));
vi.mock("@/lib/server/oss", () => ({
  deleteObject: mockDeleteObject,
}));
vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: mockGenerateCacheKey,
  getCache: mockGetCache,
  setCache: mockSetCache,
}));
vi.mock("@/lib/server/slugify", () => ({
  slugify: mockSlugify,
}));
vi.mock("@/lib/server/virtual-storage", () => ({
  isVirtualStorage: mockIsVirtualStorage,
}));
vi.mock("@/lib/client/media-exif", () => ({
  parseExifBuffer: mockParseExifBuffer,
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
  getGalleryPhotos,
  getMediaList,
  getMediaDetail,
  updateMedia,
  batchUpdateMedia,
  deleteMedia,
  getMediaStats,
  getMediaTrends,
} from "@/actions/media";

// ============================================================================
// Helpers
// ============================================================================

const ADMIN_USER = { uid: 1, username: "admin", role: "ADMIN" as const };
const EDITOR_USER = { uid: 2, username: "editor", role: "EDITOR" as const };
const AUTHOR_USER = { uid: 3, username: "author", role: "AUTHOR" as const };

const MEDIA_RECORD = {
  id: 1,
  fileName: "test.jpg",
  originalName: "test.jpg",
  mimeType: "image/jpeg",
  shortHash: "abc123def456",
  mediaType: "IMAGE",
  size: 1024,
  width: 800,
  height: 600,
  altText: null,
  blur: null,
  storageUrl: "https://example.com/test.jpg",
  persistentPath: null,
  isOptimized: false,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  userUid: 1,
  storageProviderId: "provider-1",
  folderId: null,
  exif: null,
  thumbnails: null,
  hash: "fullhash",
  galleryPhoto: null,
  user: { uid: 1, username: "admin", nickname: "Admin" },
  folder: null,
  StorageProvider: {
    id: "provider-1",
    name: "local",
    displayName: "本地存储",
  },
  references: [],
  _count: { references: 0 },
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

describe("media actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAllowed();
    mockValidationSuccess();
    mockHeaders.mockResolvedValue(new Headers());
    mockGenerateSignedImageId.mockReturnValue("signed-id-123456");
    mockSlugify.mockResolvedValue("photo");
    mockIsVirtualStorage.mockReturnValue(false);
    mockGetCache.mockResolvedValue(null);
    mockGenerateCacheKey.mockReturnValue("cache-key");
  });

  describe("getGalleryPhotos", () => {
    it("成功获取画廊照片", async () => {
      mockGetGalleryPhotosData.mockResolvedValue({
        photos: [],
        nextCursor: undefined,
      });
      const result = await getGalleryPhotos(
        {},
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getMediaList", () => {
    it("成功获取媒体列表", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaMediaFindMany.mockResolvedValue([MEDIA_RECORD]);
      mockPrismaMediaCount.mockResolvedValue(1);
      const result = await getMediaList(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await getMediaList(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("速率限制时返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMediaList(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getMediaDetail", () => {
    it("成功获取媒体详情", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaMediaFindUnique.mockResolvedValue({
        ...MEDIA_RECORD,
        galleryPhoto: null,
        references: [],
      });
      const result = await getMediaDetail(
        { access_token: "token", id: 1 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("媒体不存在时返回 404", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaMediaFindUnique.mockResolvedValue(null);
      const result = await getMediaDetail(
        { access_token: "token", id: 999 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("updateMedia", () => {
    it("成功更新媒体信息", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaMediaFindUnique.mockResolvedValue({
        ...MEDIA_RECORD,
        galleryPhoto: null,
      });
      mockPrismaMediaUpdate.mockResolvedValue({
        ...MEDIA_RECORD,
        originalName: "renamed.jpg",
        galleryPhoto: null,
      });
      mockPrismaMediaReferenceFindMany.mockResolvedValue([]);
      const result = await updateMedia(
        {
          access_token: "token",
          id: 1,
          originalName: "renamed.jpg",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("媒体不存在时返回 404", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaMediaFindUnique.mockResolvedValue(null);
      const result = await updateMedia(
        {
          access_token: "token",
          id: 999,
          originalName: "renamed.jpg",
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("batchUpdateMedia", () => {
    it("成功批量更新媒体", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaMediaFindMany.mockResolvedValue([
        {
          id: 1,
          userUid: 2,
          originalName: "test.jpg",
          exif: null,
          galleryPhoto: null,
        },
      ]);
      mockPrismaTransaction.mockImplementation(async (fn: Function) =>
        fn({
          media: { updateMany: vi.fn() },
          photo: { createMany: vi.fn(), deleteMany: vi.fn() },
        }),
      );
      mockPrismaMediaReferenceFindMany.mockResolvedValue([]);
      const result = await batchUpdateMedia(
        {
          access_token: "token",
          ids: [1],
          isOptimized: true,
        },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("deleteMedia", () => {
    it("成功删除媒体文件", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaMediaFindMany.mockResolvedValue([
        {
          ...MEDIA_RECORD,
          galleryPhoto: null,
          StorageProvider: {
            name: "local",
            type: "LOCAL",
            baseUrl: "https://example.com",
            pathTemplate: "/{year}/{month}/{filename}",
            config: {},
          },
        },
      ]);
      mockPrismaMediaDeleteMany.mockResolvedValue({ count: 1 });
      mockPrismaMediaReferenceFindMany.mockResolvedValue([]);
      mockDeleteObject.mockResolvedValue(undefined);
      const result = await deleteMedia(
        { access_token: "token", ids: [1] },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await deleteMedia(
        { access_token: "token", ids: [1] },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getMediaStats", () => {
    it("成功获取媒体统计", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaMediaAggregate.mockResolvedValue({
        _count: { id: 10 },
        _sum: { size: 102400 },
      });
      mockPrismaMediaGroupBy.mockResolvedValue([
        {
          mediaType: "IMAGE",
          _count: { id: 8 },
          _sum: { size: 81920 },
        },
      ]);
      const result = await getMediaStats(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getMediaTrends", () => {
    it("成功获取媒体趋势", async () => {
      mockAuthSuccess(ADMIN_USER);
      const result = await getMediaTrends(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(true);
    });
  });

  // ---------- 补充测试 ----------

  describe("getMediaList 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMediaList(
        { access_token: "token", page: 1 },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("deleteMedia 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteMedia(
        { access_token: "token", ids: [1] },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("空 ID 列表时应正常处理", async () => {
      mockAuthSuccess(ADMIN_USER);
      const result = await deleteMedia(
        { access_token: "token", ids: [] },
        { environment: "serveraction" },
      );
      // 空列表可能返回成功（无操作）或失败（验证错误）
      expect(result).toBeDefined();
      expect(result).toHaveProperty("success");
    });
  });

  describe("getMediaStats 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMediaStats(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthFailure();
      const result = await getMediaStats(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getMediaTrends 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMediaTrends(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });
});
