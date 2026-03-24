"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Camera, Save, AlertCircle
} from "lucide-react";
import { getRecipe, Recipe, createCookingLog, saveAnalysisCache } from "@/lib/supabase";
import { useRecipeStore, useCookingStore } from "@/store";
import InstantOptimizeCard from "@/components/InstantOptimizeCard";
import { analyzeCookingLog, CookingLogAnalysis } from "@/lib/doubao";

const TASTE_OPTIONS = [
  { id: "too_spicy", label: "太辣了", icon: "🌶️" },
  { id: "too_bland", label: "太淡了", icon: "🥄" },
  { id: "too_salty", label: "太咸了", icon: "🧂" },
  { id: "too_oily", label: "太油了", icon: "🫗" },
  { id: "just_right", label: "刚刚好", icon: "✨" },
  { id: "other", label: "其他", icon: "💬" },
];

const DIFFICULTY_OPTIONS = [
  { id: "prep_hard", label: "食材准备太麻烦", icon: "🥬" },
  { id: "step_unclear", label: "某一步没看懂", icon: "❓" },
  { id: "heat_hard", label: "火候不好掌握", icon: "🔥" },
  { id: "time_short", label: "时间不够", icon: "⏰" },
  { id: "seasoning_uncertain", label: "调味不确定", icon: "🧂" },
  { id: "too_complex", label: "过程太复杂", icon: "🔄" },
];

const RESULT_OPTIONS = [
  { id: 5, label: "很成功", icon: "🎉", color: "text-green-500" },
  { id: 4, label: "基本成功", icon: "👍", color: "text-blue-500" },
  { id: 3, label: "一般", icon: "😐", color: "text-yellow-500" },
  { id: 2, label: "不太成功", icon: "😕", color: "text-orange-500" },
  { id: 1, label: "失败了", icon: "😢", color: "text-red-500" },
];

const STATUS_COLORS: Record<string, string> = {
  "状态正常": "text-green-700 bg-green-100",
  "需要注意": "text-amber-600 bg-amber-50",
  "需要调整": "text-red-600 bg-red-50",
  "无法判断": "text-gray-600 bg-gray-100",
};

