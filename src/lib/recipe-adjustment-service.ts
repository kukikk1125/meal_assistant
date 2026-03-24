import {
  RecipeBase,
  CookRecord,
  AnalysisResult,
  OptimizedRecipe,
  AnalyzeCurrentRecordRequest,
  AnalyzeCurrentRecordResponse,
  AnalyzeHistoryRecordsRequest,
  AnalyzeHistoryRecordsResponse,
  GenerateOptimizedRecipeRequest,
  GenerateOptimizedRecipeResponse,
  ProblemTag,
} from "@/types/recipe-adjustment";
import { supabase } from "./supabase";

const LOCAL_STORAGE_KEY_PREFIX = "my-version-";
const useSupabase = !!supabase;

async function apiCall<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "请求失败");
  }

  return response.json();
}

export async function analyzeCurrentRecord(
  recipeBase: RecipeBase,
  currentRecord: CookRecord
): Promise<AnalysisResult> {
  const request: AnalyzeCurrentRecordRequest = {
    recipe_base: recipeBase,
    current_record: currentRecord,
  };

  const response = await apiCall<AnalyzeCurrentRecordResponse>(
    "/api/recipe-adjustment/analyze-current-record",
    request
  );

  return response.analysis_result;
}

export async function analyzeHistoryRecords(
  recipeBase: RecipeBase,
  historyRecords: CookRecord[]
): Promise<AnalysisResult> {
  const request: AnalyzeHistoryRecordsRequest = {
    recipe_base: recipeBase,
    history_records: historyRecords,
  };

  const response = await apiCall<AnalyzeHistoryRecordsResponse>(
    "/api/recipe-adjustment/analyze-history-records",
    request
  );

  return response.analysis_result;
}

export async function generateOptimizedRecipe(
  recipeBase: RecipeBase,
  analysisResult: AnalysisResult
): Promise<OptimizedRecipe> {
  const request: GenerateOptimizedRecipeRequest = {
    recipe_base: recipeBase,
    analysis_result: analysisResult,
  };

  const response = await apiCall<GenerateOptimizedRecipeResponse>(
    "/api/recipe-adjustment/generate-optimized-recipe",
    request
  );

  return response.optimized_recipe;
}

export function convertRecipeToBase(recipe: {
  id: string;
  name: string;
  total_time: number;
  ingredients: Array<{ id: string; name: string; amount: number; unit: string; scalable?: boolean }>;
  steps: Array<{
    order: number;
    description: string;
    duration: number;
    ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }>;
    tip?: string;
  }>;
}): RecipeBase {
  return {
    id: recipe.id,
    name: recipe.name,
    total_time: recipe.total_time,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
  };
}

export function convertCookingLogToRecord(log: {
  id: string;
  rating: number;
  taste_feedback?: string[];
  difficulty_feedback?: string[];
  notes?: string;
  created_at?: string;
}): CookRecord {
  const tags: ProblemTag[] = [
    ...(log.taste_feedback || []).map((tag) => ({
      code: tag,
      label: getTagLabel(tag),
      category: "taste" as const,
    })),
    ...(log.difficulty_feedback || []).map((tag) => ({
      code: tag,
      label: getTagLabel(tag),
      category: "difficulty" as const,
    })),
  ];

  return {
    id: log.id,
    rating: log.rating,
    tags,
    notes: log.notes,
    cook_time: log.created_at,
  };
}

function getTagLabel(code: string): string {
  const labels: Record<string, string> = {
    too_spicy: "太辣了",
    too_salty: "太咸了",
    too_oily: "太油了",
    too_bland: "太淡了",
    too_sweet: "太甜了",
    too_sour: "太酸了",
    just_right: "刚刚好",
    prep_hard: "食材准备太麻烦",
    step_unclear: "某一步没看懂",
    heat_hard: "火候不好掌握",
    time_short: "时间不够",
    seasoning_uncertain: "调味不确定",
    too_complex: "过程太复杂",
  };
  return labels[code] || code;
}

