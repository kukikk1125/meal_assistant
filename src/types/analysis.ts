export interface AnalysisResult {
  should_generate_optimized_version: boolean;
  confidence: "high" | "medium" | "low";
  analysis_stability?: "high" | "medium" | "low";
  
  summary: {
    title: string;
    text: string;
  };
  
  problems: Array<{
    code: string;
    label: string;
    frequency?: number;
    evidence_strength: "high" | "medium" | "low";
    category: "stable" | "occasional";
    likely_causes?: string[];
  }>;
  
  preferences: Array<{
    code: string;
    label: string;
    type: "flavor" | "texture" | "other";
    evidence_strength: "high" | "medium" | "low";
  }>;
  
  suggestions: Array<{
    title: string;
    detail: string;
    priority: "high" | "medium" | "low";
  }>;
  
  adjustment_direction: {
    flavor_profile?: string;
    ingredient_adjustment?: string[];
    heat_adjustment?: string[];
    step_optimization?: string[];
  };
  
  generation_reason: string;
  
  ui_recommendation: {
    primary_button_text: string;
    secondary_button_text: string;
  };
}

export interface OptimizedRecipe {
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
  changes_explanation: Array<{
    type: "ingredient" | "step" | "time" | "tip";
    target: string;
    original?: string;
    adjusted: string;
    reason: string;
  }>;
  adjustment_summary: string;
}
