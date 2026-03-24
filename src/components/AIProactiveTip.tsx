"use client";

import { useState, useEffect } from "react";
import { Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CookingLog } from "@/lib/supabase";
import { analyzeCookingHistory, CookingHistoryAnalysis } from "@/lib/doubao";

interface AIProactiveTipProps {
  recipeId: string;
  recipe: {
    name: string;
    totalTime: number;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string; scalable?: boolean }>;
    steps: Array<{ order: number; description: string; duration: number; ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }>; tip?: string }>;
  };
  cookingLogs: CookingLog[];
  hasOptimizedVersion: boolean;
  onGenerateOptimized?: () => void;
}

export default function AIProactiveTip({
  recipeId,
  recipe,
  cookingLogs,
}: AIProactiveTipProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [analysis, setAnalysis] = useState<CookingHistoryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (cookingLogs.length >= 2) {
      setVisible(true);
      loadAnalysis();
    }
  }, [recipeId, cookingLogs]);

  async function loadAnalysis() {
    setLoading(true);
    try {
      const result = await analyzeCookingHistory(recipe, cookingLogs.map(log => ({
        rating: log.rating,
        taste_feedback: log.taste_feedback,
        difficulty_feedback: log.difficulty_feedback,
        notes: log.notes,
      })));
      console.log('[AIProactiveTip] Analysis result:', result);
      console.log('[AIProactiveTip] Problems:', result.problems);
      console.log('[AIProactiveTip] Problems length:', result.problems?.length);
      setAnalysis(result);
    } catch (error) {
      console.error("Failed to load analysis:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleViewMore() {
    router.push(`/recipe/${recipeId}/logs`);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`bg-gradient-to-r from-primary-500 to-blue-500 shadow-lg overflow-hidden transition-all duration-300 ${
          expanded ? 'rounded-2xl' : 'rounded-full'
        }`}
      >
        <div className={`${expanded ? 'p-3' : 'px-3 py-1.5'}`}>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            
            <p className="text-white text-xs whitespace-nowrap">
              你的菜谱可以进行优化……
            </p>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-white/80 hover:text-white transition-colors p-0.5 ml-1"
            >
              {expanded ? (
                <ChevronRight className="w-3 h-3 rotate-90" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>

          {expanded && (
            <div className="mt-2 pt-2 border-t border-white/20" onClick={(e) => e.stopPropagation()}>
              {loading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-3 h-3 text-white animate-spin mr-2" />
                  <span className="text-white text-xs">分析中...</span>
                </div>
              ) : analysis && analysis.problems.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {analysis.problems.slice(0, 3).map((problem, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-white/20 text-white rounded-full text-xs"
                      >
                        {problem.label}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={handleViewMore}
                    className="w-full py-1.5 bg-white text-primary-600 rounded-full text-xs font-medium flex items-center justify-center gap-1 hover:bg-white/90 transition-colors"
                  >
                    查看更多优化建议
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <p className="text-white/80 text-xs text-center py-2">
                  暂无优化建议
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
