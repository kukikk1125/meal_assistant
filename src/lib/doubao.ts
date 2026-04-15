﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿export interface ParsedRecipe {
  name: string;
  totalTime: number;
  ingredients: {
    name: string;
    amount: number;
    unit: string;
    scalable?: boolean;
  }[];
  steps: {
    order: number;
    description: string;
    duration: number;
    ingredients?: {
      ingredientId: string;
      name: string;
      amount: number;
      unit: string;
    }[];
    relatedIngredients?: string[];
  }[];
}

export interface IngredientSubstitution {
  type: "same_type" | "similar_flavor" | "omit";
  name: string;
  amount: string;
  reason: string;
  impact: "low" | "medium" | "high";
  parsedAmount: number;
  parsedUnit: string;
}

export interface CookingAdvice {
  status: string;
  suggestion: string;
  warning?: string;
}

export interface PhotoCheckAnalysisResult {
  overallStatus: "good" | "warning" | "problem" | "unclear";
  statusLabel: string;
  currentState: string;
  isAppropriate: boolean;
  canProceed: boolean;
  problemType: "none" | "heat" | "texture" | "color" | "doneness" | "seasoning" | "mixing" | "moisture" | "plating" | "unclear";
  confidence: "high" | "medium" | "low";
  reasons: string[];
  risks: string[];
  advice: string;
  remedy: string;
  followUpShotSuggestion?: string;
}

export interface PersonalizedAdvice {
  summary: string;
  suggestions: string[];
  improvements: string[];
}

const USE_MOCK_DATA = false;

class AIRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "API_ERROR", status = 500) {
    super(message);
    this.name = "AIRequestError";
    this.code = code;
    this.status = status;
  }
}

async function callAI(type: string, data: Record<string, unknown>): Promise<string> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type, ...data }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code || payload?.code || "API_ERROR";
    const message = payload?.error?.message || payload?.error || payload?.message || "API call failed";
    throw new AIRequestError(String(message), String(code), response.status);
  }

  return payload?.result || "";
}

export function isAIRequestTimeoutError(error: unknown): boolean {
  if (error instanceof AIRequestError) {
    return error.code === "TIMEOUT";
  }
  if (error instanceof Error) {
    return (
      error.message.includes("TIMEOUT") ||
      error.message.includes("taking longer than expected") ||
      error.message.includes("超时")
    );
  }
  return false;
}

function findIngredientByName(
  ingredients: Array<{ id: string; name: string; amount: number; unit: string }>,
  name: string
): { id: string; name: string; amount: number; unit: string } | undefined {
  let ingredient = ingredients.find(ing => ing.name === name);
  
  if (!ingredient) {
    ingredient = ingredients.find(ing => 
      ing.name.includes(name) || name.includes(ing.name)
    );
  }
  
  if (!ingredient) {
    const nameChars = name.split('');
    ingredient = ingredients.find(ing => {
      const ingChars = ing.name.split('');
      const commonChars = nameChars.filter(c => ingChars.includes(c));
      return commonChars.length >= Math.min(nameChars.length, ingChars.length) * 0.5;
    });
  }
  
  return ingredient;
}

