import { listen } from '@tauri-apps/api/event';
import { sessionsApi, agentTasksApi, gitApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import queryClient from '../../../lib/queryClient';
import { useAgentPlanStore } from '../../../stores/agentPlanStore';
import { useAgentStore } from '../../../stores/agentStore';
import { createProvider } from './providers';
import { stripAnsi } from '../../../lib/stripAnsi';
import type { AgentProvider, AgentStreamEvent } from './AgentProvider';
import type { TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';

// ── Templates ──────────────────────────────────────────────

interface PlanTemplate {
  id: string;
  label: string;
  keywords: string[];
  goalPrefix: string;
  steps: Array<{ title: string; description: string }>;
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'feature',
    label: '新功能',
    keywords: ['实现', '添加', '新增', '创建', '开发', '功能', 'feature', 'add', 'create'],
    goalPrefix: '实现新功能：',
    steps: [
      { title: '分析需求和现有代码', description: '阅读需求描述，分析现有代码结构，确定需要修改的文件和模块' },
      { title: '设计实现方案', description: '确定技术方案、数据模型、接口设计' },
      { title: '实现核心逻辑', description: '编写主要业务逻辑代码' },
      { title: '编写测试', description: '为新功能编写单元测试和集成测试' },
      { title: '验证和清理', description: '运行测试，确保通过，清理临时代码' },
    ],
  },
  {
    id: 'bugfix',
    label: 'Bug 修复',
    keywords: ['修复', 'fix', 'bug', '问题', '错误', '报错', '异常', '崩溃'],
    goalPrefix: '修复 Bug：',
    steps: [
      { title: '复现和定位问题', description: '理解 bug 描述，找到相关的代码位置' },
      { title: '分析根因', description: '分析导致 bug 的根本原因' },
      { title: '实施修复', description: '编写最小化修复代码' },
      { title: '验证修复', description: '运行相关测试，确认 bug 已修复且无回归' },
    ],
  },
  {
    id: 'refactor',
    label: '代码重构',
    keywords: ['重构', 'refactor', '优化', '改善', '清理', '简化'],
    goalPrefix: '重构：',
    steps: [
      { title: '分析现有代码', description: '阅读需要重构的代码，理解当前实现和依赖关系' },
      { title: '制定重构计划', description: '确定重构策略、目标结构、风险点' },
      { title: '执行重构', description: '逐步进行代码重构，保持功能不变' },
      { title: '验证完整性', description: '运行测试确保重构没有破坏现有功能' },
    ],
  },
  {
    id: 'review',
    label: '代码审查',
    keywords: ['审查', 'review', '代码审查', 'code review', '检查代码'],
    goalPrefix: '审查代码：',
    steps: [
      { title: '阅读变更代码', description: '逐文件阅读需要审查的代码变更' },
      { title: '检查正确性', description: '检查逻辑错误、边界情况、错误处理' },
      { title: '检查质量和规范', description: '检查代码风格、命名、可维护性、性能' },
      { title: '输出审查报告', description: '汇总发现的问题和改进建议' },
    ],
  },
  {
    id: 'test',
    label: '编写测试',
    keywords: ['测试', 'test', '写测试', '单测', '单元测试', '集成测试'],
    goalPrefix: '编写测试：',
    steps: [
      { title: '分析待测代码', description: '阅读需要测试的代码，确定测试范围和策略' },
      { title: '设计测试用例', description: '设计覆盖正常路径、边界情况、错误情况的测试用例' },
      { title: '编写测试代码', description: '实现测试用例' },
      { title: '运行并验证', description: '运行测试，确保全部通过' },
    ],
  },
];

// ── Goal Parsing ───────────────────────────────────────────

interface ParsedGoal {
  goal: string;
  steps: Array<{ title: string; description: string }>;
}

function matchTemplate(goal: string): PlanTemplate | null {
  const lower = goal.toLowerCase();
  for (const tpl of PLAN_TEMPLATES) {
    if (tpl.keywords.some(kw => lower.includes(kw))) {
      return tpl;
    }
  }
  return null;
}

async function parseGoalWithClaude(goal: string, cwd: string): Promise<ParsedGoal> {
  const terminalId = `plan-parse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];

  const parsePrompt = `你是一个目标分析器。将用户的开发目标拆解为具体的实现步骤。

用户目标：${goal}

请返回一个 JSON 对象（不要包含 markdown 代码块标记），格式如下：
{
  "goal": "简要重述目标",
  "steps": [
    { "title": "步骤标题（简短）", "description": "步骤描述（具体做什么）" }
  ]
}

要求：
- 步骤数量 3-8 个
- 步骤按执行顺序排列
- 每个步骤标题不超过 20 字
- 每个步骤描述具体可执行
- 只返回 JSON，不要其他内容`;

  return new Promise<ParsedGoal>((resolve, reject) => {
    let jsonBuffer = '';
    let resultText: string | null = null;
    const emittedTextLengths = new Map<number, number>();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Goal parsing timed out'));
    }, 120_000);

    function cleanup() {
      clearTimeout(timeout);
    }

    // Collect text from stream-json events
    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      if (event.payload.stream === 'stderr') return;

      jsonBuffer += event.payload.data.replace(/\r/g, '');
      const lines = jsonBuffer.split('\n');
      const maybePending = lines.pop() ?? '';
      jsonBuffer = maybePending;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('{')) continue;
        try {
          const clean = stripAnsi(line);
          const obj = JSON.parse(clean);
          if (obj.type === 'assistant' && obj.message?.content) {
            for (let i = 0; i < obj.message.content.length; i++) {
              const block = obj.message.content[i];
              if (block.type === 'text' && block.text) {
                const prevLen = emittedTextLengths.get(i) || 0;
                if (block.text.length > prevLen) {
                  resultText = (resultText || '') + block.text.slice(prevLen);
                  emittedTextLengths.set(i, block.text.length);
                }
              }
            }
          } else if (obj.type === 'result' && obj.result) {
            resultText = obj.result;
          }
        } catch { /* skip non-JSON */ }
      }
    });

    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', async (event) => {
      if (event.payload.terminalId !== terminalId) return;
      cleanup();
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());

      if (event.payload.code !== 0 || !resultText) {
        reject(new Error(`Goal parsing failed (exit ${event.payload.code})`));
        return;
      }

      try {
        // Try to extract JSON from the response text
        let jsonStr = resultText.trim();
        // Strip markdown code fences if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const parsed = JSON.parse(jsonStr) as ParsedGoal;
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          resolve(parsed);
        } else {
          reject(new Error('Invalid plan structure'));
        }
      } catch {
        reject(new Error('Failed to parse plan JSON from Claude response'));
      }
    });

    // Spawn Claude CLI for parsing
    import('../../../api').then(({ terminalApi }) => {
      terminalApi.startAgentPipedPty(terminalId, 'claude', args, cwd, parsePrompt);
    }).catch(reject);
  });
}

// ── Step Context ───────────────────────────────────────────

interface StepContext {
  goal: string;
  cwd: string;
  branch: string;
  completedSteps: Array<{ title: string; status: 'done' | 'error' | 'skipped' }>;
  currentIndex: number;
  totalSteps: number;
}

function buildStepPrompt(step: { title: string; description: string }, ctx: StepContext): string {
  const lines: string[] = [
    '你是一个执行器。按照以下指令完成任务，只返回执行结果。',
    '',
    '## 项目信息',
    `工作目录: ${ctx.cwd}`,
    `当前分支: ${ctx.branch}`,
    '',
    '## 总目标',
    ctx.goal,
    '',
    `## 当前步骤 (${ctx.currentIndex + 1}/${ctx.totalSteps})`,
    `${step.title}: ${step.description}`,
  ];

  if (ctx.completedSteps.length > 0) {
    lines.push('', '## 已完成的步骤');
    for (const s of ctx.completedSteps) {
      const icon = s.status === 'done' ? '✅' : s.status === 'error' ? '❌' : '⏭️';
      lines.push(`${icon} ${s.title} — ${s.status}`);
    }
  }

  lines.push(
    '',
    '## 要求',
    '- 只执行当前步骤的内容',
    '- 完成后输出简要总结（改了哪些文件，做了什么）',
    '- 不要执行其他步骤',
    '- 如果遇到问题，输出错误信息',
  );

  return lines.join('\n');
}

