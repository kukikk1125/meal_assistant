"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Clock, Star } from "lucide-react";
import { getRecipes, Recipe, getCookingLogs, calculateAverageRating } from "@/lib/supabase";
import { useRecipeStore } from "@/store";

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const { clearTempAdjustments } = useRecipeStore();

  useEffect(() => {
    clearTempAdjustments();
    loadRecipes();
  }, [clearTempAdjustments]);

  async function loadRecipes() {
    try {
      const data = await getRecipes();
      setRecipes(data);
      
      const ratingsData: Record<string, { avg: number; count: number }> = {};
      for (const recipe of data) {
        const logs = await getCookingLogs(recipe.id);
        ratingsData[recipe.id] = {
          avg: calculateAverageRating(logs),
          count: logs.length
        };
      }
      setRatings(ratingsData);
    } catch (error) {
      console.error("Failed to load recipes:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-[28px] pb-3">
        <h1 className="text-2xl font-bold text-gray-900">我的食谱</h1>
        <p className="text-gray-500 mt-2">共 {recipes.length} 道菜谱</p>
      </header>

      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索食谱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {searchQuery ? "没有找到匹配的食谱" : "还没有食谱，点击下方添加"}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-4">
          {filteredRecipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
              <div className="card overflow-hidden">
                <div className="aspect-[4/3] bg-gray-100 relative">
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      🍳
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 truncate">{recipe.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{recipe.total_time} 分钟</span>
                  </div>
                  {ratings[recipe.id]?.count > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-gray-700">{ratings[recipe.id].avg}</span>
                      <span className="text-gray-400">({ratings[recipe.id].count}次)</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link href="/import">
        <button className="fixed bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-primary-500 text-white rounded-full shadow-lg flex items-center justify-center safe-bottom z-50">
          <Plus className="w-6 h-6" />
        </button>
      </Link>
    </div>
  );
}