export function replaceStepPlaceholders(
  description: string,
  ingredients: Array<{ id: string; name: string; amount: number; unit: string }>,
  scaleFactor: number,
  getSubstitutedIngredient: (ingredientId: string) => { name: string; unit: string } | null
): string {
  const newFormatRegex = /\[([^\]]+)\]\[([^\]]+)\]/g;
  
  let result = description.replace(newFormatRegex, (match, amountWithUnit, ingredientName) => {
    const ingredient = findIngredientByName(ingredients, ingredientName);
    
    if (!ingredient) {
      return match;
    }
    
    const substitution = getSubstitutedIngredient(ingredient.id);
    const displayName = substitution?.name || ingredientName;
    const displayUnit = substitution?.unit || ingredient.unit;
    
    const amountMatch = amountWithUnit.match(/^([\d.]+)(.*)$/);
    let displayAmount: string | number;
    
    if (amountMatch) {
      const originalAmount = parseFloat(amountMatch[1]);
      const unitFromPlaceholder = amountMatch[2];
      const scaledAmount = Math.round(originalAmount * scaleFactor * 10) / 10;
      
      if (unitFromPlaceholder) {
        return `${scaledAmount}${unitFromPlaceholder} ${displayName}`;
      } else {
        return `${scaledAmount}${displayUnit} ${displayName}`;
      }
    } else if (amountWithUnit === "适量" || amountWithUnit === "少许") {
      return `${amountWithUnit} ${displayName}`;
    } else {
      displayAmount = Math.round(ingredient.amount * scaleFactor * 10) / 10;
      if (displayAmount > 0 && displayUnit) {
        return `${displayAmount}${displayUnit} ${displayName}`;
      } else {
        return `适量 ${displayName}`;
      }
    }
  });
  
  const fullPlaceholderRegex = /\{([^:}]+):([^:}]*):([^}]*)\}/g;
  
  result = result.replace(fullPlaceholderRegex, (match, ingredientName, amountStr, unit) => {
    const ingredient = findIngredientByName(ingredients, ingredientName);
    
    if (!ingredient) {
      return match;
    }
    
    const substitution = getSubstitutedIngredient(ingredient.id);
    const displayName = substitution?.name || ingredientName;
    const displayUnit = substitution?.unit || unit || ingredient.unit;
    
    let displayAmount: string | number;
    if (amountStr === "适量" || amountStr === "" || !amountStr || parseFloat(amountStr) === 0) {
      const ingredientAmount = ingredient.amount * scaleFactor;
      if (ingredientAmount > 0) {
        displayAmount = Math.round(ingredientAmount * 10) / 10;
      } else {
        displayAmount = "适量";
      }
    } else {
      const originalAmount = parseFloat(amountStr);
      const scaledAmount = Math.round(originalAmount * scaleFactor * 10) / 10;
      displayAmount = scaledAmount;
    }
    
    if (typeof displayAmount === "number" && displayUnit) {
      return `${displayAmount}${displayUnit} ${displayName}`;
    } else if (typeof displayAmount === "number") {
      return `${displayAmount} ${displayName}`;
    } else {
      return `${displayAmount} ${displayName}`;
    }
  });
  
  const simplePlaceholderRegex = /\{([^:}]+)\}/g;
  
  result = result.replace(simplePlaceholderRegex, (match, ingredientName) => {
    const ingredient = findIngredientByName(ingredients, ingredientName);
    
    if (!ingredient) {
      return match;
    }
    
    const substitution = getSubstitutedIngredient(ingredient.id);
    const displayName = substitution?.name || ingredientName;
    const displayUnit = substitution?.unit || ingredient.unit;
    const displayAmount = Math.round(ingredient.amount * scaleFactor * 10) / 10;
    
    if (displayAmount > 0 && displayUnit) {
      return `${displayAmount}${displayUnit} ${displayName}`;
    } else if (displayAmount > 0) {
      return `${displayAmount} ${displayName}`;
    } else {
      return `适量 ${displayName}`;
    }
  });
  
  return result;
}

