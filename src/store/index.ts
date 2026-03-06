import { create } from 'zustand';
import { Recipe, Ingredient, Step } from '@/lib/supabase';

interface RecipeState {
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  scaleFactor: number;
  setRecipes: (recipes: Recipe[]) => void;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  setScaleFactor: (factor: number) => void;
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  getScaledIngredients: () => Ingredient[];
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  currentRecipe: null,
  scaleFactor: 1,
  
  setRecipes: (recipes) => set({ recipes }),
  setCurrentRecipe: (recipe) => set({ currentRecipe: recipe, scaleFactor: 1 }),
  setScaleFactor: (factor) => set({ scaleFactor: factor }),
  
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
  setCurrentStepIndex: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  startTimer: (seconds: number) => void;
  pauseTimer: () => void;
  resetTimer: (seconds: number) => void;
  tickTimer: () => void;
  substituteIngredient: (ingredientId: string, originalName: string, substitutedName: string, substitutedUnit: string) => void;
  getSubstitutedIngredient: (ingredientId: string) => { name: string; unit: string } | null;
  clearSubstitutions: () => void;
}

export const useCookingStore = create<CookingState>((set, get) => ({
  currentStepIndex: 0,
  isTimerRunning: false,
  remainingTime: 0,
  ingredientSubstitutions: [],
  
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
  
  clearSubstitutions: () => set({ ingredientSubstitutions: [] }),
}));
