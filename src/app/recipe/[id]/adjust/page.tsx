"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Sparkles, Save, Info, AlertCircle, Clock, Loader2
} from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog } from "@/lib/supabase";
import { useRecipeStore, useCookingStore } from "@/store";
import { 
  analyzeHistoryIssues, 
  TASTE_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/optimizeService";
import { optimizeRecipeFromLogs, OptimizedRecipeFromLogs } from "@/lib/doubao";

export default function SmartAdjustPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recipeId = params.id as string;
  const source = searchParams.get("source") || "history";
  const router = useRouter();
  const { currentRecipe, setCurrentRecipe } = useRecipeStore();
  const { setCurrentStepIndex, resetTimer, clearSubstitutions } = useCookingStore();
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CookingLog[]>([]);
  const [issues, setIssues] = useState<Array<{ tag: string; label: string; count: number }>>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedRecipe, setOptimizedRecipe] = useState<OptimizedRecipeFromLogs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [recipeId]);

  async function loadData() {
    try {
      const recipe = await getRecipe(recipeId);
      setCurrentRecipe(recipe);
      
      const cookingLogs = await getCookingLogs(recipeId);
      setLogs(cookingLogs);
      
      if (cookingLogs.length > 0) {
        const analysis = analyzeHistoryIssues(cookingLogs);
        setIssues(analysis.issues);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleOptimize() {
    if (!currentRecipe) return;
    
    setOptimizing(true);
    setError(null);
    
    try {
      const validLogs = logs.filter(log => log && log.rating);
      const result = await optimizeRecipeFromLogs(
        {
          name: currentRecipe.name,
          totalTime: currentRecipe.total_time,
          ingredients: currentRecipe.ingredients.map(ing => ({
            id: ing.id,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            scalable: true,
          })),
          steps: currentRecipe.steps.map(step => ({
            order: step.order,
            description: step.description,
            duration: step.duration,
            ingredients: step.ingredients?.map(ing => ({
              ingredientId: ing.ingredientId,
              name: ing.name,
              amount: ing.amount,
              unit: ing.unit,
            })),
            tip: step.tip,
          })),
        },
        validLogs.map(log => ({
          rating: log.rating,
          taste_feedback: log.taste_feedback,
          difficulty_feedback: log.difficulty_feedback,
          notes: log.notes,
        }))
      );
      
      setOptimizedRecipe(result);
    } catch (err) {
      console.error("Failed to optimize recipe:", err);
      setError(err instanceof Error ? err.message : "优化失败，请重试");
    } finally {
      setOptimizing(false);
    }
  }

  function handleSaveVersion() {
    if (!optimizedRecipe) return;
    
    setSaving(true);
    
    const versionData = {
      name: optimizedRecipe.name,
      recipe: optimizedRecipe,
      basedOnLogs: logs.length,
      createdAt: new Date().toISOString(),
      adjustmentSummary: optimizedRecipe.adjustmentSummary,
    };
    
    localStorage.setItem(`my-version-${recipeId}`, JSON.stringify(versionData));
    
    setTimeout(() => {
      setSaving(false);
      router.push(`/recipe/${recipeId}`);
    }, 500);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentRecipe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500">
        <p>食谱不存在</p>
        <button onClick={() => router.push("/")} className="btn-primary mt-4">
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={`/recipe/${recipeId}`}>
            <button className="w-10 h-10 -ml-2 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold">AI 为你优化食谱</h1>
        </div>
      </header>

      <div className="px-4 py-6">
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-primary-500" />
            <h3 className="font-medium text-gray-900">分析摘要</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            根据你 {logs.length} 次做菜记录，识别到以下问题：
          </p>
          <div className="flex flex-wrap gap-2">
            {issues.slice(0, 5).map((issue, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm"
              >
                {TASTE_LABELS[issue.tag] || DIFFICULTY_LABELS[issue.tag] || issue.label}({issue.count}次)
              </span>
            ))}
            {issues.length === 0 && (
              <span className="text-sm text-gray-500">暂无明显问题</span>
            )}
          </div>
        </div>

        {!optimizedRecipe && !optimizing && (
          <div className="card p-6 mb-4 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">AI 智能优化</h3>
            <p className="text-sm text-gray-500 mb-4">
              基于你的做菜反馈，AI 将为你生成个性化食谱版本
            </p>
            <button
              onClick={handleOptimize}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              开始 AI 优化
            </button>
            {error && (
              <p className="text-sm text-red-500 mt-3">{error}</p>
            )}
          </div>
        )}

        {optimizing && (
          <div className="card p-6 mb-4 text-center">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">AI 正在分析你的做菜记录并优化食谱...</p>
          </div>
        )}

        {optimizedRecipe && (
          <>
            <div className="card p-4 mb-4 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                <h3 className="font-medium text-gray-900">{optimizedRecipe.name}</h3>
              </div>
              <p className="text-sm text-gray-600">
                {optimizedRecipe.adjustmentSummary}
              </p>
            </div>

            <div className="card p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 bg-green-100 rounded flex items-center justify-center text-xs text-green-600">料</span>
                <h3 className="font-medium text-gray-900">食材调整</h3>
              </div>
              <div className="space-y-2">
                {optimizedRecipe.ingredients.map((ing, index) => {
                  const originalIng = currentRecipe.ingredients.find(o => o.id === ing.id);
                  const hasChanged = originalIng && (
                    originalIng.amount !== ing.amount || 
                    originalIng.unit !== ing.unit
                  );
                  return (
                    <div key={index} className={`rounded-xl p-3 ${hasChanged ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-700">{ing.name}</span>
                        <div className="text-right">
                          {hasChanged && originalIng && (
                            <span className="text-xs text-gray-400 line-through mr-2">
                              {originalIng.amount}{originalIng.unit}
                            </span>
                          )}
                          <span className={`text-sm font-medium ${hasChanged ? 'text-green-600' : 'text-gray-600'}`}>
                            {ing.amount}{ing.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium text-gray-900">步骤优化</h3>
              </div>
              <div className="space-y-3">
                {optimizedRecipe.steps.map((step, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center text-xs text-primary-600 flex-shrink-0">
                        {step.order}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{step.description}</p>
                        {step.tip && (
                          <p className="text-xs text-primary-600 mt-1 bg-primary-50 rounded p-2">
                            💡 {step.tip}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4 bg-blue-50 border-blue-100">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-700">
                    这个版本基于你过去 {logs.length} 次做菜记录由 AI 生成，保存后可在食谱详情页切换使用。
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-bottom">
        <div className="max-w-md mx-auto flex gap-3">
          {optimizedRecipe ? (
            <>
              <button
                onClick={handleSaveVersion}
                disabled={saving}
                className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "保存中..." : "保存为我的版本"}
              </button>
              <Link href={`/recipe/${recipeId}`} className="flex-1">
                <button className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  返回原食谱
                </button>
              </Link>
            </>
          ) : (
            <Link href={`/recipe/${recipeId}`} className="w-full">
              <button className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                返回原食谱
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
