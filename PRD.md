
# Meal Assistant - 产品需求文档 (PRD)

## 1. 产品概述

### 1.1 产品定位
Meal Assistant 是一款AI驱动的智能烹饪助手，旨在帮助用户管理食谱、优化烹饪过程、记录烹饪心得，并通过AI技术持续学习和改进用户的烹饪体验。

### 1.2 核心价值
- **智能食谱管理**：便捷地导入、编辑和管理个人食谱库
- **AI辅助烹饪**：提供实时的烹饪指导和优化建议
- **持续学习优化**：基于用户反馈自动优化食谱
- **食材灵活替换**：AI智能推荐食材替代品

---

## 2. 功能架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                           │
├─────────────────────────────────────────────────────────────┤
│  首页  │  食谱详情  │  烹饪模式  │  导入页面  │  日志页面 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        状态管理层                          │
├─────────────────────────────────────────────────────────────┤
│              Zustand (食谱状态 + 烹饪状态)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层                             │
├─────────────────────────────────────────────────────────────┤
│  食谱服务  │  AI服务  │  优化服务  │  烹饪检查服务        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据存储层                           │
├─────────────────────────────────────────────────────────────┤
│          Supabase (数据库)  │  LocalStorage (本地)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        AI服务层                             │
├─────────────────────────────────────────────────────────────┤
│              豆包AI (文本/图片解析 + 智能优化)              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 类别 | 技术选型 |
|------|---------|
| 前端框架 | Next.js 14.2.3 + React 18 |
| UI框架 | Tailwind CSS 3.4.1 |
| 状态管理 | Zustand 4.5.2 |
| 数据库 | Supabase |
| AI服务 | 豆包AI (火山引擎) |
| 图标库 | lucide-react 0.378.0 |
| 编程语言 | TypeScript 5 |

---

## 3. 核心功能模块

### 3.1 食谱管理模块

#### 3.1.1 功能描述
提供完整的食谱CRUD操作，包括浏览、搜索、查看详情、编辑和删除食谱。

#### 3.1.2 主要页面
- **首页 (/)**
  - 食谱列表展示（卡片式布局）
  - 搜索功能（按食谱名称）
  - 显示平均评分和烹饪次数
  - 快速添加新食谱入口

- **食谱详情页 (/recipe/[id])**
  - 食谱基本信息（名称、总时长、封面图）
  - 食材清单展示
  - 制作步骤展示（含预计时长、小贴士）
  - 版本切换（原始版本/我的优化版本）
  - 份量调整（0.5x/1x/1.5x/2x）
  - 食材临时调整（替换/移除）
  - 开始烹饪入口
  - 编辑/删除操作

#### 3.1.3 数据模型
```typescript
interface Recipe {
  id: string;
  user_id: string;
  name: string;
  image_url?: string;
  total_time: number;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  created_at: string;
  updated_at: string;
}

interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  is_optional: boolean;
  note?: string;
  scalable?: boolean;
}

interface Step {
  id: string;
  order: number;
  description: string;
  duration: number;
  is_key_step: boolean;
  tip?: string;
  image_url?: string;
  ingredients?: StepIngredient[];
}
```

---

### 3.2 食谱导入模块

#### 3.2.1 功能描述
支持多种方式导入食谱，包括手动输入、文本解析和图片识别。

#### 3.2.2 导入方式
1. **手动导入**
   - 逐行输入食材和用量
   - 逐步添加制作步骤
   - 支持上传封面图
   - 可关联步骤与所需食材

2. **文本导入**
   - 粘贴食谱文本内容
   - AI自动解析食材和步骤
   - 支持封面图上传
   - 解析后可编辑调整

3. **图片导入**
   - 上传食谱图片（菜谱截图、照片等）
   - AI OCR识别并解析内容
   - 自动提取食材和步骤

#### 3.2.3 AI优化功能
- 导入后可一键AI优化
- 优化前后对比展示
- 高亮显示改进内容

---

