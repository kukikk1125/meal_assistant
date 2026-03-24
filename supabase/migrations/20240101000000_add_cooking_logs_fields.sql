-- =====================================================
-- Migration: Add missing fields to cooking_logs table
-- Date: 2024-01-XX
-- Description: Add difficulty_feedback, difficulty_detail, notes, 
--              taste_feedback, system_summary, step_photos fields
-- =====================================================

-- 1. Add difficulty_feedback column (text array)
ALTER TABLE public.cooking_logs 
ADD COLUMN IF NOT EXISTS difficulty_feedback text[] DEFAULT '{}';

-- 2. Add difficulty_detail column (text)
ALTER TABLE public.cooking_logs 
ADD COLUMN IF NOT EXISTS difficulty_detail text DEFAULT '';

-- 3. Add notes column (text)
ALTER TABLE public.cooking_logs 
ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- 4. Add taste_feedback column (text array)
ALTER TABLE public.cooking_logs 
ADD COLUMN IF NOT EXISTS taste_feedback text[] DEFAULT '{}';

-- 5. Add system_summary column (jsonb)
ALTER TABLE public.cooking_logs 
ADD COLUMN IF NOT EXISTS system_summary jsonb DEFAULT '{}'::jsonb;

-- 6. Add step_photos column (jsonb) - stores photos taken during cooking steps
ALTER TABLE public.cooking_logs 
ADD COLUMN IF NOT EXISTS step_photos jsonb DEFAULT '[]'::jsonb;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON COLUMN public.cooking_logs.difficulty_feedback IS '结构化难点标签数组，如 ["heat_hard", "time_short"]';
COMMENT ON COLUMN public.cooking_logs.difficulty_detail IS '针对已选难点的补充说明';
COMMENT ON COLUMN public.cooking_logs.notes IS '自由备注';
COMMENT ON COLUMN public.cooking_logs.taste_feedback IS '结构化口味反馈标签数组，如 ["too_spicy", "just_right"]';
COMMENT ON COLUMN public.cooking_logs.system_summary IS '本次做菜过程中的系统总结(JSON格式)';
COMMENT ON COLUMN public.cooking_logs.step_photos IS '做菜步骤中的拍照记录(JSON数组)';

-- =====================================================
-- Create index for better query performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cooking_logs_recipe_id ON public.cooking_logs(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cooking_logs_user_id ON public.cooking_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cooking_logs_cooked_at ON public.cooking_logs(cooked_at);
