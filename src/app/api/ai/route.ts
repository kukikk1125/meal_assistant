import { NextRequest, NextResponse } from "next/server";

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = (process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
const ARK_MODEL = process.env.ARK_MODEL || "doubao-seed-2-0-mini-260215";
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120_000);

type ApiType = "parseText" | "parseImage" | "getSubstitutions" | "analyzeCooking" | "optimizeRecipe" | "optimizeRecipeFromLogs" | "analyzeCookingLog" | "analyzeCookingHistory" | "chatSubstitution" | "queryIngredientSubstitution";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RecipeIngredient {
  id?: string;
  name?: string;
  amount?: number;
  unit?: string;
  scalable?: boolean;
  original_amount?: number;
  original_unit?: string;
  adjusted_amount?: number;
  adjusted_unit?: string;
  change_reason?: string;
}

interface RecipeStepIngredient {
  ingredientId?: string;
  name?: string;
  amount?: number;
  unit?: string;
}

interface RecipeStep {
  order?: number;
  description?: string;
  duration?: number;
  is_key_step?: boolean;
  tip?: string;
  image_url?: string;
  ingredients?: RecipeStepIngredient[];
  changes?: string[];
  relatedIngredients?: string[];
}

interface Recipe {
  name?: string;
  totalTime?: number;
  total_time?: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
}

interface CurrentLog {
  rating?: number | string;
  taste_feedback?: string[];
  difficulty_feedback?: string[];
  notes?: string;
  cookTime?: string;
  servingAdjustment?: string;
  ingredientReplacements?: string;
}

function clampInputText(text: unknown): string {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  return trimmed.length <= 3500 ? trimmed : trimmed.slice(0, 3500);
}

async function requestChatCompletions(messages: Array<{ role: string; content: string | Array<any> }>, signal: AbortSignal): Promise<any> {
  const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: ARK_MODEL,
      messages,
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    const rawError = await response.text();
    const err = new Error(rawError);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  return response.json();
}