export function replaceStepPlaceholdersWithoutAmount(
  description: string,
  ingredients: Array<{ id: string; name: string; amount: number; unit: string }>,
  getSubstitutedIngredient: (ingredientId: string) => { name: string; unit: string } | null,
  stripPlainTextAmount = false
): string {
  const stripInlineIngredientAmounts = (text: string): string => {
    const amountUnitRegex =
      /(\d+(?:\.\d+)?)\s*(克|g|千克|kg|毫升|ml|升|l|勺|汤匙|茶匙|小勺|大勺|杯|碗|个|颗|粒|片|块|条|根|段|把|瓣|滴|撮|袋|罐|张)/gi;

    return text
      .replace(amountUnitRegex, "")
      .replace(/\b(适量|少许)\s*/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s*([，。；、])/g, "$1")
      .trim();
  };

  const newFormatRegex = /\[([^\]]+)\]\[([^\]]+)\]/g;
  
  let result = description.replace(newFormatRegex, (match, amountWithUnit, ingredientName) => {
    const ingredient = findIngredientByName(ingredients, ingredientName);
    
    if (!ingredient) {
      return match;
    }
    
    const substitution = getSubstitutedIngredient(ingredient.id);
    const displayName = substitution?.name || ingredientName;
    
    return displayName;
  });
  
  const fullPlaceholderRegex = /\{([^:}]+):([^:}]*):([^}]*)\}/g;
  
  result = result.replace(fullPlaceholderRegex, (match, ingredientName, amountStr, unit) => {
    const ingredient = findIngredientByName(ingredients, ingredientName);
    
    if (!ingredient) {
      return match;
    }
    
    const substitution = getSubstitutedIngredient(ingredient.id);
    const displayName = substitution?.name || ingredientName;
    
    return displayName;
  });
  
  const simplePlaceholderRegex = /\{([^:}]+)\}/g;
  
  result = result.replace(simplePlaceholderRegex, (match, ingredientName) => {
    const ingredient = findIngredientByName(ingredients, ingredientName);
    
    if (!ingredient) {
      return match;
    }
    
    const substitution = getSubstitutedIngredient(ingredient.id);
    const displayName = substitution?.name || ingredientName;
    
    return displayName;
  });
  
  return stripPlainTextAmount ? stripInlineIngredientAmounts(result) : result;
}

function extractJSON(text: string): string {
  let cleaned = text.trim();

  if (cleaned.includes("```json")) {
    const match = cleaned.match(/```json\s*([\s\S]*?)```/);
    if (match) cleaned = match[1].trim();
  } else if (cleaned.includes("```")) {
    const match = cleaned.match(/```\s*([\s\S]*?)```/);
    if (match) cleaned = match[1].trim();
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : cleaned;
}

export async function parseRecipeFromText(text: string): Promise<ParsedRecipe> {
  const result = await callAI("parseText", { content: text });
  try {
    return JSON.parse(extractJSON(result)) as ParsedRecipe;
  } catch {
    throw new Error("模型返回内容不是有效的 JSON");
  }
}

export async function parseRecipeFromImage(imageBase64: string): Promise<ParsedRecipe> {
  const result = await callAI("parseImage", { content: imageBase64 });
  try {
    return JSON.parse(extractJSON(result)) as ParsedRecipe;
  } catch {
    throw new Error("模型返回内容不是有效的 JSON");
  }
}

export async function getIngredientSubstitutions(
  ingredientName: string,
  recipeName: string,
  currentAmount: string
): Promise<IngredientSubstitution[]> {
  if (USE_MOCK_DATA) {
    const normalized = ingredientName.trim().toLowerCase();
    if (!normalized) return [];
    return [
      {
        type: "same_type",
        name: "同类食材",
        amount: "等量替换",
        reason: "口感和用途相近",
        impact: "low",
        parsedAmount: 1,
        parsedUnit: "份",
      },
    ];
  }

  try {
    const result = await callAI("getSubstitutions", {
      ingredientName,
      recipeName,
      currentAmount,
    });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    
    const parsed = JSON.parse(jsonMatch[0]);
    const substitutions = parsed.substitutions || [];
    
    return substitutions.map((sub: any) => ({
      type: sub.type as IngredientSubstitution["type"],
      name: sub.name,
      amount: sub.amount,
      reason: sub.reason,
      impact: sub.impact as IngredientSubstitution["impact"],
      parsedAmount: parseFloat(sub.amount) || 0,
      parsedUnit: sub.amount?.replace(/[\d.]/g, "") || "",
    }));
  } catch {
    return [];
  }
}

export async function analyzeCookingImage(
  imageBase64: string,
  currentStep: string,
  stepNumber: number,
  recipeName?: string,
  prevStep?: string,
  nextStep?: string
): Promise<PhotoCheckAnalysisResult> {
  if (USE_MOCK_DATA) {
    return {
      overallStatus: "good",
      statusLabel: "状态正常",
      currentState: "食材正在锅中翻炒，表面微微上色",
      isAppropriate: true,
      canProceed: true,
      problemType: "none",
      confidence: "high",
      reasons: ["食材颜色均匀", "表面有适当焦化"],
      risks: [],
      advice: "可以继续下一步操作",
      remedy: "",
      followUpShotSuggestion: "",
    };
  }

  try {
    const result = await callAI("analyzeCooking", {
      content: imageBase64,
      currentStep,
      stepNumber,
      recipeName,
      prevStep,
      nextStep,
    });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("invalid JSON");
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      overallStatus: parsed.overallStatus || "unclear",
      statusLabel: parsed.statusLabel || "无法判断",
      currentState: parsed.currentState || "无法识别当前状态",
      isAppropriate: parsed.isAppropriate ?? true,
      canProceed: parsed.canProceed ?? true,
      problemType: parsed.problemType || "unclear",
      confidence: parsed.confidence || "low",
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      advice: parsed.advice || "请继续按步骤操作",
      remedy: parsed.remedy || "",
      followUpShotSuggestion: parsed.followUpShotSuggestion || "",
    };
  } catch {
    return {
      overallStatus: "unclear",
      statusLabel: "无法判断",
      currentState: "无法识别当前状态",
      isAppropriate: true,
      canProceed: true,
      problemType: "unclear",
      confidence: "low",
      reasons: [],
      risks: [],
      advice: "请继续按步骤操作",
      remedy: "",
      followUpShotSuggestion: "建议重新拍摄，确保光线充足、画面清晰",
    };
  }
}

