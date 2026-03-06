"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, FileText, Loader2, Wand2, ChevronDown, X } from "lucide-react";
import { parseRecipeFromImage, parseRecipeFromText, ParsedRecipe, isAIRequestTimeoutError, optimizeRecipe } from "@/lib/doubao";
import { createRecipe } from "@/lib/supabase";
import { useRecipeStore } from "@/store";

type ImportTab = "image" | "text" | "manual";

const UNIT_DISPLAY_MAP: Record<string, string> = {
  g: "克",
  kg: "千克",
  ml: "毫升",
  L: "升",
};

function formatUnit(unit: string): string {
  return UNIT_DISPLAY_MAP[unit] || unit;
}

function formatStepDescription(description: string): string {
  return description.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (match, amountWithUnit, ingredientName) => {
    return `${amountWithUnit} ${ingredientName}`;
  });
}

const INGREDIENT_UNITS = [
  { value: "克", label: "克" },
  { value: "千克", label: "千克" },
  { value: "毫升", label: "毫升" },
  { value: "升", label: "升" },
  { value: "个", label: "个" },
  { value: "瓣", label: "瓣" },
  { value: "茶匙", label: "茶匙" },
  { value: "汤匙", label: "汤匙" },
  { value: "勺", label: "勺" },
  { value: "根", label: "根" },
  { value: "片", label: "片" },
  { value: "适量", label: "适量" },
  { value: "少许", label: "少许" },
];

const TIME_UNITS = [
  { value: "秒", label: "秒" },
  { value: "分钟", label: "分钟" },
  { value: "小时", label: "小时" },
];

interface ManualIngredient {
  name: string;
  amount: number;
  unit: string;
}

interface ManualStepIngredient {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
}

interface ManualStep {
  order: number;
  description: string;
  duration: number;
  timeUnit: string;
  ingredients: ManualStepIngredient[];
}

