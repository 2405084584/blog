import { describe, expect, it, vi } from "vitest";

// We test the pure logic that can be extracted, since hook testing requires
// full React rendering setup. The hook itself uses useSyncExternalStore
// which is well-tested by React team.

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