export async function getPersonalizedAdvice(
  recipeName: string,
  logs: Array<{ rating: number; taste_note: string; improvement: string; cooked_at: string }>
): Promise<PersonalizedAdvice> {
  if (USE_MOCK_DATA) {
    if (logs.length === 0) {
      return { summary: "暂无历史记录", suggestions: [], improvements: [] };
    }
    return {
      summary: `你已做过 ${logs.length} 次 ${recipeName}`,
      suggestions: ["可根据口味继续微调调味比例"],
      improvements: logs.map((x) => x.improvement).filter(Boolean).slice(0, 3),
    };
  }

  try {
    const result = await callAI("getPersonalizedAdvice", {
      recipeName,
      logs: JSON.stringify(logs),
    });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? (JSON.parse(jsonMatch[0]) as PersonalizedAdvice)
      : { summary: "暂无建议", suggestions: [], improvements: [] };
  } catch {
    return { summary: "获取建议失败", suggestions: [], improvements: [] };
  }
}

export async function generateRecipeImprovements(
  recipe: { name: string; ingredients: Array<{ name: string; amount: number; unit: string }>; steps: Array<{ description: string }> },
  logs: Array<{ rating: number; taste_note: string; improvement: string }>
): Promise<{
  ingredientChanges: Array<{ name: string; oldAmount: number; newAmount: number; reason: string }>;
  stepChanges: Array<{ stepIndex: number; oldDescription: string; newDescription: string; reason: string }>;
}> {
  if (USE_MOCK_DATA) {
    return { ingredientChanges: [], stepChanges: [] };
  }

  try {
    const result = await callAI("generateRecipeImprovements", {
      recipe: JSON.stringify(recipe),
      logs: JSON.stringify(logs),
    });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { ingredientChanges: [], stepChanges: [] };
  } catch {
    return { ingredientChanges: [], stepChanges: [] };
  }
}

export async function optimizeRecipe(recipe: ParsedRecipe): Promise<ParsedRecipe> {
  const result = await callAI("optimizeRecipe", { recipe });
  try {
    return JSON.parse(extractJSON(result)) as ParsedRecipe;
  } catch {
    throw new Error("模型返回内容不是有效的 JSON");
  }
}

export interface OptimizedRecipeFromLogs {
  name: string;
  totalTime: number;
  ingredients: {
    id: string;
    name: string;
    original_amount?: number;
    original_unit?: string;
    adjusted_amount: number;
    adjusted_unit: string;
    scalable?: boolean;
    change_reason?: string;
  }[];
  steps: {
    order: number;
    description: string;
    duration: number;
    ingredients?: {
      ingredientId: string;
      name: string;
      amount: number;
      unit: string;
    }[];
    tip?: string;
    changes?: string[];
  }[];
  adjustmentSummary: string;
}

