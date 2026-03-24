"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, TrendingUp, Lightbulb, ChevronRight, Loader2 } from "lucide-react";
import { CookingLog } from "@/lib/supabase";
import { analyzeCookingHistory, CookingHistoryAnalysis } from "@/lib/doubao";

interface CookingReviewCardProps {
  recipeId: string;
  recipe: {
    name: string;
    totalTime: number;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string; scalable?: boolean }>;
    steps: Array<{ order: number; description: string; duration: number; ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }>; tip?: string }>;
  };
  cookingLogs: CookingLog[];
  onClose: () => void;
}

export default function CookingReviewCard({
  recipeId,
  recipe,
  cookingLogs,
  onClose,
}: CookingReviewCardProps) {
  const [analysis, setAnalysis] = useState<CookingHistoryAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, []);

  async function loadAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeCookingHistory(recipe, cookingLogs.map(log => ({
        rating: log.rating,
        taste_feedback: log.taste_feedback,
        difficulty_feedback: log.difficulty_feedback,
        notes: log.notes,
      })));
      setAnalysis(result);
    } catch (err) {
      console.error("Failed to load analysis:", err);
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">正在分析你的做菜记录...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <div className="text-center mb-4">
            <p className="text-gray-700 mb-2">分析失败，请稍后重试</p>
            {error && (
              <p className="text-xs text-red-500 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAnalysis}
              disabled={loading}
              className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {loading ? "分析中..." : "重新分析"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-r from-primary-500 to-blue-500 rounded-2xl shadow-lg overflow-hidden max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-medium text-sm">做菜复盘</span>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white/10 rounded-xl p-3 mb-3">
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
                {analysis.problems.map((problem, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-white/20 text-white rounded-full text-sm"
                  >
                    {problem.label}
                    {problem.frequency && ` (${problem.frequency}次)`}
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

          <button
            onClick={onClose}
            className="w-full py-3 bg-white text-primary-600 rounded-xl font-medium hover:bg-white/90 transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