// ── PlanRuntime ────────────────────────────────────────────

export class PlanRuntime {
  private aborted = false;
  private providers: AgentProvider[] = [];

  async parseGoal(goal: string, cwd: string): Promise<ParsedGoal> {
    const store = useAgentPlanStore.getState();
    store.setMode('parsing');
    store.setGoal(goal);

    // Try template matching first
    const template = matchTemplate(goal);
    if (template) {
      const parsed: ParsedGoal = {
        goal: template.goalPrefix + goal,
        steps: template.steps.map(s => ({ ...s })),
      };
      return parsed;
    }

    // Fall back to Claude CLI parsing
    try {
      return await parseGoalWithClaude(goal, cwd);
    } catch {
      // Final fallback: treat the entire goal as a single step
      return {
        goal,
        steps: [{ title: goal.slice(0, 40), description: goal }],
      };
    }
  }

  async execute(cwd: string): Promise<void> {
    const planStore = useAgentPlanStore.getState();
    const steps = planStore.steps;
    if (steps.length === 0) return;

    planStore.setMode('executing');
    planStore.setCurrentStepIndex(0);

    // Get git branch for context
    let branch = 'main';
    try {
      const branches = await gitApi.branches(cwd) as Array<{ name: string; current: boolean }>;
      const current = branches?.find(b => b.current);
      if (current) branch = current.name;
    } catch { /* not a git repo */ }

    const completedSteps: StepContext['completedSteps'] = [];

    for (let i = 0; i < steps.length; i++) {
      if (this.aborted) break;

      const step = steps[i];
      planStore.setCurrentStepIndex(i);
      planStore.updateStepStatus(step.taskId, 'running');

      // Update task status in DB + invalidate cache
      const sessionId = planStore.sessionId;
      agentTasksApi.update(step.taskId, { status: 'in_progress' }).then(() => {
        if (sessionId) queryClient.invalidateQueries({ queryKey: queryKeys.agentTasks.all(sessionId) });
      }).catch(() => {});

      const ctx: StepContext = {
        goal: planStore.goal,
        cwd,
        branch,
        completedSteps,
        currentIndex: i,
        totalSteps: steps.length,
      };

      try {
        await this.executeStep(step, ctx);
        planStore.updateStepStatus(step.taskId, 'done');
        completedSteps.push({ title: step.title, status: 'done' });
        // Mark completed in DB
        agentTasksApi.update(step.taskId, { status: 'completed' }).then(() => {
          if (sessionId) queryClient.invalidateQueries({ queryKey: queryKeys.agentTasks.all(sessionId) });
        }).catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        planStore.updateStepStatus(step.taskId, 'error');
        completedSteps.push({ title: step.title, status: 'error' });
        step.error = msg;
        // Continue to next step (skip on error)
      }
    }

    // Update root task status
    const planTaskId = planStore.planTaskId;
    const planSessionId = planStore.sessionId;
    if (planTaskId) {
      agentTasksApi.update(planTaskId, { status: 'completed' }).then(() => {
        if (planSessionId) queryClient.invalidateQueries({ queryKey: queryKeys.agentTasks.all(planSessionId) });
      }).catch(() => {});
    }

    if (!this.aborted) {
      planStore.setMode('completed');
    }
  }

