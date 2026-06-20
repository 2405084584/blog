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
    cloudTriggerHistory: {
      count: vi.fn(),
      findMany: vi.fn(),
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
      return { success: false, status: 401 };
    }
    tooManyRequests() {
      return { success: false, status: 429 };
    }
    serverError() {
      return { success: false, status: 500 };
    }
    badGateway(opts?: unknown) {
      return {
        success: false,
        status: 502,
        ...(opts as Record<string, unknown>),
      };
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

vi.mock("@/lib/server/config-cache", () => ({
  getConfigs: vi.fn(async () => []),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: vi.fn(() => "abc123"),
  };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      readFile: vi.fn(async () => JSON.stringify({ version: "5.0.0" })),
    },
    readFile: vi.fn(async () => JSON.stringify({ version: "5.0.0" })),
  };
});

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    sign: vi.fn(() => Buffer.from("mock-signature")),
    createPrivateKey: vi.fn((key: string) => key),
    generateKeyPairSync: vi.fn(() => ({
      publicKey: { export: vi.fn(() => "mock-pub-key") },
      privateKey: { export: vi.fn(() => "mock-priv-key") },
    })),
    randomUUID: vi.fn(() => "mock-uuid-1234"),
  };
});

vi.mock("@/lib/shared/cloud-signature", () => ({
  buildCloudSignMessage: vi.fn(() => "mock-message"),
  encodeBase64Url: vi.fn(() => "mock-sig"),
  generateNonce: vi.fn(() => "mock-nonce"),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { authVerify } from "@/lib/server/auth-verify";
import limitControl from "@/lib/server/rate-limit";
import prisma from "@/lib/server/prisma";
import { validateData } from "@/lib/server/validator";
import { getConfigs } from "@/lib/server/config-cache";

const mockLimitControl = vi.mocked(limitControl);
const mockValidateData = vi.mocked(validateData);
const mockAuthVerify = vi.mocked(authVerify);
const mockGetConfigs = vi.mocked(getConfigs);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSuccessMocks() {
  mockLimitControl.mockResolvedValue(true as never);
  mockValidateData.mockReturnValue(null as never);
  mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" } as never);
}

function setupCloudConfig(enabled = true) {
  mockGetConfigs.mockImplementation(async (keys: string[]) => {
    const map: Record<string, unknown> = {
      "cloud.enable": enabled,
      "cloud.id": "test-site-id",
      "cloud.schedule.time": "03:00",
      "cloud.api.baseUrl": "https://cloud.neutralpress.net",
      "cloud.verify.dohDomain": "key.neutralpress.net",
      "cloud.verify.jwksUrl":
        "https://cloud.neutralpress.net/.well-known/jwks.json",
      "cloud.verify.issuer": "np-cloud",
      "cloud.verify.audience": "np-instance",
      "cloud.key.pub": "mock-pub-key",
      "cloud.key.priv": "mock-priv-key",
      "cloud.key.alg": "ed25519",
      "site.url": "https://example.com",
    };
    return keys.map((k) => map[k] ?? null);
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("cloud actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.config.findMany).mockResolvedValue([
      { updatedAt: new Date("2025-01-01") },
    ] as never);
  });

  // ==========================================================================
  // getCloudConfig
  // ==========================================================================
  describe("getCloudConfig", () => {
    it("返回云端配置 - 成功路径", async () => {
      setupSuccessMocks();
      setupCloudConfig();

      const { getCloudConfig } = await import("@/actions/cloud");
      const result = await getCloudConfig({ access_token: "valid-token" });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getCloudConfig } = await import("@/actions/cloud");
      const result = await getCloudConfig({ access_token: "invalid" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("速率限制触发返回 429", async () => {
      mockLimitControl.mockResolvedValue(false as never);

      const { getCloudConfig } = await import("@/actions/cloud");
      const result = await getCloudConfig({ access_token: "valid-token" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });
  });

  // ==========================================================================
  // updateCloudConfig
  // ==========================================================================
  describe("updateCloudConfig", () => {
    it("更新云端配置 - 成功路径", async () => {
      setupSuccessMocks();
      setupCloudConfig();
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: never) => {
        const tx = {
          config: { upsert: vi.fn().mockResolvedValue({}) },
        };
        return (fn as (tx: unknown) => Promise<unknown>)(tx);
      });

      const { updateCloudConfig } = await import("@/actions/cloud");
      const result = await updateCloudConfig({
        access_token: "valid-token",
        enabled: true,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("无配置项返回 400", async () => {
      setupSuccessMocks();
      setupCloudConfig();

      const { updateCloudConfig } = await import("@/actions/cloud");
      const result = await updateCloudConfig({
        access_token: "valid-token",
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 400 }),
      );
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { updateCloudConfig } = await import("@/actions/cloud");
      const result = await updateCloudConfig({
        access_token: "invalid",
        enabled: true,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });

  // ==========================================================================
  // syncCloudNow
  // ==========================================================================
  describe("syncCloudNow", () => {
    it("云功能禁用时返回 synced=false", async () => {
      setupSuccessMocks();
      setupCloudConfig(false);

      const { syncCloudNow } = await import("@/actions/cloud");
      const result = await syncCloudNow({ access_token: "valid-token" });

      expect(result).toEqual(expect.objectContaining({ success: true }));
      const data = (result as Record<string, unknown>).data as Record<
        string,
        unknown
      >;
      expect(data.synced).toBe(false);
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { syncCloudNow } = await import("@/actions/cloud");
      const result = await syncCloudNow({ access_token: "invalid" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });

  // ==========================================================================
  // getCloudHistory
  // ==========================================================================
  describe("getCloudHistory", () => {
    it("返回云端历史 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.cloudTriggerHistory.count).mockResolvedValue(0);
      vi.mocked(prisma.cloudTriggerHistory.findMany).mockResolvedValue([]);

      const { getCloudHistory } = await import("@/actions/cloud");
      const result = await getCloudHistory({
        access_token: "valid-token",
        page: 1,
        pageSize: 25,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getCloudHistory } = await import("@/actions/cloud");
      const result = await getCloudHistory({
        access_token: "invalid",
        page: 1,
        pageSize: 25,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });

  // ==========================================================================
  // getCloudTrends
  // ==========================================================================
  describe("getCloudTrends", () => {
    it("返回云端趋势 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.cloudTriggerHistory.findMany).mockResolvedValue([]);

      const { getCloudTrends } = await import("@/actions/cloud");
      const result = await getCloudTrends({
        access_token: "valid-token",
        days: 30,
        count: 60,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getCloudTrends } = await import("@/actions/cloud");
      const result = await getCloudTrends({
        access_token: "invalid",
        days: 30,
        count: 60,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });
});
