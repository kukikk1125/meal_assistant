import { CookingCheckStatus, CookingProblemType, CookingConfidence, CookingPhotoCheckResult } from '@/types/cooking';

export const statusTitleMap: Record<CookingCheckStatus, string> = {
  good: '状态正常',
  warning: '需要注意',
  problem: '需要调整',
  unclear: '无法判断',
};

export const problemTypeLabelMap: Record<CookingProblemType, string> = {
  none: '无明显问题',
  heat: '火候问题',
  texture: '状态不到位',
  color: '颜色异常',
  doneness: '生熟问题',
  seasoning: '调味问题',
  mixing: '混合不均',
  moisture: '干湿状态问题',
  plating: '铺料或摆放问题',
  unclear: '暂时无法判断',
};

export const confidenceLabelMap: Record<CookingConfidence, string> = {
  high: '识别较明确',
  medium: '基本可判断',
  low: '信息不足',
};

export const statusColorMap: Record<CookingCheckStatus, { 
  bg: string; 
  text: string; 
  border: string;
  icon: 'check' | 'warning' | 'alert' | 'help';
}> = {
  good: { 
    bg: 'bg-green-200', 
    text: 'text-green-800', 
    border: 'border-green-300',
    icon: 'check'
  },
  warning: { 
    bg: 'bg-amber-100', 
    text: 'text-amber-800', 
    border: 'border-amber-300',
    icon: 'warning'
  },
  problem: { 
    bg: 'bg-red-100', 
    text: 'text-gray-900', 
    border: 'border-red-300',
    icon: 'alert'
  },
  unclear: { 
    bg: 'bg-gray-200', 
    text: 'text-gray-700', 
    border: 'border-gray-300',
    icon: 'help'
  },
};

export function normalizePhotoCheckResult(raw: unknown): CookingPhotoCheckResult {
  const defaultResult: CookingPhotoCheckResult = {
    overallStatus: 'unclear',
    statusLabel: '无法判断',
    currentState: '无法识别当前状态',
    isAppropriate: true,
    canProceed: true,
    problemType: 'unclear',
    confidence: 'low',
    reasons: [],
    risks: [],
    advice: '请继续按步骤操作',
    remedy: '',
    followUpShotSuggestion: '',
  };

  if (!raw || typeof raw !== 'object') {
    return defaultResult;
  }

  const data = raw as Record<string, unknown>;

  const validStatuses: CookingCheckStatus[] = ['good', 'warning', 'problem', 'unclear'];
  const overallStatus = validStatuses.includes(data.overallStatus as CookingCheckStatus)
    ? (data.overallStatus as CookingCheckStatus)
    : 'unclear';

  const validProblemTypes: CookingProblemType[] = [
    'none', 'heat', 'texture', 'color', 'doneness', 
    'seasoning', 'mixing', 'moisture', 'plating', 'unclear'
  ];
  const problemType = validProblemTypes.includes(data.problemType as CookingProblemType)
    ? (data.problemType as CookingProblemType)
    : 'unclear';

  const validConfidences: CookingConfidence[] = ['high', 'medium', 'low'];
  const confidence = validConfidences.includes(data.confidence as CookingConfidence)
    ? (data.confidence as CookingConfidence)
    : 'low';

  const statusLabel = typeof data.statusLabel === 'string' && data.statusLabel.trim()
    ? data.statusLabel.trim()
    : statusTitleMap[overallStatus];

  const currentState = typeof data.currentState === 'string' && data.currentState.trim()
    ? data.currentState.trim()
    : '无法识别当前状态';

  const reasons = Array.isArray(data.reasons)
    ? data.reasons.filter((r): r is string => typeof r === 'string' && r.trim() !== '').slice(0, 5)
    : [];

  const risks = Array.isArray(data.risks)
    ? data.risks.filter((r): r is string => typeof r === 'string' && r.trim() !== '').slice(0, 3)
    : [];

  const advice = typeof data.advice === 'string' && data.advice.trim()
    ? data.advice.trim()
    : '请继续按步骤操作';

  const remedy = typeof data.remedy === 'string' && data.remedy.trim()
    ? data.remedy.trim()
    : '';

  const followUpShotSuggestion = typeof data.followUpShotSuggestion === 'string' && data.followUpShotSuggestion.trim()
    ? data.followUpShotSuggestion.trim()
    : '';

  return {
    overallStatus,
    statusLabel,
    currentState,
    isAppropriate: typeof data.isAppropriate === 'boolean' ? data.isAppropriate : true,
    canProceed: typeof data.canProceed === 'boolean' ? data.canProceed : true,
    problemType,
    confidence,
    reasons,
    risks,
    advice,
    remedy,
    followUpShotSuggestion,
  };
}
