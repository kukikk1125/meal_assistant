-- Supabase 数据库表结构

-- 创建 recipes 表
CREATE TABLE recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  total_time INTEGER NOT NULL,
  servings INTEGER NOT NULL,
  ingredients JSONB NOT NULL,
  steps JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 cooking_logs 表
CREATE TABLE cooking_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  taste_note TEXT,
  improvement TEXT,
  apply_to_recipe BOOLEAN DEFAULT FALSE,
  cooked_at TIMESTAMPTZ DEFAULT NOW(),
  images TEXT[]
);

-- 创建索引
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_cooking_logs_recipe_id ON cooking_logs(recipe_id);
CREATE INDEX idx_cooking_logs_user_id ON cooking_logs(user_id);

-- 启用行级安全 (RLS)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_logs ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（示例：只有用户自己可以访问自己的数据）
-- 注意：你需要在 Supabase 控制台中启用认证功能
CREATE POLICY "Users can view their own recipes"
  ON recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes"
  ON recipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
  ON recipes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
  ON recipes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own cooking logs"
  ON cooking_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cooking logs"
  ON cooking_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cooking logs"
  ON cooking_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cooking logs"
  ON cooking_logs FOR DELETE
  USING (auth.uid() = user_id);
