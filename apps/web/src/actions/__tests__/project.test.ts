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
  project: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  category: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mediaReference: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  media: {
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/server/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/server/config-cache", () => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/server/cron-task-runner", () => ({
  runProjectsGithubSync: vi.fn(),
}));

vi.mock("@/lib/server/image-crypto", () => ({
  generateSignature: vi.fn().mockReturnValue("?sig=test"),
}));

vi.mock("@/lib/server/media-reference", () => ({
  findMediaIdByUrl: vi.fn().mockResolvedValue(null),
  getAllFeaturedImageUrls: vi.fn().mockReturnValue([]),
  getFeaturedImageUrl: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/server/slugify", () => ({
  slugify: vi.fn().mockResolvedValue("test-slug"),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

vi.mock("@/types/media", () => ({
  MEDIA_SLOTS: {
    PROJECT_FEATURED_IMAGE: "projectFeaturedImage",
    PROJECT_CONTENT_IMAGE: "projectContentImage",
  },
}));

// ============ Tests ============

describe("project actions", () => {
  let getProjectsList: typeof import("@/actions/project").getProjectsList;
  let getProjectDetail: typeof import("@/actions/project").getProjectDetail;
  let createProject: typeof import("@/actions/project").createProject;
  let deleteProjects: typeof import("@/actions/project").deleteProjects;
  let getProjectsTrends: typeof import("@/actions/project").getProjectsTrends;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/project");
    getProjectsList = mod.getProjectsList;
    getProjectDetail = mod.getProjectDetail;
    createProject = mod.createProject;
    deleteProjects = mod.deleteProjects;
    getProjectsTrends = mod.getProjectsTrends;
  });

  // ---------- getProjectsTrends ----------

  describe("getProjectsTrends", () => {
    it("非管理员/编辑/作者应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getProjectsTrends({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("成功获取趋势", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(5);

      const result = await getProjectsTrends({
        access_token: "token",
        days: 7,
        count: 3,
      });
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  // ---------- getProjectsList ----------

  describe("getProjectsList", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getProjectsList({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("非管理员/编辑/作者应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getProjectsList({ access_token: "token" });
      expect(result.success).toBe(false);
    });

    it("成功获取项目列表", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.count.mockResolvedValue(1);
      mockPrisma.project.findMany.mockResolvedValue([
        {
          id: 1,
          title: "Test Project",
          slug: "test-project",
          description: "A test project",
          status: "PUBLISHED",
          demoUrl: null,
          repoUrl: null,
          urls: [],
          techStack: ["TypeScript"],
          repoPath: "user/repo",
          stars: 10,
          forks: 2,
          languages: { TypeScript: 100 },
          license: "MIT",
          enableGithubSync: false,
          enableConentSync: false,
          isFeatured: false,
          sortOrder: 0,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: null,
          completedAt: null,
          author: { uid: 1, username: "admin", nickname: "Admin" },
          categories: [{ name: "Category1" }],
          tags: [{ name: "tag1", slug: "tag1" }],
          mediaRefs: [],
        },
      ]);

      const result = await getProjectsList({ access_token: "token" });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Test Project");
    });
  });

  // ---------- getProjectDetail ----------

  describe("getProjectDetail", () => {
    it("项目不存在时应返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getProjectDetail({
        access_token: "token",
        slug: "nonexistent",
      });
      expect(result.success).toBe(false);
    });

    it("AUTHOR 无权访问他人项目时应返回 403", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "AUTHOR" });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 1,
        userUid: 2,
        title: "Other's Project",
      });

      const result = await getProjectDetail({
        access_token: "token",
        slug: "other-project",
      });
      expect(result.success).toBe(false);
    });

    it("成功获取项目详情", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 1,
        title: "Test",
        slug: "test",
        description: "Desc",
        content: "# Hello",
        status: "PUBLISHED",
        demoUrl: null,
        repoUrl: null,
        urls: [],
        techStack: null,
        repoPath: null,
        stars: 0,
        forks: 0,
        languages: null,
        license: null,
        enableGithubSync: false,
        enableConentSync: false,
        isFeatured: false,
        sortOrder: 0,
        metaDescription: null,
        metaKeywords: null,
        robotsIndex: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        userUid: 1,
        author: { uid: 1, username: "admin", nickname: "Admin" },
        categories: [],
        tags: [],
        mediaRefs: [],
      });

      const result = await getProjectDetail({
        access_token: "token",
        slug: "test",
      });
      expect(result.success).toBe(true);
      expect(result.data.title).toBe("Test");
    });
  });

  // ---------- createProject ----------

  describe("createProject", () => {
    it("slug 已存在时应返回 400", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.findUnique.mockResolvedValue({ id: 99 });

      const result = await createProject({
        access_token: "token",
        title: "New",
        slug: "existing",
      });
      expect(result.success).toBe(false);
    });

    it("成功创建项目", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.findUnique.mockResolvedValue(null);
      mockPrisma.category.findFirst.mockResolvedValue({
        id: 1,
        slug: "uncategorized",
        path: "1",
        depth: 0,
        fullSlug: "uncategorized",
      });
      mockPrisma.project.create.mockResolvedValue({
        id: 1,
        slug: "new-project",
        status: "DRAFT",
        tags: [],
        categories: [],
      });

      const result = await createProject({
        access_token: "token",
        title: "New Project",
        description: "A new project",
      });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
    });
  });

  // ---------- deleteProjects ----------

  describe("deleteProjects", () => {
    it("AUTHOR 只能删除自己的项目", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "AUTHOR" });
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.updateMany.mockResolvedValue({ count: 0 });

      const result = await deleteProjects({
        access_token: "token",
        ids: [1, 2],
      });
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(0);
    });

    it("成功删除项目", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.project.findMany.mockResolvedValue([
        {
          id: 1,
          slug: "test",
          title: "Test",
          status: "PUBLISHED",
          tags: [{ slug: "tag1" }],
          categories: [{ fullSlug: "cat1" }],
        },
      ]);
      mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });

      const result = await deleteProjects({ access_token: "token", ids: [1] });
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(1);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteProjects({ access_token: "token", ids: [1] });
      expect(result.success).toBe(false);
    });
  });

  // ---------- 补充测试 ----------

  describe("getProjectsList 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getProjectsList({ access_token: "token", page: 1 });
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getProjectsList({ access_token: "token", page: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe("createProject 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await createProject({
        access_token: "token",
        title: "New Project",
      });
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await createProject({
        access_token: "token",
        title: "New Project",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getProjectDetail 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getProjectDetail({
        access_token: "token",
        slug: "test",
      });
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getProjectDetail({
        access_token: "token",
        slug: "test",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getProjectsTrends 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getProjectsTrends({ access_token: "token" });
      expect(result.success).toBe(false);
    });
  });
});
