"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Star, Trash2, X, Camera } from "lucide-react";
import { getRecipe, Recipe, getCookingLogs, CookingLog, deleteCookingLog } from "@/lib/supabase";

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

const RATING_LABELS: Record<number, string> = {
  1: "失败了",
  2: "不太成功",
  3: "一般",
  4: "基本成功",
  5: "很成功",
};

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
  const [viewingImage, setViewingImage] = useState<string | null>(null);

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
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 safe-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">做菜记录</h1>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 -mr-2 text-gray-400"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
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
          
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{RATING_LABELS[log.rating] || "未评分"}</span>
          </div>
          
          {recipe && (
            <p className="text-sm text-gray-500 mt-1">{recipe.name}</p>
          )}
        </div>

        {log.images && log.images.length > 0 && (
          <div className="card p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">成品照片</h3>
            <div className="grid grid-cols-3 gap-2">
              {log.images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`照片 ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setViewingImage(img)}
                />
              ))}
            </div>
          </div>
        )}

        {log.taste_feedback && log.taste_feedback.length > 0 && (
          <div className="card p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">口味反馈</h3>
            <div className="flex flex-wrap gap-2">
              {log.taste_feedback.map((feedback, index) => (
                <span key={index} className="px-3 py-1.5 bg-primary-50 text-primary-600 rounded-full text-sm">
                  {getTasteLabel(feedback)}
                </span>
              ))}
            </div>
          </div>
        )}

        {(log.difficulty_feedback && log.difficulty_feedback.length > 0) || log.difficulty_detail ? (
          <div className="card p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">制作难点</h3>
            {log.difficulty_feedback && log.difficulty_feedback.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {log.difficulty_feedback.map((feedback, index) => (
                  <span key={index} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-sm">
                    {getDifficultyLabel(feedback)}
                  </span>
                ))}
              </div>
            )}
            {log.difficulty_detail && (
              <p className="text-gray-700 text-sm whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                {log.difficulty_detail}
              </p>
            )}
          </div>
        ) : null}

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">制作过程</h3>
          {log.step_photos && log.step_photos.length > 0 ? (
            <div className="space-y-4">
              {log.step_photos.map((photo, index) => (
                <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="w-24 h-24 flex-shrink-0">
                      <img
                        src={photo.imageUrl}
                        alt={`步骤 ${photo.stepNumber}`}
                        className="w-full h-full object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setViewingImage(photo.imageUrl)}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          第 {photo.stepNumber} 步
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          photo.statusLabel === "状态正常" 
                            ? "text-green-700 bg-green-100" 
                            : photo.statusLabel === "需要注意"
                            ? "text-amber-600 bg-amber-50"
                            : "text-red-600 bg-red-50"
                        }`}>
                          {photo.statusLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        {photo.stepDescription}
                      </p>
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                        💡 {photo.advice}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Camera className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">本次制作没有拍摄步骤照片</p>
              <p className="text-xs text-gray-400 mt-1">下次做菜时可以尝试拍照记录哦</p>
            </div>
          )}
        </div>

        {log.notes && (
          <div className="card p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-2">自由备注</h3>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{log.notes}</p>
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
            <p className="text-gray-500 mb-6">删除后将无法恢复，确定要删除这条做菜记录吗？</p>
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
      
      {viewingImage && (
        <div 
          className="fixed inset-0 bg-black z-[60] flex items-center justify-center"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 text-white p-2 bg-black/30 rounded-full hover:bg-black/50 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={viewingImage}
            alt="查看大图"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