function buildMessages(type: ApiType, body: Record<string, unknown>): Array<{ role: string; content: any }> {
  const content = body.content;
  const currentStep = body.currentStep;
  const stepNumber = body.stepNumber;
  const recipeName = body.recipeName;
  const ingredientName = body.ingredientName;
  const currentAmount = body.currentAmount;
  const recipe = body.recipe as Recipe | undefined;
  const currentLog = body.currentLog as CurrentLog | undefined;
  const historyRecords = body.historyRecords as Array<CurrentLog> | undefined;
  const historyCount = body.historyCount;
  const cookingLogs = body.cookingLogs as Array<CurrentLog> | undefined;
  const prevStep = body.prevStep;
  const nextStep = body.nextStep;

  switch (type) {
    case "parseText": {
      const text = clampInputText(content);
      return [
        {
          role: "system",
          content: "你是一个纯信息抽取引擎。仅从输入的食谱文本中提取明确存在的信息，不要做任何智能估算或补充。",
        },
        {
          role: "user",
          content: `请解析以下食谱文本，直接返回JSON，不要有任何解释：
文本内容：
${text}

要求返回的JSON格式（必须严格匹配）：
{
  "name": "菜名",
  "totalTime": 数字分钟,
  "ingredients": [
    {
      "id": "食材ID（如：ing_salt, ing_oil, ing_egg）",
      "name": "食材名",
      "amount": 该食材在整道菜中的总用量,
      "unit": "单位",
      "scalable": true或false
    }
  ],
  "steps": [
    {
      "order": 数字,
      "description": "步骤描述",
      "duration": 数字分钟,
      "ingredients": [
        {
          "ingredientId": "对应ingredients中的id",
          "name": "食材名",
          "amount": 本步骤使用的用量,
          "unit": "单位"
        }
      ]
    }
  ]
}

====================
抽取规则：

【1. 菜名识别】
- 优先提取最大标题
- 若无明确标题，使用第一行文本
- 去除表情符号和营销词

【2. 食材ID生成规则】
- 为每个食材生成唯一ID，格式：ing_食材拼音或英文
- 例如：盐 → ing_salt, 食用油 → ing_oil, 鸡蛋 → ing_egg
- ID必须全小写，用下划线连接

【3. 食材总量计算（核心规则！）】
- ingredients中的amount是该食材在整道菜中的总用量
- **重要：总用量 = 所有步骤中该食材用量之和**
- 例如：葱在步骤1用5克，步骤2用10克，步骤3用5克，则总量为20克
- 如果某食材在多个步骤中使用，必须累加所有步骤的用量
- scalable字段：主料和主要调料填true，装饰性食材填false

【4. 步骤食材用量（核心规则！）】
- 每个步骤的ingredients数组列出该步骤实际使用的食材及用量
- ingredientId必须对应ingredients中的id
- **amount是该步骤使用的具体用量，不是总量**
- **关键：同一食材在多个步骤中的用量相加，必须等于ingredients中的总量**
- 如果步骤中未明确用量，根据常识合理分配到各步骤
- 例如：总量20克葱，分3个步骤使用，可以分配为：步骤1用5克，步骤2用10克，步骤3用5克

【5. 步骤描述规则】
- 步骤描述保持原样，不要添加或修改任何内容
- 不要在步骤中添加食材用量信息
- 保持步骤描述简洁清晰

【6. 纯提取原则（重要！）】
- 只提取文本中明确存在的信息
- 不确定的 amount 填 0
- 不确定的 duration 填 0
- 不确定的 totalTime 填 0
- 不做任何智能估算或补充

====================
重要约束：
- 这是纯信息抽取任务，不是优化任务
- 禁止编造文本中不存在的信息
- 不确定的内容填0，不要估算
- 严禁输出解释、注释、Markdown、额外字段
- 只输出一个合法JSON对象

示例输出：
{
  "name": "番茄炒蛋",
  "totalTime": 10,
  "ingredients": [
    {"id": "ing_egg", "name": "鸡蛋", "amount": 3, "unit": "个", "scalable": true},
    {"id": "ing_tomato", "name": "番茄", "amount": 2, "unit": "个", "scalable": true},
    {"id": "ing_oil", "name": "食用油", "amount": 30, "unit": "毫升", "scalable": true},
    {"id": "ing_salt", "name": "盐", "amount": 3, "unit": "克", "scalable": true}
  ],
  "steps": [
    {
      "order": 1,
      "description": "鸡蛋打散，番茄切块",
      "duration": 2,
      "ingredients": [
        {"ingredientId": "ing_egg", "name": "鸡蛋", "amount": 3, "unit": "个"}
      ]
    },
    {
      "order": 2,
      "description": "热锅倒油，油热后倒入蛋液炒散盛出",
      "duration": 2,
      "ingredients": [
        {"ingredientId": "ing_oil", "name": "食用油", "amount": 15, "unit": "毫升"},
        {"ingredientId": "ing_egg", "name": "鸡蛋", "amount": 3, "unit": "个"}
      ]
    },
    {
      "order": 3,
      "description": "锅中再加少许油，放入番茄翻炒出汁",
      "duration": 3,
      "ingredients": [
        {"ingredientId": "ing_oil", "name": "食用油", "amount": 15, "unit": "毫升"},
        {"ingredientId": "ing_tomato", "name": "番茄", "amount": 2, "unit": "个"}
      ]
    },
    {
      "order": 4,
      "description": "倒入炒好的鸡蛋，加盐调味翻炒均匀",
      "duration": 1,
      "ingredients": [
        {"ingredientId": "ing_egg", "name": "鸡蛋", "amount": 3, "unit": "个"},
        {"ingredientId": "ing_salt", "name": "盐", "amount": 3, "unit": "克"}
      ]
    }
  ]
}

现在开始输出最终JSON：`,
        },
      ];
    }
    case "parseImage": {
      const imageUrl = typeof content === "string" ? content : "";
      return [
        {
          role: "system",
          content: "你是一个纯信息抽取引擎。仅从输入的食谱图片中提取明确存在的信息，不要做任何智能估算或补充。",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `请识别这张图片中的食谱内容，直接返回JSON，不要有任何解释。要求返回的JSON格式：
{
  "name": "菜名",
  "totalTime": 数字分钟,
  "ingredients": [
    {
      "id": "食材ID（如：ing_salt, ing_oil, ing_egg）",
      "name": "食材名",
      "amount": 该食材在整道菜中的总用量,
      "unit": "单位",
      "scalable": true或false
    }
  ],
  "steps": [
    {
      "order": 数字,
      "description": "步骤描述",
      "duration": 数字分钟,
      "ingredients": [
        {
          "ingredientId": "对应ingredients中的id",
          "name": "食材名",
          "amount": 本步骤使用的用量,
          "unit": "单位"
        }
      ]
    }
  ]
}

====================
抽取规则：

【1. 菜名识别】
- 优先提取最大标题
- 若无明确标题，使用第一行文本
- 去除表情符号和营销词

【2. 食材ID生成规则】
- 为每个食材生成唯一ID，格式：ing_食材拼音或英文
- 例如：盐 → ing_salt, 食用油 → ing_oil, 鸡蛋 → ing_egg
- ID必须全小写，用下划线连接

【3. 食材总量计算（核心规则！）】
- ingredients中的amount是该食材在整道菜中的总用量
- **重要：总用量 = 所有步骤中该食材用量之和**
- 例如：葱在步骤1用5克，步骤2用10克，步骤3用5克，则总量为20克
- 如果某食材在多个步骤中使用，必须累加所有步骤的用量
- scalable字段：主料和主要调料填true，装饰性食材填false

【4. 步骤食材用量（核心规则！）】
- 每个步骤的ingredients数组列出该步骤实际使用的食材及用量
- ingredientId必须对应ingredients中的id
- **amount是该步骤使用的具体用量，不是总量**
- **关键：同一食材在多个步骤中的用量相加，必须等于ingredients中的总量**
- 如果步骤中未明确用量，根据常识合理分配到各步骤
- 例如：总量20克葱，分3个步骤使用，可以分配为：步骤1用5克，步骤2用10克，步骤3用5克

【5. 步骤描述规则】
- 步骤描述保持原样，不要添加或修改任何内容
- 不要在步骤中添加食材用量信息
- 保持步骤描述简洁清晰

【6. 纯提取原则（重要！）】
- 只提取图片中明确存在的信息
- 不确定的 amount 填 0
- 不确定的 duration 填 0
- 不确定的 totalTime 填 0
- 不做任何智能估算或补充

====================
重要约束：
- 这是纯信息抽取任务，不是优化任务
- 禁止编造图片中不存在的信息
- 不确定的内容填0，不要估算
- 严禁输出解释、注释、Markdown、额外字段
- 只输出一个合法JSON对象

现在开始输出最终JSON：` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ];
    }
    case "optimizeRecipe": {
      return [
        {
          role: "system",
          content: "你是一个\"食谱执行优化引擎\"。基于输入的结构化食谱JSON进行优化增强，提升其可执行性、清晰度和厨房使用体验。",
        },
        {
          role: "user",
          content: `请优化以下食谱，直接返回JSON，不要有任何解释：
食谱：${JSON.stringify(recipe)}

注意：
- 这是优化任务，不是重新生成任务。
- 不得删除原有主料。
- 不得添加图片中完全不存在的新主料。
- 允许优化单位、补全缺失时间、结构化步骤、智能估算用量。
- 必须保持原菜品风味不变。
- 只输出优化后的JSON。
- 禁止输出解释、Markdown、额外字段。

====================
输出JSON结构必须与输入一致：
{
  "name": "菜名",
  "totalTime": 数字分钟,
  "ingredients": [
    {
      "id": "食材ID",
      "name": "食材名",
      "amount": 该食材在整道菜中的总用量,
      "unit": "单位",
      "scalable": true或false
    }
  ],
  "steps": [
    {
      "order": 数字,
      "description": "步骤描述",
      "duration": 数字分钟,
      "ingredients": [
        {
          "ingredientId": "对应ingredients中的id",
          "name": "食材名",
          "amount": 本步骤使用的用量,
          "unit": "单位"
        }
      ]
    }
  ]
}

====================
优化规则：

【1. 智能用量估算（优先，核心！）】
- 如果菜谱中没有食材分量，根据菜名 + 食材组合，给出合理的家常用量
- 所有菜单都以**一人份**为标准配比
- **关键流程：先估算每个步骤的食材用量 → 再相加得到总量**
- 步骤用量估算标准（一人份）：
  - 主料：肉类100-150克，蔬菜200-300克（按步骤分配）
  - 调料：盐2克，生抽15毫升（按步骤分配）
- 例如：葱在步骤1爆炒用10克，步骤2装饰用5克，则总量为15克
- 不得填0，必须给出合理数值

【2. 食材ID生成规则】
- 为每个食材生成唯一ID，格式：ing_食材拼音或英文
- 例如：盐 → ing_salt, 食用油 → ing_oil, 鸡蛋 → ing_egg
- ID必须全小写，用下划线连接

【3. 食材总量计算（核心规则！）】
- ingredients中的amount是该食材在整道菜中的总用量
- **重要：总用量 = 所有步骤中该食材用量之和**
- 例如：葱在步骤1用5克，步骤2用10克，步骤3用5克，则总量为20克
- 如果某食材在多个步骤中使用，必须累加所有步骤的用量
- scalable字段：主料和主要调料填true，装饰性食材填false

【4. 步骤食材用量（核心规则！）】
- 每个步骤的ingredients数组列出该步骤实际使用的食材及用量
- ingredientId必须对应ingredients中的id
- **amount是该步骤使用的具体用量，不是总量**
- **关键：同一食材在多个步骤中的用量相加，必须等于ingredients中的总量**
- 合理分配食材用量到各个步骤
- 例如：总量20克葱，分3个步骤使用，可以分配为：步骤1用5克，步骤2用10克，步骤3用5克

【5. 单位标准化优化】
- 将"少许/适量"转换为合理小剂量
- 统一单位格式
- 不夸张放大用量

【6. 食材名称标准化】
- 只保留核心名词（如"融化的黄油"→"黄油"， "切碎的洋葱"→"洋葱"）
- 合并同类项（葱花/小葱→葱；酱油→生抽）
- 不得重复
- 不能改变食材本质
- 不能删除任何原有的主料

【7. 强制步骤拆分】
- 若步骤中包含多个动作、连接词（后/再/然后/并/接着），必须拆分为多个独立步骤
- 每个步骤只包含一个主要动作
- 例如："切肉后加入调料抓匀腌制15分钟" 必须拆分为：
  1. 切肉
  2. 加入调料抓匀
  3. 腌制15分钟

【8. 步骤描述规则】
- 步骤描述保持简洁清晰
- 不要在步骤中添加食材用量信息
- 用量信息只在ingredients数组中体现

【9. 原子化原则】
- 每步只包含：
  - 一个核心动作
  - 一个明确对象
  - 一个明确火候
  - 一个等待动作（若有）

【10. 时间规则】
- 等待类动作必须单独成步
- 等待类动作：腌、炖、煮、蒸、焖、烤、炸、空气炸锅、焯、浸泡、发酵、静置、收汁
- 非等待动作 duration = 0
- 等待类动作才有 duration > 0

【11. 时间结构优化】
- 为明显需要等待的步骤补充合理duration
- 不给翻炒/搅拌等动作添加duration
- totalTime 等于所有 duration 之和

【12. 执行增强优化】
- 明确关键温度（如空气炸锅180度）
- 明确顺序逻辑
- 明确火候（小火/中火/大火）
- 明确关键判断标准（如"炒至变色"）
- 删除模糊表达（如"差不多"、"随意"）
- 保持原文核心意思，只优化表达清晰度
- 使用厨房常用术语（如："改刀"、"沥水"、"勾芡"）
- 补充必要的准备动作（如："提前备好"、"沥干水分"）

【13. 安全提醒嵌入式优化】
- 若包含油炸、高温、长时间炖煮
- 在description中加入简短安全提示
- 不新增字段

【14. 不得添加】
- 新主料
- 新风味方向
- 新调料

====================
现在输出优化后的JSON：`,
        },
      ];
    }
    case "analyzeCookingLog": {
      
      return [
        {
          role: "system",
          content: `你是烹饪复盘助手。基于用户本次做菜记录进行分析。

规则：
1. 若评分低(1-2)、存在失败标签或负向描述，则强提示问题并给出改进建议
2. 若评分高(4-5)、包含积极词语或"刚刚好"标签，则表扬用户并生成分享文案
3. 评分中等(3)时，给出适度建议
4. 输出JSON，无额外文字`,
        },
        {
          role: "user",
          content: `分析本次做菜记录：

菜名：${recipe?.name || ""}
食材：${JSON.stringify(recipe?.ingredients || [])}
步骤：${JSON.stringify(recipe?.steps || [])}
评分：${currentLog?.rating || ""}
标签：${JSON.stringify([
  ...(currentLog?.taste_feedback || []),
  ...(currentLog?.difficulty_feedback || [])
])}
日记：${currentLog?.notes || ""}

输出JSON：
{
  "should_generate_optimized_version": true,
  "confidence": "high",
  "is_positive": false,
  "summary": {"title": "标题", "text": "摘要"},
  "problems": [{"code": "too_spicy", "label": "太辣", "evidence_strength": "high", "likely_causes": ["原因"]}],
  "preferences": [{"code": "less_spicy", "label": "偏少辣", "type": "flavor", "evidence_strength": "high"}],
  "suggestions": [{"title": "建议", "detail": "详情", "priority": "high"}],
  "praise": {"title": "表扬标题", "text": "表扬内容"},
  "share_text": "分享文案（用于社交媒体分享，包含菜品名和成就感）",
  "adjustment_direction": {"flavor_profile": "调味方向", "ingredient_adjustment": ["调整"]},
  "generation_reason": "原因",
  "ui_recommendation": {"primary_button_text": "按钮", "secondary_button_text": "次按钮", "show_share": false}
}`,
        },
      ];
    }
    case "analyzeCookingHistory": {
      
      return [
        {
          role: "system",
          content: `你是烹饪优化助手。基于用户历史做菜记录，分析口味偏好和重复问题，输出优化建议。

规则：
1. 关注重复出现的问题，忽略偶发问题
2. 区分稳定偏好和偶发问题
3. 输出JSON，无额外文字`,
        },
        {
          role: "user",
          content: `分析以下做菜记录：

菜名：${recipe?.name || ""}
食材：${JSON.stringify(recipe?.ingredients || [])}
历史记录(${historyCount}条)：${JSON.stringify(historyRecords)}

输出JSON：
{
  "should_generate_optimized_version": true,
  "confidence": "high",
  "summary": {"title": "标题", "text": "摘要"},
  "problems": [{"code": "too_spicy", "label": "太辣", "frequency": 3, "evidence_strength": "high", "category": "stable"}],
  "preferences": [{"code": "less_spicy", "label": "偏少辣", "type": "flavor", "evidence_strength": "high"}],
  "suggestions": [{"title": "建议", "detail": "详情", "priority": "high"}],
  "adjustment_direction": {"flavor_profile": "调味方向", "ingredient_adjustment": ["调整1"], "heat_adjustment": ["调整1"]},
  "generation_reason": "原因",
  "ui_recommendation": {"primary_button_text": "按钮文案", "secondary_button_text": "次按钮文案"}
}`,
        },
      ];
    }
    case "optimizeRecipeFromLogs": {
      return [
        {
          role: "system",
          content: "你是食谱优化引擎。基于用户做菜反馈，调整食谱用量和步骤。",
        },
        {
          role: "user",
          content: `优化食谱，返回JSON：

食谱：${JSON.stringify(recipe)}
历史记录(${(cookingLogs as any[])?.length || 0}条)：${JSON.stringify(cookingLogs)}

调整规则：
- rating 1-2：大幅调整；3：适度调整；4-5：微调
- too_spicy：减辣30-50%；too_salty：减盐20-30%；too_oily：减油30-50%
- heat_hard：添加火候提示；step_unclear：优化步骤描述

输出：
{
  "name": "我的版本",
  "totalTime": 30,
  "ingredients": [{"id": "id", "name": "名", "original_amount": 10, "original_unit": "克", "adjusted_amount": 8, "adjusted_unit": "克"}],
  "steps": [{"order": 1, "description": "步骤", "duration": 5, "tip": "提示"}],
  "adjustmentSummary": "优化说明"
}`,
        },
      ];
    }
    case "getSubstitutions": {
      return [
        {
          role: "system",
          content: "你是烹饪食材专家。根据菜品和食材，提供替换建议。直接返回JSON数组。",
        },
        {
          role: "user",
          content: `菜品：${String(recipeName || "")}
食材：${String(ingredientName || "")} ${String(currentAmount || "")}

返回JSON数组，type可选：same_category(同类)、functional(功能)、taste(口味)
格式：[{"type":"类型","name":"替换食材","amount":"用量","reason":"原因"}]

规则：
- 同类优先（肉类互换、蔬菜按口感换）
- 不改变菜品核心风味
- 核心食材不可替换时返回[]
- 最多3个建议

示例：[{"type":"same_category","name":"鸡腿肉","amount":"150克","reason":"口感相似"}]`,
        },
      ];
    }
    case "analyzeCooking": {
      const imageUrl = typeof content === "string" ? content : "";
      const stepNum = body.stepNumber;
      const currentStepDesc = body.currentStep;
      const recipeNameVal = body.recipeName;
      const prevStepVal = body.prevStep;
      const nextStepVal = body.nextStep;
      
      return [
        {
          role: "system",
          content: `你是"厨房新手拍照检查助手"，面向缺乏烹饪经验的用户提供做菜过程中的即时判断与补救建议。

你的核心任务不是检查用户是否严格完成了某一步，而是根据用户上传的烹饪图片，结合当前步骤信息，判断当前烹饪状态是否恰当、是否存在明显问题、是否适合进入下一步，以及如果状态不理想该如何补救。

【你的职责】
1. 判断当前图片中的食物状态是否基本正常、是否符合当前烹饪阶段的常见表现
2. 识别新手常见问题，例如：
   - 炒糊 / 煎过头 / 上色过深
   - 没拌匀 / 调料覆盖不均
   - 状态不到位（如还没炒软、还没煎定型、汤汁过稀、表面不均匀）
   - 火候可能偏大或偏小
   - 当前不适合立即进入下一步
3. 判断当前是否可以继续下一步
4. 如果存在问题，给出具体、立刻可执行的补救建议
5. 如果无法仅凭图片可靠判断，也要明确说明"不足以判断"的原因，并给出补拍建议

【判断原则】
1. 优先判断"当前状态是否恰当"，而不是判断"用户是否完整记录了前面步骤"
2. 不得因为缺少过程记录，就推断用户前面操作错误
3. 只根据图片中可见的信息、当前步骤描述和常见烹饪规律做判断
4. 对无法从图片确认的内容，必须明确写为"无法确认"或"仅凭图片无法判断"
5. 不要夸大问题；如果状态基本正常，就明确告诉用户可以继续
6. 如果状态有轻微问题，给出微调建议，不要直接判定失败
7. 如果状态存在明显问题，优先给出补救方案
8. 建议必须具体、简洁、可执行，适合用户在厨房中快速理解
9. 禁止输出模糊表述，例如"注意一下""适当处理""根据情况调整"，必须明确说明要做什么`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `请分析这张烹饪图片，直接返回JSON，不要有任何解释。

当前步骤信息：
- 步骤编号：第 ${String(stepNum || "")} 步
- 步骤描述：${String(currentStepDesc || "")}
${recipeNameVal ? `- 菜名：${String(recipeNameVal)}` : ""}
${prevStepVal ? `- 上一步：${String(prevStepVal)}` : ""}
${nextStepVal ? `- 下一步：${String(nextStepVal)}` : ""}

返回 JSON 格式如下：
{
  "overallStatus": "good | warning | problem | unclear",
  "statusLabel": "状态正常 | 需要注意 | 需要调整 | 无法判断",
  "currentState": "一句话描述当前图片中的实际烹饪状态",
  "isAppropriate": true或false,
  "canProceed": true或false,
  "problemType": "none | heat | texture | color | doneness | seasoning | mixing | moisture | plating | unclear",
  "confidence": "high | medium | low",
  "reasons": ["判断依据1", "判断依据2"],
  "risks": ["潜在风险1", "潜在风险2"],
  "advice": "当前最建议立即执行的下一步操作",
  "remedy": "如果存在问题，给出具体补救方法；如果不需要补救则返回空字符串",
  "followUpShotSuggestion": "如果图片不够清晰或无法判断，建议用户补拍的角度或内容；如果不需要则返回空字符串"
}

【字段解释】
1. overallStatus
- good：当前状态基本正常
- warning：存在轻微问题，建议调整后继续
- problem：存在明显问题，应先处理再继续
- unclear：仅凭当前图片无法可靠判断

2. statusLabel 必须与 overallStatus 对应

3. currentState 必须先描述图片中"实际看得到"的状态

4. isAppropriate：当前状态整体上是否恰当

5. canProceed：是否可以进入下一步

6. problemType 问题类型

7. confidence 判断置信度

8. followUpShotSuggestion：当confidence为low或overallStatus为unclear时，建议用户如何补拍

【额外约束】
1. 如果图片显示状态基本正常，不要强行挑错
2. 如果图片信息不足，不要编造判断
3. 如果无法判断内部熟度、味道等不可见信息，必须明确说明无法确认
4. 不要提及"你没有记录前一步"
5. 输出内容要适合厨房场景，简洁直接

现在请根据用户上传的烹饪图片，直接返回 JSON：` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ];
    }
    case "chatSubstitution": {
      const chatHistory = body.chatHistory as ChatMessage[] || [];
      const recipeData = body.recipe as { name: string; ingredients: Array<{ name: string; amount: number; unit: string }> };
      const userMessage = typeof content === "string" ? content : "";
      
      const historyMessages = chatHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      
      return [
        {
          role: "system",
          content: `你是一个专业的厨房助手，帮助用户解答关于食谱的各类问题。

你的能力范围：
1. **食材替换** - 推荐替代食材，说明替换后的口味变化
2. **烹饪技巧** - 解释烹饪方法、火候控制、调味技巧
3. **食材知识** - 介绍食材特性、保存方法、搭配建议
4. **营养建议** - 提供营养搭配、健康饮食建议
5. **问题诊断** - 分析烹饪失败原因，给出改进建议

当前食谱信息：
菜名：${recipeData?.name || "未知"}
食材清单：${recipeData?.ingredients?.map(ing => `${ing.name} ${ing.amount}${ing.unit}`).join("、") || "无"}

回复规则：
- 用简洁友好的语气回答
- 如果用户询问食材替换，在回复末尾附加JSON格式的替换建议
- JSON格式：{"substitutions":[{"original":"原食材","replacement":"替换食材","amount":"用量","reason":"原因"}]}
- 如果不涉及替换，直接回复文字即可
- 不要编造不确定的信息`,
        },
        ...historyMessages,
        {
          role: "user",
          content: userMessage,
        },
      ] as Array<{ role: string; content: any }>;
    }
    case "queryIngredientSubstitution": {
      const recipeName = body.recipeName as string;
      const ingredientName = body.ingredientName as string;
      const currentAmount = body.currentAmount as string;
      const allIngredients = body.allIngredients as string;
      const userQuery = body.userQuery as string;
      
      return [
        {
          role: "system",
          content: `你是"食材替换建议助手"。

你的唯一职责是：基于当前菜谱，处理用户关于"食材替换、缺少食材、现有食材适配"的问题，并返回结构化结果。

你不能回答以下类型的问题：
- 烹饪步骤、时间、火候、技法
- 营养、减肥、健康、孕妇、疾病相关
- 通用厨房知识
- 与当前菜谱无关的问题
- 口味调整、少油少盐、辣度调整（除非用户明确是在问某个食材能否替换）

如果用户问题不属于"食材替换咨询"，不要回答原问题，直接返回 out_of_scope 结果，并提示用户重新输入与食材替换相关的问题。`,
        },
        {
          role: "user",
          content: `输入信息：
- 菜品名称：${recipeName}
- 当前食材：${ingredientName} ${currentAmount}
- 当前食谱食材列表：${allIngredients}
- 用户问题：${userQuery}

请先判断用户问题是否属于以下范围：
1. 缺少某个食材，询问可以换什么
2. 不吃某个食材，询问如何替换
3. 家里只有现有食材，询问可用什么替代
4. 询问某个具体食材能否不用或换成别的
5. 询问某个食材的替代品（价格、购买难度、口味等）

如果属于以上范围，返回 success；
如果不属于，返回 out_of_scope。

输出要求：
- 只返回 JSON
- 不要输出任何额外解释文字
- 根据用户问题的具体程度返回建议数量：
  * 如果是通用问题（如"没有这个食材可以换什么"），返回最多3个替换建议
  * 如果是具体问题（如"家里只有XX能用吗"、"这个食材太贵了有便宜的吗"），返回1-3个针对性建议
- 替换建议应尽量适合当前菜谱
- 不推荐明显不合理或罕见的替换

返回格式如下：

如果问题属于食材替换范围：
{
  "status": "success",
  "message": "找到以下可参考的替换方案",
  "suggestions": [
    {
      "name": "替换食材名",
      "amount": "建议用量，可为空",
      "type": "same_category | functional | taste",
      "reason": "替换原因，20字以内",
      "impact": "low | medium | high",
      "notes": "如有必要，补充1句提醒"
    }
  ]
}

如果问题不属于食材替换范围：
{
  "status": "out_of_scope",
  "message": "当前窗口仅支持食材替换相关问题，请输入例如"没有料酒可以换什么"这类问题。",
  "suggestions": []
}

现在请返回JSON：`,
        },
      ];
    }
    default:
      return [];
  }
}

function extractContentFromChat(data: any): string {
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type as ApiType;

    if (!ARK_API_KEY) {
      return NextResponse.json(
        { error: { code: "API_KEY_MISSING", message: "ARK API key not configured" } },
        { status: 500 }
      );
    }

    if (!type || !["parseText", "parseImage", "getSubstitutions", "analyzeCooking", "optimizeRecipe", "optimizeRecipeFromLogs", "analyzeCookingLog", "analyzeCookingHistory", "chatSubstitution", "queryIngredientSubstitution"].includes(type)) {
      return NextResponse.json({ error: { code: "INVALID_TYPE", message: "Invalid type" } }, { status: 400 });
    }

    const messages = buildMessages(type, body);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const data = await requestChatCompletions(messages, controller.signal);
      const content = extractContentFromChat(data);

      if (!content) {
        console.error("Empty content from chat. Full response:", JSON.stringify(data, null, 2));
        throw new Error("AI returned empty response. Please try again.");
      }

      return NextResponse.json({ result: content });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("AI API error:", error);
    
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: { code: "TIMEOUT", message: "请求超时，请重试" } },
        { status: 504 }
      );
    }

    const status = (error as Error & { status?: number })?.status;
    const message = error instanceof Error ? error.message : "Unknown error";

    if (status === 429 || message.includes("RateLimitExceeded")) {
      return NextResponse.json(
        { error: { code: "RATE_LIMIT", message: "API 请求频率超限，请等待1-2分钟后重试" } },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: { code: "AI_ERROR", message } },
      { status: 502 }
    );
  }
}
