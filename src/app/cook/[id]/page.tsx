"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Play, Pause, RotateCcw, X, List, Lightbulb, ChefHat } from "lucide-react";
import { getRecipe, Recipe } from "@/lib/supabase";
import { useCookingStore, useRecipeStore } from "@/store";

export default function CookPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const router = useRouter();
  const { 
    currentStepIndex, 
    isTimerRunning, 
    remainingTime, 
    setCurrentStepIndex,
    nextStep, 
    prevStep, 
    startTimer, 
    pauseTimer, 
    resetTimer, 
    tickTimer,
    getSubstitutedIngredient,
    ingredientSubstitutions,
    clearSubstitutions
  } = useCookingStore();
  const { scaleFactor, getScaledIngredients, setCurrentRecipe, currentRecipe: storeRecipe } = useRecipeStore();
  
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [showAllIngredients, setShowAllIngredients] = useState(false);

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && remainingTime > 0) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    } else if (remainingTime === 0 && isTimerRunning) {
      pauseTimer();
      playAlarm();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, remainingTime]);

  async function loadRecipe() {
    try {
      const data = await getRecipe(recipeId);
      setRecipe(data);
      
      if (!storeRecipe || storeRecipe.id !== recipeId) {
        setCurrentRecipe(data);
        setCurrentStepIndex(0);
        clearSubstitutions();
        if (data.steps.length > 0) {
          resetTimer(data.steps[0].duration * 60);
        }
      }
    } catch (error) {
      console.error("Failed to load recipe:", error);
    } finally {
      setLoading(false);
    }
  }

  function playAlarm() {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    setTimeout(() => oscillator.stop(), 500);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function handleNextStep() {
    if (!recipe) return;
    
    if (currentStepIndex >= recipe.steps.length - 1) {
      setCompleted(true);
    } else {
      nextStep();
      resetTimer(recipe.steps[currentStepIndex + 1].duration * 60);
    }
  }

  function handlePrevStep() {
    if (!recipe || currentStepIndex === 0) return;
    
    prevStep();
    resetTimer(recipe.steps[currentStepIndex - 1].duration * 60);
  }

  function getSubstitutedStepDescription(description: string): string {
    if (!recipe) return description;
    
    const scaledIngredients = getScaledIngredients();
    let result = description;

    scaledIngredients.forEach(ingredient => {
      const substitution = getSubstitutedIngredient(ingredient.id);
      const displayName = substitution?.name || ingredient.name;
      const displayUnit = substitution?.unit || ingredient.unit;
      
      const patterns = [
        new RegExp(escapeRegExp(ingredient.name), 'g'),
      ];

      patterns.forEach(pattern => {
        result = result.replace(pattern, `${displayName}`);
      });
    });

    return result;
  }

  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getStepIngredients(step: { 
    description: string; 
    ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }> 
  }) {
    if (!recipe) return [];
    
    const scaledIngredients = getScaledIngredients();
    const stepIngredients: Array<{
      id: string;
      name: string;
      amount: number;
      unit: string;
      isSubstituted: boolean;
      originalName?: string;
    }> = [];

    if (step.ingredients && step.ingredients.length > 0) {
      step.ingredients.forEach(stepIng => {
        const ingredient = scaledIngredients.find(ing => ing.id === stepIng.ingredientId);
        
        if (ingredient) {
          const substitution = getSubstitutedIngredient(ingredient.id);
          const scaledAmount = stepIng.amount * scaleFactor;
          
          stepIngredients.push({
            id: ingredient.id,
            name: substitution?.name || stepIng.name,
            amount: scaledAmount,
            unit: substitution?.unit || stepIng.unit,
            isSubstituted: !!substitution,
            originalName: substitution ? ingredient.name : undefined
          });
        } else {
          const scaledAmount = stepIng.amount * scaleFactor;
          stepIngredients.push({
            id: stepIng.ingredientId,
            name: stepIng.name,
            amount: scaledAmount,
            unit: stepIng.unit,
            isSubstituted: false
          });
        }
      });
    } else {
      scaledIngredients.forEach(ingredient => {
        const pattern = new RegExp(escapeRegExp(ingredient.name), 'i');
        if (pattern.test(step.description)) {
          const substitution = getSubstitutedIngredient(ingredient.id);
          if (!stepIngredients.find(i => i.id === ingredient.id)) {
            stepIngredients.push({
              id: ingredient.id,
              name: substitution?.name || ingredient.name,
              amount: ingredient.amount,
              unit: substitution?.unit || ingredient.unit,
              isSubstituted: !!substitution,
              originalName: substitution ? ingredient.name : undefined
            });
          }
        }
      });
    }

    return stepIngredients;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-gray-400">
        <ChefHat className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">食谱不存在</p>
        <button onClick={() => router.push("/")} className="btn-primary mt-6">
          返回首页
        </button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-700 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-8xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-3">恭喜完成！</h1>
        <p className="text-primary-100 text-lg mb-8 text-center">
          您已完成 {recipe.name} 的制作
        </p>
        <Link href={`/recipe/${recipe.id}/log/new`}>
          <button className="bg-white text-primary-600 px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg">
            记录做菜日志
          </button>
        </Link>
        <button 
          onClick={() => router.push(`/recipe/${recipe.id}`)}
          className="mt-4 text-primary-100 underline"
        >
          返回食谱详情
        </button>
      </div>
    );
  }

  const currentStep = recipe.steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / recipe.steps.length) * 100;
  const stepDescription = getSubstitutedStepDescription(currentStep.description);
  const stepIngredients = getStepIngredients(currentStep);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between bg-gray-900/95 backdrop-blur safe-top">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">返回</span>
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-sm font-bold">
            {currentStepIndex + 1}
          </div>
          <span className="text-gray-400">/</span>
          <span className="text-gray-400">{recipe.steps.length} 步</span>
        </div>
        
        <button 
          onClick={() => setShowAllIngredients(true)} 
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          <List className="w-5 h-5" />
          <span className="text-sm">食材</span>
        </button>
      </header>

      {/* Progress Bar */}
      <div className="px-4 py-2">
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Step Description */}
        <div className="bg-gray-800/50 rounded-2xl p-5">
          <p className="text-xl leading-relaxed font-medium">
            {stepDescription}
          </p>
        </div>

        {/* Timer Section */}
        {currentStep.duration > 0 && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-400" />
              <span className="text-gray-400">预计时间：{currentStep.duration} 分钟</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className={`text-6xl font-mono font-bold mb-5 ${isTimerRunning ? 'text-primary-400' : 'text-white'}`}>
                {formatTime(remainingTime)}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => isTimerRunning ? pauseTimer() : startTimer(remainingTime)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                    isTimerRunning
                      ? "bg-yellow-500 text-yellow-900 hover:bg-yellow-400"
                      : "bg-primary-500 text-white hover:bg-primary-400"
                  }`}
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-5 h-5" />
                      暂停
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      开始计时
                    </>
                  )}
                </button>
                <button
                  onClick={() => resetTimer(currentStep.duration * 60)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-gray-700 text-white hover:bg-gray-600 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  重置
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step Ingredients */}
        {stepIngredients.length > 0 && (
          <div className="bg-gray-800/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📦</span>
              <h3 className="font-medium text-gray-300">本步骤需要食材</h3>
              <span className="text-xs text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded-full">
                {scaleFactor}x 份量
              </span>
            </div>
            
            <div className="space-y-2">
              {stepIngredients.map((ing) => (
                <div
                  key={ing.id}
                  className="flex justify-between items-center bg-gray-700/50 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ing.name}</span>
                    {ing.isSubstituted && (
                      <span className="text-xs text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">
                        已替换
                      </span>
                    )}
                  </div>
                  <span className="text-primary-400 font-medium">
                    {ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        {currentStep.tip && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-100 text-sm leading-relaxed">{currentStep.tip}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="px-4 py-4 bg-gray-900/95 backdrop-blur border-t border-gray-800 safe-bottom">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevStep}
            disabled={currentStepIndex === 0}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-gray-800 text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            上一步
          </button>
          
          <button
            onClick={handleNextStep}
            className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-400 transition-all"
          >
            下一步
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* All Ingredients Modal */}
      {showAllIngredients && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={() => setShowAllIngredients(false)}>
          <div 
            className="w-full max-w-md mx-auto bg-gray-800 rounded-t-3xl max-h-[70vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-800 px-4 py-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">全部食材</h3>
                <span className="text-xs text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded-full">
                  {scaleFactor}x 份量
                </span>
              </div>
              <button 
                onClick={() => setShowAllIngredients(false)}
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-2">
              {getScaledIngredients().map((ing) => {
                const substitution = getSubstitutedIngredient(ing.id);
                const displayName = substitution?.name || ing.name;
                const displayUnit = substitution?.unit || ing.unit;
                const isSubstituted = !!substitution;
                
                return (
                  <div
                    key={ing.id}
                    className="flex justify-between items-center bg-gray-700/50 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{displayName}</span>
                      {isSubstituted && (
                        <span className="text-xs text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">
                          已替换
                        </span>
                      )}
                    </div>
                    <span className="text-primary-400 font-medium">
                      {ing.amount} {displayUnit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