export async function optimizeRecipeFromLogs(
  recipe: { 
    name: string; 
    totalTime: number;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string; scalable?: boolean }>;
    steps: Array<{ order: number; description: string; duration: number; ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }>; tip?: string }>;
  },
  cookingLogs: Array<{
    rating: number;
    taste_feedback?: string[];
    difficulty_feedback?: string[];
    notes?: string;
  }>
): Promise<OptimizedRecipeFromLogs> {
  const result = await callAI("optimizeRecipeFromLogs", { recipe, cookingLogs });
  try {
    return JSON.parse(extractJSON(result)) as OptimizedRecipeFromLogs;
  } catch {
    throw new Error("模型返回内容不是有效的 JSON");
  }
}

export interface CookingLogAnalysis {
  should_generate_optimized_version: boolean;
  confidence: "high" | "medium" | "low";
  is_positive?: boolean;
  
  summary: {
    title: string;
    text: string;
  };
  
  problems: Array<{
    code: string;
    label: string;
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
  
  praise?: {
    title: string;
    text: string;
  };
  
  share_text?: string;
  
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
    show_share?: boolean;
  };
}

export async function analyzeCookingLog(
  recipe: {
    name: string;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string }>;
    steps: Array<{ order: number; description: string; duration: number }>;
  },
  currentLog: {
    cookTime?: string;
    rating: number;
    taste_feedback?: string[];
    difficulty_feedback?: string[];
    notes?: string;
    servingAdjustment?: string;
    ingredientReplacements?: string;
  }
): Promise<CookingLogAnalysis> {
  const result = await callAI("analyzeCookingLog", { recipe, currentLog });
  try {
    const jsonStr = extractJSON(result);
    const parsed = JSON.parse(jsonStr);
    
    if (!parsed.suggestions) {
      parsed.suggestions = [];
    }
    if (!parsed.problems) {
      parsed.problems = [];
    }
    if (!parsed.preferences) {
      parsed.preferences = [];
    }
    if (!parsed.summary) {
      parsed.summary = { title: "分析结果", text: "" };
    }
    if (!parsed.ui_recommendation) {
      parsed.ui_recommendation = {
        primary_button_text: "根据这次问题生成改良版",
        secondary_button_text: "先查看优化建议"
      };
    }
    
    return parsed as CookingLogAnalysis;
  } catch (e) {
    console.error("Failed to parse analyzeCookingLog result:", result);
    throw new Error("模型返回内容不是有效的 JSON: " + (e instanceof Error ? e.message : String(e)));
  }
}

export interface CookingHistoryAnalysis {
  should_generate_optimized_version: boolean;
  confidence: "high" | "medium" | "low";
  analysis_stability: "high" | "medium" | "low";
  history_count: number;
  
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

export async function analyzeCookingHistory(
  recipe: {
    name: string;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string }>;
    steps: Array<{ order: number; description: string; duration: number }>;
  },
  historyRecords: Array<{
    cookTime?: string;
    rating: number;
    taste_feedback?: string[];
    difficulty_feedback?: string[];
    notes?: string;
    servingAdjustment?: string;
    ingredientReplacements?: string;
  }>
): Promise<CookingHistoryAnalysis> {
  const result = await callAI("analyzeCookingHistory", { 
    recipe, 
    historyRecords, 
    historyCount: historyRecords.length 
  });
  try {
    const jsonStr = extractJSON(result);
    const parsed = JSON.parse(jsonStr);
    
    if (!parsed.suggestions) {
      parsed.suggestions = [];
    }
    if (!parsed.problems) {
      parsed.problems = [];
    }
    if (!parsed.preferences) {
      parsed.preferences = [];
    }
    if (!parsed.summary) {
      parsed.summary = { title: "分析结果", text: "" };
    }
    if (!parsed.ui_recommendation) {
      parsed.ui_recommendation = {
        primary_button_text: "基于历史记录生成长期优化版",
        secondary_button_text: "查看我的复盘总结"
      };
    }
    
    return parsed as CookingHistoryAnalysis;
  } catch (e) {
    console.error("Failed to parse analyzeCookingHistory result:", result);
    throw new Error("模型返回内容不是有效的 JSON: " + (e instanceof Error ? e.message : String(e)));
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSubstitutionResult {
  reply: string;
  substitutions?: Array<{
    original: string;
    replacement: string;
    amount: string;
    reason: string;
  }>;
}

export async function chatSubstitution(
  message: string,
  recipe: { name: string; ingredients: Array<{ name: string; amount: number; unit: string }> },
  chatHistory: ChatMessage[] = []
): Promise<ChatSubstitutionResult> {
  try {
    const result = await callAI("chatSubstitution", {
      content: message,
      recipe,
      chatHistory,
    });
    
    const jsonMatch = result.match(/\{"substitutions":[\s\S]*?\}/);
    let substitutions: ChatSubstitutionResult["substitutions"] = undefined;
    let reply = result;
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        substitutions = parsed.substitutions;
        reply = result.replace(jsonMatch[0], "").trim();
      } catch {
        // JSON解析失败，忽略
      }
    }
    
    return { reply, substitutions };
  } catch (error) {
    throw error;
  }
}