  private async executeStep(step: { taskId: string; title: string; description: string }, ctx: StepContext): Promise<void> {
    const agentStore = useAgentStore.getState();
    const planStore = useAgentPlanStore.getState();

    // Create a session for this step
    const sessionId = await sessionsApi.start(
      'plan-runtime',
      'claude',
      undefined,
      ctx.cwd,
      'dangerously-skip-permissions',
    );

    planStore.setStepSessionId(step.taskId, sessionId);

    // Create provider in oneshot mode
    const provider = createProvider('claude');
    this.providers.push(provider);

    await provider.start({
      sessionId,
      cwd: ctx.cwd,
      mode: 'oneshot',
    });

    // Set up streaming state in agentStore for UI rendering
    agentStore.startStreaming(sessionId);

    // Wire up stream events to agentStore
    const unlisten = provider.onStream((event: AgentStreamEvent) => {
      switch (event.type) {
        case 'token':
          agentStore.appendToken(sessionId, event.text);
          break;
        case 'thinking':
          agentStore.appendThinkingBlock(sessionId, event.text);
          break;
        case 'tool_start':
          agentStore.appendToolStartBlock(sessionId, {
            id: event.id,
            toolName: event.toolName,
            input: event.input,
          });
          break;
        case 'tool_result':
          agentStore.updateToolBlockResult(sessionId, event.toolUseId, event.output, event.isError);
          break;
        case 'result':
          if (event.costUsd !== undefined || event.durationMs !== undefined || event.numTurns !== undefined) {
            useAgentStore.getState().setSessionResult(sessionId, {
              costUsd: event.costUsd,
              durationMs: event.durationMs,
              numTurns: event.numTurns,
            });
          }
          break;
        case 'done': {
          // Persist streaming blocks to DB
          const blocks = useAgentStore.getState().streamingBlocks[sessionId];
          if (blocks && blocks.length > 0) {
            sessionsApi.appendMessage(sessionId, 'assistant', JSON.stringify({ v: 2, blocks })).catch(() => {});
          }
          agentStore.finishStreaming(sessionId);
          unlisten();
          break;
        }
        case 'error': {
          agentStore.appendMessage(sessionId, 'error', event.error);
          const errBlocks = useAgentStore.getState().streamingBlocks[sessionId];
          if (errBlocks && errBlocks.length > 0) {
            sessionsApi.appendMessage(sessionId, 'assistant', JSON.stringify({ v: 2, blocks: errBlocks })).catch(() => {});
          }
          agentStore.finishStreaming(sessionId);
          unlisten();
          break;
        }
      }
    });

    // Send the step prompt
    const prompt = buildStepPrompt(step, ctx);
    await provider.send(prompt);

    // Wait for completion by polling isActive
    await new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.aborted) {
          clearInterval(checkInterval);
          reject(new Error('Aborted'));
          return;
        }
        if (!provider.isActive()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);

      // Safety timeout: 10 minutes per step
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Step execution timed out'));
      }, 600_000);
    });

    // Cleanup provider
    const idx = this.providers.indexOf(provider);
    if (idx !== -1) this.providers.splice(idx, 1);
  }

  abort(): void {
    this.aborted = true;
    for (const p of this.providers) {
      p.abort().catch(() => {});
    }
    useAgentPlanStore.getState().setMode('paused');
  }

  destroy(): void {
    this.aborted = true;
    for (const p of this.providers) {
      p.stop().catch(() => {});
    }
    this.providers = [];
  }
}
