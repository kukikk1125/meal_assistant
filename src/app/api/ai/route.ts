import { NextRequest, NextResponse } from "next/server";

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = (process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
const ARK_MODEL = process.env.ARK_MODEL || "doubao-seed-2-0-mini-260215";
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60_000);

type ApiType = "parseText" | "parseImage" | "getSubstitutions" | "analyzeCooking" | "optimizeRecipe" | "chatSubstitution";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const recipe = body.recipe;

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

【3. 食材总量计算】
- ingredients中的amount是该食材在整道菜中的总用量
- 如果某食材在多个步骤中使用，需要累加所有步骤的用量
- scalable字段： 主料和主要调料填true，装饰性食材填false

【4. 步骤食材用量】
- 每个步骤的ingredients数组列出该步骤实际使用的食材及用量
- ingredientId必须对应ingredients中的id
- amount是该步骤使用的具体用量
- 如果步骤中未明确用量，根据常识估算

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

【3. 食材总量计算】
- ingredients中的amount是该食材在整道菜中的总用量
- 如果某食材在多个步骤中使用，需要累加所有步骤的用量
- scalable字段： 主料和主要调料填true，装饰性食材填false

【4. 步骤食材用量】
- 每个步骤的ingredients数组列出该步骤实际使用的食材及用量
- ingredientId必须对应ingredients中的id
- amount是该步骤使用的具体用量
- 如果步骤中未明确用量，根据常识估算

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

【1. 智能用量估算（优先）】
- 如果菜谱中没有食材分量，根据菜名 + 食材组合，给出合理的家常用量
- 所有菜单都以**一人份**为标准配比
- 主料按一人份合理估算（如：肉类100-150克，蔬菜200-300克）
- 调料按一人份小剂量估算（如：盐2克，生抽15毫升）
- 不得填0，必须给出合理数值

【2. 食材ID生成规则】
- 为每个食材生成唯一ID，格式：ing_食材拼音或英文
- 例如：盐 → ing_salt, 食用油 → ing_oil, 鸡蛋 → ing_egg
- ID必须全小写，用下划线连接

【3. 食材总量计算】
- ingredients中的amount是该食材在整道菜中的总用量
- 如果某食材在多个步骤中使用，需要累加所有步骤的用量
- scalable字段： 主料和主要调料填true，装饰性食材填false

【4. 步骤食材用量】
- 每个步骤的ingredients数组列出该步骤实际使用的食材及用量
- ingredientId必须对应ingredients中的id
- amount是该步骤使用的具体用量
- 合理分配食材用量到各个步骤

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
      return [
        {
          role: "system",
          content: "你是烹饪指导助手。请分析用户提供的烹饪图片，直接返回JSON格式结果，不要有任何解释。",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `请分析这张烹饪图片，直接返回JSON，不要有任何解释。当前第${String(stepNumber || "")}步：${String(currentStep || "")}。要求返回的JSON格式：{"status":"当前阶段判断","suggestion":"下一步建议","warning":"风险预警(可选)"}` },
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

    if (!type || !["parseText", "parseImage", "getSubstitutions", "analyzeCooking", "optimizeRecipe", "chatSubstitution"].includes(type)) {
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
