import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const useSupabase = supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http');

export const supabase = useSupabase 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  image_url?: string;
  total_time: number;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  is_optional: boolean;
  note?: string;
  scalable?: boolean;
}

export interface StepIngredient {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
}

export interface Step {
  id: string;
  order: number;
  description: string;
  duration: number;
  is_key_step: boolean;
  tip?: string;
  image_url?: string;
  ingredients?: StepIngredient[];
}

export interface StepPhoto {
  stepNumber: number;
  stepDescription: string;
  imageUrl: string;
  statusLabel: string;
  advice: string;
  createdAt: string;
}

export interface CookingLog {
  id: string;
  recipe_id: string;
  user_id: string;
  rating: number;
  taste_note: string;
  improvement: string;
  apply_to_recipe: boolean;
  cooked_at: string;
  images?: string[];
  taste_feedback?: string[];
  difficulty_feedback?: string[];
  difficulty_detail?: string;
  notes?: string;
  system_summary?: Record<string, unknown>;
  step_photos?: StepPhoto[];
}

const LOCAL_STORAGE_RECIPES_KEY = 'meal_assistant_recipes';
const LOCAL_STORAGE_LOGS_KEY = 'meal_assistant_logs';

function getLocalRecipes(): Recipe[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(LOCAL_STORAGE_RECIPES_KEY);
  return data ? JSON.parse(data) : [];
}

function setLocalRecipes(recipes: Recipe[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_RECIPES_KEY, JSON.stringify(recipes));
}

function getLocalLogs(): CookingLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn("Local logs data is not an array, resetting...");
      localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
      return [];
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse local logs, resetting:", error);
    localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
    return [];
  }
}

function setLocalLogs(logs: CookingLog[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(logs));
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DEFAULT_USER_ID = 'demo-user';

export async function getRecipes(userId?: string): Promise<Recipe[]> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId || DEFAULT_USER_ID)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Recipe[];
  }
  
  return getLocalRecipes();
}

export async function getRecipe(id: string): Promise<Recipe> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Recipe;
  }
  
  const recipes = getLocalRecipes();
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) throw new Error('Recipe not found');
  return recipe;
}

export async function createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<Recipe> {
  const now = new Date().toISOString();
  const newRecipe: Recipe = {
    ...recipe,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('recipes')
      .insert(newRecipe)
      .select()
      .single();
    
    if (error) throw error;
    return data as Recipe;
  }
  
  const recipes = getLocalRecipes();
  recipes.unshift(newRecipe);
  setLocalRecipes(recipes);
  return newRecipe;
}

export async function updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('recipes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Recipe;
  }
  
  const recipes = getLocalRecipes();
  const index = recipes.findIndex(r => r.id === id);
  if (index === -1) throw new Error('Recipe not found');
  
  recipes[index] = {
    ...recipes[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setLocalRecipes(recipes);
  return recipes[index];
}

export async function deleteRecipe(id: string): Promise<void> {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return;
  }
  
  const recipes = getLocalRecipes();
  const filtered = recipes.filter(r => r.id !== id);
  setLocalRecipes(filtered);
}

export async function getCookingLogs(recipeId: string): Promise<CookingLog[]> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('cooking_logs')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('cooked_at', { ascending: false });
    
    if (error) throw error;
    return data as CookingLog[];
  }
  
  const logs = getLocalLogs();
  return logs.filter(l => l.recipe_id === recipeId);
}

export async function createCookingLog(log: Omit<CookingLog, 'id'>): Promise<CookingLog> {
  const newLog: CookingLog = {
    id: generateId(),
    recipe_id: log.recipe_id,
    user_id: log.user_id || 'demo-user',
    rating: log.rating || 3,
    taste_note: log.taste_note || '',
    improvement: log.improvement || '',
    apply_to_recipe: log.apply_to_recipe || false,
    cooked_at: log.cooked_at || new Date().toISOString(),
    images: log.images || [],
    taste_feedback: log.taste_feedback || [],
    difficulty_feedback: log.difficulty_feedback || [],
    difficulty_detail: log.difficulty_detail || '',
    notes: log.notes || '',
    system_summary: log.system_summary,
    step_photos: log.step_photos || [],
  };

  console.log("createCookingLog called, useSupabase:", useSupabase);
  console.log("newLog.step_photos:", JSON.stringify(newLog.step_photos, null, 2));
  console.log("newLog data:", JSON.stringify(newLog, null, 2));

  if (useSupabase && supabase) {
    console.log("Saving to Supabase...");
    const { data, error } = await supabase
      .from('cooking_logs')
      .insert(newLog)
      .select()
      .single();
    
    if (error) {
      console.error("Supabase error:", error);
      throw new Error(`数据库保存失败: ${error.message}`);
    }
    console.log("Supabase save successful:", data);
    console.log("Saved step_photos:", data.step_photos);
    return data as CookingLog;
  }
  
  throw new Error("Supabase 未配置，请检查环境变量");
}

export async function deleteCookingLog(id: string): Promise<void> {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('cooking_logs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return;
  }
  
  const logs = getLocalLogs();
  const filtered = logs.filter(l => l.id !== id);
  setLocalLogs(filtered);
}

