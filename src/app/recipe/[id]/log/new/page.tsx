"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Camera, X } from "lucide-react";
import { getRecipe, Recipe, createCookingLog } from "@/lib/supabase";

export default function NewLogPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [rating, setRating] = useState(3);
  const [tasteNote, setTasteNote] = useState("");
  const [improvement, setImprovement] = useState("");
  const [applyToRecipe, setApplyToRecipe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTaste, setSelectedTaste] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);

  const tasteOptions = ["偏咸", "偏淡", "刚好", "偏辣", "偏甜", "偏酸"];

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImages((prev) => [...prev, base64].slice(0, 3));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await createCookingLog({
        recipe_id: recipeId,
        user_id: "demo-user",
        rating,
        taste_note: [selectedTaste, tasteNote].filter(Boolean).join("、"),
        improvement,
        apply_to_recipe: applyToRecipe,
        cooked_at: new Date().toISOString(),
        images,
      });
      router.push(`/recipe/${recipeId}`);
    } catch (error) {
      console.error("Failed to save log:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-4 flex items-center gap-4 safe-top">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">做菜日志</h1>
      </header>

      <div className="px-4 py-4">
        <div className="card p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">今天做了什么？</h2>
          <p className="text-sm text-gray-500">记录您的烹饪体验</p>
        </div>

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">评分</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl transition-transform ${
                  star <= rating ? "text-yellow-400 scale-110" : "text-gray-300"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">成品照片</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={img}
                  alt={`照片 ${index + 1}`}
                  className="w-24 h-24 object-cover rounded-xl"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <label className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">添加照片</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">最多添加3张照片</p>
        </div>

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">口味评价</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {tasteOptions.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTaste(selectedTaste === tag ? "" : tag)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  selectedTaste === tag
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <textarea
            value={tasteNote}
            onChange={(e) => setTasteNote(e.target.value)}
            placeholder="其他口味备注..."
            className="input-field min-h-[80px] resize-none"
          />
        </div>

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">改进建议</h3>
          <textarea
            value={improvement}
            onChange={(e) => setImprovement(e.target.value)}
            placeholder="下次可以..."
            className="input-field min-h-[80px] resize-none"
          />
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-3">
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                applyToRecipe ? "bg-primary-500" : "bg-gray-300"
              }`}
              onClick={() => setApplyToRecipe(!applyToRecipe)}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  applyToRecipe ? "translate-x-5" : ""
                }`}
              />
            </div>
            <span className="text-gray-700">将改进建议应用到食谱</span>
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              保存中...
            </>
          ) : (
            "保存日志"
          )}
        </button>
      </div>
    </div>
  );
}
