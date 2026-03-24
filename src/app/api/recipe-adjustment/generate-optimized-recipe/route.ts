import { NextRequest, NextResponse } from "next/server";
import {
  GenerateOptimizedRecipeRequest,
  GenerateOptimizedRecipeResponse,
  OptimizedRecipe,
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
    const body: GenerateOptimizedRecipeRequest = await request.json();
    const { recipe_base, analysis_result } = body;

    const messages = [
      {
        role: "system",
        content: `你是一名专业的家庭烹饪食谱优化助手。你的任务是根据分析结果，生成一份优化后的食谱。

你的优化必须遵循以下原则：
1. 严格基于分析结果中的问题和偏好进行调整
2. 保持菜品的基本风味和特色
3. 不删除主料，不添加新主料
4. 只调整用量、步骤描述和添加提示
5. 必须在 changes_explanation 中清晰说明每一处修改的原因

请严格按要求输出 JSON，不要输出任何额外说明文字。`,
      },
      {
        role: "user",
        content: `请根据以下分析结果，生成优化后的食谱。

【原始食谱】
菜名：${recipe_base.name}
总时间：${recipe_base.total_time}分钟
食材：${JSON.stringify(recipe_base.ingredients, null, 2)}
步骤：${JSON.stringify(recipe_base.steps, null, 2)}

【分析结果】
问题列表：${JSON.stringify(analysis_result.problems, null, 2)}
用户偏好：${JSON.stringify(analysis_result.preferences, null, 2)}
调整方向：${JSON.stringify(analysis_result.adjustment_direction, null, 2)}
建议列表：${JSON.stringify(analysis_result.suggestions, null, 2)}

请严格输出 JSON：
{
  "name": "我的少辣版剁椒鱼头",
  "total_time": 30,
  "ingredients": [
    {
      "id": "ing_001",
      "name": "鱼头",
      "original_amount": 500,
      "original_unit": "g",
      "adjusted_amount": 500,
      "adjusted_unit": "g",
      "change_reason": null
    },
    {
      "id": "ing_002",
      "name": "剁椒",
      "original_amount": 50,
      "original_unit": "g",
      "adjusted_amount": 35,
      "adjusted_unit": "g",
      "change_reason": "根据你的反馈，减少30%的剁椒用量"
    }
  ],
  "steps": [
    {
      "order": 1,
      "description": "将鱼头洗净，从中间劈开，用料酒和姜片腌制10分钟去腥",
      "duration": 15,
      "ingredients": [...],
      "tip": "腌制时可以在鱼身划几刀，更入味",
      "changes": []
    },
    {
      "order": 3,
      "description": "将剁椒均匀铺在鱼头上，注意用量已根据你的口味调整",
      "duration": 2,
      "ingredients": [...],
      "tip": "如果不确定辣度，可以先铺一半，蒸好后尝一下再决定是否添加",
      "changes": ["减少了剁椒用量", "添加了辣度调整提示"]
    }
  ],
  "changes_explanation": [
    {
      "type": "ingredient",
      "target": "剁椒",
      "original": "50g",
      "adjusted": "35g",
      "reason": "你多次反馈太辣，减少30%用量"
    },
    {
      "type": "step",
      "target": "步骤3",
      "adjusted": "添加辣度调整提示",
      "reason": "帮助你更好地控制辣度"
    },
    {
      "type": "tip",
      "target": "收汁阶段",
      "adjusted": "改为中小火，缩短1-2分钟",
      "reason": "你反馈火候不好掌握，降低翻车风险"
    }
  ],
  "adjustment_summary": "减少了剁椒用量30%，添加了辣度控制提示，优化了火候说明"
}`,
      },
    ];

    const result = await callAI(messages);
    const optimizedRecipe = JSON.parse(extractJSON(result)) as OptimizedRecipe;

    const response: GenerateOptimizedRecipeResponse = {
      optimized_recipe: optimizedRecipe,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate optimized recipe:", error);
    return NextResponse.json(
      { error: { code: "GENERATION_FAILED", message: error instanceof Error ? error.message : "生成失败" } },
      { status: 500 }
    );
  }
}
