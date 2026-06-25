# Project Board

A Trello-style project management app built with Next.js, Tailwind CSS, and Supabase. It supports columns by status, card creation, search, deletion, and drag-and-drop movement between columns.

## Features

- Status columns for Backlog, To do, In progress, Review, and Done
- Create cards with title, description, labels, and initial status
- Drag cards between status columns
- Search cards by title, description, or label
- Supabase auth with per-user card ownership
- Two starter cards are created automatically for each new user

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL migrations in order from `supabase/migrations`.
3. Copy `.env.example` to `.env.local`.
4. Add your project URL and publishable key:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The auth ownership migrations add `project_cards.user_id`, create user profiles from `auth.users`,
restrict card access to the owning user, and create starter cards when a new user signs up.
If the app shows `column project_cards.user_id does not exist`, run
the latest migration in `supabase/migrations` against the connected Supabase project.

## Vercel Setup

1. Import `max-scryptic/DemoRepository` in Vercel.
2. Add the same Supabase environment variables in Vercel project settings.
3. Deploy with the default Next.js settings.

Vercel will run `npm run build` automatically.
