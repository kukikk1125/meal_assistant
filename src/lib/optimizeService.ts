import { CookingLog } from "./supabase";

export const TASTE_LABELS: Record<string, string> = {
  too_spicy: "太辣了",
  too_bland: "太淡了",
  too_salty: "太咸了",
  too_oily: "太油了",
  just_right: "刚刚好",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  prep_hard: "食材准备太麻烦",
  step_unclear: "某一步没看懂",
  heat_hard: "火候不好掌握",
  time_short: "时间不够",
  seasoning_uncertain: "调味不确定",
  too_complex: "过程太复杂",
};

const NEGATIVE_TASTE_TAGS = ["too_spicy", "too_salty", "too_oily", "too_bland"];

export interface IssueAnalysis {
  issues: Array<{
    tag: string;
    label: string;
    count: number;
    type: "taste" | "difficulty";
  }>;
  suggestions: string[];
  hasIssues: boolean;
}

export interface OptimizeSuggestion {
  target: string;
  action: string;
  reason: string;
}

export function shouldShowInstantOptimize(
  rating: number,
  tasteFeedback: string[],
  difficultyFeedback: string[]
): boolean {
  if (rating <= 3) return true;
  
  const hasNegativeTaste = tasteFeedback.some(tag => NEGATIVE_TASTE_TAGS.includes(tag));
  if (hasNegativeTaste) return true;
  
  return false;
}

export function analyzeInstantIssues(
  rating: number,
  tasteFeedback: string[],
  difficultyFeedback: string[]
): IssueAnalysis {
  const issues: IssueAnalysis["issues"] = [];
  const suggestions: string[] = [];
  
  NEGATIVE_TASTE_TAGS.forEach(tag => {
    if (tasteFeedback.includes(tag)) {
      issues.push({
        tag,
        label: TASTE_LABELS[tag],
        count: 1,
        type: "taste",
      });
    }
  });
  
  difficultyFeedback.forEach(tag => {
    issues.push({
      tag,
      label: DIFFICULTY_LABELS[tag] || tag,
      count: 1,
      type: "difficulty",
    });
  });
  
  if (tasteFeedback.includes("too_spicy")) {
    suggestions.push("减少辣椒用量约 40%");
  }
  if (tasteFeedback.includes("too_salty")) {
    suggestions.push("减少盐/酱油用量约 30%");
  }
  if (tasteFeedback.includes("too_oily")) {
    suggestions.push("减少油量约 30%");
  }
  if (tasteFeedback.includes("too_bland")) {
    suggestions.push("适当增加调味料");
  }
  if (difficultyFeedback.includes("too_complex")) {
    suggestions.push("简化制作步骤");
  }
  if (difficultyFeedback.includes("prep_hard")) {
    suggestions.push("简化食材准备流程");
  }
  if (difficultyFeedback.includes("heat_hard")) {
    suggestions.push("增加火候提醒");
  }
  if (difficultyFeedback.includes("time_short")) {
    suggestions.push("预留更多准备时间");
  }
  
  return {
    issues,
    suggestions,
    hasIssues: issues.length > 0 || rating <= 3,
  };
}

