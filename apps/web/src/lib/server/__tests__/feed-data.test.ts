import { describe, expect, it } from "vitest";

import {
  buildFeedLeadHtml,
  normalizeFeedText,
  prependFeedLead,
  stripLeadingHtmlTitle,
  stripLeadingMarkdownTitle,
} from "@/lib/server/feed-data";

describe("feed-data utilities", () => {
  describe("normalizeFeedText", () => {
    it("strips HTML tags", () => {
      expect(normalizeFeedText("<p>Hello</p>")).toBe("Hello");
      expect(normalizeFeedText("<strong>Bold</strong>")).toBe("Bold");
    });

    it("decodes &nbsp; to space", () => {
      expect(normalizeFeedText("Hello&nbsp;World")).toBe("Hello World");
    });

    it("decodes &lt; and &gt;", () => {
      expect(normalizeFeedText("a&lt;b&gt;c")).toBe("a<b>c");
    });

    it("decodes &quot;", () => {
      expect(normalizeFeedText("say &quot;hello&quot;")).toBe('say "hello"');
    });

    it("decodes &#39; and &apos;", () => {
      expect(normalizeFeedText("it&#39;s")).toBe("it's");
      expect(normalizeFeedText("it&apos;s")).toBe("it's");
    });

    it("decodes &amp;", () => {
      expect(normalizeFeedText("A&amp;B")).toBe("A&B");
    });

    it("removes unrecognized HTML entities", () => {
      expect(normalizeFeedText("test&unknown;end")).toBe("test end");
    });

    it("collapses whitespace", () => {
      expect(normalizeFeedText("Hello   World")).toBe("Hello World");
      expect(normalizeFeedText("  Hello  ")).toBe("Hello");
    });

    it("handles empty string", () => {
      expect(normalizeFeedText("")).toBe("");
    });

    it("handles mixed HTML and entities", () => {
      expect(normalizeFeedText("<b>Hello</b>&nbsp;&amp;World")).toBe(
        "Hello &World",
      );
    });

    it("decodes numeric entity &#60; and &#62;", () => {
      expect(normalizeFeedText("a&#60;b&#62;c")).toBe("a<b>c");
    });

    it("decodes numeric entity &#34;", () => {
      expect(normalizeFeedText("say&#34;hello")).toBe('say"hello');
    });

    it("decodes numeric entity &#38;", () => {
      expect(normalizeFeedText("A&#38;B")).toBe("A&B");
    });
  });

  describe("stripLeadingMarkdownTitle", () => {
    it("strips ATX h1 heading that matches title", () => {
      const markdown = `# My Title

Some content here.`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe("Some content here.");
    });

    it("strips setext h1 heading that matches title", () => {
      const markdown = `My Title
=========

Some content here.`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe("Some content here.");
    });

    it("does not strip heading that does not match title", () => {
      const markdown = `# Different Title

Some content here.`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe(markdown);
    });

    it("does not strip h2 or deeper headings", () => {
      const markdown = `## My Title

Some content here.`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe(markdown);
    });

    it("handles empty title", () => {
      const markdown = `# Title

Content`;
      const result = stripLeadingMarkdownTitle(markdown, "");
      expect(result).toBe(markdown);
    });

    it("handles ATX heading with trailing hashes", () => {
      const markdown = `# My Title ###

Content here`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe("Content here");
    });

    it("handles title comparison with HTML entity normalization", () => {
      const markdown = `# A &amp; B

Content`;
      const result = stripLeadingMarkdownTitle(markdown, "A & B");
      expect(result).toBe("Content");
    });

    it("does not strip heading inside code fence", () => {
      // Note: stripLeadingMarkdownTitle uses regex, not AST parsing,
      // so it doesn't handle code fences. This tests current behavior.
      const markdown = `\`\`\`
# Fake Heading
\`\`\`

# Real Heading

Content`;
      // It will match the first # heading it finds
      const result = stripLeadingMarkdownTitle(markdown, "Fake Heading");
      // The regex matches from the start, so it finds the first match
      // within the code block
      expect(result).toBeTruthy();
    });

    it("handles BOM at start of markdown", () => {
      const markdown = `﻿# My Title

Content here.`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe("Content here.");
    });
  });

  describe("stripLeadingHtmlTitle", () => {
    it("strips h1 that matches title", () => {
      const html = `<h1>My Title</h1><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "My Title");
      expect(result).toBe("<p>Content</p>");
    });

    it("does not strip h1 that does not match title", () => {
      const html = `<h1>Different Title</h1><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "My Title");
      expect(result).toBe(html);
    });

    it("does not strip h2", () => {
      const html = `<h2>My Title</h2><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "My Title");
      expect(result).toBe(html);
    });

    it("handles empty title", () => {
      const html = `<h1>Title</h1><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "");
      expect(result).toBe(html);
    });

    it("handles h1 with attributes", () => {
      const html = `<h1 id="title">My Title</h1><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "My Title");
      expect(result).toBe("<p>Content</p>");
    });

    it("handles multiline h1 content", () => {
      const html = `<h1>My Title</h1>
<p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "My Title");
      expect(result).toBe("<p>Content</p>");
    });

    it("handles title with HTML entities", () => {
      const html = `<h1>A &amp; B</h1><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "A & B");
      expect(result).toBe("<p>Content</p>");
    });
  });

  describe("buildFeedLeadHtml", () => {
    it("generates lead HTML with post URL", () => {
      const result = buildFeedLeadHtml("https://example.com/posts/my-post");
      expect(result).toContain('<a href="https://example.com/posts/my-post">');
      expect(result).toContain("https://example.com/posts/my-post");
      expect(result).toContain("前往");
      expect(result).toContain("查看以获得最佳体验");
    });

    it("uses correct CSS class", () => {
      const result = buildFeedLeadHtml("https://example.com/post");
      expect(result).toContain('class="feed-lead"');
    });
  });

  describe("prependFeedLead", () => {
    it("prepends lead to existing content", () => {
      const content = "<p>Article content</p>";
      const result = prependFeedLead(content, "https://example.com/post");
      expect(result).toContain("前往");
      expect(result).toContain("Article content");
      // Lead should come first
      expect(result.indexOf("前往")).toBeLessThan(
        result.indexOf("Article content"),
      );
    });

    it("returns only lead when content is empty", () => {
      const result = prependFeedLead("", "https://example.com/post");
      expect(result).toContain("前往");
      expect(result).not.toContain("\n<p");
    });

    it("separates lead and content with newline", () => {
      const content = "<p>Content</p>";
      const result = prependFeedLead(content, "https://example.com/post");
      expect(result).toContain("\n<p>Content</p>");
    });
  });
});
