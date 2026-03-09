"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, Clock, Play, X, Check, MoreVertical, Edit2, Trash2, BookOpen, Star, 
  Sparkles, RefreshCw, AlertCircle, Send
} from "lucide-react";
import { getRecipe, deleteRecipe, Recipe, Ingredient, getCookingLogs, calculateAverageRating } from "@/lib/supabase";
import { queryIngredientSubstitution, IngredientSubstitutionQueryResult, IngredientSubstitutionSuggestion } from "@/lib/doubao";
import { useRecipeStore, useCookingStore } from "@/store";

interface SubstitutionHistoryItem {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  originalAmount: string;
  replacement: string;
  replacementAmount: string;
  timestamp: number;
}

type QueryStatus = "idle" | "loading" | "success" | "out_of_scope";

interface QueryHistoryItem {
  id: string;
  query: string;
  result: IngredientSubstitutionQueryResult;
  timestamp: number;
}

const MAX_SUBSTITUTION_HISTORY = 5;

const RECOMMENDED_QUESTIONS = [
  "家里只有其他食材，能用吗",
  "这个食材太贵了，有便宜的吗",
  "这个食材不好买，有常见的吗",
];

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { 
    currentRecipe, 
    setCurrentRecipe, 
    scaleFactor, 
    setScaleFactor, 
    tempAdjustments,
    addTempAdjustment,
    removeTempAdjustment,
    clearTempAdjustments,
    sessionRecipe,
  } = useRecipeStore();
  const { 
    setCurrentStepIndex, 
    resetTimer, 
    clearSubstitutions,
  } = useCookingStore();
  
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [logCount, setLogCount] = useState(0);
  
  const [showIngredientAction, setShowIngredientAction] = useState<Ingredient | null>(null);
  const [queryStatus, setQueryStatus] = useState<QueryStatus>("idle");
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [substitutionHistory, setSubstitutionHistory] = useState<SubstitutionHistoryItem[]>([]);
  
  const [hasMyVersion, setHasMyVersion] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<"original" | "my">("original");
  
  const lastLoadedRecipeId = useRef<string | null>(null);

  useEffect(() => {
    loadRecipe();
    loadSubstitutionHistory();
  }, [recipeId]);

  async function loadRecipe() {
    try {
      const recipe = await getRecipe(recipeId);
      
      setCurrentRecipe(recipe);
      
      const logs = await getCookingLogs(recipeId);
      setAverageRating(calculateAverageRating(logs));
      setLogCount(logs.length);
      
      const savedVersion = localStorage.getItem(`my-version-${recipeId}`);
      setHasMyVersion(!!savedVersion);
    } catch (error) {
      console.error("Failed to load recipe:", error);
    } finally {
      setLoading(false);
    }
  }

  function loadSubstitutionHistory() {
    try {
      const saved = localStorage.getItem(`substitution-history-${recipeId}`);
      if (saved) {
        const history = JSON.parse(saved);
        setSubstitutionHistory(history.slice(0, MAX_SUBSTITUTION_HISTORY));
      }
    } catch (error) {
      console.error("Failed to load substitution history:", error);
    }
  }

  function saveSubstitutionHistory(history: SubstitutionHistoryItem[]) {
    try {
      localStorage.setItem(`substitution-history-${recipeId}`, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save substitution history:", error);
    }
  }

  function handleStartCooking() {
    setCurrentStepIndex(0);
    clearSubstitutions();
    
    if (sessionRecipe && sessionRecipe.steps.length > 0) {
      resetTimer(sessionRecipe.steps[0].duration * 60);
    }
    router.push(`/cook/${recipeId}`);
  }

  async function handleDelete() {
    if (!currentRecipe) return;
    
    setDeleting(true);
    try {
      await deleteRecipe(currentRecipe.id);
      router.push("/");
    } catch (error) {
      console.error("Failed to delete recipe:", error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setShowMenu(false);
    }
  }

  function handleEdit() {
    router.push(`/recipe/${recipeId}/edit`);
    setShowMenu(false);
  }

  function handleOpenIngredientAction(ingredient: Ingredient) {
    setShowIngredientAction(ingredient);
    setQueryStatus("loading");
    setQueryHistory([]);
    setUserQuery("");
    
    handleDefaultQuery(ingredient);
  }

  async function handleDefaultQuery(ingredient: Ingredient) {
    try {
      const allIngredients = currentRecipe!.ingredients.map(i => i.name).join("、");
      const result = await queryIngredientSubstitution(
        currentRecipe!.name,
        ingredient.name,
        `${ingredient.amount} ${ingredient.unit}`,
        allIngredients,
        "没有这个食材可以换什么"
      );
      
      const historyItem: QueryHistoryItem = {
        id: Date.now().toString(),
        query: "没有这个食材可以换什么",
        result,
        timestamp: Date.now(),
      };
      
      setQueryHistory([historyItem]);
      setQueryStatus(result.status);
    } catch (error) {
      console.error("Failed to query default substitution:", error);
      setQueryStatus("out_of_scope");
      const errorResult: IngredientSubstitutionQueryResult = {
        status: "out_of_scope",
        message: "查询失败，请重试",
        suggestions: [],
      };
      setQueryHistory([{
        id: Date.now().toString(),
        query: "没有这个食材可以换什么",
        result: errorResult,
        timestamp: Date.now(),
      }]);
    }
  }

  async function handleQuerySubstitution() {
    if (!showIngredientAction || !userQuery.trim()) return;
    
    setQueryStatus("loading");
    
    try {
      const allIngredients = currentRecipe!.ingredients.map(i => i.name).join("、");
      const result = await queryIngredientSubstitution(
        currentRecipe!.name,
        showIngredientAction.name,
        `${showIngredientAction.amount} ${showIngredientAction.unit}`,
        allIngredients,
        userQuery
      );
      
      const historyItem: QueryHistoryItem = {
        id: Date.now().toString(),
        query: userQuery,
        result,
        timestamp: Date.now(),
      };
      
      setQueryHistory(prev => [...prev, historyItem]);
      setQueryStatus(result.status);
      setUserQuery("");
    } catch (error) {
      console.error("Failed to query substitution:", error);
      setQueryStatus("out_of_scope");
      const errorResult: IngredientSubstitutionQueryResult = {
        status: "out_of_scope",
        message: "查询失败，请重试",
        suggestions: [],
      };
      setQueryHistory(prev => [...prev, {
        id: Date.now().toString(),
        query: userQuery,
        result: errorResult,
        timestamp: Date.now(),
      }]);
    }
  }

  function handleApplySuggestion(suggestion: IngredientSubstitutionSuggestion) {
    if (!showIngredientAction) return;
    
    addTempAdjustment({
      ingredientId: showIngredientAction.id,
      ingredientName: showIngredientAction.name,
      action: "replace",
      replacement: suggestion.name,
    });
    
    const historyItem: SubstitutionHistoryItem = {
      id: Date.now().toString(),
      recipeId: recipeId,
      ingredientId: showIngredientAction.id,
      ingredientName: showIngredientAction.name,
      originalAmount: `${showIngredientAction.amount} ${showIngredientAction.unit}`,
      replacement: suggestion.name,
      replacementAmount: suggestion.amount || "",
      timestamp: Date.now(),
    };
    
    const newHistory = [historyItem, ...substitutionHistory].slice(0, MAX_SUBSTITUTION_HISTORY);
    setSubstitutionHistory(newHistory);
    saveSubstitutionHistory(newHistory);
    
    setShowIngredientAction(null);
  }

  function handleRemoveIngredient() {
    if (!showIngredientAction) return;
    
    addTempAdjustment({
      ingredientId: showIngredientAction.id,
      ingredientName: showIngredientAction.name,
      action: "remove",
    });
    
    const historyItem: SubstitutionHistoryItem = {
      id: Date.now().toString(),
      recipeId: recipeId,
      ingredientId: showIngredientAction.id,
      ingredientName: showIngredientAction.name,
      originalAmount: `${showIngredientAction.amount} ${showIngredientAction.unit}`,
      replacement: "不使用",
      replacementAmount: "",
      timestamp: Date.now(),
    };
    
    const newHistory = [historyItem, ...substitutionHistory].slice(0, MAX_SUBSTITUTION_HISTORY);
    setSubstitutionHistory(newHistory);
    saveSubstitutionHistory(newHistory);
    
    setShowIngredientAction(null);
  }

  function handleUndoAdjustment(ingredientId: string) {
    removeTempAdjustment(ingredientId);
  }

  function clearAllAdjustments() {
    clearTempAdjustments();
    clearSubstitutions();
  }

  const scaleOptions = [0.5, 1, 1.5, 2];

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
    <div className="min-h-screen pb-24">
      <header className="relative h-64 bg-gray-100">
        {currentRecipe.image_url ? (
          <img
            src={currentRecipe.image_url}
            alt={currentRecipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            🍳
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="absolute top-4 left-4 right-4 flex justify-between safe-top">
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <Link href={`/recipe/${currentRecipe.id}/logs`}>
              <button className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </button>
            </Link>
            <button
              onClick={() => setShowMenu(true)}
              className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 -mt-8 relative">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold flex-1">{currentRecipe.name}</h1>
            {hasMyVersion && (
              <div className="flex bg-gray-100 rounded-lg p-0.5 ml-2">
                <button
                  onClick={() => setCurrentVersion("original")}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    currentVersion === "original" ? "bg-white shadow text-gray-900" : "text-gray-500"
                  }`}
                >
                  原始
                </button>
                <button
                  onClick={() => setCurrentVersion("my")}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    currentVersion === "my" ? "bg-primary-500 text-white" : "text-gray-500"
                  }`}
                >
                  我的版本
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{currentRecipe.total_time} 分钟</span>
            </div>
            {logCount > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span>{averageRating}</span>
                <span className="text-gray-400">({logCount}次)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">份量调整</h2>
          <span className="text-primary-500 font-medium">{scaleFactor}x</span>
        </div>
        <div className="flex gap-2">
          {scaleOptions.map((option) => (
            <button
              key={option}
              onClick={() => setScaleFactor(option)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                scaleFactor === option
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">食材清单</h2>
          {tempAdjustments.length > 0 && (
            <button
              onClick={clearAllAdjustments}
              className="text-xs text-gray-400"
            >
              清除临时调整
            </button>
          )}
        </div>
        
        {substitutionHistory.length > 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">最近替换记录</p>
              <button
                onClick={() => {
                  setSubstitutionHistory([]);
                  localStorage.removeItem(`substitution-history-${recipeId}`);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                清空
              </button>
            </div>
            <div className="space-y-1.5">
              {substitutionHistory.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">{item.ingredientName}</span>
                    <span className="text-gray-400">→</span>
                    <span className={`font-medium ${item.replacement === "不使用" ? "text-red-500" : "text-primary-600"}`}>
                      {item.replacement}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      addTempAdjustment({
                        ingredientId: item.ingredientId,
                        ingredientName: item.ingredientName,
                        action: item.replacement === "不使用" ? "remove" : "replace",
                        ...(item.replacement !== "不使用" && { replacement: item.replacement }),
                      });
                    }}
                    className="text-xs text-primary-500 hover:text-primary-600"
                  >
                    应用
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {tempAdjustments.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
            <p className="text-xs text-blue-600 mb-1">本次做菜的临时调整</p>
            <div className="flex flex-wrap gap-1">
              {tempAdjustments.map(adj => (
                <span 
                  key={adj.ingredientId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded text-xs"
                >
                  {adj.ingredientName}
                  {adj.action === "replace" && `→ ${adj.replacement}`}
                  {adj.action === "remove" && "（已去掉）"}
                  <button
                    onClick={() => handleUndoAdjustment(adj.ingredientId)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="card divide-y divide-gray-100">
          {sessionRecipe?.ingredients.map((ingredient) => {
            const adjustment = tempAdjustments.find(a => a.ingredientId === ingredient.id);
            const isReplaced = adjustment?.action === "replace";
            
            return (
              <div
                key={ingredient.id}
                className="w-full flex justify-between items-center py-3 px-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">
                    {ingredient.name}
                  </span>
                  {isReplaced && (
                    <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                      已替换
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">
                    {ingredient.amount} {ingredient.unit}
                  </span>
                  <button
                    onClick={() => {
                      const originalIngredient = currentRecipe?.ingredients.find(i => i.id === ingredient.id);
                      if (originalIngredient) {
                        handleOpenIngredientAction(originalIngredient);
                      }
                    }}
                    className="p-1 text-gray-300 hover:text-primary-500"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">制作步骤</h2>
        <div className="space-y-3">
          {sessionRecipe?.steps.map((step, index) => (
            <div key={step.id} className="card p-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-700">{step.description}</p>
                  {step.duration > 0 && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>{step.duration} 分钟</span>
                    </div>
                  )}
                  {step.tip && (
                    <p className="mt-2 text-sm text-primary-600 bg-primary-50 rounded-lg px-3 py-2">
                      💡 {step.tip}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-gray-100 safe-bottom">
        <div className="max-w-md mx-auto">
          <button 
            onClick={handleStartCooking}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            开始做菜
          </button>
        </div>
      </div>

      {showIngredientAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowIngredientAction(null)}>
          <div 
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-4 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">临时调整「{showIngredientAction.name}」</h3>
                <button onClick={() => setShowIngredientAction(null)} className="p-1">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">仅对本次做菜生效，不会修改原始食谱</p>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <button
                  onClick={handleRemoveIngredient}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <X className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">本次不使用这个食材</span>
                    <p className="text-xs text-gray-500 mt-0.5">适合可选食材或临时不放的情况</p>
                  </div>
                </button>
              </div>
              
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary-500" />
                  <h4 className="font-medium text-gray-900">替换建议</h4>
                </div>
                
                {queryStatus === "loading" && (
                  <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-xl mb-4">
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-sm text-gray-500">正在查询替换建议...</p>
                  </div>
                )}
                
                {queryHistory.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {queryHistory.map((historyItem) => (
                      <div key={historyItem.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-400">问题：</span>
                          <span className="text-sm text-gray-700 font-medium">{historyItem.query}</span>
                        </div>
                        
                        {historyItem.result.status === "success" && (
                          <>
                            {historyItem.result.suggestions.length > 0 ? (
                              <>
                                <div className="flex items-center gap-2 mb-2">
                                  <Check className="w-4 h-4 text-green-500" />
                                  <span className="text-xs text-gray-600">{historyItem.result.message}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {historyItem.result.suggestions.map((suggestion, index) => (
                                    <div
                                      key={index}
                                      className="bg-gray-50 rounded-lg p-2.5 flex flex-col"
                                    >
                                      <div className="mb-1.5">
                                        <span className="font-medium text-gray-900 text-xs">{suggestion.name}</span>
                                        {suggestion.amount && (
                                          <span className="text-xs text-gray-500 ml-1">{suggestion.amount}</span>
                                        )}
                                      </div>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full inline-block mb-1.5 w-fit ${
                                        suggestion.type === "same_category" ? "bg-blue-100 text-blue-600" :
                                        suggestion.type === "functional" ? "bg-green-100 text-green-600" :
                                        "bg-purple-100 text-purple-600"
                                      }`}>
                                        {suggestion.type === "same_category" ? "同类" :
                                         suggestion.type === "functional" ? "功能" : "口味"}
                                      </span>
                                      <p className="text-xs text-gray-600 mb-1.5 flex-1 line-clamp-2">{suggestion.reason}</p>
                                      {suggestion.notes && (
                                        <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">💡 {suggestion.notes}</p>
                                      )}
                                      <span className={`text-xs px-1.5 py-0.5 rounded inline-block mb-1.5 w-fit ${
                                        suggestion.impact === "low" ? "bg-green-50 text-green-600" :
                                        suggestion.impact === "medium" ? "bg-yellow-50 text-yellow-600" :
                                        "bg-red-50 text-red-600"
                                      }`}>
                                        风味影响：{suggestion.impact === "low" ? "小" : suggestion.impact === "medium" ? "中" : "大"}
                                      </span>
                                      <button
                                        onClick={() => handleApplySuggestion(suggestion)}
                                        className="w-full px-2 py-1 bg-primary-500 text-white text-xs rounded hover:bg-primary-600 transition-colors"
                                      >
                                        使用
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs text-gray-700 font-medium">当前没有找到合适的替换建议</p>
                                  <p className="text-xs text-gray-500 mt-0.5">可以尝试输入你的具体情况重新查询</p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        
                        {historyItem.result.status === "out_of_scope" && (
                          <div className="bg-yellow-50 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-yellow-700 font-medium">当前窗口仅支持食材替换问题</p>
                              <p className="text-xs text-yellow-600 mt-0.5">请重新输入，例如&ldquo;没有料酒可以换什么&rdquo;</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-blue-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-blue-600">💡 可以继续输入你的具体情况，获取更多替换建议</p>
                </div>
                
                <p className="text-xs text-gray-500 mb-2">快速提问：</p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {RECOMMENDED_QUESTIONS.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setUserQuery(q);
                        handleQuerySubstitution();
                      }}
                      className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-full text-xs hover:bg-primary-100 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuerySubstitution()}
                    placeholder="输入与这个食材相关的替换问题"
                    className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleQuerySubstitution}
                    disabled={!userQuery.trim() || queryStatus === "loading"}
                    className="px-4 py-3 bg-primary-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {queryStatus === "loading" ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowMenu(false)}>
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-center">操作</h3>
            </div>
            <div className="p-2">
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50"
              >
                <Edit2 className="w-5 h-5 text-gray-600" />
                <span>编辑食谱</span>
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-red-500"
              >
                <Trash2 className="w-5 h-5" />
                <span>删除食谱</span>
              </button>
            </div>
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 text-center text-gray-500 font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-gray-500 mb-6">删除后将无法恢复，确定要删除这个食谱吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
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