### 3.3 智能烹饪模块

#### 3.3.1 功能描述
提供沉浸式的烹饪指导体验，帮助用户按步骤完成菜品制作。

#### 3.3.2 主要页面
- **烹饪模式页 (/cook/[id])**
  - 分步引导（上一步/下一步）
  - 当前步骤详细说明
  - 本步骤食材清单
  - 步骤小贴士
  - 计时器功能（开始/暂停/重置）
  - 进度条展示
  - 全部食材弹窗
  - AI拍照检查功能
  - 完成后跳转到日志记录

#### 3.3.3 烹饪状态管理
```typescript
interface CookingSession {
  sessionId: string;
  recipeId: string;
  recipeName: string;
  versionType: "original" | "my";
  startTime: string;
  endTime?: string;
  status: "active" | "completed" | "abandoned";
  photoCheckEvents: PhotoCheckEvent[];
}
```

---

### 3.4 AI拍照检查模块

#### 3.4.1 功能描述
通过AI分析用户上传的烹饪过程照片，提供实时反馈和建议。

#### 3.4.2 核心功能
- 拍照上传当前步骤成果
- AI分析烹饪状态（火候、质地、颜色、熟度等）
- 评估是否可以继续下一步
- 提供改进建议和补救措施
- 记录检查结果供后续优化参考

#### 3.4.3 分析结果类型
```typescript
type CookingCheckStatus = 'good' | 'warning' | 'problem' | 'unclear';
type CookingProblemType = 
  | 'none' | 'heat' | 'texture' | 'color' | 'doneness'
  | 'seasoning' | 'mixing' | 'moisture' | 'plating' | 'unclear';

interface CookingPhotoCheckResult {
  overallStatus: CookingCheckStatus;
  statusLabel: string;
  currentState: string;
  isAppropriate: boolean;
  canProceed: boolean;
  problemType: CookingProblemType;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  risks: string[];
  advice: string;
  remedy: string;
}
```

---

### 3.5 食材智能替换模块

#### 3.5.1 功能描述
当用户缺少某些食材时，AI智能推荐合适的替代品。

#### 3.5.2 主要功能
- 点击食材发起替换查询
- AI提供多种替换建议
- 建议分类：同类替换、功能替换、口味替换
- 显示风味影响评估（小/中/大）
- 支持自定义问题查询
- 历史替换记录
- 一键应用替换（仅本次烹饪生效）

#### 3.5.3 推荐问题
- "家里只有其他食材，能用吗"
- "这个食材太贵了，有便宜的吗"
- "这个食材不好买，有常见的吗"

---

### 3.6 烹饪日志模块

#### 3.6.1 功能描述
记录每次烹饪的体验和反馈，为AI优化提供数据基础。

#### 3.6.2 主要页面
- **新建日志页 (/recipe/[id]/log/new)**
  - 评分（1-5星）
  - 口味反馈（多选）
  - 难度反馈（多选）
  - 详细备注
  - 上传成品照片
  - 是否应用到食谱优化

- **日志列表页 (/recipe/[id]/logs)**
  - 历史烹饪记录时间线
  - 每次记录的评分和反馈
  - 照片展示
  - AI总结分析

- **日志详情页 (/recipe/[id]/log/[logId])**
  - 单条日志完整信息
  - 系统总结（拍照检查记录）
  - 编辑/删除操作

#### 3.6.3 反馈选项
**口味问题：**
- 太辣了
- 太咸了
- 太油了
- 太淡了
- 太甜了
- 太酸了
- 刚刚好

**难度问题：**
- 食材准备太麻烦
- 某一步没看懂
- 火候不好掌握
- 时间不够
- 调味不确定
- 过程太复杂

---

### 3.7 AI食谱优化模块

#### 3.7.1 功能描述
基于用户的烹饪日志历史，AI自动分析并优化食谱，生成个性化的"我的版本"。

#### 3.7.2 优化触发条件
- 用户至少有2次烹饪记录
- 存在一致的问题反馈
- AI分析达到足够置信度

