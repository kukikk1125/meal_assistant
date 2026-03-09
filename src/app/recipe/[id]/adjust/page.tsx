"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Sparkles, Check, X, Save, ChevronRight, 
  Flame, Droplet, Shield, Info, AlertCircle
} from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog } from "@/lib/supabase";
import { useRecipeStore } from "@/store";

interface RecommendedVersion {
  name: string;
  reason: string[];
  changes: {
    type: "ingredient" | "amount" | "step";
    target: string;
    original: string;
    modified: string;
  }[];
}

export default function SmartAdjustPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { currentRecipe, setCurrentRecipe } = useRecipeStore();
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CookingLog[]>([]);
  const [recommendedVersion, setRecommendedVersion] = useState<RecommendedVersion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [versionName, setVersionName] = useState("");

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
        await generateRecommendation(recipe, cookingLogs);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateRecommendation(recipe: Recipe, cookingLogs: CookingLog[]) {
    setGenerating(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const tasteIssues: string[] = [];
      const difficultyIssues: string[] = [];
      
      cookingLogs.forEach(log => {
        if (log.taste_feedback) {
          tasteIssues.push(...log.taste_feedback);
        }
        if (log.difficulty_feedback) {
          difficultyIssues.push(...log.difficulty_feedback);
        }
      });
      
      const reasons: string[] = [];
      const changes: RecommendedVersion["changes"] = [];
      let versionName = "我的版本";
      
      const tooSpicyCount = tasteIssues.filter(t => t.includes("辣")).length;
      if (tooSpicyCount > 0) {
        reasons.push(`你过去${tooSpicyCount}次记录这道菜偏辣`);
        const spicyIngredients = recipe.ingredients.filter(i => 
          i.name.includes("辣椒") || i.name.includes("花椒") || i.name.includes("胡椒")
        );
        spicyIngredients.forEach(ing => {
          changes.push({
            type: "amount",
            target: ing.name,
            original: `${ing.amount}${ing.unit}`,
            modified: `${Math.round(ing.amount * 0.6 * 10) / 10}${ing.unit}`,
          });
        });
        versionName = "我的少辣版";
      }
      
      const tooOilyCount = tasteIssues.filter(t => t.includes("油")).length;
      if (tooOilyCount > 0) {
        reasons.push(`你经常减少油量`);
        const oilIngredients = recipe.ingredients.filter(i => i.name.includes("油"));
        oilIngredients.forEach(ing => {
          changes.push({
            type: "amount",
            target: ing.name,
            original: `${ing.amount}${ing.unit}`,
            modified: `${Math.round(ing.amount * 0.7 * 10) / 10}${ing.unit}`,
          });
        });
        versionName = "我的清淡版";
      }
      
      const tooSaltyCount = tasteIssues.filter(t => t.includes("咸")).length;
      if (tooSaltyCount > 0) {
        reasons.push(`你偏好清淡口味`);
        const saltIngredients = recipe.ingredients.filter(i => 
          i.name.includes("盐") || i.name.includes("酱油")
        );
        saltIngredients.forEach(ing => {
          changes.push({
            type: "amount",
            target: ing.name,
            original: `${ing.amount}${ing.unit}`,
            modified: `${Math.round(ing.amount * 0.7 * 10) / 10}${ing.unit}`,
          });
        });
      }
      
      const complexCount = difficultyIssues.filter(d => d.includes("复杂") || d.includes("麻烦")).length;
      if (complexCount > 0) {
        reasons.push(`你更偏好简单做法`);
        const complexIngredients = recipe.ingredients.filter(i => 
          i.name.includes("香料") || i.name.includes("料酒") || i.name.includes("鸡精")
        );
        complexIngredients.forEach(ing => {
          changes.push({
            type: "ingredient",
            target: ing.name,
            original: `${ing.amount}${ing.unit}`,
            modified: "省略",
          });
        });
        versionName = "我的简化版";
      }
      
      if (reasons.length === 0) {
        reasons.push("基于你的做菜记录，为你生成更适合的版本");
        reasons.push("保留了原始食谱的核心风味");
      }
      
      setRecommendedVersion({
        name: versionName,
        reason: reasons,
        changes,
      });
      setVersionName(versionName);
    } catch (error) {
      console.error("Failed to generate recommendation:", error);
    } finally {
      setGenerating(false);
    }
  }

  function handleApplyVersion() {
    if (!recommendedVersion) return;
    
    const versionData = {
      name: recommendedVersion.name,
      changes: recommendedVersion.changes,
      createdAt: new Date().toISOString(),
    };
    
    localStorage.setItem(`my-version-${recipeId}`, JSON.stringify(versionData));
    
    router.push(`/recipe/${recipeId}`);
  }

  function handleSaveVersion() {
    if (!recommendedVersion) return;
    
    const versionData = {
      name: versionName,
      changes: recommendedVersion.changes,
      createdAt: new Date().toISOString(),
    };
    
    localStorage.setItem(`my-version-${recipeId}`, JSON.stringify(versionData));
    
    setShowSaveDialog(false);
    router.push(`/recipe/${recipeId}`);
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
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={`/recipe/${recipeId}`}>
            <button className="w-10 h-10 -ml-2 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold">智能调整</h1>
        </div>
      </header>

      <div className="px-4 py-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {currentRecipe.name}
          </h2>
          <p className="text-sm text-gray-500">
            根据这道菜和你的做菜记录，生成更适合你的版本
          </p>
        </div>

        {logs.length === 0 ? (
          <div className="card p-6 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Info className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-700 mb-2">还没有做菜记录</h3>
            <p className="text-sm text-gray-500 mb-4">
              记录几次做菜体验后，系统可以为你生成更适合的版本
            </p>
            <Link href={`/recipe/${recipeId}`}>
              <button className="btn-primary">
                开始做菜并记录
              </button>
            </Link>
          </div>
        ) : generating ? (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">正在分析你的做菜记录...</p>
          </div>
        ) : recommendedVersion && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-primary-500" />
                <h3 className="font-medium text-gray-900">推荐原因</h3>
              </div>
              <div className="space-y-2">
                {recommendedVersion.reason.map((reason, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary-500" />
                <h3 className="font-medium text-gray-900">版本摘要</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendedVersion.changes.map((change, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm"
                  >
                    {change.type === "ingredient" ? "省略" : "调整"}{change.target}
                  </span>
                ))}
                {recommendedVersion.changes.length === 0 && (
                  <span className="text-sm text-gray-500">保持原始食谱不变</span>
                )}
              </div>
            </div>

            {recommendedVersion.changes.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-gray-400" />
                  <h3 className="font-medium text-gray-900">版本差异预览</h3>
                </div>
                <div className="space-y-3">
                  {recommendedVersion.changes.map((change, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{change.target}</span>
                        <span className="text-xs text-gray-400">
                          {change.type === "ingredient" ? "食材" : "用量"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400 line-through">{change.original}</span>
                        <span>→</span>
                        <span className="text-primary-600 font-medium">{change.modified}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-4 bg-blue-50 border-blue-100">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-700">
                    这个版本是基于你过去 {logs.length} 次做菜记录生成的，保存后可以在食谱详情页切换使用。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {recommendedVersion && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-bottom">
          <div className="max-w-md mx-auto flex gap-3">
            <button
              onClick={() => router.push(`/recipe/${recipeId}`)}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium"
            >
              暂不使用
            </button>
            <button
              onClick={handleApplyVersion}
              className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium flex items-center justify-center gap-1"
            >
              <Save className="w-4 h-4" />
              保存为我的版本
            </button>
          </div>
        </div>
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">保存为我的版本</h3>
            <p className="text-gray-500 text-sm mb-4">
              保存后，下次做这道菜时可以快速使用这个版本
            </p>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="给这个版本起个名字"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveVersion}
                className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