export function calculateAverageRating(logs: CookingLog[]): number {
  if (logs.length === 0) return 0;
  const sum = logs.reduce((acc, log) => acc + log.rating, 0);
  return Math.round((sum / logs.length) * 10) / 10;
}

export async function getRecipeWithRating(id: string): Promise<Recipe & { averageRating: number; logCount: number }> {
  const recipe = await getRecipe(id);
  const logs = await getCookingLogs(id);
  return {
    ...recipe,
    averageRating: calculateAverageRating(logs),
    logCount: logs.length,
  };
}

export interface OptimizedRecipe {
  id: string;
  recipe_id: string;
  user_id: string;
  name: string;
  total_time: number;
  ingredients: Array<{
    id: string;
    name: string;
    original_amount?: number;
    original_unit?: string;
    adjusted_amount: number;
    adjusted_unit: string;
    change_reason?: string;
  }>;
  steps: Array<{
    order: number;
    description: string;
    duration: number;
    ingredients?: Array<{
      ingredientId: string;
      name: string;
      amount: number;
      unit: string;
    }>;
    tip?: string;
    changes?: string[];
  }>;
  changes_explanation?: Array<{
    type: "ingredient" | "step" | "time" | "tip";
    target: string;
    original?: string;
    adjusted: string;
    reason: string;
  }>;
  adjustment_summary: string;
  based_on_logs_count: number;
  analysis_stability?: string;
  generation_reason?: string;
  created_at: string;
  updated_at: string;
}

export async function getOptimizedRecipe(recipeId: string): Promise<OptimizedRecipe | null> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('optimized_recipes')
      .select('*')
      .eq('recipe_id', recipeId)
      .eq('user_id', 'demo-user')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as OptimizedRecipe;
  }
  
  const savedVersion = localStorage.getItem(`my-version-${recipeId}`);
  if (!savedVersion) return null;
  
  try {
    const versionData = JSON.parse(savedVersion);
    return {
      id: 'local-' + recipeId,
      recipe_id: recipeId,
      user_id: 'demo-user',
      name: versionData.name,
      total_time: versionData.recipe?.totalTime || 0,
      ingredients: versionData.recipe?.ingredients || [],
      steps: versionData.recipe?.steps || [],
      adjustment_summary: versionData.adjustmentSummary || '',
      based_on_logs_count: versionData.basedOnLogs || 0,
      created_at: versionData.createdAt || new Date().toISOString(),
      updated_at: versionData.createdAt || new Date().toISOString(),
    } as OptimizedRecipe;
  } catch {
    return null;
  }
}

export async function saveOptimizedRecipe(recipeId: string, data: {
  name: string;
  totalTime: number;
  ingredients: OptimizedRecipe['ingredients'];
  steps: OptimizedRecipe['steps'];
  adjustmentSummary: string;
  basedOnLogsCount: number;
  analysisStability?: string;
  generationReason?: string;
}): Promise<OptimizedRecipe> {
  const optimizedRecipe = {
    recipe_id: recipeId,
    user_id: 'demo-user',
    name: data.name,
    total_time: data.totalTime,
    ingredients: data.ingredients,
    steps: data.steps,
    adjustment_summary: data.adjustmentSummary,
    based_on_logs_count: data.basedOnLogsCount,
    analysis_stability: data.analysisStability,
    generation_reason: data.generationReason,
    updated_at: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    const existing = await getOptimizedRecipe(recipeId);
    
    if (existing) {
      const { data: updated, error } = await supabase
        .from('optimized_recipes')
        .update(optimizedRecipe)
        .eq('recipe_id', recipeId)
        .eq('user_id', 'demo-user')
        .select()
        .single();
      
      if (error) throw error;
      return updated as OptimizedRecipe;
    } else {
      const { data: created, error } = await supabase
        .from('optimized_recipes')
        .insert({
          ...optimizedRecipe,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return created as OptimizedRecipe;
    }
  }
  
  const versionData = {
    name: data.name,
    recipe: {
      totalTime: data.totalTime,
      ingredients: data.ingredients,
      steps: data.steps,
    },
    adjustmentSummary: data.adjustmentSummary,
    basedOnLogs: data.basedOnLogsCount,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(`my-version-${recipeId}`, JSON.stringify(versionData));
  
  return {
    id: 'local-' + recipeId,
    recipe_id: recipeId,
    user_id: 'demo-user',
    ...versionData,
    total_time: data.totalTime,
    based_on_logs_count: data.basedOnLogsCount,
    created_at: versionData.createdAt,
    updated_at: versionData.createdAt,
  } as OptimizedRecipe;
}

export async function deleteOptimizedRecipe(recipeId: string): Promise<void> {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from('optimized_recipes')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('user_id', 'demo-user');
    
    if (error) throw error;
    return;
  }
  
  localStorage.removeItem(`my-version-${recipeId}`);
}

export async function saveAnalysisCache(
  analysisType: string,
  analysisResult: any,
  sourceLogIds: string[]
): Promise<void> {
  if (!useSupabase || !supabase) {
    console.log('Supabase not configured, skipping analysis cache save');
    return;
  }
  
  const { error } = await supabase
    .from('analysis_cache')
    .insert({
      analysis_type: analysisType,
      analysis_result: analysisResult,
      source_log_ids: sourceLogIds,
      user_id: 'demo-user',
    });
  
  if (error) {
    console.error('Failed to save analysis cache:', error);
  }
}