#### 3.7.3 优化流程
1. **历史记录分析**
   - 收集所有烹饪日志
   - 识别重复出现的问题
   - 分析用户偏好
   - 评估问题稳定性

2. **生成优化方案**
   - 调整食材用量
   - 优化步骤描述
   - 增加/修改小贴士
   - 调整烹饪时长

3. **展示优化内容**
   - 变更说明列表
   - 每项变更的原因
   - 整体优化总结
   - 基于多少条日志

4. **版本管理**
   - 保留原始版本
   - 保存优化版本
   - 支持版本切换
   - 可重新生成优化

#### 3.7.4 数据模型
```typescript
interface OptimizedRecipe {
  id: string;
  recipe_id: string;
  user_id: string;
  name: string;
  total_time: number;
  ingredients: OptimizedIngredient[];
  steps: OptimizedStep[];
  changes_explanation?: ChangeExplanation[];
  adjustment_summary: string;
  based_on_logs_count: number;
  created_at: string;
  updated_at: string;
}

interface ChangeExplanation {
  type: "ingredient" | "step" | "time" | "tip";
  target: string;
  original?: string;
  adjusted: string;
  reason: string;
}
```

---

### 3.8 AI主动提示模块

#### 3.8.1 功能描述
在食谱详情页顶部，AI主动提示用户可进行的优化。

#### 3.8.2 触发条件
- 该食谱有2条以上烹饪记录
- AI分析发现可优化点

#### 3.8.3 展示内容
- 悬浮提示条
- 收起/展开切换
- 主要问题标签
- 查看详情入口

---

## 4. API接口设计

### 4.1 AI相关接口

#### 4.1.1 POST /api/ai
通用AI请求接口，封装豆包AI调用。

#### 4.1.2 POST /api/recipe-adjustment/analyze-current-record
分析单条烹饪记录。

**请求：**
```typescript
{
  recipe_base: RecipeBase;
  current_record: CookRecord;
}
```

**响应：**
```typescript
{
  analysis_result: AnalysisResult;
}
```

#### 4.1.3 POST /api/recipe-adjustment/analyze-history-records
分析历史烹饪记录。

**请求：**
```typescript
{
  recipe_base: RecipeBase;
  history_records: CookRecord[];
}
```

**响应：**
```typescript
{
  analysis_result: AnalysisResult;
}
```

#### 4.1.4 POST /api/recipe-adjustment/generate-optimized-recipe
生成优化后的食谱。

**请求：**
```typescript
{
  recipe_base: RecipeBase;
  analysis_result: AnalysisResult;
}
```

**响应：**
```typescript
{
  optimized_recipe: OptimizedRecipe;
}
```

---

## 5. 数据库设计

### 5.1 主要数据表

#### 5.1.1 recipes (食谱表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| user_id | uuid | 用户ID |
| name | text | 食谱名称 |
| image_url | text | 封面图片URL |
| total_time | int | 总时长（分钟） |
| servings | int | 份量 |
| ingredients | jsonb | 食材列表 |
| steps | jsonb | 步骤列表 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### 5.1.2 cooking_logs (烹饪日志表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| recipe_id | uuid | 关联食谱ID |
| user_id | uuid | 用户ID |
| rating | int | 评分（1-5） |
| taste_note | text | 口味备注 |
| improvement | text | 改进建议 |
| apply_to_recipe | boolean | 是否应用优化 |
| cooked_at | timestamptz | 烹饪时间 |
| images | text[] | 照片列表 |
| taste_feedback | text[] | 口味反馈标签 |
| difficulty_feedback | text[] | 难度反馈标签 |
| difficulty_detail | text | 难度详情 |
| notes | text | 备注 |
| system_summary | jsonb | 系统总结 |
| step_photos | jsonb | 步骤照片 |
| created_at | timestamptz | 创建时间 |

