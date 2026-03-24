"use client";

import { useRouter } from "next/navigation";
import { X, Sparkles, Loader2, Share2, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { analyzeCookingLog, CookingLogAnalysis } from "@/lib/doubao";

interface InstantOptimizeCardProps {
  recipeId: string;
  recipe: {
    name: string;
    ingredients: Array<{ id: string; name: string; amount: number; unit: string }>;
    steps: Array<{ order: number; description: string; duration: number }>;
  };
  currentLog: {
    rating: number;
    taste_feedback?: string[];
    difficulty_feedback?: string[];
    notes?: string;
  };
  onClose: () => void;
}

export default function InstantOptimizeCard({
  recipeId,
  recipe,
  currentLog,
  onClose,
}: InstantOptimizeCardProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<CookingLogAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    analyzeLog();
  }, []);

  async function analyzeLog() {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeCookingLog(recipe, {
        rating: currentLog.rating,
        taste_feedback: currentLog.taste_feedback,
        difficulty_feedback: currentLog.difficulty_feedback,
        notes: currentLog.notes,
      });
      setAnalysis(result);
    } catch (err) {
      console.error("Failed to analyze cooking log:", err);
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateVersion() {
    router.push(`/recipe/${recipeId}/adjust?source=instant`);
  }

  async function handleShare() {
    if (!analysis?.share_text) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${recipe.name} - 我的做菜成果`,
          text: analysis.share_text,
        });
      } else {
        await navigator.clipboard.writeText(analysis.share_text);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">正在分析本次做菜记录...</p>
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
              onClick={analyzeLog}
              disabled={loading}
              className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {loading ? "分析中..." : "重新分析"}
            </button>
            <button
              onClick={() => router.push(`/recipe/${recipeId}/logs`)}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              查看食谱日记
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPositive = analysis.is_positive ?? (currentLog.rating >= 4);

  if (isPositive) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">🎉 本次做菜很成功！</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {analysis.praise && (
              <div className="mb-4 p-3 bg-green-50 rounded-xl">
                <h4 className="text-sm font-medium text-green-800 mb-1">{analysis.praise.title}</h4>
                <p className="text-sm text-green-700">{analysis.praise.text}</p>
              </div>
            )}
            
            {analysis.share_text && (
              <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-2">{analysis.share_text}</p>
                <button
                  onClick={handleShare}
                  className="w-full py-2 bg-primary-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
                >
                  {shareSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      分享到朋友圈
                    </>
                  )}
                </button>
              </div>
            )}
            
            {analysis.suggestions.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">下次可以尝试：</p>
                <div className="space-y-2">
                  {analysis.suggestions.slice(0, 2).map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-primary-500 mt-0.5">•</span>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{suggestion.title}</span>
                        <p className="text-xs text-gray-500">{suggestion.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              返回食谱
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">本次做菜分析</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-1">{analysis.summary.title}</h4>
            <p className="text-sm text-gray-600">{analysis.summary.text}</p>
          </div>
          
          {analysis.problems.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {analysis.problems.map((problem, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs"
                >
                  {problem.label}
                </span>
              ))}
            </div>
          )}
          
          {analysis.suggestions.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">建议调整：</p>
              <div className="space-y-2">
                {analysis.suggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center text-xs text-primary-600 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-700">{suggestion.title}</span>
                      <p className="text-xs text-gray-500">{suggestion.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={handleGenerateVersion}
              className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {analysis.ui_recommendation.primary_button_text}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              {analysis.ui_recommendation.secondary_button_text}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