export interface PlaceholderConversionResult {
  convertedSteps: Array<{ id: string; order: number; description: string; duration: number; tip?: string }>;
  unmatchedIngredients: string[];
}

export function convertStepsToPlaceholderFormat(
  steps: Array<{ id: string; order: number; description: string; duration: number; tip?: string }>,
  ingredients: Array<{ name: string; amount: number; unit: string }>
): PlaceholderConversionResult {
  const matchedIngredients = new Set<string>();
  const convertedSteps: Array<{ id: string; order: number; description: string; duration: number; tip?: string }> = [];

  for (const step of steps) {
    let convertedDescription = step.description;

    const sortedIngredients = [...ingredients].sort((a, b) => b.name.length - a.name.length);

    for (const ingredient of sortedIngredients) {
      const { name, amount, unit } = ingredient;

      const patterns = [
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${escapeRegExp(unit)})\\s*${escapeRegExp(name)}`, 'gi'),
        new RegExp(`${escapeRegExp(name)}\\s*(\\d+(?:\\.\\d+)?)\\s*(${escapeRegExp(unit)})`, 'gi'),
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapeRegExp(name)}`, 'gi'),
      ];

      let matched = false;
      for (const pattern of patterns) {
        const matches = convertedDescription.match(pattern);
        if (matches) {
          for (const match of matches) {
            const amountMatch = match.match(/(\d+(?:\.\d+)?)/);
            if (amountMatch) {
              const matchedAmount = amountMatch[1];
              const matchedUnit = match.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${escapeRegExp(unit)})`))?.[2] || unit;
              const placeholder = `{${name}:${matchedAmount}:${matchedUnit}}`;
              convertedDescription = convertedDescription.replace(match, placeholder);
              matchedIngredients.add(name);
            }
          }
          matched = true;
        }
      }

      if (!matched) {
        const amountVariants = [
          { text: `${amount}${unit}${name}`, placeholder: `{${name}:${amount}:${unit}}` },
          { text: `${amount}${unit} ${name}`, placeholder: `{${name}:${amount}:${unit}}` },
          { text: `${amount} ${unit}${name}`, placeholder: `{${name}:${amount}:${unit}}` },
          { text: `${name}${amount}${unit}`, placeholder: `{${name}:${amount}:${unit}}` },
          { text: `${name} ${amount}${unit}`, placeholder: `{${name}:${amount}:${unit}}` },
          { text: `${name}${amount} ${unit}`, placeholder: `{${name}:${amount}:${unit}}` },
        ];

        for (const variant of amountVariants) {
          if (convertedDescription.includes(variant.text)) {
            convertedDescription = convertedDescription.split(variant.text).join(variant.placeholder);
            matchedIngredients.add(name);
            break;
          }
        }
      }

      const nameOnlyPattern = new RegExp(escapeRegExp(name), 'g');
      if (nameOnlyPattern.test(convertedDescription)) {
        matchedIngredients.add(name);
      }
    }

    convertedSteps.push({
      ...step,
      description: convertedDescription,
    });
  }

  const unmatchedIngredients = ingredients
    .filter(ing => !matchedIngredients.has(ing.name))
    .map(ing => ing.name);

  return {
    convertedSteps,
    unmatchedIngredients,
  };
}

export function convertToPlaceholderFormat(
  description: string,
  ingredients: Array<{ name: string; amount: number; unit: string }>
): string {
  let result = description;

  const sortedIngredients = [...ingredients].sort((a, b) => b.name.length - a.name.length);

  for (const ingredient of sortedIngredients) {
    const { name, amount, unit } = ingredient;

    const patterns = [
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unit})\\s*${escapeRegExp(name)}`, 'gi'),
      new RegExp(`${escapeRegExp(name)}\\s*(\\d+(?:\\.\\d+)?)\\s*(${unit})`, 'gi'),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapeRegExp(name)}`, 'gi'),
    ];

    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (match) {
        if (pattern === patterns[2]) {
          result = result.replace(pattern, `{${name}:${match[1]}:${unit}}`);
        } else {
          const matchedText = match[0];
          const matchedAmount = match[1];
          const matchedUnit = match[2] || unit;
          result = result.replace(pattern, `{${name}:${matchedAmount}:${matchedUnit}}`);
        }
        break;
      }
    }

    const amountVariants = [
      { text: `${amount}${unit}${name}`, placeholder: `{${name}:${amount}:${unit}}` },
      { text: `${amount}${unit} ${name}`, placeholder: `{${name}:${amount}:${unit}}` },
      { text: `${amount} ${unit}${name}`, placeholder: `{${name}:${amount}:${unit}}` },
      { text: `${name}${amount}${unit}`, placeholder: `{${name}:${amount}:${unit}}` },
      { text: `${name} ${amount}${unit}`, placeholder: `{${name}:${amount}:${unit}}` },
      { text: `${name}${amount} ${unit}`, placeholder: `{${name}:${amount}:${unit}}` },
    ];

    for (const variant of amountVariants) {
      if (result.includes(variant.text)) {
        result = result.split(variant.text).join(variant.placeholder);
      }
    }
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function textToSpeech(text: string): Promise<ArrayBuffer> {
  const ARK_PUBLIC_API_KEY = process.env.NEXT_PUBLIC_ARK_API_KEY || "";
  const ARK_TTS_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

  const response = await fetch(`${ARK_TTS_BASE_URL}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_PUBLIC_API_KEY}`,
    },
    body: JSON.stringify({
      model: "doubao-tts",
      input: text,
      voice: "zh_female_shuangkuaisisi_moon_bigtts",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS API error: ${error}`);
  }

  return response.arrayBuffer();
}

