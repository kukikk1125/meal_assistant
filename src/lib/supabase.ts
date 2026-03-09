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
  notes?: string;
  used_version?: "original" | "my";
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
  const data = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
  return data ? JSON.parse(data) : [];
}

function setLocalLogs(logs: CookingLog[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(logs));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
      .insert(recipe)
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
    ...log,
    id: generateId(),
  };

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('cooking_logs')
      .insert(log)
      .select()
      .single();
    
    if (error) throw error;
    return data as CookingLog;
  }
  
  const logs = getLocalLogs();
  logs.unshift(newLog);
  setLocalLogs(logs);
  return newLog;
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
