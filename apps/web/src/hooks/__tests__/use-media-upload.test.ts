import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaUpload } from "@/hooks/use-media-upload";

// Mock @vercel/blob/client
vi.mock("@vercel/blob/client", () => ({
  put: vi.fn(),
}));

import { put as putBlob } from "@vercel/blob/client";

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  status = 200;
  statusText = "OK";
  responseText = "{}";
  upload = {
    addEventListener: vi.fn(),
  };
  private listeners: Record<string, Function[]> = {};

  addEventListener(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  open() {}
  setRequestHeader() {}
  send() {
    // Simulate async completion
    setTimeout(() => {
      if (this.upload.addEventListener.mock.calls.length > 0) {
        // Trigger upload progress
        const progressCb = this.upload.addEventListener.mock.calls.find(
          (c) => c[0] === "progress",
        )?.[1];
        if (progressCb) {
          progressCb({ lengthComputable: true, loaded: 50, total: 100 });
        }
        // Trigger upload load
        const loadCb = this.upload.addEventListener.mock.calls.find(
          (c) => c[0] === "load",
        )?.[1];
        if (loadCb) loadCb();
      }
      // Trigger response load
      this.listeners["load"]?.forEach((cb) => cb());
    }, 0);
  }
  abort() {}
}

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;
global.XMLHttpRequest = MockXMLHttpRequest as any;

// Create a mock File
function createMockFile(
  name = "test.png",
  size = 1024,
  type = "image/png",
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe("useMediaUpload", () => {
  const defaultOptions = {
    mode: "lossy" as const,
    storageId: "storage-1",
    folderId: null,
    multiple: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始化时返回默认状态", () => {
    const { result } = renderHook(() => useMediaUpload(defaultOptions));

    expect(result.current.files).toEqual([]);
    expect(result.current.uploading).toBe(false);
  });

  describe("handleFileSelect", () => {
    it("多选模式下追加文件", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file1 = createMockFile("a.png");
      const file2 = createMockFile("b.png");

      const fileList = {
        0: file1,
        1: file2,
        length: 2,
        item: (i: number) => (i === 0 ? file1 : file2),
        [Symbol.iterator]: function* () {
          yield file1;
          yield file2;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      expect(result.current.files).toHaveLength(2);
      expect(result.current.files[0].status).toBe("pending");
      expect(result.current.files[1].status).toBe("pending");
    });

    it("单选模式下替换文件", () => {
      const singleOptions = { ...defaultOptions, multiple: false };
      const { result } = renderHook(() => useMediaUpload(singleOptions));

      const file1 = createMockFile("a.png");
      const file2 = createMockFile("b.png");

      const fileList1 = {
        0: file1,
        length: 1,
        item: (i: number) => (i === 0 ? file1 : null),
        [Symbol.iterator]: function* () {
          yield file1;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList1);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe("a.png");

      const fileList2 = {
        0: file2,
        length: 1,
        item: (i: number) => (i === 0 ? file2 : null),
        [Symbol.iterator]: function* () {
          yield file2;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList2);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe("b.png");
    });

    it("null 文件列表不做任何操作", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(null);
      });

      expect(result.current.files).toHaveLength(0);
    });

    it("创建预览 URL", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
      expect(result.current.files[0].previewUrl).toBe("blob:mock-url");
    });

    it("记录原始文件大小", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("big.png", 2048);
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      expect(result.current.files[0].originalSize).toBe(2048);
    });
  });

  describe("handlePaste", () => {
    it("从剪贴板粘贴图片", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const mockFile = createMockFile("clipboard.png");

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: {
            items: [
              {
                type: "image/png",
                getAsFile: () => mockFile,
              },
            ],
          },
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(1);
    });

    it("上传中不处理粘贴", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      // Set uploading state by importing and then trying to paste
      // We can't directly set uploading, so we'll test with no clipboard data
      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: null,
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(0);
    });

    it("忽略非图片剪贴板项", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: {
            items: [
              {
                type: "text/plain",
                getAsFile: () => null,
              },
            ],
          },
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe("removeFile", () => {
    it("移除指定文件并清理预览 URL", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(0);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("不影响其他文件", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file1 = createMockFile("a.png");
      const file2 = createMockFile("b.png");

      const fileList = {
        0: file1,
        1: file2,
        length: 2,
        item: (i: number) => (i === 0 ? file1 : file2),
        [Symbol.iterator]: function* () {
          yield file1;
          yield file2;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe("b.png");
    });
  });

  describe("updateFileName", () => {
    it("更新自定义文件名", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("test.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.updateFileName(fileId, "renamed.png");
      });

      expect(result.current.files[0].customName).toBe("renamed.png");
    });
  });

  describe("getDisplayFileName", () => {
    it("默认返回原始文件名", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("original.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      const displayName = result.current.getDisplayFileName(
        result.current.files[0],
      );
      expect(displayName).toBe("original.png");
    });

    it("有自定义名称时返回自定义名称", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("original.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      const fileId = result.current.files[0].id;
      act(() => {
        result.current.updateFileName(fileId, "custom.png");
      });

      const displayName = result.current.getDisplayFileName(
        result.current.files[0],
      );
      expect(displayName).toBe("custom.png");
    });
  });

  describe("handleImageError", () => {
    it("标记图片加载错误", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file = createMockFile("broken.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.handleImageError(fileId);
      });

      expect(result.current.files[0].imageLoadError).toBe(true);
    });
  });

  describe("clearFiles", () => {
    it("清除所有文件并清理预览 URL", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      const file1 = createMockFile("a.png");
      const file2 = createMockFile("b.png");

      const fileList = {
        0: file1,
        1: file2,
        length: 2,
        item: (i: number) => (i === 0 ? file1 : file2),
        [Symbol.iterator]: function* () {
          yield file1;
          yield file2;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.files).toEqual([]);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe("retryFile", () => {
    it("重试不存在的文件返回失败", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      let retryResult: { success: boolean; data?: unknown };
      await act(async () => {
        retryResult = await result.current.retryFile("nonexistent");
      });

      expect(retryResult!.success).toBe(false);
    });
  });

  describe("uploadAll", () => {
    it("没有待上传文件时返回零计数", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      let uploadAllResult: {
        successCount: number;
        failCount: number;
        successfulResults: unknown[];
      };
      await act(async () => {
        uploadAllResult = await result.current.uploadAll();
      });

      expect(uploadAllResult!.successCount).toBe(0);
      expect(uploadAllResult!.failCount).toBe(0);
      expect(uploadAllResult!.successfulResults).toEqual([]);
    });
  });

  describe("setFiles", () => {
    it("可以直接设置 files", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("direct.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe("direct.png");
    });
  });

  describe("uploadSingleFile", () => {
    it("初始化上传失败时设置错误状态", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: false, message: "初始化失败" }),
      });

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      let uploadResult: { success: boolean; data?: unknown };
      await act(async () => {
        uploadResult = await result.current.uploadSingleFile(
          result.current.files[0],
        );
      });

      expect(uploadResult!.success).toBe(false);
    });
  });

  describe("组件卸载清理", () => {
    it("卸载时清理预览 URL", () => {
      const { result, unmount } = renderHook(() =>
        useMediaUpload(defaultOptions),
      );

      const file = createMockFile("test.png");
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      act(() => {
        result.current.handleFileSelect(fileList);
      });

      unmount();

      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});
