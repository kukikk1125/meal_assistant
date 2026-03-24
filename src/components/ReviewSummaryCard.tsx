"use client";

import { useRouter } from "next/navigation";
import { Sparkles, TrendingUp, ChevronDown, ChevronUp, Loader2, CheckCircle, Lightbulb } from "lucide-react";
import { useState, useEffect } from "react";
import { CookingLog } from "@/lib/supabase";
import { analyzeCookingHistory, CookingHistoryAnalysis, optimizeRecipeFromLogs, OptimizedRecipeFromLogs } from "@/lib/doubao";
import { saveOptimizedRecipe } from "@/lib/recipe-adjustment-service";

interface ReviewSummaryCardProps {
  recipeId: string;
  recipe: {
    name: string;
    totalTime: number;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string; scalable?: boolean }>;
    steps: Array<{ order: number; description: string; duration: number; ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }>; tip?: string }>;
  };
  cookingLogs: CookingLog[];
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function ReviewSummaryCard({
  recipeId,
  recipe,
  cookingLogs,
  expanded = false,
  onToggleExpand,
}: ReviewSummaryCardProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<CookingHistoryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [optimizedRecipe, setOptimizedRecipe] = useState<OptimizedRecipeFromLogs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (expanded && cookingLogs.length > 0 && !analysis && !loading) {
      loadAnalysis();
    }
  }, [expanded, cookingLogs.length]);
  
  async function loadAnalysis() {
    setLoading(true);
    setError(null);
    
    try {
      const validLogs = cookingLogs.filter(log => log && log.rating);
      const recentLogs = validLogs.slice(-5);
      const result = await analyzeCookingHistory(recipe, recentLogs.map(log => ({
        rating: log.rating,
        taste_feedback: log.taste_feedback,
        difficulty_feedback: log.difficulty_feedback,
        notes: log.notes,
      })));
      setAnalysis(result);
    } catch (err) {
      console.error("Failed to analyze cooking history:", err);
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateOptimizedVersion() {
    if (!analysis) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const validLogs = cookingLogs.filter(log => log && log.rating);
      const recentLogs = validLogs.slice(-5);
      const result = await optimizeRecipeFromLogs(
        {
          name: recipe.name,
          totalTime: recipe.totalTime,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        },
        recentLogs.map(log => ({
          rating: log.rating,
          taste_feedback: log.taste_feedback,
          difficulty_feedback: log.difficulty_feedback,
          notes: log.notes,
        }))
      );
      
      setOptimizedRecipe(result);
      setSaved(false);
      
    } catch (err) {
      console.error("Failed to generate optimized recipe:", err);
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUseOptimizedVersion() {
    if (!optimizedRecipe) return;
    
    setSaving(true);
    try {
      await saveOptimizedRecipe(recipeId, {
        name: recipe.name,
        total_time: optimizedRecipe.totalTime,
        ingredients: optimizedRecipe.ingredients,
        steps: optimizedRecipe.steps,
        adjustment_summary: optimizedRecipe.adjustmentSummary,
        based_on_logs_count: cookingLogs.filter(log => log && log.rating).length,
      });
      setSaved(true);
    } catch (err) {
      console.error("Failed to save optimized recipe:", err);
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  
  if (cookingLogs.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-gradient-to-r from-primary-500 to-blue-500 rounded-2xl shadow-lg overflow-hidden mb-4">
      <div className="p-4">
        <div 
          className="flex items-start justify-between cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-medium text-sm">做菜复盘</span>
              <p className="text-white/70 text-xs">这道菜你做过 {cookingLogs.length} 次</p>
            </div>
          </div>
          {onToggleExpand && (
            <button className="text-white/80 hover:text-white transition-colors">
              {expanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
        
        {expanded && (
          <div className="mt-4">
            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 text-white animate-spin mr-2" />
                <span className="text-white text-sm">正在分析...</span>
              </div>
            )}
            
            {error && (
              <div className="text-center py-2">
                <p className="text-sm text-white/80">{error}</p>
                <button 
                  onClick={loadAnalysis}
                  className="text-xs text-white mt-2 underline"
                >
                  重试
                </button>
              </div>
            )}
            
            {optimizedRecipe ? (
              <div className="space-y-3">
                <div className="p-3 bg-white/10 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      {optimizedRecipe.name}
                    </h4>
                    <p className="text-xs text-white/80">
                      {optimizedRecipe.adjustmentSummary}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-white/80">主要调整：</p>
                  {optimizedRecipe.ingredients
                    .filter(ing => ing.original_amount !== undefined && ing.original_amount !== ing.adjusted_amount)
                    .slice(0, 3)
                    .map((ing, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-white/10 rounded-lg p-2">
                        <span className="text-white">{ing.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50 line-through">
                            {ing.original_amount}{ing.original_unit}
                          </span>
                          <span className="text-white font-medium">
                            {ing.adjusted_amount}{ing.adjusted_unit}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                
                <button
                  onClick={handleUseOptimizedVersion}
                  disabled={saved || saving}
                  className="w-full py-2.5 bg-white text-primary-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {saving ? "保存中..." : saved ? "已保存为我的版本" : "保存为我的版本"}
                </button>
                
                {saved && (
                  <p className="text-xs text-white/70 text-center mt-2">
                    已保存，可在食谱详情页切换使用
                  </p>
                )}
              </div>
            ) : analysis && (
              <>
                <div className="mb-3 p-3 bg-white/10 rounded-xl">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-white/80 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-white text-sm font-medium mb-1">
                        {analysis.summary.title}
                      </p>
                      <p className="text-white/80 text-xs">
                        {analysis.summary.text}
                      </p>
                    </div>
                  </div>
                </div>
                
                {analysis.problems.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1 mb-2">
                      <Lightbulb className="w-3 h-3 text-yellow-300" />
                      <span className="text-white/90 text-xs">发现的问题</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.problems.filter(p => p.category === "stable").map((item, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 bg-white/20 text-white rounded-full text-sm"
                        >
                          {item.label}
                          {item.frequency && ` (${item.frequency}次)`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysis.preferences.length > 0 && (
                  <div className="mb-3">
                    <p className="text-white/90 text-xs mb-2">你的口味偏好：</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.preferences.map((pref, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-white/15 text-white rounded-full text-xs"
                        >
                          {pref.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysis.suggestions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-white/90 text-xs mb-2">改进建议：</p>
                    <div className="space-y-2">
                      {analysis.suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-white/10 rounded-lg">
                          <span className="text-white/60 text-xs">•</span>
                          <div>
                            <p className="text-white text-sm font-medium">{suggestion.title}</p>
                            <p className="text-white/80 text-xs">{suggestion.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysis.should_generate_optimized_version ? (
                  <button
                    onClick={handleGenerateOptimizedVersion}
                    disabled={generating}
                    className="w-full py-3 bg-white text-primary-600 rounded-xl font-medium hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        正在生成优化版...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {analysis.ui_recommendation.primary_button_text}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-white/70 mb-2">
                      {analysis.generation_reason}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
