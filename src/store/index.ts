import { create } from 'zustand';
import { Recipe, Ingredient, Step } from '@/lib/supabase';

interface TempAdjustment {
  ingredientId: string;
  ingredientName: string;
  action: "replace" | "remove";
  replacement?: string;
  replacementAmount?: string;
}

interface IngredientRenderInfo {
  id: string;
  originalName: string;
  displayName: string;
  amount: number;
  unit: string;
  isRemoved: boolean;
  isReplaced: boolean;
  originalAmount?: number;
  originalUnit?: string;
}

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  scaleFactor: number;
  tempAdjustments: TempAdjustment[];
  sessionRecipe: Recipe | null;
  
  setRecipes: (recipes: Recipe[]) => void;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  setScaleFactor: (factor: number) => void;
  
  setTempAdjustments: (adjustments: TempAdjustment[]) => void;
  addTempAdjustment: (adjustment: TempAdjustment) => void;
  removeTempAdjustment: (ingredientId: string) => void;
  clearTempAdjustments: () => void;
  
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  
  getScaledIngredients: () => Ingredient[];
  getIngredientRenderMap: () => Map<string, IngredientRenderInfo>;
  getRemovedIngredients: () => string[];
  getReplacedIngredients: () => Map<string, { originalName: string; replacementName: string }>;
}

