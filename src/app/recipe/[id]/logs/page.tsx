"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Calendar, Star, Sparkles, Loader2, Check, X, Trash2 } from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog, updateRecipe, deleteCookingLog } from "@/lib/supabase";
import { getPersonalizedAdvice, generateRecipeImprovements, PersonalizedAdvice } from "@/lib/doubao";

export default function LogsPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [logs, setLogs] = useState<CookingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<PersonalizedAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{
    ingredientChanges: Array<{ name: string; oldAmount: number; newAmount: number; reason: string }>;
    stepChanges: Array<{ stepIndex: number; oldDescription: string; newDescription: string; reason: string }>;
  } | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CookingLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [recipeId]);

  async function loadData() {
    try {
      const [recipeData, logsData] = await Promise.all([
        getRecipe(recipeId),
        getCookingLogs(recipeId),
      ]);
      setRecipe(recipeData);
      setLogs(logsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAdvice() {
    if (!recipe || logs.length === 0) return;
    
    setLoadingAdvice(true);
    try {
      const result = await getPersonalizedAdvice(recipe.name, logs.map(l => ({
        rating: l.rating,
        taste_note: l.taste_note,
        improvement: l.improvement,
        cooked_at: l.cooked_at,
      })));
      setAdvice(result);
    } catch (error) {
      console.error("Failed to load advice:", error);
    } finally {
      setLoadingAdvice(false);
    }
  }

  async function handleOptimize() {
    if (!recipe || logs.length === 0) return;
    
    setOptimizing(true);
    try {
      const result = await generateRecipeImprovements(
        {
          name: recipe.name,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        },
        logs.map(l => ({
          rating: l.rating,
          taste_note: l.taste_note,
          improvement: l.improvement,
        }))
      );
      setOptimizeResult(result);
    } catch (error) {
      console.error("Failed to optimize:", error);
    } finally {
      setOptimizing(false);
    }
  }

  async function applyIngredientChange(change: { name: string; oldAmount: number; newAmount: number; reason: string }) {
    if (!recipe) return;
    
    const updatedIngredients = recipe.ingredients.map(ing => {
      if (ing.name === change.name && ing.amount === change.oldAmount) {
        return { ...ing, amount: change.newAmount };
      }
      return ing;
    });
    
    try {
      const updated = await updateRecipe(recipe.id, { ingredients: updatedIngredients });
      setRecipe(updated);
      setAppliedChanges(prev => {
        const next = new Set(prev);
        next.add(`ing-${change.name}`);
        return next;
      });
    } catch (error) {
      console.error("Failed to apply change:", error);
    }
  }

  async function applyStepChange(change: { stepIndex: number; oldDescription: string; newDescription: string; reason: string }) {
    if (!recipe) return;
    
    const updatedSteps = recipe.steps.map((step, index) => {
      if (index === change.stepIndex && step.description === change.oldDescription) {
        return { ...step, description: change.newDescription };
      }
      return step;
    });
    
    try {
      const updated = await updateRecipe(recipe.id, { steps: updatedSteps });
      setRecipe(updated);
      setAppliedChanges(prev => {
        const next = new Set(prev);
        next.add(`step-${change.stepIndex}`);
        return next;
      });
    } catch (error) {
      console.error("Failed to apply change:", error);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  async function handleDeleteLog() {
    if (!deleteTarget) return;
    
    setDeleting(true);
    try {
      await deleteCookingLog(deleteTarget.id);
      setLogs(prev => prev.filter(l => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete log:", error);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-4 flex items-center gap-4 safe-top">
        <button onClick={() => router.push(`/recipe/${recipeId}`)} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">做菜日志</h1>
      </header>

      {recipe ? (
        <div className="px-4 py-2">
          <h2 className="text-xl font-bold">{recipe.name}</h2>
          <p className="text-sm text-gray-500">共 {logs.length} 次记录</p>
        </div>
      ) : (
        <div className="px-4 py-2">
          <p className="text-gray-500">加载中...</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="px-4 py-4 space-y-4">
          <div className="card p-4 bg-gradient-to-r from-primary-50 to-purple-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-gray-900">AI 个性化建议</h3>
              </div>
              {!advice && !loadingAdvice && (
                <button
                  onClick={loadAdvice}
                  className="text-sm text-primary-500 font-medium"
                >
                  获取建议
                </button>
              )}
            </div>
            
            {loadingAdvice ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : advice ? (
              <div className="space-y-3">
                <p className="text-gray-700">{advice.summary}</p>
                {advice.suggestions.length > 0 && (
                  <div className="space-y-2">
                    {advice.suggestions.map((s, i) => (
                      <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-primary-500">•</span>
                        {s}
                      </p>
                    ))}
                  </div>
                )}
                {advice.improvements.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">历史改进建议：</p>
                    {advice.improvements.map((imp, i) => (
                      <p key={i} className="text-sm text-gray-600">• {imp}</p>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => setShowOptimize(true)}
                  className="mt-3 w-full py-2 bg-primary-500 text-white rounded-xl text-sm font-medium"
                >
                  应用改进到食谱
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Calendar className="w-12 h-12 mb-4 text-gray-300" />
          <p>暂无做菜记录</p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-4">
          {logs.map((log) => (
            <Link key={log.id} href={`/recipe/${recipeId}/log/${log.id}`}>
              <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    {formatDate(log.cooked_at)}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= log.rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                
                {log.images && log.images.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto">
                    {log.images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`照片 ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ))}
                  </div>
                )}
                
                {log.taste_note && (
                  <p className="text-gray-700 mb-2">口味：{log.taste_note}</p>
                )}
                
                {log.improvement && (
                  <p className="text-gray-600 text-sm">
                    改进：{log.improvement}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showOptimize && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white px-4 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">食谱优化建议</h3>
              <button onClick={() => {
                setShowOptimize(false);
                setOptimizeResult(null);
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              {!optimizeResult && !optimizing && (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">AI 将根据您的做菜日志分析改进建议</p>
                  <button
                    onClick={handleOptimize}
                    className="btn-primary"
                  >
                    开始分析
                  </button>
                </div>
              )}
              
              {optimizing && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
                  <p className="text-gray-500">AI 正在分析...</p>
                </div>
              )}
              
              {optimizeResult && (
                <div className="space-y-6">
                  {optimizeResult.ingredientChanges.length === 0 && optimizeResult.stepChanges.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>暂无优化建议</p>
                      <p className="text-sm mt-2">继续记录做菜日志，AI 会给出更多建议</p>
                    </div>
                  )}
                  
                  {optimizeResult.ingredientChanges.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">食材调整</h4>
                      <div className="space-y-3">
                        {optimizeResult.ingredientChanges.map((change, index) => (
                          <div key={index} className="card p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{change.name}</span>
                              {appliedChanges.has(`ing-${change.name}`) ? (
                                <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                  <Check className="w-3 h-3" /> 已应用
                                </span>
                              ) : (
                                <button
                                  onClick={() => applyIngredientChange(change)}
                                  className="text-xs text-primary-500 bg-primary-50 px-2 py-1 rounded"
                                >
                                  应用
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {change.oldAmount} → {change.newAmount}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{change.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {optimizeResult.stepChanges.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">步骤调整</h4>
                      <div className="space-y-3">
                        {optimizeResult.stepChanges.map((change, index) => (
                          <div key={index} className="card p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">步骤 {change.stepIndex + 1}</span>
                              {appliedChanges.has(`step-${change.stepIndex}`) ? (
                                <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                  <Check className="w-3 h-3" /> 已应用
                                </span>
                              ) : (
                                <button
                                  onClick={() => applyStepChange(change)}
                                  className="text-xs text-primary-500 bg-primary-50 px-2 py-1 rounded"
                                >
                                  应用
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 line-through">{change.oldDescription}</p>
                            <p className="text-sm text-gray-700 mt-1">{change.newDescription}</p>
                            <p className="text-xs text-gray-400 mt-1">{change.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowOptimize(false);
                      setOptimizeResult(null);
                    }}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-gray-500 mb-6">
              确定要删除 {formatDate(deleteTarget.cooked_at)} 的做菜日志吗？删除后将无法恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDeleteLog}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium disabled:opacity-50"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