export interface SavedOptimizedRecipe {
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

export async function getOptimizedRecipe(recipeId: string): Promise<SavedOptimizedRecipe | null> {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from("optimized_recipes")
        .select("*")
        .eq("recipe_id", recipeId)
        .eq("user_id", "demo-user")
        .single();
      
      if (error) {
        console.log('[getOptimizedRecipe] Supabase error:', error);
        if (error.code === "PGRST116") return null;
        console.log('[getOptimizedRecipe] Falling back to localStorage');
      } else if (data) {
        return data as SavedOptimizedRecipe;
      }
    } catch (error) {
      console.log('[getOptimizedRecipe] Error querying Supabase:', error);
    }
  }
  
  const savedVersion = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${recipeId}`);
  if (!savedVersion) return null;
  
  try {
    const versionData = JSON.parse(savedVersion);
    return {
      id: `local-${recipeId}`,
      recipe_id: recipeId,
      user_id: "demo-user",
      name: versionData.name,
      total_time: versionData.recipe?.totalTime || 0,
      ingredients: versionData.recipe?.ingredients || [],
      steps: versionData.recipe?.steps || [],
      adjustment_summary: versionData.adjustmentSummary || "",
      based_on_logs_count: versionData.basedOnLogs || 0,
      created_at: versionData.createdAt || new Date().toISOString(),
      updated_at: versionData.createdAt || new Date().toISOString(),
    } as SavedOptimizedRecipe;
  } catch {
    return null;
  }
}

export async function saveOptimizedRecipe(
  recipeId: string,
  data: {
    name: string;
    total_time: number;
    ingredients: SavedOptimizedRecipe["ingredients"];
    steps: SavedOptimizedRecipe["steps"];
    adjustment_summary: string;
    based_on_logs_count: number;
    changes_explanation?: SavedOptimizedRecipe["changes_explanation"];
    analysis_stability?: string;
    generation_reason?: string;
  }
): Promise<SavedOptimizedRecipe> {
  if (useSupabase && supabase) {
    try {
      const existing = await getOptimizedRecipe(recipeId);
      
      if (existing) {
        const { data: updated, error } = await supabase
          .from("optimized_recipes")
          .update({
            name: data.name,
            total_time: data.total_time,
            ingredients: data.ingredients,
            steps: data.steps,
            adjustment_summary: data.adjustment_summary,
            based_on_logs_count: data.based_on_logs_count,
            changes_explanation: data.changes_explanation,
            analysis_stability: data.analysis_stability,
            generation_reason: data.generation_reason,
            updated_at: new Date().toISOString(),
          })
          .eq("recipe_id", recipeId)
          .eq("user_id", "demo-user")
          .select()
          .single();
        
        if (error) {
          console.log('[saveOptimizedRecipe] Update error, falling back to localStorage:', error);
        } else if (updated) {
          return updated as SavedOptimizedRecipe;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("optimized_recipes")
          .insert({
            recipe_id: recipeId,
            user_id: "demo-user",
            name: data.name,
            total_time: data.total_time,
            ingredients: data.ingredients,
            steps: data.steps,
            adjustment_summary: data.adjustment_summary,
            based_on_logs_count: data.based_on_logs_count,
            changes_explanation: data.changes_explanation,
            analysis_stability: data.analysis_stability,
            generation_reason: data.generation_reason,
          })
          .select()
          .single();
        
        if (error) {
          console.log('[saveOptimizedRecipe] Insert error, falling back to localStorage:', error);
        } else if (inserted) {
          return inserted as SavedOptimizedRecipe;
        }
      }
    } catch (error) {
      console.log('[saveOptimizedRecipe] Supabase error, falling back to localStorage:', error);
    }
  }
  
  const versionData = {
    name: data.name,
    recipe: {
      totalTime: data.total_time,
      ingredients: data.ingredients,
      steps: data.steps,
    },
    adjustmentSummary: data.adjustment_summary,
    basedOnLogs: data.based_on_logs_count,
    createdAt: new Date().toISOString(),
  };
  
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${recipeId}`, JSON.stringify(versionData));
  
  return {
    id: `local-${recipeId}`,
    recipe_id: recipeId,
    user_id: "demo-user",
    ...data,
    created_at: versionData.createdAt,
    updated_at: versionData.createdAt,
  } as SavedOptimizedRecipe;
}

export async function deleteOptimizedRecipe(recipeId: string): Promise<void> {
  if (useSupabase && supabase) {
    const { error } = await supabase
      .from("optimized_recipes")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("user_id", "demo-user");
    
    if (error) throw error;
    return;
  }
  
  localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${recipeId}`);
}