function computeSessionRecipe(currentRecipe: Recipe | null, tempAdjustments: TempAdjustment[], scaleFactor: number): Recipe | null {
  if (!currentRecipe) return null;
  
  const removedIds = new Set(
    tempAdjustments
      .filter(a => a.action === "remove")
      .map(a => a.ingredientId)
  );
  
  const replacedNames = new Map<string, string>();
  tempAdjustments.forEach(a => {
    if (a.action === "replace" && a.replacement) {
      replacedNames.set(a.ingredientId, a.replacement);
    }
  });
  
  const sessionIngredients = currentRecipe.ingredients
    .filter(ing => !removedIds.has(ing.id))
    .map(ing => {
      const replacement = replacedNames.get(ing.id);
      if (replacement) {
        return {
          ...ing,
          name: replacement,
          amount: Math.round(ing.amount * scaleFactor * 10) / 10,
        };
      }
      return {
        ...ing,
        amount: Math.round(ing.amount * scaleFactor * 10) / 10,
      };
    });
  
  const escapeRegExp = (string: string) => 
    string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const sessionSteps = currentRecipe.steps.map(step => {
    let processedDescription = step.description;
    
    currentRecipe.ingredients.forEach(ing => {
      if (removedIds.has(ing.id)) {
        const escapedName = escapeRegExp(ing.name);
        const patterns = [
          new RegExp(`[、，,]?\\s*${escapedName}\\s*[、，,]?`, 'g'),
          new RegExp(escapedName, 'g'),
        ];
        patterns.forEach(pattern => {
          processedDescription = processedDescription.replace(pattern, '');
        });
      } else if (replacedNames.has(ing.id)) {
        const escapedName = escapeRegExp(ing.name);
        const replacement = replacedNames.get(ing.id)!;
        const pattern = new RegExp(escapedName, 'g');
        processedDescription = processedDescription.replace(pattern, replacement);
      }
    });
    
    processedDescription = processedDescription
      .replace(/[、，,]{2,}/g, '、')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!step.ingredients || step.ingredients.length === 0) {
      return {
        ...step,
        description: processedDescription,
        duration: step.duration,
      };
    }
    
    const filteredStepIngredients = step.ingredients.filter(
      stepIng => !removedIds.has(stepIng.ingredientId)
    );
    
    const updatedStepIngredients = filteredStepIngredients.map(stepIng => {
      const replacement = replacedNames.get(stepIng.ingredientId);
      if (replacement) {
        return {
          ...stepIng,
          name: replacement,
        };
      }
      return stepIng;
    });
    
    return {
      ...step,
      description: processedDescription,
      ingredients: updatedStepIngredients,
      duration: step.duration,
    };
  });
  
  return {
    ...currentRecipe,
    ingredients: sessionIngredients,
    steps: sessionSteps,
  };
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  currentRecipe: null,
  scaleFactor: 1,
  tempAdjustments: [],
  sessionRecipe: null,
  
  setRecipes: (recipes) => set({ recipes }),
  setCurrentRecipe: (recipe) => {
    set((state) => {
      const isDifferentRecipe = state.currentRecipe?.id !== recipe?.id;
      const newAdjustments = isDifferentRecipe ? [] : state.tempAdjustments;
      const newSessionRecipe = computeSessionRecipe(recipe, newAdjustments, isDifferentRecipe ? 1 : state.scaleFactor);
      return { 
        currentRecipe: recipe, 
        scaleFactor: isDifferentRecipe ? 1 : state.scaleFactor, 
        tempAdjustments: newAdjustments,
        sessionRecipe: newSessionRecipe,
      };
    });
  },
  setScaleFactor: (factor) => {
    set((state) => {
      const newSessionRecipe = computeSessionRecipe(state.currentRecipe, state.tempAdjustments, factor);
      return { 
        scaleFactor: factor,
        sessionRecipe: newSessionRecipe,
      };
    });
  },
  
  setTempAdjustments: (adjustments) => {
    set((state) => {
      const newSessionRecipe = computeSessionRecipe(state.currentRecipe, adjustments, state.scaleFactor);
      return { 
        tempAdjustments: adjustments,
        sessionRecipe: newSessionRecipe,
      };
    });
  },
  
  addTempAdjustment: (adjustment) => {
    set((state) => {
      const existing = state.tempAdjustments.find(a => a.ingredientId === adjustment.ingredientId);
      let newAdjustments;
      
      if (existing) {
        newAdjustments = state.tempAdjustments.map(a =>
          a.ingredientId === adjustment.ingredientId ? adjustment : a
        );
      } else {
        newAdjustments = [...state.tempAdjustments, adjustment];
      }
      
      const newSessionRecipe = computeSessionRecipe(state.currentRecipe, newAdjustments, state.scaleFactor);
      return { 
        tempAdjustments: newAdjustments,
        sessionRecipe: newSessionRecipe,
      };
    });
  },
  
  removeTempAdjustment: (ingredientId) => {
    set((state) => {
      const newAdjustments = state.tempAdjustments.filter(a => a.ingredientId !== ingredientId);
      const newSessionRecipe = computeSessionRecipe(state.currentRecipe, newAdjustments, state.scaleFactor);
      return { 
        tempAdjustments: newAdjustments,
        sessionRecipe: newSessionRecipe,
      };
    });
  },
  
  clearTempAdjustments: () => {
    set((state) => {
      const newSessionRecipe = computeSessionRecipe(state.currentRecipe, [], state.scaleFactor);
      return { 
        tempAdjustments: [],
        sessionRecipe: newSessionRecipe,
      };
    });
  },
  
  addRecipe: (recipe) => set((state) => ({
    recipes: [recipe, ...state.recipes],
  })),
  
  updateRecipe: (id, updates) => set((state) => ({
    recipes: state.recipes.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    ),
    currentRecipe: state.currentRecipe?.id === id
      ? { ...state.currentRecipe, ...updates }
      : state.currentRecipe,
  })),
  
  deleteRecipe: (id) => set((state) => ({
    recipes: state.recipes.filter((r) => r.id !== id),
    currentRecipe: state.currentRecipe?.id === id ? null : state.currentRecipe,
  })),
  
  getScaledIngredients: () => {
    const { currentRecipe, scaleFactor } = get();
    if (!currentRecipe) return [];
    
    return currentRecipe.ingredients.map((ing) => ({
      ...ing,
      amount: Math.round(ing.amount * scaleFactor * 10) / 10,
    }));
  },
  
  getIngredientRenderMap: () => {
    const { currentRecipe, tempAdjustments, scaleFactor } = get();
    const renderMap = new Map<string, IngredientRenderInfo>();
    
    if (!currentRecipe) return renderMap;
    
    currentRecipe.ingredients.forEach(ing => {
      const adjustment = tempAdjustments.find(a => a.ingredientId === ing.id);
      
      if (adjustment) {
        if (adjustment.action === "remove") {
          renderMap.set(ing.id, {
            id: ing.id,
            originalName: ing.name,
            displayName: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            isRemoved: true,
            isReplaced: false,
          });
        } else if (adjustment.action === "replace" && adjustment.replacement) {
          renderMap.set(ing.id, {
            id: ing.id,
            originalName: ing.name,
            displayName: adjustment.replacement,
            amount: Math.round(ing.amount * scaleFactor * 10) / 10,
            unit: ing.unit,
            isRemoved: false,
            isReplaced: true,
            originalAmount: ing.amount,
            originalUnit: ing.unit,
          });
        }
      } else {
        renderMap.set(ing.id, {
          id: ing.id,
          originalName: ing.name,
          displayName: ing.name,
          amount: Math.round(ing.amount * scaleFactor * 10) / 10,
          unit: ing.unit,
          isRemoved: false,
          isReplaced: false,
        });
      }
    });
    
    return renderMap;
  },
  
  getRemovedIngredients: () => {
    const { tempAdjustments } = get();
    return tempAdjustments
      .filter(a => a.action === "remove")
      .map(a => a.ingredientId);
  },
  
  getReplacedIngredients: () => {
    const { tempAdjustments } = get();
    const replacedMap = new Map<string, { originalName: string; replacementName: string }>();
    
    tempAdjustments
      .filter(a => a.action === "replace" && a.replacement)
      .forEach(a => {
        replacedMap.set(a.ingredientId, {
          originalName: a.ingredientName,
          replacementName: a.replacement!,
        });
      });
    
    return replacedMap;
  },
}));

