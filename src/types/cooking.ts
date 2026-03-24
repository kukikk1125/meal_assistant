export type CookingCheckStatus = 'good' | 'warning' | 'problem' | 'unclear';

export type CookingProblemType = 
  | 'none'
  | 'heat'
  | 'texture'
  | 'color'
  | 'doneness'
  | 'seasoning'
  | 'mixing'
  | 'moisture'
  | 'plating'
  | 'unclear';

export type CookingConfidence = 'high' | 'medium' | 'low';

export interface CookingPhotoCheckResult {
  overallStatus: CookingCheckStatus;
  statusLabel: string;
  currentState: string;
  isAppropriate: boolean;
  canProceed: boolean;
  problemType: CookingProblemType;
  confidence: CookingConfidence;
  reasons: string[];
  risks: string[];
  advice: string;
  remedy: string;
  followUpShotSuggestion?: string;
}