#### 5.1.3 optimized_recipes (优化食谱表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| recipe_id | uuid | 关联食谱ID |
| user_id | uuid | 用户ID |
| name | text | 食谱名称 |
| total_time | int | 总时长 |
| ingredients | jsonb | 优化后食材 |
| steps | jsonb | 优化后步骤 |
| changes_explanation | jsonb | 变更说明 |
| adjustment_summary | text | 优化总结 |
| based_on_logs_count | int | 基于多少条日志 |
| analysis_stability | text | 分析稳定性 |
| generation_reason | text | 生成原因 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

#### 5.1.4 analysis_cache (分析缓存表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| analysis_type | text | 分析类型 |
| analysis_result | jsonb | 分析结果 |
| source_log_ids | uuid[] | 源日志ID列表 |
| user_id | uuid | 用户ID |
| created_at | timestamptz | 创建时间 |

---

## 6. 用户流程

### 6.1 完整烹饪流程

```
1. 首页选择食谱
   ↓
2. 查看食谱详情
   ├─ 可选：调整份量
   ├─ 可选：临时替换食材
   └─ 可选：切换到优化版本
   ↓
3. 开始烹饪
   ↓
4. 按步骤操作
   ├─ 查看步骤说明
   ├─ 使用计时器
   ├─ 可选：拍照检查
   └─ 上一步/下一步
   ↓
5. 完成烹饪
   ↓
6. 记录烹饪日志
   ├─ 评分
   ├─ 口味反馈
   ├─ 难度反馈
   ├─ 上传照片
   └─ 详细备注
   ↓
7. AI学习优化（后台）
```

### 6.2 食谱导入流程

```
1. 点击添加食谱
   ↓
2. 选择导入方式
   ├─ 手动输入
   ├─ 文本解析
   └─ 图片识别
   ↓
3. 输入/上传内容
   ↓
4. AI解析（非手动方式）
   ↓
5. 编辑调整
   ↓
6. 可选：AI优化
   ↓
7. 保存食谱
```

---

## 7. 核心业务逻辑

### 7.1 临时调整应用逻辑
当用户在食谱详情页进行食材替换或移除时，系统需要：
1. 更新临时调整状态
2. 重新计算sessionRecipe（会话食谱）
3. 在步骤描述中替换食材名称
4. 应用到当前会话

### 7.2 AI优化触发逻辑
- 用户提交烹饪日志后
- 检查是否有足够的历史记录（≥2条）
- 分析是否有一致的问题模式
- 达到置信度阈值后自动生成优化版本

### 7.3 版本切换逻辑
- 保留原始版本不变
- 优化版本作为独立记录
- 用户可随时在两个版本间切换
- 烹饪时可选择使用哪个版本

---

## 8. 状态管理

### 8.1 食谱状态 (useRecipeStore)
- recipes: 食谱列表
- currentRecipe: 当前食谱
- scaleFactor: 份量倍数
- tempAdjustments: 临时调整
- sessionRecipe: 会话食谱（应用了调整后的版本）

### 8.2 烹饪状态 (useCookingStore)
- currentStepIndex: 当前步骤索引
- isTimerRunning: 计时器是否运行
- remainingTime: 剩余时间
- currentSession: 当前烹饪会话
- photoCheckEvents: 拍照检查事件

---

## 9. 非功能需求

### 9.1 性能要求
- 页面加载时间 &lt; 2秒
- AI解析响应时间 &lt; 10秒
- 拍照检查响应时间 &lt; 5秒
- 支持离线使用（本地存储模式）

### 9.2 兼容性要求
- 移动端优先设计
- 支持PWA安装
- 响应式布局（最大宽度md）

### 9.3 数据安全
- 用户数据存储在Supabase中
- 本地存储作为备用方案
- 不存储敏感信息

---

## 10. 未来规划

### 10.1 短期规划
- 多用户支持
- 食谱分享功能
- 社区食谱库
- 购物清单生成

### 10.2 长期规划
- 语音指导
- 多语言支持
- 营养分析
- 饮食计划
