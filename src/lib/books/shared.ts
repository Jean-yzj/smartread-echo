export type CatalogEntry = {
  title: string;
  order: number;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  totalPages: number;
  currentPage: number;
  description: string;
  coverImage: string;
  publisher?: string;
  source?: string;
  sourceUrl?: string;
  catalog?: CatalogEntry[];
  createdAt: string;
};

export type Note = {
  id: string;
  bookId: string;
  page: number;
  rawText: string;
  reflection: string;
  isFavorite: boolean;
  imageDataUrl?: string;
  ocrText?: string;
  createdAt: string;
};

export type Session = {
  id: string;
  bookId: string;
  minutes: number;
  startedAt: string;
};

export type BookSearchResult = {
  title: string;
  author: string;
  category: string;
  isbn: string;
  totalPages: number;
  description: string;
  coverImage: string;
  source?: string;
  publisher?: string;
  sourceUrl?: string;
  catalog?: CatalogEntry[];
};

export type PersistedStateV2 = {
  version: 2;
  books: Book[];
  notes: Note[];
  sessions: Session[];
  completedEchoes: string[];
};

export type PersistedStateLegacy = {
  books?: Book[];
  notes?: Note[];
  sessions?: Session[];
  completedEchoes?: string[];
};

export const STORAGE_VERSION = 2;

export function migratePersistedState(raw: unknown): PersistedStateV2 | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const input = raw as Partial<PersistedStateV2> & PersistedStateLegacy;
  const books = Array.isArray(input.books) ? input.books : [];
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const completedEchoes = Array.isArray(input.completedEchoes)
    ? input.completedEchoes
    : [];

  return {
    version: STORAGE_VERSION,
    books: books.map((book) => ({
      ...book,
      publisher: book.publisher ?? "",
      source: book.source ?? "",
      sourceUrl: book.sourceUrl ?? "",
      catalog: Array.isArray(book.catalog) ? book.catalog : [],
    })),
    notes,
    sessions,
    completedEchoes,
  };
}