export interface IngredientSubstitutionSuggestion {
  name: string;
  amount: string;
  type: "same_category" | "functional" | "taste";
  reason: string;
  impact: "low" | "medium" | "high";
  notes?: string;
}

export interface IngredientSubstitutionQueryResult {
  status: "success" | "out_of_scope";
  message: string;
  suggestions: IngredientSubstitutionSuggestion[];
}

export async function queryIngredientSubstitution(
  recipeName: string,
  ingredientName: string,
  currentAmount: string,
  allIngredients: string,
  userQuery: string
): Promise<IngredientSubstitutionQueryResult> {
  try {
    const result = await callAI("queryIngredientSubstitution", {
      recipeName,
      ingredientName,
      currentAmount,
      allIngredients,
      userQuery,
    });
    
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        status: "out_of_scope",
        message: "无法解析AI响应，请重试",
        suggestions: [],
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      status: parsed.status || "out_of_scope",
      message: parsed.message || "",
      suggestions: (parsed.suggestions || []).map((s: any) => ({
        name: s.name || "",
        amount: s.amount || "",
        type: s.type || "same_category",
        reason: s.reason || "",
        impact: s.impact || "low",
        notes: s.notes,
      })),
    };
  } catch (error) {
    console.error("Failed to query ingredient substitution:", error);
    return {
      status: "out_of_scope",
      message: "查询失败，请重试",
      suggestions: [],
    };
  }
}
