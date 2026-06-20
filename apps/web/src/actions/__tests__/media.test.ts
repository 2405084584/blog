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
  getAccessibleFolders,
  getFolderBreadcrumb,
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

const FOLDER_RECORD = {
  id: 10,
  name: "测试文件夹",
  systemType: "NORMAL",
  userUid: 1,
  parentId: 1,
  path: "1/10",
  depth: 1,
  order: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const ROOT_PUBLIC_FOLDER = {
  id: 1,
  name: "公共空间",
  systemType: "ROOT_PUBLIC",
  userUid: null,
  parentId: null,
  path: "1",
  depth: 0,
  order: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const ROOT_USERS_FOLDER = {
  id: 2,
  name: "用户目录",
  systemType: "ROOT_USERS",
  userUid: null,
  parentId: null,
  path: "2",
  depth: 0,
  order: 1,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const USER_HOME_FOLDER = {
  id: 3,
  name: "我的文件夹",
  systemType: "USER_HOME",
  userUid: 1,
  parentId: 2,
  path: "2/3",
  depth: 1,
  order: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
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

  // ==================== getGalleryPhotos ====================

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

    it("应传递 cursorId 参数", async () => {
      mockGetGalleryPhotosData.mockResolvedValue({
        photos: [],
        nextCursor: undefined,
      });
      await getGalleryPhotos({ cursorId: 10 }, { environment: "serveraction" });
      expect(mockGetGalleryPhotosData).toHaveBeenCalledWith(
        expect.objectContaining({ cursorId: 10 }),
      );
    });

    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getGalleryPhotos(
        {},
        { environment: "serveraction" },
      );
      expect(result.success).toBe(false);
    });
  });

  // ==================== getMediaList ====================

  describe("getMediaList", () => {
    describe("认证", () => {
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

      it("所有角色都可访问", async () => {
        for (const user of [ADMIN_USER, EDITOR_USER, AUTHOR_USER]) {
          mockAuthSuccess(user);
          mockPrismaMediaFindMany.mockResolvedValue([]);
          mockPrismaMediaCount.mockResolvedValue(0);
          const result = await getMediaList(
            { access_token: "token" },
            { environment: "serveraction" },
          );
          expect(result.success).toBe(true);
        }
      });
    });

    describe("分页", () => {
      it("应返回正确的分页信息", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaMediaFindMany.mockResolvedValue([MEDIA_RECORD]);
        mockPrismaMediaCount.mockResolvedValue(1);

        const result = await getMediaList(
          { access_token: "token", page: 1, pageSize: 25 },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
        expect(result.meta).toBeDefined();
      });
    });

    describe("返回数据结构", () => {
      it("应包含必要的字段", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaMediaFindMany.mockResolvedValue([MEDIA_RECORD]);
        mockPrismaMediaCount.mockResolvedValue(1);

        const result = await getMediaList(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toHaveProperty("id");
        expect(result.data[0]).toHaveProperty("fileName");
        expect(result.data[0]).toHaveProperty("originalName");
      });

      it("应生成签名 imageId", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaMediaFindMany.mockResolvedValue([MEDIA_RECORD]);
        mockPrismaMediaCount.mockResolvedValue(1);

        await getMediaList(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(mockGenerateSignedImageId).toHaveBeenCalled();
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getMediaList(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== getMediaDetail ====================

  describe("getMediaDetail", () => {
    describe("认证", () => {
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

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await getMediaDetail(
          { access_token: "token", id: 1 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("不存在", () => {
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

    describe("权限控制", () => {
      it("AUTHOR 不能访问其他用户的文件", async () => {
        mockAuthSuccess(AUTHOR_USER);
        mockPrismaMediaFindUnique.mockResolvedValue({
          ...MEDIA_RECORD,
          userUid: 999, // 其他用户
          galleryPhoto: null,
          references: [],
        });
        const result = await getMediaDetail(
          { access_token: "token", id: 1 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });

      it("AUTHOR 可以访问自己的文件", async () => {
        mockAuthSuccess(AUTHOR_USER);
        mockPrismaMediaFindUnique.mockResolvedValue({
          ...MEDIA_RECORD,
          userUid: 3, // AUTHOR_USER
          galleryPhoto: null,
          references: [],
        });
        const result = await getMediaDetail(
          { access_token: "token", id: 1 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(true);
      });

      it("ADMIN 可以访问任何文件", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaMediaFindUnique.mockResolvedValue({
          ...MEDIA_RECORD,
          userUid: 999,
          galleryPhoto: null,
          references: [],
        });
        const result = await getMediaDetail(
          { access_token: "token", id: 1 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(true);
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getMediaDetail(
          { access_token: "token", id: 1 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== updateMedia ====================

  describe("updateMedia", () => {
    describe("认证", () => {
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

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await updateMedia(
          { access_token: "token", id: 1, originalName: "renamed.jpg" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("不存在", () => {
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

    describe("权限控制", () => {
      it("AUTHOR 不能编辑其他用户的文件", async () => {
        mockAuthSuccess(AUTHOR_USER);
        mockPrismaMediaFindUnique.mockResolvedValue({
          ...MEDIA_RECORD,
          userUid: 999,
          galleryPhoto: null,
        });
        const result = await updateMedia(
          {
            access_token: "token",
            id: 1,
            originalName: "renamed.jpg",
          },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await updateMedia(
          { access_token: "token", id: 1, originalName: "renamed.jpg" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== batchUpdateMedia ====================

  describe("batchUpdateMedia", () => {
    describe("认证", () => {
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

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await batchUpdateMedia(
          { access_token: "token", ids: [1] },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("不存在", () => {
      it("没有找到媒体时返回 404", async () => {
        mockAuthSuccess(EDITOR_USER);
        mockPrismaMediaFindMany.mockResolvedValue([]);
        const result = await batchUpdateMedia(
          { access_token: "token", ids: [999] },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await batchUpdateMedia(
          { access_token: "token", ids: [1] },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== deleteMedia ====================

  describe("deleteMedia", () => {
    describe("认证", () => {
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

    describe("权限控制", () => {
      it("AUTHOR 只能删除自己的文件", async () => {
        mockAuthSuccess(AUTHOR_USER);
        mockPrismaMediaFindMany.mockResolvedValue([
          {
            ...MEDIA_RECORD,
            userUid: 3, // AUTHOR_USER
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
    });

    describe("存储后端删除", () => {
      it("应调用 deleteObject 删除文件", async () => {
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

        await deleteMedia(
          { access_token: "token", ids: [1] },
          { environment: "serveraction" },
        );

        expect(mockDeleteObject).toHaveBeenCalled();
      });

      it("虚拟存储应跳过删除", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockIsVirtualStorage.mockReturnValue(true);
        mockPrismaMediaFindMany.mockResolvedValue([
          {
            ...MEDIA_RECORD,
            galleryPhoto: null,
            StorageProvider: {
              name: "external",
              type: "EXTERNAL_URL",
              baseUrl: "https://example.com",
              pathTemplate: "/{year}/{month}/{filename}",
              config: {},
            },
          },
        ]);
        mockPrismaMediaDeleteMany.mockResolvedValue({ count: 1 });
        mockPrismaMediaReferenceFindMany.mockResolvedValue([]);

        await deleteMedia(
          { access_token: "token", ids: [1] },
          { environment: "serveraction" },
        );

        expect(mockDeleteObject).not.toHaveBeenCalled();
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await deleteMedia(
          { access_token: "token", ids: [1] },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== getMediaStats ====================

  describe("getMediaStats", () => {
    describe("认证", () => {
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

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await getMediaStats(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("缓存行为", () => {
      it("有缓存时应返回缓存数据", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockGetCache.mockResolvedValue({
          totalFiles: 10,
          totalSize: 102400,
          typeDistribution: [],
          dailyStats: [],
        });

        const result = await getMediaStats(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("无缓存时应查询数据库", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockGetCache.mockResolvedValue(null);
        mockPrismaMediaAggregate.mockResolvedValue({
          _count: { id: 10 },
          _sum: { size: 102400 },
        });
        mockPrismaMediaGroupBy.mockResolvedValue([]);

        await getMediaStats(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(mockPrismaMediaAggregate).toHaveBeenCalled();
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getMediaStats(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== getMediaTrends ====================

  describe("getMediaTrends", () => {
    describe("认证", () => {
      it("成功获取媒体趋势", async () => {
        mockAuthSuccess(ADMIN_USER);
        const result = await getMediaTrends(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(true);
      });

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await getMediaTrends(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getMediaTrends(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== getAccessibleFolders ====================

  describe("getAccessibleFolders", () => {
    describe("认证", () => {
      it("成功获取文件夹列表", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindFirst.mockResolvedValue(ROOT_PUBLIC_FOLDER);
        mockPrismaVirtualFolderFindMany.mockResolvedValue([
          ROOT_PUBLIC_FOLDER,
          ROOT_USERS_FOLDER,
          USER_HOME_FOLDER,
        ]);
        // mock $queryRaw for batchGetFolderFileCounts
        const prisma = (await import("@/lib/server/prisma")).default;
        (prisma.$queryRaw as any).mockResolvedValue([
          { folderId: 1, count: 5 },
        ]);

        const result = await getAccessibleFolders(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(true);
      });

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await getAccessibleFolders(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });

      it("所有角色都可访问", async () => {
        for (const user of [ADMIN_USER, EDITOR_USER, AUTHOR_USER]) {
          mockAuthSuccess(user);
          mockPrismaVirtualFolderFindFirst.mockResolvedValue(
            ROOT_PUBLIC_FOLDER,
          );
          mockPrismaVirtualFolderFindMany.mockResolvedValue([
            ROOT_PUBLIC_FOLDER,
            USER_HOME_FOLDER,
          ]);
          const prisma = (await import("@/lib/server/prisma")).default;
          (prisma.$queryRaw as any).mockResolvedValue([]);

          const result = await getAccessibleFolders(
            { access_token: "token" },
            { environment: "serveraction" },
          );
          expect(result.success).toBe(true);
        }
      });
    });

    describe("根目录行为", () => {
      it("应包含 ROOT_PUBLIC", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindFirst.mockResolvedValue(ROOT_PUBLIC_FOLDER);
        mockPrismaVirtualFolderFindMany.mockResolvedValue([
          ROOT_PUBLIC_FOLDER,
          ROOT_USERS_FOLDER,
          USER_HOME_FOLDER,
        ]);
        const prisma = (await import("@/lib/server/prisma")).default;
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const result = await getAccessibleFolders(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it("ADMIN/EDITOR 应能看到 ROOT_USERS", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindFirst.mockResolvedValue(ROOT_PUBLIC_FOLDER);
        mockPrismaVirtualFolderFindMany.mockResolvedValue([
          ROOT_PUBLIC_FOLDER,
          ROOT_USERS_FOLDER,
          USER_HOME_FOLDER,
        ]);
        const prisma = (await import("@/lib/server/prisma")).default;
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const result = await getAccessibleFolders(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
      });

      it("AUTHOR 不应看到 ROOT_USERS", async () => {
        mockAuthSuccess(AUTHOR_USER);
        mockPrismaVirtualFolderFindFirst.mockResolvedValue(ROOT_PUBLIC_FOLDER);
        mockPrismaVirtualFolderFindMany.mockResolvedValue([
          ROOT_PUBLIC_FOLDER,
          USER_HOME_FOLDER,
        ]);
        const prisma = (await import("@/lib/server/prisma")).default;
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const result = await getAccessibleFolders(
          { access_token: "token" },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
      });
    });

    describe("子文件夹行为", () => {
      it("应返回指定 parentId 的子文件夹", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindUnique.mockResolvedValue(ROOT_PUBLIC_FOLDER);
        mockPrismaVirtualFolderFindMany.mockResolvedValue([FOLDER_RECORD]);
        const prisma = (await import("@/lib/server/prisma")).default;
        (prisma.$queryRaw as any).mockResolvedValue([]);

        const result = await getAccessibleFolders(
          { access_token: "token", parentId: 1 },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
      });

      it("父文件夹不存在时返回 404", async () => {
        mockAuthSuccess(AUTHOR_USER);
        mockPrismaVirtualFolderFindUnique.mockResolvedValue(null);

        const result = await getAccessibleFolders(
          { access_token: "token", parentId: 999 },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(false);
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getAccessibleFolders(
          { access_token: "token" },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });

  // ==================== getFolderBreadcrumb ====================

  describe("getFolderBreadcrumb", () => {
    describe("认证", () => {
      it("成功获取面包屑", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindUnique.mockResolvedValue({
          id: 10,
          name: "测试文件夹",
          systemType: "NORMAL",
          userUid: 1,
          path: "1/10",
        });
        mockPrismaVirtualFolderFindMany.mockResolvedValue([
          { id: 1, name: "公共空间", systemType: "ROOT_PUBLIC", userUid: null },
        ]);

        const result = await getFolderBreadcrumb(
          { access_token: "token", folderId: 10 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(true);
      });

      it("未认证时返回未授权", async () => {
        mockAuthFailure();
        const result = await getFolderBreadcrumb(
          { access_token: "token", folderId: 10 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });

      it("所有角色都可访问", async () => {
        for (const user of [ADMIN_USER, EDITOR_USER, AUTHOR_USER]) {
          mockAuthSuccess(user);
          mockPrismaVirtualFolderFindUnique.mockResolvedValue({
            id: 10,
            name: "测试文件夹",
            systemType: "NORMAL",
            userUid: 1,
            path: "1/10",
          });
          mockPrismaVirtualFolderFindMany.mockResolvedValue([
            {
              id: 1,
              name: "公共空间",
              systemType: "ROOT_PUBLIC",
              userUid: null,
            },
          ]);

          const result = await getFolderBreadcrumb(
            { access_token: "token", folderId: 10 },
            { environment: "serveraction" },
          );
          expect(result.success).toBe(true);
        }
      });
    });

    describe("null folderId", () => {
      it("应返回根节点 [{id: null, name: '全部'}]", async () => {
        mockAuthSuccess(ADMIN_USER);

        const result = await getFolderBreadcrumb(
          { access_token: "token", folderId: null },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual([{ id: null, name: "全部" }]);
      });
    });

    describe("不存在", () => {
      it("文件夹不存在时返回 404", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindUnique.mockResolvedValue(null);

        const result = await getFolderBreadcrumb(
          { access_token: "token", folderId: 999 },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(false);
      });
    });

    describe("面包屑构建", () => {
      it("应包含所有祖先文件夹", async () => {
        mockAuthSuccess(ADMIN_USER);
        mockPrismaVirtualFolderFindUnique.mockResolvedValue({
          id: 10,
          name: "子文件夹",
          systemType: "NORMAL",
          userUid: 1,
          path: "1/5/10",
        });
        mockPrismaVirtualFolderFindMany.mockResolvedValue([
          { id: 1, name: "公共空间", systemType: "ROOT_PUBLIC", userUid: null },
          { id: 5, name: "父文件夹", systemType: "NORMAL", userUid: 1 },
        ]);

        const result = await getFolderBreadcrumb(
          { access_token: "token", folderId: 10 },
          { environment: "serveraction" },
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        // 第一个应该是 {id: null, name: "全部"}
        expect(result.data[0]).toEqual({ id: null, name: "全部" });
      });
    });

    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getFolderBreadcrumb(
          { access_token: "token", folderId: 10 },
          { environment: "serveraction" },
        );
        expect(result.success).toBe(false);
      });
    });
  });
});
