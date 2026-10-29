-- ============================================================================
-- OUR LITTLE FOREVER — SUPABASE DATABASE & REALTIME SETUP
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Create the certificates table to store text & drawn signatures
create table if not exists public.certificates (
  id text primary key default 'adam_maria',
  p1_name text default 'Adam',
  p1_handle text default 'nova.af',
  p2_name text default 'Maria',
  p2_handle text default 'llittleaangel',
  ceremony_date text default 'October 30, 2026',
  location text default 'celebrated in love, late-night voice calls, shared playlists, and quiet companionship',
  vows text default 'I promise to be by your side through every quiet evening and late-night conversation, to listen, to care, and to choose you every single day.',
  sig1 text, -- Hand-drawn signature 1 (PNG data URL)
  sig2 text, -- Hand-drawn signature 2 (PNG data URL)
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Insert initial default row for Adam & Maria
insert into public.certificates (
  id,
  p1_name,
  p1_handle,
  p2_name,
  p2_handle,
  ceremony_date,
  location,
  vows
)
values (
  'adam_maria',
  'Adam',
  'nova.af',
  'Maria',
  'llittleaangel',
  'October 30, 2026',
  'celebrated in love, late-night voice calls, shared playlists, and quiet companionship',
  'I promise to be by your side through every quiet evening and late-night conversation, to listen, to care, and to choose you every single day.'
)
on conflict (id) do nothing;

-- 3. Enable Row Level Security (RLS)
alter table public.certificates enable row level security;

-- 4. Create policies so anon (client website) can read, insert, and update
drop policy if exists "Allow public read access" on public.certificates;
create policy "Allow public read access"
on public.certificates for select
to anon
using (true);

drop policy if exists "Allow public insert access" on public.certificates;
create policy "Allow public insert access"
on public.certificates for insert
to anon
with check (true);

drop policy if exists "Allow public update access" on public.certificates;
create policy "Allow public update access"
on public.certificates for update
to anon
using (true)
with check (true);

-- 5. Enable Realtime publication so updates push to all devices instantly
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'certificates'
  ) then
    alter publication supabase_realtime add table public.certificates;
  end if;
end;
$$;
