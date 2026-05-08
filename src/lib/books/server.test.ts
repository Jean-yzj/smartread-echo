import {
  categorizeBook,
  chooseVerifiedPageCount,
  dedupeBookResults,
  extractCatalogFromText,
  parseSanminProduct,
  scoreBookMatch,
} from "@/lib/books/server";

describe("books server helpers", () => {
  it("normalizes books into the requested commercial categories", () => {
    expect(
      categorizeBook({
        title: "納瓦爾寶典",
        author: "Eric Jorgenson",
        description: "談財富與槓桿",
      }),
    ).toBe("商業類");

    expect(
      categorizeBook({
        title: "快思慢想",
        author: "Daniel Kahneman",
        description: "直覺與理性",
      }),
    ).toBe("思考類");

    expect(
      categorizeBook({
        title: "百年孤寂",
        author: "Gabriel Garcia Marquez",
        description: "魔幻寫實小說",
      }),
    ).toBe("文學類");
  });

  it("deduplicates search results by title/author/isbn fingerprint", () => {
    const results = dedupeBookResults([
      {
        title: "原子習慣",
        author: "James Clear",
        category: "思考類",
        isbn: "9780735211292",
        totalPages: 320,
        description: "",
        coverImage: "",
      },
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

    expect(results).toHaveLength(1);
  });

  it("prefers the larger page count when one provider clearly under-reports", () => {
    const pageCount = chooseVerifiedPageCount([
      {
        title: "認知學習",
        author: "作者",
        category: "思考類",
        isbn: "1",
        totalPages: 86,
        description: "",
        coverImage: "",
      },
      {
        title: "認知學習",
        author: "作者",
        category: "思考類",
        isbn: "1",
        totalPages: 312,
        description: "",
        coverImage: "",
      },
    ]);

    expect(pageCount).toBe(312);
  });

  it("extracts catalog lines from scraped body text", () => {
    const catalog = extractCatalogFromText(`
      書籍資料
      目錄
      第一章 找回注意力
      第二章 建立系統
      第三章 持續複利
      ISBN 9780000000000
    `);

    expect(catalog).toEqual([
      { order: 1, title: "第一章 找回注意力" },
      { order: 2, title: "第二章 建立系統" },
      { order: 3, title: "第三章 持續複利" },
    ]);
  });

  it("parses a Sanmin product page into canonical metadata", () => {
    const result = parseSanminProduct(
      `
      <html>
        <head>
          <meta property="og:title" content="原子習慣 - 三民網路書店" />
          <meta property="og:image" content="https://example.com/cover.jpg" />
          <meta name="description" content="一本談習慣設計的書" />
        </head>
        <body>
          作者：James Clear
          出版社：方智
          裝訂／頁數：平裝／320頁
          ISBN13：9780735211292
        </body>
      </html>
      `,
      "https://www.sanmin.com.tw/product/index/123456",
    );

    expect(result).toMatchObject({
      title: "原子習慣",
      author: "James Clear",
      publisher: "方智",
      totalPages: 320,
      isbn: "9780735211292",
      source: "三民網路書店",
      sourceUrl: "https://www.sanmin.com.tw/product/index/123456",
    });
    expect(result?.catalog).toEqual([]);
  });

  it("scores isbn-exact matches above fuzzy matches", () => {
    const exactScore = scoreBookMatch(
      { title: "原子習慣", author: "James Clear", isbn: "9780735211292" },
      {
        title: "原子習慣",
        author: "James Clear",
        category: "思考類",
        isbn: "9780735211292",
        totalPages: 320,
        description: "",
        coverImage: "",
      },
    );

    const fuzzyScore = scoreBookMatch(
      { title: "原子習慣", author: "James Clear" },
      {
        title: "原子習慣：實踐篇",
        author: "J. Clear",
        category: "思考類",
        isbn: "",
        totalPages: 320,
        description: "",
        coverImage: "",
      },
    );

    expect(exactScore).toBeGreaterThan(fuzzyScore);
  });
});
