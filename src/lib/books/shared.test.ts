import { migratePersistedState, STORAGE_VERSION } from "@/lib/books/shared";

describe("migratePersistedState", () => {
  it("backfills new book metadata fields for legacy data", () => {
    const migrated = migratePersistedState({
      books: [
        {
          id: "book-1",
          title: "原子習慣",
          author: "James Clear",
          category: "思考類",
          isbn: "9780735211292",
          totalPages: 320,
          currentPage: 20,
          description: "desc",
          coverImage: "cover",
          createdAt: "2026-05-08T00:00:00.000Z",
        },
      ],
      notes: [],
      sessions: [],
      completedEchoes: [],
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(STORAGE_VERSION);
    expect(migrated?.books[0]).toMatchObject({
      publisher: "",
      source: "",
      sourceUrl: "",
      catalog: [],
    });
  });

  it("returns null when persisted payload is not an object", () => {
    expect(migratePersistedState(null)).toBeNull();
    expect(migratePersistedState("bad-payload")).toBeNull();
  });
});