export function analyzeHistoryIssues(logs: CookingLog[]): IssueAnalysis {
  const issueCount: Record<string, { count: number; type: "taste" | "difficulty"; label: string }> = {};
  
  logs.forEach(log => {
    (log.taste_feedback || []).forEach(tag => {
      if (NEGATIVE_TASTE_TAGS.includes(tag)) {
        if (!issueCount[tag]) {
          issueCount[tag] = { count: 0, type: "taste", label: TASTE_LABELS[tag] };
        }
        issueCount[tag].count++;
      }
    });
    
    (log.difficulty_feedback || []).forEach(tag => {
      if (!issueCount[tag]) {
        issueCount[tag] = { count: 0, type: "difficulty", label: DIFFICULTY_LABELS[tag] || tag };
      }
      issueCount[tag].count++;
    });
  });
  
  const issues = Object.entries(issueCount)
    .map(([tag, data]) => ({
      tag,
      label: data.label,
      count: data.count,
      type: data.type,
    }))
    .sort((a, b) => b.count - a.count);
  
  const suggestions: string[] = [];
  
  if (issueCount["too_spicy"]?.count >= 1) {
    suggestions.push("减少辣椒用量");
  }
  if (issueCount["too_salty"]?.count >= 1) {
    suggestions.push("减少盐/酱油用量");
  }
  if (issueCount["too_oily"]?.count >= 1) {
    suggestions.push("减少油量");
  }
  if (issueCount["too_bland"]?.count >= 1) {
    suggestions.push("适当增加调味料");
  }
  if (issueCount["too_complex"]?.count >= 1) {
    suggestions.push("简化制作步骤");
  }
  if (issueCount["prep_hard"]?.count >= 1) {
    suggestions.push("简化食材准备流程");
  }
  if (issueCount["heat_hard"]?.count >= 1) {
    suggestions.push("增加火候提醒");
  }
  
  return {
    issues,
    suggestions,
    hasIssues: issues.length > 0,
  };
}

export function calculateReviewSummary(logs: CookingLog[]) {
  if (logs.length === 0) {
    return {
      totalCooking: 0,
      avgRating: 0,
      frequentIssues: [],
      topIssues: [],
      suggestions: [],
    };
  }
  
  const totalCooking = logs.length;
  const avgRating = Math.round((logs.reduce((sum, log) => sum + log.rating, 0) / totalCooking) * 10) / 10;
  
  const issueAnalysis = analyzeHistoryIssues(logs);
  
  const threshold = Math.max(1, Math.ceil(totalCooking * 0.3));
  const frequentIssues = issueAnalysis.issues.filter(i => i.count >= threshold);
  
  return {
    totalCooking,
    avgRating,
    frequentIssues,
    topIssues: issueAnalysis.issues.slice(0, 3),
    suggestions: issueAnalysis.suggestions || [],
  };
}

export function hasNegativeExperience(logs: CookingLog[]): boolean {
  return logs.some(log => {
    if (log.rating <= 3) return true;
    
    const hasNegativeTaste = (log.taste_feedback || []).some(tag => NEGATIVE_TASTE_TAGS.includes(tag));
    if (hasNegativeTaste) return true;
    
    if ((log.difficulty_feedback || []).length > 0) return true;
    
    return false;
  });
}

export function getRecentIssues(logs: CookingLog[], limit: number = 3): string[] {
  const recentLogs = logs.slice(0, limit);
  const issues = new Set<string>();
  
  recentLogs.forEach(log => {
    (log.taste_feedback || []).forEach(tag => {
      if (NEGATIVE_TASTE_TAGS.includes(tag)) {
        issues.add(TASTE_LABELS[tag]);
      }
    });
  });
  
  return Array.from(issues);
}

export function generateAdjustments(issues: IssueAnalysis["issues"]): OptimizeSuggestion[] {
  const adjustments: OptimizeSuggestion[] = [];
  
  issues.forEach(issue => {
    switch (issue.tag) {
      case "too_spicy":
        adjustments.push({
          target: "辣椒",
          action: "减少 40%",
          reason: "你反馈过太辣了",
        });
        break;
      case "too_salty":
        adjustments.push({
          target: "盐/酱油",
          action: "减少 30%",
          reason: "你反馈过太咸了",
        });
        break;
      case "too_oily":
        adjustments.push({
          target: "油",
          action: "减少 30%",
          reason: "你反馈过太油了",
        });
        break;
      case "too_bland":
        adjustments.push({
          target: "调味料",
          action: "适当增加",
          reason: "你反馈过太淡了",
        });
        break;
      case "too_complex":
        adjustments.push({
          target: "制作步骤",
          action: "简化流程",
          reason: "你反馈过过程太复杂",
        });
        break;
      case "heat_hard":
        adjustments.push({
          target: "火候控制",
          action: "增加提醒",
          reason: "你反馈过火候不好掌握",
        });
        break;
    }
  });
  
  return adjustments;
}
