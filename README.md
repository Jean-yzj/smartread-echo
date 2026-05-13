# SmartRead Echo

SmartRead Echo is a one-day MVP for a private reading retention platform. It turns book reading into a loop of capture, reflection, recall, and reward.

## What this MVP includes

- title-first book search with server-side metadata calibration
- multi-source metadata correction for page count, publisher, and ISBN
- publisher/retailer catalog extraction flow for owned books
- private OCR note capture through Google Vertex AI
- reflection-first note storage
- Echo review cards on 1 / 7 / 30 day intervals
- focus timer with browser-generated white noise
- Ink Drops and level unlocks
- favorite quote share-card preview

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- `cheerio` for server-side metadata scraping
- Google Vertex AI Gemini for server-side OCR
- `lucide-react` for icons

## Product decisions

- This MVP stores data in `localStorage` so it works immediately without external setup.
- AI guidance is implemented as a local rules-based placeholder so the experience is demoable without API keys.
- The architecture is intentionally ready to swap in Supabase, OpenAI, Gemini, and push notifications later.
- Book metadata search and calibration are now routed through server APIs so the frontend no longer talks to provider sources directly.

## Book metadata pipeline

- `GET /api/books/search?q=...`
  - merges local trusted seeds, Open Library, Google Books, and selected retailer results
- `POST /api/books/calibrate`
  - re-ranks candidate editions and corrects page count, publisher, source, and ISBN
- `POST /api/books/catalog`
  - uses a saved `sourceUrl` to scrape a specific retailer/publisher page for chapter data when available

BDD acceptance scenarios live in [docs/BDD-book-metadata.md](/tmp/smartread-echo-push/docs/BDD-book-metadata.md).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build checks

```bash
npm run lint
npm test
npm run build
```

## Deployment notes

This project is compatible with Zeabur as a standard Next.js application.

- Build command: `npm run build`
- Start command: `npm run start`
- Node version: 24.x recommended

## Suggested next steps

1. Replace `localStorage` with Supabase Auth + Postgres + Storage.
2. Add push notifications for real Echo reminders.
3. Add PNG export for social cards and Notion sync for level 4 users.

## Google OCR setup

SmartRead Echo now sends uploaded note images to `POST /api/ocr`, which calls
Google Vertex AI Gemini server-side and returns plain extracted text.

Required environment variables:

```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_VERTEX_MODEL=gemini-3.1-flash-lite
```

Authentication, choose one:

```bash
GOOGLE_VERTEX_API_KEY=your-vertex-api-key
```

or

```bash
GOOGLE_VERTEX_ACCESS_TOKEN=your-oauth-access-token
```

Notes:

- The Vertex AI official image-text sample was last updated on 2026-05-08.
- This implementation sends the image plus a strict "return only transcribed text"
  prompt to Gemini, then stores the returned text as OCR content.
- `GOOGLE_VERTEX_ACCESS_TOKEN` is best for short-lived local testing only. For a
  deployed app, prefer a stable server-side auth setup or rotate secrets often.
