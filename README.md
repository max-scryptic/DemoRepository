# Project Board

A Trello-style project management app built with Next.js, Tailwind CSS, and Supabase. It supports columns by status, card creation, search, deletion, and drag-and-drop movement between columns.

## Features

- Status columns for Backlog, To do, In progress, Review, and Done
- Create cards with title, description, labels, and initial status
- Drag cards between status columns
- Search cards by title, description, or label
- Supabase persistence when environment variables are configured
- Local starter data fallback when Supabase is not configured

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/20260617180000_create_project_cards.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add your project URL and publishable key:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The demo migration uses public read/write policies for easy prototyping. For production, add authentication and restrict row access to the owning user or workspace.

## Vercel Setup

1. Import `max-scryptic/DemoRepository` in Vercel.
2. Add the same Supabase environment variables in Vercel project settings.
3. Deploy with the default Next.js settings.

Vercel will run `npm run build` automatically.
