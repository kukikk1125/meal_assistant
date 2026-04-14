import { NextRequest, NextResponse } from "next/server";
import {
  AnalyzeCurrentRecordRequest,
  AnalyzeCurrentRecordResponse,
  AnalysisResult,
  ProblemTag,
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
    const body: AnalyzeCurrentRecordRequest = await request.json();
    const { recipe_base, current_record } = body;

    const messages = [
      {
        role: "system",
        content: `你是一名专业的家庭烹饪复盘助手。你的任务是基于用户本次做菜记录，识别本次制作中最可能出现的问题，并给出下次可执行的优化建议。

你的分析必须遵循以下原则：
1. 只基于本次记录进行判断，不要假设不存在的信息
2. 优先识别用户明确反馈的问题
3. 如果信息不足，要明确说明"判断置信度较低"
4. 输出建议时必须具体，避免空话
5. 输出内容必须适合移动端快速阅读，简洁、结构化
6. 不要输出安慰性话术，不要夸张表述

请严格按要求输出 JSON，不要输出任何额外说明文字。`,
      },
      {
        role: "user",
        content: `请基于以下"本次做菜记录"进行分析，并输出结构化结果。

【食谱基础信息】
菜名：${recipe_base.name}
食材：${JSON.stringify(recipe_base.ingredients)}
步骤：${JSON.stringify(recipe_base.steps)}

【本次制作记录】
评分（1-5）：${current_record.rating}
标签：${JSON.stringify(current_record.tags)}
用户日记：${current_record.notes || ""}
份量调整：${current_record.serving_adjustment || "1人份"}
食材替换：${JSON.stringify(current_record.ingredient_replacements) || "无"}

请严格输出 JSON：
{
  "should_generate_optimized_version": true,
  "confidence": "high",
  "summary": {
    "title": "这次主要问题集中在辣度和火候控制",
    "text": "根据你的评分和标签，本次问题更可能出现在调味偏重和火候控制不稳定。"
  },
  "problems": [
    {
      "code": "too_spicy",
      "label": "太辣了",
      "evidence_strength": "high",
      "category": "stable",
      "likely_causes": ["辣椒用量偏多", "调味比例偏重"]
    }
  ],
  "preferences": [
    {
      "code": "less_spicy",
      "label": "偏少辣",
      "type": "flavor",
      "evidence_strength": "high"
    }
  ],
  "suggestions": [
    {
      "title": "降低辣椒比例",
      "detail": "下次先减少约20%-30%的辣椒用量，再根据口味补加。",
      "priority": "high"
    }
  ],
  "adjustment_direction": {
    "flavor_profile": "少辣、少油",
    "ingredient_adjustment": ["降低辣椒用量"],
    "heat_adjustment": ["后段火力更温和"],
    "step_optimization": ["增加关键步骤提醒"]
  },
  "generation_reason": "本次记录显示明确的问题点，适合生成优化版本。",
  "ui_recommendation": {
    "primary_button_text": "根据这次问题生成改良版",
    "secondary_button_text": "先查看优化建议"
  }
}`,
      },
    ];

    const result = await callAI(messages);
    const analysisResult = JSON.parse(extractJSON(result)) as AnalysisResult;

    const response: AnalyzeCurrentRecordResponse = {
      analysis_result: analysisResult,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to analyze current record:", error);
    return NextResponse.json(
      { error: { code: "ANALYSIS_FAILED", message: error instanceof Error ? error.message : "分析失败" } },
      { status: 500 }
    );
  }
}