export default function ImportPage() {
  const router = useRouter();
  const { addRecipe } = useRecipeStore();
  const [activeTab, setActiveTab] = useState<ImportTab>("manual");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState("");
  const [showRetry, setShowRetry] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>(undefined);
  const [originalRecipe, setOriginalRecipe] = useState<ParsedRecipe | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ParsedRecipe | null>(null);
  const [hasOptimized, setHasOptimized] = useState(false);
  
  const [manualRecipe, setManualRecipe] = useState({
    name: "",
    totalTime: 15,
    ingredients: [{ name: "", amount: 1, unit: "个" }] as ManualIngredient[],
    steps: [{ order: 1, description: "", duration: 5, timeUnit: "分钟", ingredients: [] as ManualStepIngredient[] }] as ManualStep[],
  });

  const [showUnitPicker, setShowUnitPicker] = useState<number | null>(null);
  const [showEditUnitPicker, setShowEditUnitPicker] = useState<number | null>(null);
  
  const [manualOptimizing, setManualOptimizing] = useState(false);
  const [manualOriginal, setManualOriginal] = useState<typeof manualRecipe | null>(null);
  const [manualOptimized, setManualOptimized] = useState<typeof manualRecipe | null>(null);
  const [showManualComparison, setShowManualComparison] = useState(false);

  function hasIngredientChanged(oldIng: any, newIng: any) {
    return oldIng.name !== newIng.name || 
           oldIng.amount !== newIng.amount || 
           oldIng.unit !== newIng.unit;
  }

  function findMatchingStep(oldSteps: any[], newStep: any) {
    for (const oldStep of oldSteps) {
      if (oldStep.description === newStep.description) return oldStep;
      const oldWords = oldStep.description.substring(0, 20);
      const newWords = newStep.description.substring(0, 20);
      if (oldWords === newWords) return oldStep;
    }
    return null;
  }

  function hasStepChanged(oldStep: any, newStep: any) {
    return oldStep.description !== newStep.description || 
           oldStep.duration !== newStep.duration ||
           JSON.stringify(oldStep.ingredients || []) !== JSON.stringify(newStep.ingredients || []);
  }

  async function handleParse() {
    if (!inputValue.trim()) {
      setError("请输入内容");
      return;
    }

    setLoading(true);
    setError("");
    setShowRetry(false);
    if (activeTab === "image") {
      setCoverImageUrl(undefined);
    }
    setOriginalRecipe(null);
    setShowComparison(false);
    setIsEditing(false);
    setEditingRecipe(null);

    try {
      const result = activeTab === "text"
        ? await parseRecipeFromText(inputValue)
        : await parseRecipeFromImage(inputValue);
      setParsedRecipe(result);

      if (activeTab === "image") {
        setCoverImageUrl(inputValue);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败，请重试");
      setShowRetry(isAIRequestTimeoutError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOptimize() {
    if (!parsedRecipe) return;

    setOptimizing(true);
    setError("");
    setOriginalRecipe(JSON.parse(JSON.stringify(parsedRecipe)));

    try {
      const result = await optimizeRecipe(parsedRecipe);
      setParsedRecipe(result);
      setShowComparison(true);
      setHasOptimized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "优化失败，请重试");
      setOriginalRecipe(null);
    } finally {
      setOptimizing(false);
    }
  }

  async function handleSave() {
    const recipeToSave = activeTab === "manual" ? {
      name: manualRecipe.name,
      totalTime: manualRecipe.totalTime,
      ingredients: manualRecipe.ingredients.map((ing, index) => ({
        id: `ing-${index}`,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        scalable: true,
      })),
      steps: manualRecipe.steps.map((step, index) => {
        let durationInMinutes = step.duration;
        if (step.timeUnit === "秒") {
          durationInMinutes = Math.ceil(step.duration / 60);
        } else if (step.timeUnit === "小时") {
          durationInMinutes = step.duration * 60;
        }
        return {
          order: step.order,
          description: step.description,
          duration: durationInMinutes,
          ingredients: step.ingredients,
        };
      }),
    } : parsedRecipe;

    if (!recipeToSave || !recipeToSave.name) {
      setError("请填写食谱名称");
      return;
    }

    setLoading(true);
    try {
      const recipe = await createRecipe({
        user_id: "demo-user",
        name: recipeToSave.name,
        total_time: recipeToSave.totalTime,
        servings: 2,
        ingredients: recipeToSave.ingredients.map((ing) => ({
          id: ing.id || `ing-${Math.random().toString(36).substr(2, 9)}`,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          is_optional: false,
          scalable: ing.scalable ?? true,
        })),
        steps: recipeToSave.steps.map((step, index) => ({
          id: `step-${index}`,
          order: step.order,
          description: step.description,
          duration: step.duration,
          is_key_step: false,
          ingredients: step.ingredients || [],
        })),
        image_url: coverImageUrl,
      });

      if (!recipe?.id || typeof recipe.id !== "string") {
        throw new Error("新增食谱失败：未生成有效 ID");
      }

      addRecipe(recipe);
      router.push(`/recipe/${recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setInputValue(base64);
    };
    reader.readAsDataURL(file);
  }

  function addIngredient() {
    setManualRecipe(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", amount: 1, unit: "个" }],
    }));
  }

  function updateIngredient(index: number, field: string, value: string | number) {
    setManualRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
    setShowUnitPicker(null);
  }

  function removeIngredient(index: number) {
    setManualRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  function addStep() {
    setManualRecipe(prev => ({
      ...prev,
      steps: [...prev.steps, { order: prev.steps.length + 1, description: "", duration: 5, timeUnit: "分钟", ingredients: [] }],
    }));
  }

  function updateStep(index: number, field: string, value: string | number) {
    setManualRecipe(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, [field]: value, order: i + 1 } : step
      ),
    }));
  }

  function removeStep(index: number) {
    setManualRecipe(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 })),
    }));
  }

  function applyParsedToManual() {
    if (!parsedRecipe) return;
    setManualRecipe({
      name: parsedRecipe.name || "",
      totalTime: parsedRecipe.totalTime || 0,
      ingredients: parsedRecipe.ingredients.length > 0
        ? parsedRecipe.ingredients.map((ing) => ({
            name: ing.name || "",
            amount: Number.isFinite(ing.amount) ? ing.amount : 0,
            unit: ing.unit || "个",
          }))
        : [{ name: "", amount: 1, unit: "个" }],
      steps: parsedRecipe.steps.length > 0
        ? parsedRecipe.steps.map((step, index) => ({
            order: index + 1,
            description: step.description || "",
            duration: Number.isFinite(step.duration) ? step.duration : 0,
            timeUnit: "分钟",
            ingredients: Array.isArray(step.ingredients) ? step.ingredients.map(ing => ({
              ingredientId: ing.ingredientId || "",
              name: ing.name || "",
              amount: ing.amount || 0,
              unit: ing.unit || "",
            })) : [],
          }))
        : [{ order: 1, description: "", duration: 5, timeUnit: "分钟", ingredients: [] }],
    });
    setParsedRecipe(null);
    setActiveTab("manual");
  }

  function convertManualToParsedRecipe(): ParsedRecipe {
    return {
      name: manualRecipe.name,
      totalTime: manualRecipe.totalTime,
      ingredients: manualRecipe.ingredients.map((ing, index) => ({
        id: `ing-${index}`,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        scalable: true,
      })),
      steps: manualRecipe.steps.map((step, index) => {
        let durationInMinutes = step.duration;
        if (step.timeUnit === "秒") {
          durationInMinutes = Math.ceil(step.duration / 60);
        } else if (step.timeUnit === "小时") {
          durationInMinutes = step.duration * 60;
        }
        return {
          order: step.order,
          description: step.description,
          duration: durationInMinutes,
          ingredients: step.ingredients,
        };
      }),
    };
  }

  function convertParsedToManualRecipe(parsed: ParsedRecipe): typeof manualRecipe {
    return {
      name: parsed.name || "",
      totalTime: parsed.totalTime || 0,
      ingredients: parsed.ingredients.length > 0
        ? parsed.ingredients.map((ing) => ({
            name: ing.name || "",
            amount: Number.isFinite(ing.amount) ? ing.amount : 0,
            unit: ing.unit || "个",
          }))
        : [{ name: "", amount: 1, unit: "个" }],
      steps: parsed.steps.length > 0
        ? parsed.steps.map((step, index) => ({
            order: index + 1,
            description: step.description || "",
            duration: Number.isFinite(step.duration) ? step.duration : 0,
            timeUnit: "分钟" as const,
            ingredients: Array.isArray(step.ingredients) ? step.ingredients.map(ing => ({
              ingredientId: ing.ingredientId || "",
              name: ing.name || "",
              amount: ing.amount || 0,
              unit: ing.unit || "",
            })) : [],
          }))
        : [{ order: 1, description: "", duration: 5, timeUnit: "分钟" as const, ingredients: [] }],
    };
  }

  async function handleManualOptimize() {
    if (!manualRecipe.name) {
      setError("请先填写菜名");
      return;
    }

    setManualOptimizing(true);
    setError("");
    setManualOriginal(JSON.parse(JSON.stringify(manualRecipe)));

    try {
      const parsedRecipe = convertManualToParsedRecipe();
      const optimized = await optimizeRecipe(parsedRecipe);
      const converted = convertParsedToManualRecipe(optimized);
      setManualOptimized(converted);
      setShowManualComparison(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "优化失败，请重试");
      setManualOriginal(null);
    } finally {
      setManualOptimizing(false);
    }
  }

  function applyManualOptimization() {
    if (!manualOptimized) return;
    setManualRecipe(manualOptimized);
    setShowManualComparison(false);
    setManualOriginal(null);
    setManualOptimized(null);
  }

  function cancelManualOptimization() {
    setShowManualComparison(false);
    setManualOriginal(null);
    setManualOptimized(null);
  }

  const tabs = [
    { id: "manual" as const, label: "手动导入", icon: FileText },
    { id: "text" as const, label: "文本导入", icon: FileText },
    { id: "image" as const, label: "图片导入", icon: Camera },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-4 flex items-center gap-4 safe-top">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">导入食谱</h1>
      </header>

      <div className="px-4">
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setInputValue("");
                setParsedRecipe(null);
                setError("");
                setShowRetry(false);
                setCoverImageUrl(undefined);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {activeTab === "manual" ? (
          showManualComparison && manualOriginal && manualOptimized ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-gray-400 rounded-full" />
                    <span className="text-sm font-medium text-gray-600">原版</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">{manualOriginal.name}</h4>
                  <p className="text-sm text-gray-500 mb-3">总时长：{manualOriginal.totalTime} 分钟</p>
                  
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">食材</p>
                    <div className="space-y-1">
                      {manualOriginal.ingredients.map((ing, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{ing.name}</span>
                          <span className="text-gray-500">{ing.amount} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-400 mb-1">步骤 ({manualOriginal.steps.length}步)</p>
                    <div className="space-y-2">
                      {manualOriginal.steps.map((step, i) => (
                        <div key={i} className="text-sm text-gray-600">
                          <span className="text-gray-400">{i + 1}.</span> {formatStepDescription(step.description)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-primary-500 rounded-full" />
                    <span className="text-sm font-medium text-primary-600">AI优化版</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">{manualOptimized.name}</h4>
                  <p className="text-sm text-gray-500 mb-3">总时长：{manualOptimized.totalTime} 分钟</p>
                  
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">食材</p>
                    <div className="space-y-1">
                      {manualOptimized.ingredients.map((ing, i) => {
                        const originalIng = manualOriginal.ingredients.find(o => o.name === ing.name);
                        const isAmountChanged = !originalIng || 
                          originalIng.amount !== ing.amount || 
                          originalIng.unit !== ing.unit;
                        const isNewIngredient = !originalIng;
                        return (
                          <div key={i} className="flex justify-between text-sm">
                            <span className={isNewIngredient ? "text-primary-600 font-medium" : ""}>{ing.name}</span>
                            <span className={isAmountChanged ? "text-primary-600 font-medium" : "text-gray-500"}>{ing.amount} {ing.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-400 mb-1">步骤 ({manualOptimized.steps.length}步)</p>
                    <div className="space-y-2">
                      {manualOptimized.steps.map((step, i) => (
                        <div key={i} className="text-sm text-gray-700">
                          <div><span className="text-primary-400">{i + 1}.</span> {formatStepDescription(step.description)}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 pl-4">
                            {step.duration > 0 && (
                              <div className="text-xs text-gray-400">⏱ 预计时长：{step.duration}分钟</div>
                            )}
                            {step.ingredients && step.ingredients.length > 0 && (
                              <div className="text-xs text-gray-400">
                                📦 {step.ingredients.map(ing => `${ing.name} ${ing.amount}${ing.unit}`).join('、')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowManualComparison(false);
                    setManualOriginal(null);
                    setManualOptimized(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium"
                >
                  修改优化食谱
                </button>
                <button
                  onClick={() => {
                    if (manualOptimized) {
                      setManualRecipe(manualOptimized);
                    }
                    setShowManualComparison(false);
                    setManualOriginal(null);
                    setManualOptimized(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium"
                >
                  保存食谱
                </button>
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">菜名</label>
              <input
                type="text"
                value={manualRecipe.name}
                onChange={(e) => setManualRecipe(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：番茄炒蛋"
                className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">总时长（分钟）</label>
              <input
                type="number"
                value={manualRecipe.totalTime}
                onChange={(e) => setManualRecipe(prev => ({ ...prev, totalTime: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">封面图（可选）</label>
              {coverImageUrl ? (
                <div className="relative inline-block">
                  <img
                    src={coverImageUrl}
                    alt="封面预览"
                    className="w-24 h-24 object-cover rounded-xl"
                  />
                  <button
                    onClick={() => setCoverImageUrl(undefined)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <Camera className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">上传封面图</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setCoverImageUrl(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">食材清单</label>
                <button onClick={addIngredient} className="text-primary-500 text-sm">+ 添加食材</button>
              </div>
              <div className="space-y-3">
                {manualRecipe.ingredients.map((ing, index) => (
                  <div key={index} className="flex gap-2 items-center flex-nowrap">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(index, "name", e.target.value)}
                      placeholder="食材名"
                      className="flex-1 min-w-0 px-3 py-2.5 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <input
                      type="number"
                      value={ing.amount}
                      onChange={(e) => updateIngredient(index, "amount", parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-2.5 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-center flex-shrink-0"
                    />
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowUnitPicker(showUnitPicker === index ? null : index)}
                        className="min-w-[60px] px-2 py-2.5 bg-gray-100 rounded-xl flex items-center justify-between gap-1"
                      >
                        <span className="whitespace-nowrap text-sm">{ing.unit}</span>
                        <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      </button>
                      {showUnitPicker === index && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto min-w-[100px]">
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
                    {manualRecipe.ingredients.length > 1 && (
                      <button onClick={() => removeIngredient(index)} className="text-red-500 p-1.5 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
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
              <div className="space-y-4">
                {manualRecipe.steps.map((step, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-2">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={step.description}
                        onChange={(e) => updateStep(index, "description", e.target.value)}
                        placeholder="步骤描述"
                        className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[60px] resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 whitespace-nowrap">预计时长</span>
                        <input
                          type="number"
                          value={step.duration}
                          onChange={(e) => updateStep(index, "duration", parseInt(e.target.value) || 0)}
                          className="w-20 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                          {TIME_UNITS.map((unit) => (
                            <button
                              key={unit.value}
                              type="button"
                              onClick={() => updateStep(index, "timeUnit", unit.value)}
                              className={`px-2 py-0.5 rounded text-sm transition-colors whitespace-nowrap ${
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
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-gray-500">所需食材：</span>
                        {manualRecipe.ingredients.filter(ing => ing.name).map((ing) => (
                          <button
                            key={ing.name}
                            type="button"
                            onClick={() => {
                              setManualRecipe(prev => ({
                                ...prev,
                                steps: prev.steps.map((s, i) =>
                                  i === index
                                    ? {
                                        ...s,
                                        relatedIngredients: s.relatedIngredients.includes(ing.name)
                                          ? s.relatedIngredients.filter(n => n !== ing.name)
                                          : [...s.relatedIngredients, ing.name]
                                      }
                                    : s
                                ),
                              }));
                            }}
                            className={`px-2 py-1 rounded-full text-xs transition-colors ${
                              step.relatedIngredients.includes(ing.name)
                                ? "bg-primary-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {ing.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {manualRecipe.steps.length > 1 && (
                      <button onClick={() => removeStep(index)} className="text-red-500 p-2 flex-shrink-0 mt-2">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleManualOptimize}
                disabled={manualOptimizing || loading || !manualRecipe.name}
                className="flex-1 py-3 rounded-xl border border-primary-500 text-primary-500 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {manualOptimizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    优化中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    AI优化
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !manualRecipe.name}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存食谱"
                )}
              </button>
            </div>
          </div>
          )
        ) : !parsedRecipe ? (
          <>
            {activeTab === "image" ? (
              <div className="space-y-4">
                {inputValue ? (
                  <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
                    <img
                      src={inputValue}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => {
                        setInputValue("");
                        setParsedRecipe(null);
                        setCoverImageUrl(undefined);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <label className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/50 rounded-lg flex items-center gap-1.5 text-white text-sm cursor-pointer hover:bg-black/70 transition-colors">
                      <Camera className="w-4 h-4" />
                      <span>重新上传</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                      <Camera className="w-10 h-10 mb-2" />
                      <span className="text-sm">点击上传图片</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            ) : activeTab === "text" ? (
              <div className="space-y-4">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="粘贴食谱内容，包括食材和步骤..."
                  className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[200px] resize-none"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">封面图（可选）</label>
                  {coverImageUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={coverImageUrl}
                        alt="封面预览"
                        className="w-24 h-24 object-cover rounded-xl"
                      />
                      <button
                        onClick={() => setCoverImageUrl(undefined)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <Camera className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">上传封面图</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setCoverImageUrl(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            ) : null}

            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={handleParse}
              disabled={loading || !inputValue.trim()}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  {activeTab === "text" ? "AI文本解析" : "AI图片解析"}
                </>
              )}
            </button>
          </>
        ) : showComparison && originalRecipe ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-gray-400 rounded-full" />
                  <span className="text-sm font-medium text-gray-600">原版</span>
                </div>
                <h4 className="font-bold text-lg mb-2">{originalRecipe.name}</h4>
                <p className="text-sm text-gray-500 mb-3">总时长：{originalRecipe.totalTime} 分钟</p>
                
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">食材</p>
                  <div className="space-y-1">
                    {originalRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{ing.name}</span>
                        <span className="text-gray-500">{ing.amount} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-400 mb-1">步骤 ({originalRecipe.steps.length}步)</p>
                  <div className="space-y-2">
                    {originalRecipe.steps.map((step, i) => (
                      <div key={i} className="text-sm text-gray-600">
                        <span className="text-gray-400">{i + 1}.</span> {formatStepDescription(step.description)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-primary-500 rounded-full" />
                  <span className="text-sm font-medium text-primary-600">AI优化版</span>
                </div>
                <h4 className="font-bold text-lg mb-2">{parsedRecipe.name}</h4>
                <p className="text-sm text-gray-500 mb-3">总时长：{parsedRecipe.totalTime} 分钟</p>
                
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">食材</p>
                  <div className="space-y-1">
                    {parsedRecipe.ingredients.map((ing, i) => {
                      const originalIng = originalRecipe.ingredients.find(o => o.name === ing.name);
                      const isAmountChanged = !originalIng || 
                        originalIng.amount !== ing.amount || 
                        originalIng.unit !== ing.unit;
                      const isNewIngredient = !originalIng;
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <span className={isNewIngredient ? "text-primary-600 font-medium" : ""}>{ing.name}</span>
                          <span className={isAmountChanged ? "text-primary-600 font-medium" : "text-gray-500"}>{ing.amount} {ing.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-400 mb-1">步骤 ({parsedRecipe.steps.length}步)</p>
                  <div className="space-y-2">
                    {parsedRecipe.steps.map((step, i) => (
                      <div key={i} className="text-sm text-gray-700">
                        <div><span className="text-primary-400">{i + 1}.</span> {formatStepDescription(step.description)}</div>
                        {step.duration > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5 pl-4">⏱ 预计时长：{step.duration}分钟</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowComparison(false);
                  setOriginalRecipe(null);
                }}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                修改优化食谱
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存食谱"
                )}
              </button>
            </div>
          </div>
        ) : isEditing && editingRecipe ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  value={editingRecipe.name}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                  className="text-xl font-bold w-full bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500 pb-1"
                  placeholder="菜名"
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-500">总时长：</span>
                  <input
                    type="number"
                    value={editingRecipe.totalTime}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, totalTime: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-gray-100 rounded-lg text-sm text-center"
                  />
                  <span className="text-sm text-gray-500">分钟</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingRecipe(null);
                  }}
                  className="text-sm text-gray-500 px-3 py-1 rounded-lg border border-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setParsedRecipe(editingRecipe);
                    setIsEditing(false);
                    setEditingRecipe(null);
                  }}
                  className="text-sm text-white px-3 py-1 rounded-lg bg-primary-500"
                >
                  保存
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">食材清单</h3>
                <button
                  onClick={() => setEditingRecipe({
                    ...editingRecipe,
                    ingredients: [...editingRecipe.ingredients, { name: "", amount: 0, unit: "克" }]
                  })}
                  className="text-primary-500 text-sm"
                >
                  + 添加食材
                </button>
              </div>
              <div className="space-y-2">
                {editingRecipe.ingredients.map((ing, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => {
                        const newIngredients = [...editingRecipe.ingredients];
                        newIngredients[index] = { ...newIngredients[index], name: e.target.value };
                        setEditingRecipe({ ...editingRecipe, ingredients: newIngredients });
                      }}
                      placeholder="食材名"
                      className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm"
                    />
                    <input
                      type="number"
                      value={ing.amount || ""}
                      onChange={(e) => {
                        const newIngredients = [...editingRecipe.ingredients];
                        newIngredients[index] = { ...newIngredients[index], amount: parseFloat(e.target.value) || 0 };
                        setEditingRecipe({ ...editingRecipe, ingredients: newIngredients });
                      }}
                      className="w-16 px-2 py-2 bg-gray-100 rounded-xl text-sm text-center"
                    />
                    <select
                      value={ing.unit}
                      onChange={(e) => {
                        const newIngredients = [...editingRecipe.ingredients];
                        newIngredients[index] = { ...newIngredients[index], unit: e.target.value };
                        setEditingRecipe({ ...editingRecipe, ingredients: newIngredients });
                      }}
                      className="px-2 py-2 bg-gray-100 rounded-xl text-sm"
                    >
                      {INGREDIENT_UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                    {editingRecipe.ingredients.length > 1 && (
                      <button
                        onClick={() => {
                          const newIngredients = editingRecipe.ingredients.filter((_, i) => i !== index);
                          setEditingRecipe({ ...editingRecipe, ingredients: newIngredients });
                        }}
                        className="text-red-500 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">制作步骤</h3>
                <button
                  onClick={() => setEditingRecipe({
                    ...editingRecipe,
                    steps: [...editingRecipe.steps, { order: editingRecipe.steps.length + 1, description: "", duration: 0, relatedIngredients: [] }]
                  })}
                  className="text-primary-500 text-sm"
                >
                  + 添加步骤
                </button>
              </div>
              <div className="space-y-3">
                {editingRecipe.steps.map((step, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-2">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={step.description}
                        onChange={(e) => {
                          const newSteps = [...editingRecipe.steps];
                          newSteps[index] = { ...newSteps[index], description: e.target.value };
                          setEditingRecipe({ ...editingRecipe, steps: newSteps });
                        }}
                        placeholder="步骤描述"
                        className="w-full px-3 py-2 bg-gray-100 rounded-xl text-sm min-h-[60px] resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">预计时长</span>
                        <input
                          type="number"
                          value={step.duration || ""}
                          onChange={(e) => {
                            const newSteps = [...editingRecipe.steps];
                            newSteps[index] = { ...newSteps[index], duration: parseInt(e.target.value) || 0 };
                            setEditingRecipe({ ...editingRecipe, steps: newSteps });
                          }}
                          className="w-16 px-2 py-1 bg-gray-100 rounded-lg text-xs text-center"
                        />
                        <span className="text-xs text-gray-500">分钟</span>
                      </div>
                    </div>
                    {editingRecipe.steps.length > 1 && (
                      <button
                        onClick={() => {
                          const newSteps = editingRecipe.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
                          setEditingRecipe({ ...editingRecipe, steps: newSteps });
                        }}
                        className="text-red-500 p-1 mt-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              {!hasOptimized && (
                <button
                  onClick={handleOptimize}
                  disabled={optimizing}
                  className="flex-1 py-3 rounded-xl border border-primary-500 text-primary-500 font-medium flex items-center justify-center gap-2"
                >
                  {optimizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      优化中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      AI智能优化
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存食谱"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{parsedRecipe.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  总时长：{parsedRecipe.totalTime} 分钟
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingRecipe(JSON.parse(JSON.stringify(parsedRecipe)));
                  setIsEditing(true);
                }}
                className="text-sm text-primary-500 flex items-center gap-1"
              >
                编辑
              </button>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">食材清单</h3>
              <div className="space-y-2">
                {parsedRecipe.ingredients.map((ing, index) => (
                  <div
                    key={index}
                    className="flex justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span>{ing.name}</span>
                    <span className="text-gray-500">
                      {ing.amount} {formatUnit(ing.unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">制作步骤</h3>
              <div className="space-y-3">
                {parsedRecipe.steps.map((step) => (
                  <div key={step.order} className="flex gap-3">
                    <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {step.order}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700">{formatStepDescription(step.description)}</p>
                      {step.duration > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          ⏱ 预计时长：{step.duration}分钟
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              {!hasOptimized && (
                <button
                  onClick={handleOptimize}
                  disabled={optimizing}
                  className="flex-1 py-3 rounded-xl border border-primary-500 text-primary-500 font-medium flex items-center justify-center gap-2"
                >
                  {optimizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      优化中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      AI智能优化
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className={`${hasOptimized ? 'flex-1' : 'flex-1'} btn-primary flex items-center justify-center gap-2`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存食谱"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {(showUnitPicker !== null || showEditUnitPicker !== null) && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => {
            setShowUnitPicker(null);
            setShowEditUnitPicker(null);
          }}
        />
      )}


    </div>
  );
}