export default function CookingLogPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { currentRecipe, setCurrentRecipe } = useRecipeStore();
  const { currentSession, getSystemSummary, getPhotoCheckEvents, endSession } = useCookingStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [rating, setRating] = useState<number>(0);
  const [tasteFeedback, setTasteFeedback] = useState<string[]>([]);
  const [tasteOtherDetail, setTasteOtherDetail] = useState("");
  const [difficultyFeedback, setDifficultyFeedback] = useState<string[]>([]);
  const [difficultyDetails, setDifficultyDetails] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [showSystemDetails, setShowSystemDetails] = useState(false);
  const [showOptimizeCard, setShowOptimizeCard] = useState(false);
  const [cookingLogAnalysis, setCookingLogAnalysis] = useState<CookingLogAnalysis | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentLogForOptimize, setCurrentLogForOptimize] = useState<any>(null);

  const systemSummary = getSystemSummary();
  const photoCheckEvents = getPhotoCheckEvents();

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPhotos((prev) => [...prev, base64].slice(0, 3));
      };
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function loadRecipe() {
    try {
      const recipe = await getRecipe(recipeId);
      setCurrentRecipe(recipe);
    } catch (error) {
      console.error("Failed to load recipe:", error);
    } finally {
      setLoading(false);
    }
  }

  function toggleTasteFeedback(id: string) {
    setTasteFeedback(prev => 
      prev.includes(id) 
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  }

  function toggleDifficultyFeedback(id: string) {
    setDifficultyFeedback(prev => {
      if (prev.includes(id)) {
        const newDetails = { ...difficultyDetails };
        delete newDetails[id];
        setDifficultyDetails(newDetails);
        return prev.filter(d => d !== id);
      }
      return [...prev, id];
    });
  }

  function updateDifficultyDetail(id: string, detail: string) {
    setDifficultyDetails(prev => ({
      ...prev,
      [id]: detail,
    }));
  }

  async function handleSave() {
    console.log("=== handleSave called ===");
    console.log("rating:", rating);
    console.log("recipeId:", recipeId);
    console.log("tasteFeedback:", tasteFeedback);
    console.log("difficultyFeedback:", difficultyFeedback);
    console.log("notes:", notes);
    console.log("photos length:", photos.length);
    
    if (rating === 0) {
      alert("请选择本次做菜结果");
      return;
    }

    if (!recipeId) {
      alert("食谱ID缺失");
      return;
    }

    setSaving(true);
    
    try {
      console.log("Step 1: Ending session if exists...");
      if (currentSession) {
        endSession();
      }
      
      console.log("Step 2: Preparing payload...");
      
      const systemSummaryData = systemSummary.photoCheckCount > 0 ? {
        photoCheckCount: systemSummary.photoCheckCount,
        keyEvents: systemSummary.keyEvents,
      } : undefined;
      
      const stepPhotosData = photoCheckEvents.map(event => ({
        stepNumber: event.stepNumber,
        stepDescription: event.stepDescription,
        imageUrl: event.imageUrl,
        statusLabel: event.analysis.statusLabel,
        advice: event.analysis.advice,
        createdAt: event.createdAt,
      }));
      
      const difficultyDetailText = difficultyFeedback
        .map(id => {
          const detail = difficultyDetails[id];
          if (detail && detail.trim()) {
            const option = DIFFICULTY_OPTIONS.find(o => o.id === id);
            return `${option?.label || id}: ${detail.trim()}`;
          }
          return null;
        })
        .filter(Boolean)
        .join("\n");
      
      const newFinalTasteFeedback = tasteFeedback.includes("other") && tasteOtherDetail.trim()
        ? [...tasteFeedback.filter(t => t !== "other"), `其他: ${tasteOtherDetail.trim()}`]
        : tasteFeedback;
      
      const currentLog = {
        rating: rating,
        taste_feedback: newFinalTasteFeedback,
        difficulty_feedback: difficultyFeedback,
        notes: notes,
      };
      
      setCurrentLogForOptimize(currentLog);
      
      const payload = {
        recipe_id: recipeId,
        user_id: "demo-user",
        rating: rating,
        taste_note: newFinalTasteFeedback.join(", "),
        improvement: "",
        apply_to_recipe: false,
        cooked_at: new Date().toISOString(),
        taste_feedback: newFinalTasteFeedback,
        difficulty_feedback: difficultyFeedback,
        difficulty_detail: difficultyDetailText,
        notes: notes || "",
        images: photos,
        system_summary: systemSummaryData,
        step_photos: stepPhotosData,
      };
      console.log("Payload:", JSON.stringify(payload, null, 2));
      
      console.log("Step 3: Calling createCookingLog...");
      const result = await createCookingLog(payload);
      
      console.log("Step 4: Save successful!", result);
      
      setAnalyzing(true);
      try {
        if (currentRecipe) {
          const analysis = await analyzeCookingLog(
            {
              name: currentRecipe.name,
              ingredients: currentRecipe.ingredients,
              steps: currentRecipe.steps,
            },
            {
              rating: rating,
              taste_feedback: newFinalTasteFeedback,
              difficulty_feedback: difficultyFeedback,
              notes: notes,
            }
          );
          
          setCookingLogAnalysis(analysis);
          setSaveSuccess(true);
          setShowOptimizeCard(true);
          
          try {
            await saveAnalysisCache(
              'analyzeCookingLog',
              analysis,
              [result.id]
            );
          } catch (cacheErr) {
            console.error('Failed to save analysis cache (non-critical):', cacheErr);
          }
        }
      } catch (err) {
        console.error("AI analysis failed (non-critical):", err);
        alert("保存成功！");
        router.push(`/recipe/${recipeId}`);
      } finally {
        setAnalyzing(false);
        setSaving(false);
      }
    } catch (error) {
      console.error("=== Save failed ===");
      console.error("Error:", error);
      
      let errorMessage = "保存失败，请重试";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 bg-white border-b border-gray-100 z-10 safe-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={`/recipe/${recipeId}`}>
            <button className="w-10 h-10 -ml-2 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold">记录这次做菜</h1>
        </div>
      </header>

      <div className="px-4 py-6">
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
              🍳
            </div>
            <div>
              <h2 className="font-medium text-gray-900">{currentRecipe.name}</h2>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString('zh-CN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>

        {systemSummary.photoCheckCount > 0 && (
          <div className="card p-4 mb-4">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowSystemDetails(!showSystemDetails)}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm">📸</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">拍照检查记录</h3>
                  <p className="text-xs text-gray-500">本次共 {systemSummary.photoCheckCount} 次</p>
                </div>
              </div>
              {showSystemDetails ? (
                <span className="text-gray-400 text-sm">收起</span>
              ) : (
                <span className="text-gray-400 text-sm">展开</span>
              )}
            </div>

            {showSystemDetails && (
              <div className="mt-4 space-y-3">
                {systemSummary.keyEvents.map((event, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                      {event.stepNumber}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[event.statusLabel] || "bg-gray-100 text-gray-600"}`}>
                          {event.statusLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{event.advice}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showSystemDetails && (
              <div className="mt-3 space-y-2">
                {systemSummary.keyEvents.slice(0, 2).map((event, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-400">第 {event.stepNumber} 步</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[event.statusLabel] || "bg-gray-100 text-gray-600"}`}>
                      {event.statusLabel}
                    </span>
                  </div>
                ))}
                {systemSummary.keyEvents.length > 2 && (
                  <p className="text-xs text-gray-400">点击展开查看更多</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">本次结果</h3>
          <div className="grid grid-cols-5 gap-2">
            {RESULT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setRating(option.id)}
                className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-colors ${
                  rating === option.id 
                    ? "bg-primary-50 border-2 border-primary-500" 
                    : "bg-gray-50 border-2 border-transparent"
                }`}
              >
                <span className="text-xl">{option.icon}</span>
                <span className={`text-xs ${rating === option.id ? "text-primary-600 font-medium" : "text-gray-500"}`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">成品照片</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {photos.map((img, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={img}
                  alt={`照片 ${index + 1}`}
                  className="w-24 h-24 object-cover rounded-xl"
                />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <label className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">添加照片</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">最多添加3张照片</p>
        </div>

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">口味反馈</h3>
          
          <div className="grid grid-cols-2 gap-2">
            {TASTE_OPTIONS.map((option) => {
              const isSelected = tasteFeedback.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleTasteFeedback(option.id)}
                  className={`p-3 rounded-xl flex items-center gap-2 transition-colors ${
                    isSelected
                      ? "bg-primary-50 border-2 border-primary-300"
                      : "bg-gray-50 border-2 border-transparent"
                  }`}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className={`text-sm ${
                    isSelected ? "text-primary-600 font-medium" : "text-gray-600"
                  }`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          
          {tasteFeedback.includes("other") && (
            <div className="mt-3">
              <textarea
                value={tasteOtherDetail}
                onChange={(e) => setTasteOtherDetail(e.target.value)}
                placeholder="请描述具体的口味问题..."
                className="w-full h-16 px-3 py-2 bg-gray-50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
              />
            </div>
          )}
        </div>

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">制作难点</h3>
          <p className="text-xs text-gray-400 mb-3">选择你遇到的问题，帮助后续优化</p>
          
          <div className="space-y-2">
            {DIFFICULTY_OPTIONS.map((option) => {
              const isSelected = difficultyFeedback.includes(option.id);
              return (
                <div key={option.id}>
                  <button
                    onClick={() => toggleDifficultyFeedback(option.id)}
                    className={`w-full p-3 rounded-xl flex items-center gap-2 transition-colors ${
                      isSelected
                        ? "bg-orange-50 border-2 border-orange-300"
                        : "bg-gray-50 border-2 border-transparent"
                    }`}
                  >
                    <span className="text-lg">{option.icon}</span>
                    <span className={`text-sm ${
                      isSelected ? "text-orange-600 font-medium" : "text-gray-600"
                    }`}>
                      {option.label}
                    </span>
                  </button>
                  
                  {isSelected && (
                    <div className="mt-2 ml-2 pl-4 border-l-2 border-orange-200">
                      <textarea
                        value={difficultyDetails[option.id] || ""}
                        onChange={(e) => updateDifficultyDetail(option.id, e.target.value)}
                        placeholder="具体卡在哪里？"
                        className="w-full h-16 px-3 py-2 bg-gray-50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">自由备注（可选）</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="哪里翻车了？下次想怎么改？家人朋友的反馈？"
            className="w-full h-32 px-4 py-3 bg-gray-50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>

        <div className="card p-4 bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">记录会用于优化</p>
              <p className="text-xs text-blue-600">
                这些记录会帮助系统为你生成更适合的食谱版本
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 safe-bottom">
        <div className="max-w-md mx-auto">
          <button 
            onClick={handleSave}
            disabled={saving || rating === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "保存中..." : "保存这次记录"}
          </button>
        </div>
      </div>

      {showOptimizeCard && cookingLogAnalysis && currentLogForOptimize && (
        <InstantOptimizeCard
          recipeId={recipeId}
          recipe={currentRecipe ? {
            name: currentRecipe.name,
            ingredients: currentRecipe.ingredients,
            steps: currentRecipe.steps,
          } : {
            name: "",
            ingredients: [],
            steps: [],
          }}
          currentLog={currentLogForOptimize}
          onClose={() => {
            setShowOptimizeCard(false);
            router.push(`/recipe/${recipeId}`);
          }}
        />
      )}
    </div>
  );
}
