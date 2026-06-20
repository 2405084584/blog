import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/server/auth-verify", () => ({
  authVerify: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    config: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/server/response", () => {
  class MockResponseBuilder {
    ok(opts?: unknown) {
      return { success: true, ...(opts as Record<string, unknown>) };
    }
    badRequest(opts?: unknown) {
      return {
        success: false,
        status: 400,
        ...(opts as Record<string, unknown>),
      };
    }
    unauthorized() {
      return { success: false, status: 401, message: "未授权访问" };
    }
    tooManyRequests() {
      return { success: false, status: 429, message: "请求过于频繁" };
    }
    serverError() {
      return { success: false, status: 500, message: "服务器内部错误" };
    }
  }
  return { default: MockResponseBuilder };
});

vi.mock("@/lib/server/validator", () => ({
  validateData: vi.fn(),
}));

vi.mock("@/lib/server/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

vi.mock("@/actions/cloud", () => ({
  syncCloudNow: vi.fn(),
}));

vi.mock("@/data/default-configs", () => ({
  getConfigDefinition: vi.fn(),
  extractDefaultValue: vi.fn((v: unknown) => v),
  extractOptions: vi.fn(() => null),
  extractValidationRules: vi.fn(() => null),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => void) => fn()),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { authVerify } from "@/lib/server/auth-verify";
import limitControl from "@/lib/server/rate-limit";
import prisma from "@/lib/server/prisma";
import { validateData } from "@/lib/server/validator";

const mockLimitControl = vi.mocked(limitControl);
const mockValidateData = vi.mocked(validateData);
const mockAuthVerify = vi.mocked(authVerify);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSuccessMocks() {
  mockLimitControl.mockResolvedValue(true as never);
  mockValidateData.mockReturnValue(null as never);
  mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" } as never);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("setting actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSettings", () => {
    it("返回配置列表 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.config.findMany).mockResolvedValue([
        {
          key: "site.title",
          value: { default: "Test" },
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
        },
      ] as never);

      const { getSettings } = await import("@/actions/setting");
      const result = await getSettings({ access_token: "valid-token" });

      // 如果返回 500，打印结果帮助调试
      if (!(result as Record<string, unknown>).success) {
        console.error("getSettings failed:", JSON.stringify(result, null, 2));
      }

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("速率限制触发时返回 429", async () => {
      mockLimitControl.mockResolvedValue(false as never);

      const { getSettings } = await import("@/actions/setting");
      const result = await getSettings({ access_token: "valid-token" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("未授权用户返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getSettings } = await import("@/actions/setting");
      const result = await getSettings({ access_token: "invalid-token" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误时返回 500", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.config.findMany).mockRejectedValue(
        new Error("DB error"),
      );

      const { getSettings } = await import("@/actions/setting");
      const result = await getSettings({ access_token: "valid-token" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 500 }),
      );
    });
  });

  describe("updateSettings", () => {
    it("未知配置项返回 400", async () => {
      setupSuccessMocks();
      const { getConfigDefinition } = await import("@/data/default-configs");
      vi.mocked(getConfigDefinition).mockReturnValue(null as never);

      const { updateSettings } = await import("@/actions/setting");
      const result = await updateSettings({
        access_token: "valid-token",
        settings: [{ key: "unknown.key", value: "test" }],
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 400 }),
      );
    });

    it("未授权用户返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { updateSettings } = await import("@/actions/setting");
      const result = await updateSettings({
        access_token: "invalid",
        settings: [{ key: "site.title", value: "test" }],
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("速率限制触发时返回 429", async () => {
      mockLimitControl.mockResolvedValue(false as never);

      const { updateSettings } = await import("@/actions/setting");
      const result = await updateSettings({
        access_token: "valid-token",
        settings: [{ key: "site.title", value: "test" }],
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      const { getConfigDefinition } = await import("@/data/default-configs");
      vi.mocked(getConfigDefinition).mockReturnValue({
        type: "string",
        default: "old",
      } as never);
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB error"));

      const { updateSettings } = await import("@/actions/setting");
      const result = await updateSettings({
        access_token: "valid-token",
        settings: [{ key: "site.title", value: "New Title" }],
      });

      // 可能返回 400（验证错误）或 500（服务器错误），但必定失败
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });

  describe("getSettings 补充测试", () => {
    it("返回空配置列表时应正常工作", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.config.findMany).mockResolvedValue([] as never);

      const { getSettings } = await import("@/actions/setting");
      const result = await getSettings({ access_token: "valid-token" });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("返回多个配置项", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.config.findMany).mockResolvedValue([
        {
          key: "site.title",
          value: { default: "Title" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          key: "site.url",
          value: { default: "https://example.com" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never);

      const { getSettings } = await import("@/actions/setting");
      const result = await getSettings({ access_token: "valid-token" });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });
});
