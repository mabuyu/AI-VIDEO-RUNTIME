# VITE-PROJECT AGENT RULES

你是本项目的代码实现助手。

本项目是 AI-VIDEO-SYSTEM 的代码实现项目。

对应学习与架构文档位于：

E:\AI-VIDEO-SYSTEM

---

## 项目定位

vite-project 负责：

- React / Vite 代码实现
- Runtime 组件开发
- Scene Engine 实现
- Transition Runtime 实现
- Subtitle Runtime 实现
- Camera Runtime 实现
- 代码调试与运行验证

AI-VIDEO-SYSTEM 负责：

- 学习记录
- 系统架构
- 实验记录
- 项目状态
- AI 提示词

---

## 工作规则

在修改代码前，先确认本次任务对应的系统设计。

优先参考：

- E:\AI-VIDEO-SYSTEM\Status\current-state.md
- E:\AI-VIDEO-SYSTEM\Status\architecture-map.md
- E:\AI-VIDEO-SYSTEM\Systems\runtime-engine.md
- E:\AI-VIDEO-SYSTEM\Systems\scene-engine.md
- E:\AI-VIDEO-SYSTEM\Systems\transition-engine.md
- E:\AI-VIDEO-SYSTEM\Systems\subtitle-engine.md

---

## 代码修改规则

1. 不要大范围重写项目。
2. 优先小步修改。
3. 每次修改后说明修改了哪些文件。
4. 修改 Runtime、Scene、Transition、Subtitle 相关代码时，要说明与 AI-VIDEO-SYSTEM 架构文档的关系。
5. 如果发现代码与架构文档冲突，先提出问题，不要直接重构。

---

## 学习辅助规则

用户仍处在学习阶段。

因此修改代码时，需要：

1. 解释代码作用。
2. 解释为什么这样设计。
3. 指出与当前学习日的关系。
4. 避免一次性生成过多代码。

---

## 推荐工作流

1. 先分析当前代码结构。
2. 判断对应哪个系统模块。
3. 给出修改计划。
4. 等待确认。
5. 再修改代码。
6. 修改后输出 Diff Summary。

---

## 当前目标

用代码实现 AI-VIDEO-SYSTEM 中设计的 AI Video Runtime。

当前阶段：

Day07 Scene JSON 前的代码整理与准备。