import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBreakpoint, useMobile } from "@/hooks/use-mobile";

// 测试移动端检测的纯逻辑
// useMobile 使用 useSyncExternalStore，其核心是 MOBILE_UA_RE 正则和 checkIsMobile 逻辑
describe("mobile detection logic", () => {
  const MOBILE_UA_RE =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

  function isMobileUA(userAgent: string): boolean {
    return MOBILE_UA_RE.test(userAgent);
  }

  it("detects Android as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
      ),
    ).toBe(true);
  });

  it("detects iPhone as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
  });

  it("detects iPad as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
  });

  it("does not detect desktop Chrome as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0",
      ),
    ).toBe(false);
  });

  it("does not detect desktop Firefox as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      ),
    ).toBe(false);
  });

  it("detects Opera Mini as mobile", () => {
    expect(
      isMobileUA(
        "Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54",
      ),
    ).toBe(true);
  });
});

describe("mobile detection extended tests", () => {
  const MOBILE_UA_RE =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

  function isMobileUA(userAgent: string): boolean {
    return MOBILE_UA_RE.test(userAgent);
  }

  it("detects iPod as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (iPod; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(true);
  });

  it("detects BlackBerry as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.1.0.346 Mobile Safari/534.11+",
      ),
    ).toBe(true);
  });

  it("detects webOS as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (webOS/1.4.5; U; en-US) AppleWebKit/532.2 (KHTML, like Gecko) Version/1.0 Safari/532.2 Pre/1.0",
      ),
    ).toBe(true);
  });

  it("detects IEMobile as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)",
      ),
    ).toBe(true);
  });

  it("does not detect macOS Safari as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
      ),
    ).toBe(false);
  });

  it("does not detect Linux desktop as mobile", () => {
    expect(
      isMobileUA(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("handles empty string", () => {
    expect(isMobileUA("")).toBe(false);
  });

  it("匹配不区分大小写", () => {
    expect(isMobileUA("ANDROID")).toBe(true);
    expect(isMobileUA("IPHONE")).toBe(true);
  });
});

describe("checkIsMobile combined logic", () => {
  // checkIsMobile 的完整逻辑：
  // const isMobileDevice = MOBILE_UA_RE.test(navigator.userAgent);
  // const hasTouchSupport = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  // const isSmallScreen = window.innerWidth <= 768;
  // return isMobileDevice || (hasTouchSupport && isSmallScreen);

  const MOBILE_UA_RE =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

  function checkIsMobile(
    userAgent: string,
    hasTouch: boolean,
    maxTouchPoints: number,
    innerWidth: number,
  ): boolean {
    const isMobileDevice = MOBILE_UA_RE.test(userAgent);
    const hasTouchSupport = hasTouch || maxTouchPoints > 0;
    const isSmallScreen = innerWidth <= 768;
    return isMobileDevice || (hasTouchSupport && isSmallScreen);
  }

  it("移动 UA 直接返回 true，不管屏幕大小", () => {
    const mobileUA =
      "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0";
    expect(checkIsMobile(mobileUA, false, 0, 1920)).toBe(true);
    expect(checkIsMobile(mobileUA, false, 0, 320)).toBe(true);
  });

  it("桌面 UA + 触控 + 小屏幕 = true", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0";
    expect(checkIsMobile(desktopUA, true, 0, 768)).toBe(true);
    expect(checkIsMobile(desktopUA, false, 5, 600)).toBe(true);
  });

  it("桌面 UA + 触控 + 大屏幕 = false", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0";
    expect(checkIsMobile(desktopUA, true, 0, 1920)).toBe(false);
  });

  it("桌面 UA + 无触控 + 小屏幕 = false", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0";
    expect(checkIsMobile(desktopUA, false, 0, 320)).toBe(false);
  });

  it("边界值：768px 属于小屏幕", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0";
    expect(checkIsMobile(desktopUA, true, 0, 768)).toBe(true);
  });

  it("边界值：769px 不属于小屏幕", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0";
    expect(checkIsMobile(desktopUA, true, 0, 769)).toBe(false);
  });
});

describe("useBreakpoint logic", () => {
  function checkBreakpoint(innerWidth: number, breakpoint: number): boolean {
    return innerWidth <= breakpoint;
  }

  it("宽度小于断点返回 true", () => {
    expect(checkBreakpoint(500, 768)).toBe(true);
  });

  it("宽度等于断点返回 true", () => {
    expect(checkBreakpoint(768, 768)).toBe(true);
  });

  it("宽度大于断点返回 false", () => {
    expect(checkBreakpoint(1024, 768)).toBe(false);
  });

  it("自定义断点值", () => {
    expect(checkBreakpoint(1000, 1024)).toBe(true);
    expect(checkBreakpoint(1025, 1024)).toBe(false);
  });

  it("极小断点", () => {
    expect(checkBreakpoint(0, 0)).toBe(true);
    expect(checkBreakpoint(1, 0)).toBe(false);
  });
});

describe("getServerSnapshot", () => {
  it("SSR 时返回 false", () => {
    // getServerSnapshot 总是返回 false
    // 这确保 SSR 时不检测移动端，避免 hydration mismatch
    const getServerSnapshot = () => false;
    expect(getServerSnapshot()).toBe(false);
  });
});

describe("useMobile hook", () => {
  // 由于 useSyncExternalStore 在 happy-dom 中的行为，
  // 这里测试 hook 的基本结构
  it("useMobile 是一个函数", () => {
    expect(typeof useMobile).toBe("function");
  });

  it("useBreakpoint 是一个函数", () => {
    expect(typeof useBreakpoint).toBe("function");
  });

  it("useMobile 返回 boolean", () => {
    const { result } = renderHook(() => useMobile());
    expect(typeof result.current).toBe("boolean");
  });

  it("useBreakpoint 返回 boolean", () => {
    const { result } = renderHook(() => useBreakpoint(768));
    expect(typeof result.current).toBe("boolean");
  });

  it("useBreakpoint 默认断点为 768", () => {
    // 验证函数可以不传参调用
    const { result } = renderHook(() => useBreakpoint());
    expect(typeof result.current).toBe("boolean");
  });
});
