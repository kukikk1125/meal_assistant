"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog, deleteCookingLog } from "@/lib/supabase";

export default function LogDetailPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const logId = params.logId as string;
  const router = useRouter();
  
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [log, setLog] = useState<CookingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [recipeId, logId]);

  async function loadData() {
    try {
      const [recipeData, logsData] = await Promise.all([
        getRecipe(recipeId),
        getCookingLogs(recipeId),
      ]);
      setRecipe(recipeData);
      const foundLog = logsData.find(l => l.id === logId);
      setLog(foundLog || null);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!log) return;
    
    setDeleting(true);
    try {
      await deleteCookingLog(log.id);
      router.push(`/recipe/${recipeId}/logs`);
    } catch (error) {
      console.error("Failed to delete log:", error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500">
        <p>日志不存在</p>
        <button onClick={() => router.push(`/recipe/${recipeId}/logs`)} className="btn-primary mt-4">
          返回日志列表
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-4 flex items-center justify-between safe-top">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">做菜日志</h1>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 -mr-2 text-gray-400"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      <div className="px-4 py-4">
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">{formatDate(log.cooked_at)}</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= log.rating
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
          
          {recipe && (
            <p className="text-lg font-semibold">{recipe.name}</p>
          )}
        </div>

        {log.images && log.images.length > 0 && (
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">成品照片</h3>
            <div className="grid grid-cols-3 gap-2">
              {log.images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`照片 ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-xl"
                />
              ))}
            </div>
          </div>
        )}

        {log.taste_note && (
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">口味评价</h3>
            <div className="card p-3">
              <p className="text-gray-700">{log.taste_note}</p>
            </div>
          </div>
        )}

        {log.improvement && (
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">改进建议</h3>
            <div className="card p-3">
              <p className="text-gray-700">{log.improvement}</p>
            </div>
          </div>
        )}

        {log.apply_to_recipe && (
          <div className="mb-4">
            <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded">
              已将改进建议应用到食谱
            </span>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-gray-500 mb-6">删除后将无法恢复，确定要删除这条做菜日志吗？</p>
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
