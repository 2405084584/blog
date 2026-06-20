import { beforeEach, describe, expect, it, vi } from "vitest";

// ============ Mocks ============

const mockHeaders = vi.fn().mockReturnValue(new Headers());
vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === "ACCESS_TOKEN") return { value: "test-token" };
      return undefined;
    }),
  })),
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
  customDictionary: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  post: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  searchLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $executeRaw: vi.fn(),
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/server/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/server/tokenizer", () => ({
  analyzeText: vi.fn().mockResolvedValue(["token1", "token2"]),
}));

vi.mock("@/lib/server/search", () => ({
  generateSmartExcerpt: vi.fn().mockReturnValue("excerpt"),
  getLocalDateString: vi.fn().mockReturnValue("2024-01-01"),
  highlightTitle: vi.fn().mockReturnValue("<b>title</b>"),
  markdownToPlainText: vi.fn().mockResolvedValue("plain text"),
}));

vi.mock("@/lib/server/get-client-info", () => ({
  getClientIP: vi.fn().mockResolvedValue("127.0.0.1"),
  getClientUserAgent: vi.fn().mockResolvedValue("test-agent"),
}));

vi.mock("@/lib/server/ip-utils", () => ({
  resolveIpLocation: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/server/image-crypto", () => ({
  generateSignature: vi.fn().mockReturnValue("?sig=test"),
}));

vi.mock("@/lib/server/category-utils", () => ({
  batchGetCategoryPaths: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: vi.fn().mockReturnValue("cache:key"),
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));

// ============ Tests ============

describe("search actions", () => {
  let addCustomWord: typeof import("@/actions/search").addCustomWord;
  let getCustomWords: typeof import("@/actions/search").getCustomWords;
  let deleteCustomWord: typeof import("@/actions/search").deleteCustomWord;
  let searchPosts: typeof import("@/actions/search").searchPosts;
  let searchSite: typeof import("@/actions/search").searchSite;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/search");
    addCustomWord = mod.addCustomWord;
    getCustomWords = mod.getCustomWords;
    deleteCustomWord = mod.deleteCustomWord;
    searchPosts = mod.searchPosts;
    searchSite = mod.searchSite;
  });

  // ---------- addCustomWord ----------

  describe("addCustomWord", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await addCustomWord({ word: "test" });
      expect(result.success).toBe(false);
    });

    it("包含空格时应返回 400", async () => {
      // The function gets token from dynamic import of next/headers
      // Mock cookies for dynamic import
      vi.doMock("next/headers", () => ({
        headers: vi.fn().mockReturnValue(new Headers()),
        cookies: vi.fn(() => ({
          get: vi.fn((name: string) => {
            if (name === "ACCESS_TOKEN") return { value: "test-token" };
            return undefined;
          }),
        })),
      }));
      const result = await addCustomWord({ word: "has space" });
      expect(result.success).toBe(false);
    });

    it("添加已存在的词时应返回冲突", async () => {
      vi.doMock("next/headers", () => ({
        headers: vi.fn().mockReturnValue(new Headers()),
        cookies: vi.fn(() => ({
          get: vi.fn((name: string) => {
            if (name === "ACCESS_TOKEN") return { value: "test-token" };
            return undefined;
          }),
        })),
      }));
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.customDictionary.findUnique.mockResolvedValue({
        id: 1,
        word: "test",
      });

      const result = await addCustomWord({ word: "test" });
      expect(result.success).toBe(false);
    });

    it("成功添加自定义词", async () => {
      vi.doMock("next/headers", () => ({
        headers: vi.fn().mockReturnValue(new Headers()),
        cookies: vi.fn(() => ({
          get: vi.fn((name: string) => {
            if (name === "ACCESS_TOKEN") return { value: "test-token" };
            return undefined;
          }),
        })),
      }));
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.customDictionary.findUnique.mockResolvedValue(null);
      mockPrisma.customDictionary.create.mockResolvedValue({
        id: 1,
        word: "newword",
      });
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await addCustomWord({ word: "newword" });
      expect(result.success).toBe(true);
      expect(result.data.word).toBe("newword");
      expect(result.data.added).toBe(true);
    });
  });

  // ---------- getCustomWords ----------

  describe("getCustomWords", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCustomWords({});
      expect(result.success).toBe(false);
    });

    it("成功获取词典列表", async () => {
      vi.doMock("next/headers", () => ({
        headers: vi.fn().mockReturnValue(new Headers()),
        cookies: vi.fn(() => ({
          get: vi.fn((name: string) => {
            if (name === "ACCESS_TOKEN") return { value: "test-token" };
            return undefined;
          }),
        })),
      }));
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.customDictionary.findMany.mockResolvedValue([
        { id: 1, word: "word1", createdAt: new Date("2024-01-01") },
      ]);

      const result = await getCustomWords({});
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ---------- deleteCustomWord ----------

  describe("deleteCustomWord", () => {
    it("词汇不存在时应返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.customDictionary.findUnique.mockResolvedValue(null);

      const result = await deleteCustomWord({ id: 999 });
      expect(result.success).toBe(false);
    });

    it("成功删除自定义词", async () => {
      vi.doMock("next/headers", () => ({
        headers: vi.fn().mockReturnValue(new Headers()),
        cookies: vi.fn(() => ({
          get: vi.fn((name: string) => {
            if (name === "ACCESS_TOKEN") return { value: "test-token" };
            return undefined;
          }),
        })),
      }));
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.customDictionary.findUnique.mockResolvedValue({
        id: 1,
        word: "test",
      });
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      mockPrisma.customDictionary.delete.mockResolvedValue({});

      const result = await deleteCustomWord({ id: 1 });
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);
    });
  });

  // ---------- searchPosts ----------

  describe("searchPosts", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await searchPosts({ query: "test" });
      expect(result.success).toBe(false);
    });

    it("无分词结果时返回空", async () => {
      const { analyzeText } = await import("@/lib/server/tokenizer");
      (analyzeText as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const result = await searchPosts({ query: "  " });
      expect(result.success).toBe(true);
      expect(result.data.posts).toHaveLength(0);
    });

    it("搜索无结果时返回空列表", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await searchPosts({ query: "nonexistent" });
      expect(result.success).toBe(true);
      expect(result.data.posts).toHaveLength(0);
    });
  });

  // ---------- searchSite ----------

  describe("searchSite", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await searchSite({ query: "test" });
      expect(result.success).toBe(false);
    });

    it("空查询应返回 400（验证失败）", async () => {
      const result = await searchSite({ query: "   " });
      // search-site schema requires min(1) after trim, so whitespace-only should fail
      expect(result.success).toBe(false);
    });
  });
});
