import { createRequire } from "module";

import { getPrismaDatabaseUrl } from "./load-env";

type PrismaClientInstance = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

type PrismaClientConstructor = new (options?: unknown) => PrismaClientInstance;

type PgPoolInstance = {
  end(): Promise<void>;
};

type PrismaScriptRuntime = {
  prisma: PrismaClientInstance;
  pool: PgPoolInstance;
};

type PrismaClientModuleNamespace = {
  PrismaClient?: PrismaClientConstructor;
  default?: {
    PrismaClient?: PrismaClientConstructor;
  };
};

const requireModule = createRequire(import.meta.url);

function extractPrismaClient(
  namespace: PrismaClientModuleNamespace,
): PrismaClientConstructor | null {
  return namespace.PrismaClient ?? namespace.default?.PrismaClient ?? null;
}

export async function loadPrismaClientConstructor(): Promise<PrismaClientConstructor> {
  const errors: string[] = [];

  try {
    const namespace = requireModule(
      ".prisma/client",
    ) as PrismaClientModuleNamespace;
    const PrismaClient = extractPrismaClient(namespace);
    if (PrismaClient) {
      return PrismaClient;
    }
    errors.push('".prisma/client" 已加载但未导出 PrismaClient');
  } catch (error) {
    errors.push(
      `".prisma/client" 加载失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const namespace = requireModule(
      "@prisma/client",
    ) as PrismaClientModuleNamespace;
    const PrismaClient = extractPrismaClient(namespace);
    if (PrismaClient) {
      return PrismaClient;
    }
    errors.push('"@prisma/client" 已加载但未导出 PrismaClient');
  } catch (error) {
    errors.push(
      `"@prisma/client" 加载失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  throw new Error(
    [
      "无法加载 PrismaClient 构造函数。",
      "已尝试以下模块：",
      ...errors.map((message) => `- ${message}`),
    ].join("\n"),
  );
}

export async function createPrismaScriptRuntime(): Promise<PrismaScriptRuntime> {
  const PrismaClient = await loadPrismaClientConstructor();
  const [{ Pool }, { PrismaPg }] = await Promise.all([
    import("pg"),
    import("@prisma/adapter-pg"),
  ]);

  const pool = new Pool({
    connectionString: getPrismaDatabaseUrl(),
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: [],
  });

  await prisma.$connect();

  return {
    prisma,
    pool,
  };
}

export async function closePrismaScriptRuntime(
  runtime: PrismaScriptRuntime | null | undefined,
): Promise<void> {
  if (!runtime) {
    return;
  }

  await runtime.prisma.$disconnect();
  await runtime.pool.end();
}
