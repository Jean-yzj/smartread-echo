# SmartRead Echo

SmartRead Echo is a one-day MVP for a private reading retention platform. It turns book reading into a loop of capture, reflection, recall, and reward.

## What this MVP includes

- ISBN-based book creation using Google Books
- private OCR note capture with `tesseract.js`
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
- `tesseract.js` for in-browser OCR
- `lucide-react` for icons

## Product decisions

- This MVP stores data in `localStorage` so it works immediately without external setup.
- AI guidance is implemented as a local rules-based placeholder so the experience is demoable without API keys.
- The architecture is intentionally ready to swap in Supabase, OpenAI, Gemini, and push notifications later.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build checks

```bash
npm run lint
npm run build
```

## Deployment notes

This project is compatible with Zeabur as a standard Next.js application.

- Build command: `npm run build`
- Start command: `npm run start`
- Node version: 24.x recommended

## Suggested next steps

1. Replace `localStorage` with Supabase Auth + Postgres + Storage.
2. Move OCR and AI calls behind server routes or edge functions.
3. Add push notifications for real Echo reminders.
4. Add PNG export for social cards and Notion sync for level 4 users.