interface IngredientSubstitution {
  ingredientId: string;
  originalName: string;
  substitutedName: string;
  substitutedUnit: string;
}

interface CookingState {
  currentStepIndex: number;
  isTimerRunning: boolean;
  remainingTime: number;
  ingredientSubstitutions: IngredientSubstitution[];
  removedIngredients: string[];
  setCurrentStepIndex: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  startTimer: (seconds: number) => void;
  pauseTimer: () => void;
  resetTimer: (seconds: number) => void;
  tickTimer: () => void;
  substituteIngredient: (ingredientId: string, originalName: string, substitutedName: string, substitutedUnit: string) => void;
  getSubstitutedIngredient: (ingredientId: string) => { name: string; unit: string } | null;
  removeIngredient: (ingredientId: string) => void;
  isIngredientRemoved: (ingredientId: string) => boolean;
  clearSubstitutions: () => void;
}

export const useCookingStore = create<CookingState>((set, get) => ({
  currentStepIndex: 0,
  isTimerRunning: false,
  remainingTime: 0,
  ingredientSubstitutions: [],
  removedIngredients: [],
  
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
  nextStep: () => set((state) => ({ currentStepIndex: state.currentStepIndex + 1 })),
  prevStep: () => set((state) => ({ 
    currentStepIndex: Math.max(0, state.currentStepIndex - 1) 
  })),
  
  startTimer: (seconds) => set({ remainingTime: seconds, isTimerRunning: true }),
  pauseTimer: () => set({ isTimerRunning: false }),
  resetTimer: (seconds) => set({ remainingTime: seconds, isTimerRunning: false }),
  tickTimer: () => set((state) => ({
    remainingTime: Math.max(0, state.remainingTime - 1),
  })),
  
  substituteIngredient: (ingredientId, originalName, substitutedName, substitutedUnit) => {
    set((state) => {
      const existing = state.ingredientSubstitutions.find(
        (s) => s.ingredientId === ingredientId
      );
      
      if (existing) {
        return {
          ingredientSubstitutions: state.ingredientSubstitutions.map((s) =>
            s.ingredientId === ingredientId
              ? { ...s, substitutedName, substitutedUnit }
              : s
          ),
        };
      }
      
      return {
        ingredientSubstitutions: [
          ...state.ingredientSubstitutions,
          { ingredientId, originalName, substitutedName, substitutedUnit },
        ],
      };
    });
  },
  
  getSubstitutedIngredient: (ingredientId) => {
    const { ingredientSubstitutions } = get();
    const substitution = ingredientSubstitutions.find(
      (s) => s.ingredientId === ingredientId
    );
    if (substitution) {
      return {
        name: substitution.substitutedName,
        unit: substitution.substitutedUnit,
      };
    }
    return null;
  },
  
  removeIngredient: (ingredientId) => {
    set((state) => {
      if (state.removedIngredients.includes(ingredientId)) {
        return state;
      }
      return {
        removedIngredients: [...state.removedIngredients, ingredientId],
      };
    });
  },
  
  isIngredientRemoved: (ingredientId) => {
    const { removedIngredients } = get();
    return removedIngredients.includes(ingredientId);
  },
  
  clearSubstitutions: () => set({ ingredientSubstitutions: [], removedIngredients: [] }),
}));
