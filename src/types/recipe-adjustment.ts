export interface RecipeBase {
  id: string;
  name: string;
  total_time: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface RecipeIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  scalable?: boolean;
}

export interface RecipeStep {
  order: number;
  description: string;
  duration: number;
  ingredients?: StepIngredient[];
  tip?: string;
}

export interface StepIngredient {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
}

export interface CookRecord {
  id: string;
  cook_time?: string;
  rating: number;
  tags: ProblemTag[];
  notes?: string;
  serving_adjustment?: string;
  ingredient_replacements?: IngredientReplacement[];
  image_analysis?: string;
}

export interface ProblemTag {
  code: string;
  label: string;
  category: "taste" | "difficulty" | "other";
}

export interface IngredientReplacement {
  original_id: string;
  original_name: string;
  replacement_name: string;
  replacement_amount: string;
}

export interface AnalysisResult {
  should_generate_optimized_version: boolean;
  confidence: "high" | "medium" | "low";
  analysis_stability?: "high" | "medium" | "low";
  
  summary: AnalysisSummary;
  
  problems: ProblemAnalysis[];
  
  preferences: PreferenceAnalysis[];
  
  suggestions: SuggestionItem[];
  
  adjustment_direction: AdjustmentDirection;
  
  generation_reason: string;
  
  ui_recommendation: UIRecommendation;
}

export interface AnalysisSummary {
  title: string;
  text: string;
}

export interface ProblemAnalysis {
  code: string;
  label: string;
  frequency?: number;
  evidence_strength: "high" | "medium" | "low";
  category: "stable" | "occasional";
  likely_causes?: string[];
}

export interface PreferenceAnalysis {
  code: string;
  label: string;
  type: "flavor" | "texture" | "other";
  evidence_strength: "high" | "medium" | "low";
}

export interface SuggestionItem {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export interface AdjustmentDirection {
  flavor_profile?: string;
  ingredient_adjustment?: string[];
  heat_adjustment?: string[];
  step_optimization?: string[];
}

export interface UIRecommendation {
  primary_button_text: string;
  secondary_button_text: string;
}

export interface OptimizedRecipe {
  name: string;
  total_time: number;
  ingredients: OptimizedIngredient[];
  steps: OptimizedStep[];
  
  changes_explanation: ChangeExplanation[];
  
  adjustment_summary: string;
}

export interface OptimizedIngredient {
  id: string;
  name: string;
  original_amount?: number;
  original_unit?: string;
  adjusted_amount: number;
  adjusted_unit: string;
  change_reason?: string;
}

export interface OptimizedStep {
  order: number;
  description: string;
  duration: number;
  ingredients?: StepIngredient[];
  tip?: string;
  changes?: string[];
}

export interface ChangeExplanation {
  type: "ingredient" | "step" | "time" | "tip";
  target: string;
  original?: string;
  adjusted: string;
  reason: string;
}

export interface AnalyzeCurrentRecordRequest {
  recipe_base: RecipeBase;
  current_record: CookRecord;
}

export interface AnalyzeCurrentRecordResponse {
  analysis_result: AnalysisResult;
}

export interface AnalyzeHistoryRecordsRequest {
  recipe_base: RecipeBase;
  history_records: CookRecord[];
}

export interface AnalyzeHistoryRecordsResponse {
  analysis_result: AnalysisResult;
}

export interface GenerateOptimizedRecipeRequest {
  recipe_base: RecipeBase;
  analysis_result: AnalysisResult;
}

export interface GenerateOptimizedRecipeResponse {
  optimized_recipe: OptimizedRecipe;
}

export const TASTE_PROBLEM_CODES = {
  TOO_SPICY: { code: "too_spicy", label: "太辣了", category: "taste" as const },
  TOO_SALTY: { code: "too_salty", label: "太咸了", category: "taste" as const },
  TOO_OILY: { code: "too_oily", label: "太油了", category: "taste" as const },
  TOO_BLAND: { code: "too_bland", label: "太淡了", category: "taste" as const },
  TOO_SWEET: { code: "too_sweet", label: "太甜了", category: "taste" as const },
  TOO_SOUR: { code: "too_sour", label: "太酸了", category: "taste" as const },
  JUST_RIGHT: { code: "just_right", label: "刚刚好", category: "taste" as const },
} as const;

export const DIFFICULTY_PROBLEM_CODES = {
  PREP_HARD: { code: "prep_hard", label: "食材准备太麻烦", category: "difficulty" as const },
  STEP_UNCLEAR: { code: "step_unclear", label: "某一步没看懂", category: "difficulty" as const },
  HEAT_HARD: { code: "heat_hard", label: "火候不好掌握", category: "difficulty" as const },
  TIME_SHORT: { code: "time_short", label: "时间不够", category: "difficulty" as const },
  SEASONING_UNCERTAIN: { code: "seasoning_uncertain", label: "调味不确定", category: "difficulty" as const },
  TOO_COMPLEX: { code: "too_complex", label: "过程太复杂", category: "difficulty" as const },
} as const;

export const PREFERENCE_CODES = {
  LESS_SPICY: { code: "less_spicy", label: "偏少辣", type: "flavor" as const },
  LESS_OILY: { code: "less_oily", label: "偏少油", type: "flavor" as const },
  LESS_SALTY: { code: "less_salty", label: "偏清淡", type: "flavor" as const },
  SOFTER: { code: "softer", label: "偏软烂", type: "texture" as const },
  CRISPIER: { code: "crispier", label: "偏脆爽", type: "texture" as const },
} as const;
