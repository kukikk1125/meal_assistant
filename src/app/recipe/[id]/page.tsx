"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Clock, Play, X, Check, MoreVertical, Edit2, Trash2, BookOpen, Star, MessageCircle, Send, Sparkles, RefreshCw } from "lucide-react";
import { getRecipe, deleteRecipe, Recipe, Ingredient, getCookingLogs, calculateAverageRating } from "@/lib/supabase";
import { getIngredientSubstitutions, IngredientSubstitution, chatSubstitution, ChatMessage } from "@/lib/doubao";
import { useRecipeStore, useCookingStore } from "@/store";

interface PendingSubstitution {
  original: string;
  replacement: string;
  amount: string;
  reason: string;
  ingredientId: string;
}

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { currentRecipe, setCurrentRecipe, scaleFactor, setScaleFactor, getScaledIngredients } = useRecipeStore();
  const { 
    setCurrentStepIndex, 
    resetTimer, 
    substituteIngredient, 
    getSubstitutedIngredient,
    clearSubstitutions,
    ingredientSubstitutions 
  } = useCookingStore();
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [logCount, setLogCount] = useState(0);
  
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [pendingSubstitutions, setPendingSubstitutions] = useState<PendingSubstitution[]>([]);

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  async function loadRecipe() {
    try {
      const recipe = await getRecipe(recipeId);
      setCurrentRecipe(recipe);
      
      const logs = await getCookingLogs(recipeId);
      setAverageRating(calculateAverageRating(logs));
      setLogCount(logs.length);
    } catch (error) {
      console.error("Failed to load recipe:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleStartCooking() {
    setCurrentStepIndex(0);
    clearSubstitutions();
    if (currentRecipe && currentRecipe.steps.length > 0) {
      resetTimer(currentRecipe.steps[0].duration * 60);
    }
    router.push(`/cook/${recipeId}`);
  }

  function getDisplayIngredientName(ingredient: Ingredient): string {
    return getSubstitutedIngredient(ingredient.id)?.name || ingredient.name;
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

  function getSmartSuggestions(): string[] {
    if (!currentRecipe) return [];
    
    const suggestions: string[] = [];
    const ingredients = currentRecipe.ingredients.map(i => i.name);
    
    if (ingredients.some(i => ["桂皮", "八角", "香叶", "花椒"].includes(i))) {
      suggestions.push("家里没有香料，有替代方案吗？");
    }
    if (ingredients.some(i => i.includes("肉"))) {
      suggestions.push("想换成素食版本，怎么调整？");
    }
    if (ingredients.some(i => ["白糖", "冰糖", "红糖"].includes(i))) {
      suggestions.push("想减少糖分，可以怎么调整？");
    }
    if (ingredients.some(i => ["料酒", "白酒", "黄酒"].includes(i))) {
      suggestions.push("不想用酒，有替代方案吗？");
    }
    
    if (suggestions.length === 0) {
      suggestions.push("有哪些食材可以替换？");
      suggestions.push("想调整口味，有什么建议？");
    }
    
    return suggestions.slice(0, 3);
  }

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading || !currentRecipe) return;
    
    const userMessage: ChatMessage = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    
    try {
      const result = await chatSubstitution(
        chatInput,
        {
          name: currentRecipe.name,
          ingredients: currentRecipe.ingredients,
        },
        chatMessages
      );
      
      const assistantMessage: ChatMessage = { 
        role: "assistant", 
        content: result.reply 
      };
      setChatMessages([...newMessages, assistantMessage]);
      
      if (result.substitutions && result.substitutions.length > 0) {
        const pending: PendingSubstitution[] = [];
        result.substitutions.forEach(sub => {
          const ingredient = currentRecipe.ingredients.find(
            i => i.name === sub.original || i.name.includes(sub.original)
          );
          if (ingredient) {
            pending.push({
              original: sub.original,
              replacement: sub.replacement,
              amount: sub.amount,
              reason: sub.reason,
              ingredientId: ingredient.id,
            });
          }
        });
        setPendingSubstitutions(pending);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "抱歉，我遇到了一些问题，请稍后再试。",
      };
      setChatMessages([...newMessages, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleApplySubstitution(pending: PendingSubstitution) {
    if (!currentRecipe) return;
    const ingredient = currentRecipe.ingredients.find(i => i.id === pending.ingredientId);
    if (ingredient) {
      substituteIngredient(
        pending.ingredientId,
        pending.original,
        pending.replacement,
        ingredient.unit
      );
    }
    setPendingSubstitutions(prev => prev.filter(p => p.ingredientId !== pending.ingredientId));
  }

  function handleDismissSubstitution(ingredientId: string) {
    setPendingSubstitutions(prev => prev.filter(p => p.ingredientId !== ingredientId));
  }

  function handleQuickSuggestion(suggestion: string) {
    setChatInput(suggestion);
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

  const scaledIngredients = getScaledIngredients();
  const smartSuggestions = getSmartSuggestions();

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
          <h1 className="text-2xl font-bold">{currentRecipe.name}</h1>
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
          {ingredientSubstitutions.length > 0 && (
            <button
              onClick={() => clearSubstitutions()}
              className="text-xs text-gray-400 underline"
            >
              重置替换
            </button>
          )}
        </div>
        <div className="card divide-y divide-gray-100">
          {scaledIngredients.map((ingredient) => {
            const substitution = getSubstitutedIngredient(ingredient.id);
            const displayName = substitution?.name || ingredient.name;
            const displayUnit = substitution?.unit || ingredient.unit;
            const isSubstituted = substitution !== null;
            
            return (
              <div
                key={ingredient.id}
                className="w-full flex justify-between items-center py-3 px-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">{displayName}</span>
                  {isSubstituted && (
                    <span className="text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded">已替换</span>
                  )}
                </div>
                <span className="text-gray-500">
                  {ingredient.amount} {displayUnit}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">制作步骤</h2>
        <div className="space-y-3">
          {currentRecipe.steps.map((step, index) => {
            return (
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
            );
          })}
        </div>
      </div>

      <button
        onClick={() => {
          setShowChatPanel(true);
          setChatMessages([]);
          setPendingSubstitutions([]);
        }}
        className="fixed bottom-28 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg flex items-center justify-center gap-2 z-40"
        style={{ right: 'calc((100vw - 402px) / 2 + 16px)' }}
      >
        <Sparkles className="w-5 h-5" />
        <span className="text-sm font-medium">AI助手</span>
      </button>

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

      {showChatPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold">AI厨房助手</h3>
              </div>
              <button onClick={() => setShowChatPanel(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {chatMessages.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-2">👋 你好！我是AI厨房助手</p>
                    <p className="text-sm text-gray-400">我可以帮你解答食材替换、烹饪技巧、营养搭配等问题</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">你可以问我：</p>
                    <button
                      onClick={() => setChatInput("这道菜可以少放点油吗？")}
                      className="block w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                    >
                      🥄 这道菜可以少放点油吗？
                    </button>
                    <button
                      onClick={() => setChatInput("没有这个食材可以用什么替代？")}
                      className="block w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                    >
                      🔄 没有这个食材可以用什么替代？
                    </button>
                    <button
                      onClick={() => setChatInput("这道菜有什么烹饪技巧？")}
                      className="block w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                    >
                      💡 这道菜有什么烹饪技巧？
                    </button>
                  </div>
                </div>
              )}
              
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
                >
                  <div
                    className={`inline-block max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-primary-500 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-800 rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="text-left mb-4">
                  <div className="inline-block px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              
              {pendingSubstitutions.length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-sm text-gray-500 font-medium">💡 AI建议的替换：</p>
                  {pendingSubstitutions.map((pending) => (
                    <div
                      key={pending.ingredientId}
                      className="bg-gradient-to-r from-primary-50 to-white border border-primary-100 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 line-through">{pending.original}</span>
                        <RefreshCw className="w-4 h-4 text-primary-500" />
                        <span className="font-medium text-primary-600">{pending.replacement}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{pending.reason}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApplySubstitution(pending)}
                          className="flex-1 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          采用
                        </button>
                        <button
                          onClick={() => handleDismissSubstitution(pending.ingredientId)}
                          className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium"
                        >
                          忽略
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="输入你想替换的食材或问题..."
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
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
