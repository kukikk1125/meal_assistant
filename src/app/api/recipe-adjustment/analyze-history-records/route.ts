import { NextRequest, NextResponse } from "next/server";
import {
  AnalyzeHistoryRecordsRequest,
  AnalyzeHistoryRecordsResponse,
  AnalysisResult,
} from "@/types/recipe-adjustment";

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = (process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
const ARK_MODEL = process.env.ARK_MODEL || "doubao-seed-2-0-mini-260215";

function extractJSON(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text;
}

async function callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: ARK_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeHistoryRecordsRequest = await request.json();
    const { recipe_base, history_records } = body;

    const messages = [
      {
        role: "system",
        content: `你是一名专业的家庭烹饪版本优化助手。你的任务是基于某位用户对同一道菜的多次历史做菜记录，分析其长期口味偏好、稳定失败点和重复出现的问题，并为系统生成"更适合该用户的长期优化方向"。

你的分析必须遵循以下原则：
1. 优先分析"多次重复出现"的问题，而不是只盯住最近一次记录
2. 区分三类信息：稳定口味偏好、稳定失败点、偶发问题
3. 不要因为单次异常记录就得出强结论
4. 如果历史记录数量不足，必须明确指出"结论仍不稳定"
5. 输出必须适合移动端产品使用，结构化、清晰

请严格输出 JSON，不要输出任何额外文字。`,
      },
      {
        role: "user",
        content: `请基于以下"同一道菜的全部历史做菜记录"进行复盘分析，并输出结构化结果。

【食谱基础信息】
菜名：${recipe_base.name}
食材：${JSON.stringify(recipe_base.ingredients)}
步骤：${JSON.stringify(recipe_base.steps)}

【历史做菜记录总数】
${history_records.length}

【全部历史记录】
${JSON.stringify(history_records, null, 2)}

请严格输出 JSON：
{
  "should_generate_optimized_version": true,
  "confidence": "high",
  "analysis_stability": "medium",
  "summary": {
    "title": "你做这道菜时，问题主要集中在调味偏重和火候控制",
    "text": "结合${history_records.length}次记录，你更偏好少辣少油，且在收汁和最后加热阶段更容易失误。"
  },
  "problems": [
    {
      "code": "too_spicy",
      "label": "辣度偏高",
      "frequency": 3,
      "evidence_strength": "high",
      "category": "stable"
    },
    {
      "code": "too_oily",
      "label": "油量偏多",
      "frequency": 2,
      "evidence_strength": "medium",
      "category": "stable"
    },
    {
      "code": "too_salty",
      "label": "偏咸",
      "frequency": 1,
      "evidence_strength": "low",
      "category": "occasional"
    }
  ],
  "preferences": [
    {
      "code": "less_spicy",
      "label": "偏少辣",
      "type": "flavor",
      "evidence_strength": "high"
    },
    {
      "code": "less_oily",
      "label": "偏少油",
      "type": "flavor",
      "evidence_strength": "high"
    }
  ],
  "suggestions": [
    {
      "title": "降低辣椒比例",
      "detail": "下次先减少约20%-30%的辣椒用量。",
      "priority": "high"
    }
  ],
  "adjustment_direction": {
    "flavor_profile": "整体调整为少辣、少油、调味更稳",
    "ingredient_adjustment": ["降低辣椒或剁椒基准量", "减少起锅基础油量"],
    "heat_adjustment": ["增加最后阶段火候说明", "收汁阶段改为更保守的中小火"],
    "step_optimization": ["增加关键翻车点提醒", "简化模糊步骤表达"]
  },
  "generation_reason": "历史记录中已出现较稳定的口味偏好与重复问题，适合生成用户长期优化版。",
  "ui_recommendation": {
    "primary_button_text": "基于历史记录生成长期优化版",
    "secondary_button_text": "查看我的复盘总结"
  }
}`,
      },
    ];

    const result = await callAI(messages);
    const analysisResult = JSON.parse(extractJSON(result)) as AnalysisResult;

    const response: AnalyzeHistoryRecordsResponse = {
      analysis_result: analysisResult,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to analyze history records:", error);
    return NextResponse.json(
      { error: { code: "ANALYSIS_FAILED", message: error instanceof Error ? error.message : "分析失败" } },
      { status: 500 }
    );
  }
}
