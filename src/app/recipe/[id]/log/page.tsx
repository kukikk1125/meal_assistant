"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Star, Camera, Check, ChevronRight, Save,
  ThumbsUp, ThumbsDown, AlertCircle
} from "lucide-react";
import { getRecipe, Recipe, createCookingLog } from "@/lib/supabase";
import { useRecipeStore } from "@/store";

const TASTE_OPTIONS = [
  { id: "too_spicy", label: "太辣了", icon: "🌶️" },
  { id: "too_bland", label: "太淡了", icon: "🥄" },
  { id: "too_salty", label: "太咸了", icon: "🧂" },
  { id: "too_oily", label: "太油了", icon: "🫗" },
  { id: "just_right", label: "刚刚好", icon: "✨" },
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

export default function CookingLogPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { currentRecipe, setCurrentRecipe } = useRecipeStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [rating, setRating] = useState<number>(0);
  const [tasteFeedback, setTasteFeedback] = useState<string[]>([]);
  const [difficultyFeedback, setDifficultyFeedback] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [usedVersion, setUsedVersion] = useState<"original" | "my">("original");

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  async function loadRecipe() {
    try {
      const recipe = await getRecipe(recipeId);
      setCurrentRecipe(recipe);
      
      const savedVersion = localStorage.getItem(`my-version-${recipeId}`);
      if (savedVersion) {
        setUsedVersion("my");
      }
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
    setDifficultyFeedback(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
  }

  async function handleSave() {
    if (rating === 0) {
      alert("请选择本次做菜结果");
      return;
    }

    setSaving(true);
    try {
      await createCookingLog({
        recipe_id: recipeId,
        user_id: "demo-user",
        rating,
        taste_note: tasteFeedback.join(", "),
        improvement: difficultyFeedback.join(", "),
        apply_to_recipe: false,
        cooked_at: new Date().toISOString(),
        taste_feedback: tasteFeedback,
        difficulty_feedback: difficultyFeedback,
        notes,
        used_version: usedVersion,
      });
      
      router.push(`/recipe/${recipeId}`);
    } catch (error) {
      console.error("Failed to save log:", error);
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
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">使用版本：</span>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setUsedVersion("original")}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  usedVersion === "original" ? "bg-white shadow text-gray-900" : "text-gray-500"
                }`}
              >
                原始食谱
              </button>
              <button
                onClick={() => setUsedVersion("my")}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  usedVersion === "my" ? "bg-primary-500 text-white" : "text-gray-500"
                }`}
              >
                我的版本
              </button>
            </div>
          </div>
        </div>

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
          <h3 className="font-medium text-gray-900 mb-3">口味反馈</h3>
          <div className="grid grid-cols-2 gap-2">
            {TASTE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleTasteFeedback(option.id)}
                className={`p-3 rounded-xl flex items-center gap-2 transition-colors ${
                  tasteFeedback.includes(option.id)
                    ? "bg-primary-50 border-2 border-primary-500"
                    : "bg-gray-50 border-2 border-transparent"
                }`}
              >
                <span className="text-lg">{option.icon}</span>
                <span className={`text-sm ${
                  tasteFeedback.includes(option.id) ? "text-primary-600 font-medium" : "text-gray-600"
                }`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">制作难点</h3>
          <p className="text-xs text-gray-400 mb-3">选择你遇到的问题，帮助后续优化</p>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleDifficultyFeedback(option.id)}
                className={`p-3 rounded-xl flex items-center gap-2 transition-colors ${
                  difficultyFeedback.includes(option.id)
                    ? "bg-orange-50 border-2 border-orange-300"
                    : "bg-gray-50 border-2 border-transparent"
                }`}
              >
                <span className="text-lg">{option.icon}</span>
                <span className={`text-sm ${
                  difficultyFeedback.includes(option.id) ? "text-orange-600 font-medium" : "text-gray-600"
                }`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">自由备注</h3>
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
    </div>
  );
}
