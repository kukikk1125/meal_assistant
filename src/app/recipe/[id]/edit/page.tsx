"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, ChevronDown, X } from "lucide-react";
import { getRecipe, updateRecipe, Recipe } from "@/lib/supabase";
import { useRecipeStore } from "@/store";

const INGREDIENT_UNITS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "L", label: "L" },
  { value: "个", label: "个" },
  { value: "片", label: "片" },
  { value: "块", label: "块" },
  { value: "根", label: "根" },
  { value: "把", label: "把" },
  { value: "瓣", label: "瓣" },
  { value: "适量", label: "适量" },
  { value: "少许", label: "少许" },
];

const TIME_UNITS = [
  { value: "秒", label: "秒" },
  { value: "分钟", label: "分钟" },
  { value: "小时", label: "小时" },
];

interface ManualIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
}

interface StepIngredient {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
}

interface ManualStep {
  id: string;
  order: number;
  description: string;
  duration: number;
  timeUnit: string;
  tip?: string;
  ingredients: StepIngredient[];
}

export default function EditRecipePage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { updateRecipe: updateRecipeInStore } = useRecipeStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showUnitPicker, setShowUnitPicker] = useState<number | null>(null);
  
  const [name, setName] = useState("");
  const [totalTime, setTotalTime] = useState(15);
  const [ingredients, setIngredients] = useState<ManualIngredient[]>([]);
  const [steps, setSteps] = useState<ManualStep[]>([]);

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  async function loadRecipe() {
    try {
      const recipe = await getRecipe(recipeId);
      setName(recipe.name);
      setTotalTime(recipe.total_time);
      setIngredients(recipe.ingredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
      })));
      setSteps(recipe.steps.map(step => ({
        id: step.id,
        order: step.order,
        description: step.description,
        duration: step.duration,
        timeUnit: "分钟",
        tip: step.tip,
        ingredients: step.ingredients || [],
      })));
    } catch (err) {
      console.error("Failed to load recipe:", err);
      setError("加载食谱失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("请填写食谱名称");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updatedRecipe = await updateRecipe(recipeId, {
        name,
        total_time: totalTime,
        ingredients: ingredients.map((ing, index) => ({
          id: ing.id || `ing-${index}`,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          is_optional: false,
        })),
        steps: steps.map((step, index) => {
          let durationInMinutes = step.duration;
          if (step.timeUnit === "秒") {
            durationInMinutes = Math.ceil(step.duration / 60);
          } else if (step.timeUnit === "小时") {
            durationInMinutes = step.duration * 60;
          }
          return {
            id: step.id || `step-${index}`,
            order: index + 1,
            description: step.description,
            duration: durationInMinutes,
            is_key_step: false,
            tip: step.tip,
            ingredients: step.ingredients,
          };
        }),
      });

      updateRecipeInStore(recipeId, updatedRecipe);
      router.push(`/recipe/${recipeId}`);
    } catch (err) {
      setError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  function addIngredient() {
    setIngredients(prev => [...prev, {
      id: `ing-new-${Date.now()}`,
      name: "",
      amount: 1,
      unit: "个",
    }]);
  }

  function updateIngredient(index: number, field: string, value: string | number) {
    setIngredients(prev => prev.map((ing, i) =>
      i === index ? { ...ing, [field]: value } : ing
    ));
    setShowUnitPicker(null);
  }

  function removeIngredient(index: number) {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps(prev => [...prev, {
      id: `step-new-${Date.now()}`,
      order: prev.length + 1,
      description: "",
      duration: 5,
      timeUnit: "分钟",
      ingredients: [],
    }]);
  }

  function updateStep(index: number, field: string, value: string | number) {
    setSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, [field]: value, order: i + 1 } : step
    ));
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 })));
  }

  function toggleStepIngredient(stepIndex: number, ingredient: ManualIngredient) {
    setSteps(prev => prev.map((step, i) => {
      if (i !== stepIndex) return step;
      
      const existingIndex = step.ingredients.findIndex(
        ing => ing.ingredientId === ingredient.id
      );
      
      if (existingIndex >= 0) {
        const newIngredients = step.ingredients.filter(
          ing => ing.ingredientId !== ingredient.id
        );
        return { ...step, ingredients: newIngredients };
      } else {
        const newIngredient: StepIngredient = {
          ingredientId: ingredient.id,
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
        };
        return { ...step, ingredients: [...step.ingredients, newIngredient] };
      }
    }));
  }

  function updateStepIngredientAmount(stepIndex: number, ingredientId: string, amount: number) {
    setSteps(prev => prev.map((step, i) => {
      if (i !== stepIndex) return step;
      
      return {
        ...step,
        ingredients: step.ingredients.map(ing =>
          ing.ingredientId === ingredientId ? { ...ing, amount } : ing
        ),
      };
    }));
  }

  function updateStepIngredientUnit(stepIndex: number, ingredientId: string, unit: string) {
    setSteps(prev => prev.map((step, i) => {
      if (i !== stepIndex) return step;
      
      return {
        ...step,
        ingredients: step.ingredients.map(ing =>
          ing.ingredientId === ingredientId ? { ...ing, unit } : ing
        ),
      };
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-4 flex items-center gap-4 safe-top">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">编辑食谱</h1>
      </header>

      <div className="px-4 py-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">菜名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：番茄炒蛋"
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">总时长（分钟）</label>
          <input
            type="number"
            value={totalTime}
            onChange={(e) => setTotalTime(parseInt(e.target.value) || 0)}
            className="input-field"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">食材清单</label>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">一人份量</span>
            </div>
            <button onClick={addIngredient} className="text-primary-500 text-sm">+ 添加食材</button>
          </div>
          <p className="text-xs text-gray-400 mb-2">设置一人份的食材总量，做菜时可按需调整份量</p>
          <div className="space-y-3">
            {ingredients.map((ing, index) => (
              <div key={ing.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(index, "name", e.target.value)}
                  placeholder="食材名"
                  className="input-field flex-1"
                />
                <input
                  type="number"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(index, "amount", parseFloat(e.target.value) || 0)}
                  className="input-field w-20"
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUnitPicker(showUnitPicker === index ? null : index)}
                    className="input-field w-16 flex items-center justify-between"
                  >
                    <span className="truncate">{ing.unit}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                  {showUnitPicker === index && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto min-w-[80px]">
                      {INGREDIENT_UNITS.map((unit) => (
                        <button
                          key={unit.value}
                          type="button"
                          onClick={() => updateIngredient(index, "unit", unit.value)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 whitespace-nowrap ${
                            ing.unit === unit.value ? "text-primary-500 bg-primary-50" : ""
                          }`}
                        >
                          {unit.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {ingredients.length > 1 && (
                  <button onClick={() => removeIngredient(index)} className="text-red-500 p-2 text-lg">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">制作步骤</label>
            <button onClick={addStep} className="text-primary-500 text-sm">+ 添加步骤</button>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="flex gap-2 items-start w-full">
                <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0 w-full px-2 space-y-2">
                  <textarea
                    value={step.description}
                    onChange={(e) => updateStep(index, "description", e.target.value)}
                    placeholder="步骤描述"
                    className="input-field w-full min-h-[60px] resize-none"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">预计时长</span>
                    <input
                      type="number"
                      value={step.duration}
                      onChange={(e) => updateStep(index, "duration", parseInt(e.target.value) || 0)}
                      className="input-field w-14 text-center text-sm"
                    />
                    <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                      {TIME_UNITS.map((unit) => (
                        <button
                          key={unit.value}
                          type="button"
                          onClick={() => updateStep(index, "timeUnit", unit.value)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            step.timeUnit === unit.value
                              ? "bg-white text-primary-500 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          {unit.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={step.tip || ""}
                    onChange={(e) => updateStep(index, "tip", e.target.value)}
                    placeholder="小贴士（可选）"
                    className="input-field w-full text-sm"
                  />
                  {ingredients.filter(ing => ing.name).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">本步骤所需食材：</span>
                        <span className="text-xs text-gray-400">(点击选择，设置该步骤实际用量)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ingredients.filter(ing => ing.name).map((ing) => {
                          const isSelected = step.ingredients.some(
                            stepIng => stepIng.ingredientId === ing.id
                          );
                          return (
                            <button
                              key={ing.id}
                              type="button"
                              onClick={() => toggleStepIngredient(index, ing)}
                              className={`px-2 py-1 rounded-full text-xs transition-colors ${
                                isSelected
                                  ? "bg-primary-500 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {ing.name}
                            </button>
                          );
                        })}
                      </div>
                      {step.ingredients.length > 0 && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-400">设置各食材用量：</span>
                          {step.ingredients.map((stepIng) => {
                            const originalIng = ingredients.find(i => i.id === stepIng.ingredientId);
                            return (
                              <div key={stepIng.ingredientId} className="flex items-center gap-2">
                                <span className="text-xs text-gray-600 w-20 truncate">{stepIng.name}</span>
                                <input
                                  type="number"
                                  value={stepIng.amount}
                                  onChange={(e) => updateStepIngredientAmount(index, stepIng.ingredientId, parseFloat(e.target.value) || 0)}
                                  className="input-field w-16 text-center text-xs py-1"
                                />
                                <select
                                  value={stepIng.unit}
                                  onChange={(e) => updateStepIngredientUnit(index, stepIng.ingredientId, e.target.value)}
                                  className="input-field text-xs py-1 px-2"
                                >
                                  {INGREDIENT_UNITS.map(u => (
                                    <option key={u.value} value={u.value}>{u.label}</option>
                                  ))}
                                </select>
                                {originalIng && (
                                  <span className="text-xs text-gray-400">
                                    (总量: {originalIng.amount}{originalIng.unit})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(index)} className="w-8 h-8 text-red-500 flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              保存中...
            </>
          ) : (
            "保存修改"
          )}
        </button>
      </div>

      {showUnitPicker !== null && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowUnitPicker(null)}
        />
      )}
    </div>
  );
}
