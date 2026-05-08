import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServer = vi.hoisted(() => ({
  dedupeBookResults: vi.fn((results) => results),
  fetchGoogleCandidates: vi.fn(),
  fetchOpenLibraryCandidates: vi.fn(),
  searchLocalCatalog: vi.fn(),
  searchSanminCandidates: vi.fn(),
  calibrateBookMetadata: vi.fn(),
  extractCatalogForBook: vi.fn(),
}));

vi.mock("@/lib/books/server", () => mockServer);

import { GET as searchRoute } from "@/app/api/books/search/route";
import { POST as calibrateRoute } from "@/app/api/books/calibrate/route";
import { POST as catalogRoute } from "@/app/api/books/catalog/route";

describe("book api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("search route merges providers and returns fallback warning when some sources fail", async () => {
    mockServer.searchLocalCatalog.mockReturnValue([
      {
        title: "原子習慣",
        author: "James Clear",
        category: "思考類",
        isbn: "9780735211292",
        totalPages: 320,
        description: "",
        coverImage: "",
      },
    ]);
    mockServer.fetchGoogleCandidates.mockResolvedValue([]);
    mockServer.fetchOpenLibraryCandidates.mockRejectedValue(new Error("quota"));
    mockServer.searchSanminCandidates.mockResolvedValue([]);

    const response = await searchRoute(
      new NextRequest("http://localhost:3000/api/books/search?q=%E5%8E%9F%E5%AD%90%E7%BF%92%E6%85%A3"),
    );
    const data = await response.json();

    expect(data.results).toHaveLength(1);
    expect(data.message).toContain("部分資料源");
    expect(mockServer.searchLocalCatalog).toHaveBeenCalledWith("原子習慣");
  });

  it("calibrate route enforces title and returns a calibrated payload", async () => {
    const badResponse = await calibrateRoute(
      new NextRequest("http://localhost:3000/api/books/calibrate", {
        method: "POST",
        body: JSON.stringify({ author: "James Clear" }),
      }),
    );
    expect(badResponse.status).toBe(400);

    mockServer.calibrateBookMetadata.mockResolvedValue({
      title: "原子習慣",
      author: "James Clear",
      category: "思考類",
      isbn: "9780735211292",
      totalPages: 320,
      description: "",
      coverImage: "",
      publisher: "方智",
      source: "三民網路書店",
      sourceUrl: "https://www.sanmin.com.tw/product/index/123456",
      catalog: [],
    });
    mockServer.extractCatalogForBook.mockResolvedValue({
      title: "原子習慣",
      author: "James Clear",
      category: "思考類",
      isbn: "9780735211292",
      totalPages: 320,
      description: "",
      coverImage: "",
      publisher: "方智",
      source: "三民網路書店",
      sourceUrl: "https://www.sanmin.com.tw/product/index/123456",
      catalog: [{ order: 1, title: "第一章 為什麼細微改變會造成巨大差異" }],
    });

    const okResponse = await calibrateRoute(
      new NextRequest("http://localhost:3000/api/books/calibrate", {
        method: "POST",
        body: JSON.stringify({ title: "原子習慣", author: "James Clear" }),
      }),
    );
    const data = await okResponse.json();

    expect(data.message).toContain("320");
    expect(data.message).toContain("目錄");
    expect(data.result.publisher).toBe("方智");
    expect(data.result.catalog).toHaveLength(1);
  });

  it("catalog route returns scraped catalog entries", async () => {
    mockServer.extractCatalogForBook.mockResolvedValue({
      title: "原子習慣",
      author: "James Clear",
      category: "思考類",
      isbn: "9780735211292",
      totalPages: 320,
      description: "",
      coverImage: "",
      publisher: "方智",
      source: "三民網路書店",
      sourceUrl: "https://www.sanmin.com.tw/product/index/123456",
      catalog: [{ order: 1, title: "第一章 為什麼細微改變會造成巨大差異" }],
    });

    const response = await catalogRoute(
      new NextRequest("http://localhost:3000/api/books/catalog", {
        method: "POST",
        body: JSON.stringify({ title: "原子習慣", sourceUrl: "https://www.sanmin.com.tw/product/index/123456" }),
      }),
    );
    const data = await response.json();

    expect(data.message).toContain("1");
    expect(data.result.catalog).toHaveLength(1);
  });
});
