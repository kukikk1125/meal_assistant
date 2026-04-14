"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Play, Pause, RotateCcw, X, List, Lightbulb, ChefHat } from "lucide-react";
import { getRecipe, Recipe } from "@/lib/supabase";
import { getOptimizedRecipe } from "@/lib/recipe-adjustment-service";
import { useCookingStore, useRecipeStore } from "@/store";
import PhotoCheckButton from "@/components/PhotoCheckButton";

export default function CookPage() {
  const params = useParams();
  const recipeId = params.id as string;
  const searchParams = useSearchParams();
  const version = searchParams.get("version") || "original";
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
    clearSubstitutions,
    startSession,
    currentSession
  } = useCookingStore();
  const { 
    currentRecipe, 
    setCurrentRecipe, 
    scaleFactor,
    clearTempAdjustments,
    sessionRecipe,
    tempAdjustments,
  } = useRecipeStore();
  
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
      
      if (!currentRecipe || currentRecipe.id !== recipeId) {
        const optimizedVersion = await getOptimizedRecipe(recipeId);
        
        if (optimizedVersion) {
          const mappedIngredients = optimizedVersion.ingredients.map((ing) => ({
            id: ing.id || "",
            name: ing.name || "",
            amount: ing.adjusted_amount ?? 0,
            unit: ing.adjusted_unit ?? "",
            is_optional: false,
          }));
          
          const mappedSteps = optimizedVersion.steps.map((step) => ({
            id: `step-${step.order}`,
            order: step.order,
            description: step.description,
            duration: step.duration,
            is_key_step: false,
            tip: step.tip,
            ingredients: step.ingredients,
          }));
          
          const optimizedRecipe: Recipe = {
            id: recipeId,
            name: optimizedVersion.name,
            total_time: optimizedVersion.total_time,
            servings: 1,
            ingredients: mappedIngredients,
            steps: mappedSteps,
            image_url: data.image_url,
            user_id: data.user_id,
            created_at: data.created_at,
            updated_at: data.updated_at || new Date().toISOString(),
          };
          
          setCurrentRecipe(optimizedRecipe);
        } else {
          setCurrentRecipe(data);
        }
        
        setCurrentStepIndex(0);
        const steps = optimizedVersion ? optimizedVersion.steps : data.steps;
        if (steps.length > 0) {
          resetTimer(steps[0].duration * 60);
        }
        startSession(data.id, data.name);
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
    if (!sessionRecipe) return;
    
    if (currentStepIndex >= sessionRecipe.steps.length - 1) {
      setCompleted(true);
    } else {
      nextStep();
      resetTimer(sessionRecipe.steps[currentStepIndex + 1].duration * 60);
    }
  }

  function handlePrevStep() {
    if (!sessionRecipe || currentStepIndex === 0) return;
    
    prevStep();
    resetTimer(sessionRecipe.steps[currentStepIndex - 1].duration * 60);
  }

  function getStepIngredients(step: { 
    description: string; 
    ingredients?: Array<{ ingredientId: string; name: string; amount: number; unit: string }> 
  }) {
    if (!sessionRecipe) return [];
    
    const stepIngredients: Array<{
      id: string;
      name: string;
      amount: number | null;
      unit: string;
    }> = [];

    const removedIngredientIds = new Set(
      tempAdjustments
        .filter(adj => adj.action === "remove")
        .map(adj => adj.ingredientId)
    );

    const removedIngredientNames = new Set(
      tempAdjustments
        .filter(adj => adj.action === "remove")
        .map(adj => adj.ingredientName.toLowerCase())
    );

    console.log('[DEBUG] getStepIngredients', {
      stepDescription: step.description,
      stepIngredientsField: step.ingredients,
      tempAdjustments,
      removedIngredientIds: Array.from(removedIngredientIds),
      removedIngredientNames: Array.from(removedIngredientNames)
    });

    if (step.ingredients && step.ingredients.length > 0) {
      step.ingredients.forEach(stepIng => {
        const isRemovedById = removedIngredientIds.has(stepIng.ingredientId);
        const isRemovedByName = removedIngredientNames.has(stepIng.name.toLowerCase());
        
        console.log('[DEBUG] Checking stepIng:', stepIng.name, { isRemovedById, isRemovedByName });
        
        if (isRemovedById || isRemovedByName) {
          console.log('[DEBUG] Skipping removed ingredient:', stepIng.name);
          return;
        }
        
        let sessionIng = sessionRecipe.ingredients.find(i => i.id === stepIng.ingredientId);
        
        if (!sessionIng) {
          sessionIng = sessionRecipe.ingredients.find(i => 
            i.name.toLowerCase() === stepIng.name.toLowerCase()
          );
        }
        
        if (!sessionIng) {
          const adjustment = tempAdjustments.find(a => 
            a.ingredientName.toLowerCase() === stepIng.name.toLowerCase()
          );
          if (adjustment) {
            sessionIng = sessionRecipe.ingredients.find(i => 
              i.id === adjustment.ingredientId
            );
          }
        }
        
        stepIngredients.push({
          id: sessionIng?.id || stepIng.ingredientId,
          name: sessionIng?.name || stepIng.name,
          amount: sessionIng?.amount ?? stepIng.amount,
          unit: sessionIng?.unit || stepIng.unit,
        });
      });
    }
    
    if (stepIngredients.length === 0) {
      const description = step.description.toLowerCase();
      console.log('[DEBUG] Matching from description:', description);
      
      sessionRecipe.ingredients.forEach(ingredient => {
        const ingredientName = ingredient.name.toLowerCase();
        const isRemovedById = removedIngredientIds.has(ingredient.id);
        const isRemovedByName = removedIngredientNames.has(ingredientName);
        
        console.log('[DEBUG] Checking ingredient from sessionRecipe:', ingredient.name, { 
          isRemovedById, 
          isRemovedByName,
          includesInDescription: description.includes(ingredientName)
        });
        
        if (isRemovedById || isRemovedByName) {
          console.log('[DEBUG] Skipping removed ingredient (from description match):', ingredient.name);
          return;
        }
        
        if (description.includes(ingredientName)) {
          if (!stepIngredients.find(i => i.id === ingredient.id)) {
            console.log('[DEBUG] Adding ingredient (from description match):', ingredient.name);
            stepIngredients.push({
              id: ingredient.id,
              name: ingredient.name,
              amount: ingredient.amount,
              unit: ingredient.unit,
            });
          }
        }
      });
      
      if (currentRecipe) {
        currentRecipe.ingredients.forEach(originalIng => {
          const originalName = originalIng.name.toLowerCase();
          const isRemovedById = removedIngredientIds.has(originalIng.id);
          const isRemovedByName = removedIngredientNames.has(originalName);
          
          console.log('[DEBUG] Checking original ingredient:', originalIng.name, { 
            isRemovedById, 
            isRemovedByName,
            includesInDescription: description.includes(originalName)
          });
          
          if (isRemovedById || isRemovedByName) {
            console.log('[DEBUG] Skipping removed original ingredient:', originalIng.name);
            return;
          }
          
          if (description.includes(originalName)) {
            const sessionIng = sessionRecipe.ingredients.find(i => i.id === originalIng.id);
            if (sessionIng && !stepIngredients.find(i => i.id === originalIng.id)) {
              console.log('[DEBUG] Adding original ingredient:', originalIng.name);
              stepIngredients.push({
                id: originalIng.id,
                name: sessionIng.name,
                amount: sessionIng.amount,
                unit: sessionIng.unit,
              });
            }
          }
        });
      }
    }
    
    console.log('[DEBUG] Final stepIngredients:', stepIngredients);
    
    return stepIngredients;
  }

  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sessionRecipe) {
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
          您已完成 {sessionRecipe.name} 的制作
        </p>
        <Link href={`/recipe/${sessionRecipe.id}/log/new`}>
          <button className="bg-white text-primary-600 px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg">
            记录做菜日志
          </button>
        </Link>
        <button 
          onClick={() => {
            clearTempAdjustments();
            router.push(`/recipe/${sessionRecipe.id}`);
          }}
          className="mt-4 text-primary-100 underline"
        >
          返回食谱详情
        </button>
      </div>
    );
  }

  const currentStep = sessionRecipe.steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / sessionRecipe.steps.length) * 100;
  const stepIngredients = getStepIngredients(currentStep);
  
  console.log("=== Cook Page Render ===");
  console.log("sessionRecipe:", sessionRecipe?.name);
  console.log("sessionRecipe.steps[currentStepIndex]:", sessionRecipe?.steps[currentStepIndex]);
  console.log("tempAdjustments:", tempAdjustments);
  console.log("stepIngredients:", stepIngredients);

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
          <span className="text-gray-400">{sessionRecipe.steps.length} 步</span>
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
      <div className="h-1 bg-gray-800">
        <div 
          className="h-full bg-primary-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          {/* Step Description */}
          <div className="bg-gray-800 rounded-2xl p-6 mb-4">
            <p className="text-lg leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Tip */}
          {currentStep.tip && (
            <div className="bg-primary-900/30 border border-primary-500/30 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                <p className="text-primary-200 text-sm">{currentStep.tip}</p>
              </div>
            </div>
          )}

          {/* Step Ingredients */}
          {stepIngredients.length > 0 && (
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <h3 className="text-sm text-gray-400 mb-3">本步骤食材</h3>
              <div className="space-y-2">
                {stepIngredients.map((ing) => (
                  <div key={ing.id} className="flex justify-between items-center">
                    <span className="text-gray-200">{ing.name}</span>
                    <span className="text-gray-400 text-sm">
                      {ing.amount} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timer */}
          {currentStep.duration > 0 && (
            <div className="bg-gray-800 rounded-2xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-400" />
                  <span className="text-gray-400">计时器</span>
                </div>
                <span className="text-3xl font-mono font-bold text-white">
                  {formatTime(remainingTime)}
                </span>
              </div>
              
              <div className="flex gap-2">
                {!isTimerRunning ? (
                  <button
                    onClick={() => startTimer(remainingTime)}
                    className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    开始
                  </button>
                ) : (
                  <button
                    onClick={pauseTimer}
                    className="flex-1 bg-yellow-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Pause className="w-5 h-5" />
                    暂停
                  </button>
                )}
                <button
                  onClick={() => resetTimer(currentStep.duration * 60)}
                  className="px-4 py-3 bg-gray-700 text-gray-300 rounded-xl"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <footer className="bg-gray-900/95 backdrop-blur border-t border-gray-800 p-4 safe-bottom">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={handlePrevStep}
            disabled={currentStepIndex === 0}
            className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl font-medium flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </button>
          
          <PhotoCheckButton
            stepId={currentStep.id}
            stepNumber={currentStepIndex + 1}
            stepDescription={currentStep.description}
            recipeId={sessionRecipe.id}
            recipeName={sessionRecipe.name}
            prevStep={currentStepIndex > 0 ? sessionRecipe.steps[currentStepIndex - 1].description : undefined}
            nextStep={currentStepIndex < sessionRecipe.steps.length - 1 ? sessionRecipe.steps[currentStepIndex + 1].description : undefined}
          />
          
          <button
            onClick={handleNextStep}
            className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-1 text-sm"
          >
            {currentStepIndex === sessionRecipe.steps.length - 1 ? "完成" : "下一步"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* All Ingredients Modal */}
      {showAllIngredients && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={() => setShowAllIngredients(false)}>
          <div 
            className="w-full max-w-md mx-auto bg-gray-800 rounded-t-3xl max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-800 px-4 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-lg">全部食材</h3>
              <button onClick={() => setShowAllIngredients(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {sessionRecipe.ingredients.map((ing) => (
                <div key={ing.id} className="flex justify-between items-center py-2">
                  <span className="text-gray-200">{ing.name}</span>
                  <span className="text-gray-400 text-sm">
                    {ing.amount} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
