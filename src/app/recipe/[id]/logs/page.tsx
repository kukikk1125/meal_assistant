"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Star, Sparkles, ChevronRight, History } from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog } from "@/lib/supabase";
import ReviewSummaryCard from "@/components/ReviewSummaryCard";

const TASTE_LABELS: Record<string, string> = {
  too_spicy: "太辣了",
  too_bland: "太淡了",
  too_salty: "太咸了",
  too_oily: "太油了",
  just_right: "刚刚好",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  prep_hard: "食材准备太麻烦",
  step_unclear: "某一步没看懂",
  heat_hard: "火候不好掌握",
  time_short: "时间不够",
  seasoning_uncertain: "调味不确定",
  too_complex: "过程太复杂",
};

export default function LogsPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [logs, setLogs] = useState<CookingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, [recipeId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      let recipeData: Recipe | null = null;
      let logsData: CookingLog[] = [];
      
      try {
        recipeData = await getRecipe(recipeId);
      } catch (err) {
        console.error("Failed to load recipe:", err);
      }
      
      try {
        logsData = await getCookingLogs(recipeId);
      } catch (err) {
        console.error("Failed to load logs:", err);
        logsData = [];
      }
      
      if (!recipeData) {
        setError("食谱不存在");
      } else {
        setRecipe(recipeData);
        setLogs(logsData || []);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function getRatingLabel(rating: number): string {
    const labels = ["", "失败了", "不太成功", "一般", "基本成功", "很成功"];
    return labels[rating] || "";
  }

  function getTasteLabel(id: string): string {
    if (id.startsWith("其他:") || id.startsWith("其他：")) {
      return id;
    }
    return TASTE_LABELS[id] || id;
  }

  function getDifficultyLabel(id: string): string {
    return DIFFICULTY_LABELS[id] || id;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500">
        <p className="mb-4">{error}</p>
        <button 
          onClick={() => router.push(`/recipe/${recipeId}`)}
          className="btn-primary"
        >
          返回食谱
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={`/recipe/${recipeId}`}>
            <button className="w-10 h-10 -ml-2 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold">做菜记录</h1>
        </div>
      </header>

      {recipe && (
        <div className="px-4 py-4 bg-white border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
          <p className="text-sm text-gray-500 mt-1">共 {logs.length} 次记录</p>
        </div>
      )}

      {logs.length > 0 && recipe && (
        <div className="px-4 mt-4">
          <ReviewSummaryCard
            recipeId={recipeId}
            recipe={{
              name: recipe.name,
              totalTime: recipe.total_time,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
            }}
            cookingLogs={logs}
            expanded={summaryExpanded}
            onToggleExpand={() => setSummaryExpanded(!summaryExpanded)}
          />
        </div>
      )}

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <History className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-medium text-gray-700 mb-1">还没有做菜记录</p>
          <p className="text-sm text-gray-400 text-center px-8">
            做完菜后记录一下，可以帮助生成更适合你的版本
          </p>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-4">
          {logs.map((log) => (
            <Link key={log.id} href={`/recipe/${recipeId}/log/${log.id}`}>
              <div className="card p-4 mb-4 cursor-pointer hover:shadow-md transition-shadow">
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
                            : "text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {getRatingLabel(log.rating)}
                  </span>
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
                
                {log.step_photos && log.step_photos.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto">
                    {log.step_photos.slice(0, 3).map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo.imageUrl}
                          alt={`步骤 ${photo.stepNumber}`}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                        <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded">
                          {photo.stepNumber}
                        </span>
                      </div>
                    ))}
                    {log.step_photos.length > 3 && (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-sm text-gray-500">
                        +{log.step_photos.length - 3}
                      </div>
                    )}
                  </div>
                )}
                
                {log.taste_feedback && log.taste_feedback.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {log.taste_feedback.map((feedback, i) => (
                      <span key={i} className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                        {getTasteLabel(feedback)}
                      </span>
                    ))}
                  </div>
                )}
                
                {log.difficulty_feedback && log.difficulty_feedback.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {log.difficulty_feedback.map((feedback, i) => (
                      <span key={i} className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        {getDifficultyLabel(feedback)}
                      </span>
                    ))}
                  </div>
                )}
                
                {log.notes && (
                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-2 line-clamp-2">
                    {log.notes}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
