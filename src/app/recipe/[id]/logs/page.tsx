"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Calendar, Star, Sparkles, ChevronRight, History } from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog } from "@/lib/supabase";

export default function LogsPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [logs, setLogs] = useState<CookingLog[]>([]);
  const [loading, setLoading] = useState(true);

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

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function getRatingLabel(rating: number): string {
    const labels = ["", "失败了", "不太成功", "一般", "基本成功", "很成功"];
    return labels[rating] || "";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
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

      {logs.length > 0 && (
        <div className="px-4 mt-4">
          <Link href={`/recipe/${recipeId}/adjust`}>
            <div className="card p-4 flex items-center justify-between bg-primary-50 border-primary-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">智能调整</h3>
                  <p className="text-xs text-gray-500">
                    基于{logs.length}次记录，生成更适合你的版本
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
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
        <div className="px-4 mt-4 space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="card p-4">
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
                {log.used_version === "my" && (
                  <span className="text-xs text-primary-500 bg-primary-50 px-2 py-0.5 rounded">
                    我的版本
                  </span>
                )}
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
              
              {log.taste_feedback && log.taste_feedback.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {log.taste_feedback.map((feedback, i) => (
                    <span key={i} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {feedback}
                    </span>
                  ))}
                </div>
              )}
              
              {log.difficulty_feedback && log.difficulty_feedback.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {log.difficulty_feedback.map((feedback, i) => (
                    <span key={i} className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
                      {feedback}
                    </span>
                  ))}
                </div>
              )}
              
              {log.notes && (
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">
                  {log.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
