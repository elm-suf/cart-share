-- CartShare Supabase Database Schema
-- Paste this script into your Supabase SQL Editor (https://supabase.com/dashboard/project/yatjwayegnihlvelaonp/sql/new)

-- 1. Create lists table
CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token TEXT UNIQUE NOT NULL,
  creator_token_hash TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_active_at BIGINT NOT NULL
);

-- 2. Create items table
CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  checked BOOLEAN DEFAULT FALSE,
  position DOUBLE PRECISION NOT NULL,
  updated_at BIGINT NOT NULL,
  editor TEXT
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_share_token ON public.lists (share_token);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists (user_id);
CREATE INDEX IF NOT EXISTS idx_items_list_id ON public.items (list_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- 5. Set up RLS Policies (Allow access via share_token / public)
DROP POLICY IF EXISTS "Allow public read lists" ON public.lists;
DROP POLICY IF EXISTS "Allow public insert lists" ON public.lists;
DROP POLICY IF EXISTS "Allow public update lists" ON public.lists;
DROP POLICY IF EXISTS "Allow public delete lists" ON public.lists;

CREATE POLICY "Allow public read lists" ON public.lists FOR SELECT USING (true);
CREATE POLICY "Allow public insert lists" ON public.lists FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update lists" ON public.lists FOR UPDATE USING (true);
CREATE POLICY "Allow public delete lists" ON public.lists FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read items" ON public.items;
DROP POLICY IF EXISTS "Allow public insert items" ON public.items;
DROP POLICY IF EXISTS "Allow public update items" ON public.items;
DROP POLICY IF EXISTS "Allow public delete items" ON public.items;

CREATE POLICY "Allow public read items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Allow public insert items" ON public.items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update items" ON public.items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete items" ON public.items FOR DELETE USING (true);

-- 6. Enable Realtime Publications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lists;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
  END IF;
END $$;

-- 7. Create user_saved_lists table
CREATE TABLE IF NOT EXISTS public.user_saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NOT NULL,
  joined_at BIGINT NOT NULL,
  UNIQUE(user_id, list_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_lists_user_id ON public.user_saved_lists (user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_lists_list_id ON public.user_saved_lists (list_id);

ALTER TABLE public.user_saved_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own saved lists" ON public.user_saved_lists;
DROP POLICY IF EXISTS "Users can insert their own saved lists" ON public.user_saved_lists;
DROP POLICY IF EXISTS "Users can delete their own saved lists" ON public.user_saved_lists;

CREATE POLICY "Users can read their own saved lists" ON public.user_saved_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own saved lists" ON public.user_saved_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved lists" ON public.user_saved_lists FOR DELETE USING (auth.uid() = user_id);
