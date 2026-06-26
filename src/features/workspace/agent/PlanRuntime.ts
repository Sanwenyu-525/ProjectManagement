import { listen } from '@tauri-apps/api/event';
import { sessionsApi, agentTasksApi, gitApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import queryClient from '../../../lib/queryClient';
import { useAgentPlanStore } from '../../../stores/agentPlanStore';
import { useAgentStore } from '../../../stores/agentStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { createProvider } from './providers';
import { stripAnsi } from '../../../lib/stripAnsi';
import { validateDependencyGraph, getReadySteps } from './planDependencyGraph';
import type { AgentProvider, AgentStreamEvent } from './AgentProvider';
import type { TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';

// ── Goal Parsing ───────────────────────────────────────────

interface ParsedGoal {
  goal: string;
  steps: Array<{ title: string; description: string }>;
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
  /** Results from completed dependency steps */
  dependencyResults: Array<{ title: string; output: string }>;
  /** Total number of steps in the plan */
  totalSteps: number;
}

function buildStepPrompt(step: { taskId: string; title: string; description: string }, ctx: StepContext, stepIndex: number): string {
  const lines: string[] = [
    '你是一个开发执行器。按照以下指令在项目中完成具体的开发任务。',
    '',
    '## 项目信息',
    `工作目录: ${ctx.cwd}`,
    `当前分支: ${ctx.branch}`,
    '',
    '## 总目标',
    ctx.goal,
    '',
    '## 当前任务',
    `任务 ${stepIndex + 1}/${ctx.totalSteps}: ${step.title}`,
    '',
    '## 任务说明',
    step.description,
  ];

  if (ctx.dependencyResults.length > 0) {
    lines.push('', '## 前置任务结果');
    for (const dep of ctx.dependencyResults) {
      lines.push('', `### ${dep.title}`);
      lines.push(dep.output);
    }
  }

  lines.push(
    '',
    '## 执行要求',
    '1. 仔细分析任务需求，在工作目录中执行具体的代码修改',
    '2. 创建或修改实际的代码文件，完成任务描述中的开发工作',
    '3. 完成后输出简要总结（改了哪些文件，做了什么改动）',
    '4. 如果遇到无法解决的问题，输出错误信息',
  );

  return lines.join('\n');
}

// ── PlanRuntime ────────────────────────────────────────────

export class PlanRuntime {
  private aborted = false;
  private providers: AgentProvider[] = [];
  private maxParallel: number;

  constructor(maxParallel?: number) {
    this.maxParallel = maxParallel ?? useWorkspaceStore.getState().maxParallelAgents ?? 3;
  }

  async parseGoal(goal: string, cwd: string): Promise<ParsedGoal> {
    const store = useAgentPlanStore.getState();
    store.setMode('parsing');
    store.setGoal(goal);

    // Always use Claude CLI for goal parsing — dynamic step generation
    try {
      return await parseGoalWithClaude(goal, cwd);
    } catch {
      // Fallback: treat the entire goal as a single step
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

    console.log('[PlanRuntime] execute() 开始, 步骤数:', steps.length);

    // Validate dependency graph — detect cycles
    const cycleError = validateDependencyGraph(steps);
    if (cycleError) {
      planStore.setError(cycleError);
      planStore.setMode('error');
      return;
    }

    planStore.setMode('executing');

    // Clear stale shared results from previous runs
    useAgentStore.getState().clearSharedResults();

    // Get git branch for context
    let branch = 'main';
    try {
      const branches = await gitApi.branches(cwd) as Array<{ name: string; current: boolean }>;
      const current = branches?.find(b => b.current);
      if (current) branch = current.name;
    } catch { /* not a git repo */ }

    const goal = planStore.goal;
    const maxParallel = this.maxParallel;

    // Parallel scheduler
    const running = new Map<string, Promise<void>>();
    let stepIndexCounter = 0;

    const checkAndStartNext = () => {
      if (this.aborted) return;

      const ready = getReadySteps(useAgentPlanStore.getState().steps);
      const available = ready.filter(id => !running.has(id));
      console.log('[PlanRuntime] checkAndStartNext:', { ready: ready.length, available: available.length, running: running.size });

      for (const taskId of available) {
        if (running.size >= maxParallel) break;

        const step = useAgentPlanStore.getState().steps.find(s => s.taskId === taskId);
        if (!step) continue;

        console.log('[PlanRuntime] 启动步骤:', step.title, 'taskId:', taskId);
        const promise = this.startStep(step, { goal, cwd, branch, totalSteps: steps.length }, stepIndexCounter++)
          .finally(() => {
            running.delete(taskId);
            checkAndStartNext();
          });
        running.set(taskId, promise);
      }
    };

    // Start initial batch
    checkAndStartNext();

    // Wait for all running steps to complete
    if (running.size > 0) {
      await Promise.all(running.values());
    }

    // Check if aborted
    if (this.aborted) return;

    // All steps done — update root task status
    const planTaskId = planStore.planTaskId;
    const planSessionId = planStore.sessionId;
    if (planTaskId) {
      agentTasksApi.update(planTaskId, { status: 'completed' }).then(() => {
        if (planSessionId) queryClient.invalidateQueries({ queryKey: queryKeys.agentTasks.all(planSessionId) });
      }).catch(() => {});
    }

    planStore.setMode('completed');
  }

  private async startStep(
    step: { taskId: string; title: string; description: string },
    ctx: { goal: string; cwd: string; branch: string; totalSteps: number },
    stepIndex: number,
  ): Promise<void> {
    const planStore = useAgentPlanStore.getState();
    const agentStore = useAgentStore.getState();

    console.log('[PlanRuntime] startStep:', step.title, '开始');
    planStore.updateStepStatus(step.taskId, 'running');
    planStore.addRunningTaskId(step.taskId);

    // Update task status in DB + invalidate cache
    const sessionId = planStore.sessionId;
    agentTasksApi.update(step.taskId, { status: 'in_progress' }).then(() => {
      if (sessionId) queryClient.invalidateQueries({ queryKey: queryKeys.agentTasks.all(sessionId) });
    }).catch(() => {});

    // Register as running agent for cross-tab visibility
    const tabId = null; // plan steps don't have a specific tab
    const agentId = `plan-${step.taskId}`;
    agentStore.setRunningAgent(agentId, {
      tabId,
      sessionId: '',
      stepTitle: step.title,
      startedAt: Date.now(),
    });

    try {
      await this.executeStep(step, {
        ...ctx,
        dependencyResults: this.getDependencyResults(step.taskId),
      }, stepIndex);

      // Collect output from the session's messages
      const stepSessionId = planStore.steps.find(s => s.taskId === step.taskId)?.sessionId;
      let outputSummary = 'completed';
      if (stepSessionId) {
        const msgs = useAgentStore.getState().messages[stepSessionId];
        const lastAssistant = msgs?.filter(m => m.role === 'assistant').pop();
        if (lastAssistant) {
          outputSummary = lastAssistant.blocks
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n')
            .slice(0, 2000);
        }
      }

      planStore.updateStepStatus(step.taskId, 'done');
      planStore.setStepOutput(step.taskId, outputSummary);
      console.log('[PlanRuntime] startStep:', step.title, '完成');

      // Write to shared results for downstream steps
      agentStore.setSharedResult(step.taskId, {
        stepId: step.taskId,
        title: step.title,
        output: outputSummary,
        timestamp: Date.now(),
        sessionId: stepSessionId || '',
      });

      // Mark completed in DB
      agentTasksApi.update(step.taskId, { status: 'completed' }).then(() => {
        if (sessionId) queryClient.invalidateQueries({ queryKey: queryKeys.agentTasks.all(sessionId) });
      }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PlanRuntime] startStep:', step.title, '失败:', msg);
      planStore.updateStepStatus(step.taskId, 'error');
      planStore.setStepError(step.taskId, msg);
    } finally {
      planStore.removeRunningTaskId(step.taskId);
      agentStore.removeRunningAgent(agentId);
    }
  }

  private getDependencyResults(taskId: string): Array<{ title: string; output: string }> {
    const planStore = useAgentPlanStore.getState();
    const step = planStore.steps.find(s => s.taskId === taskId);
    if (!step || step.dependsOn.length === 0) return [];

    return step.dependsOn
      .map(depId => {
        const depStep = planStore.steps.find(s => s.taskId === depId);
        const result = useAgentStore.getState().sharedResults[depId];
        if (!depStep || !result) return null;
        return { title: depStep.title, output: result.output };
      })
      .filter((r): r is { title: string; output: string } => r !== null);
  }

  private async executeStep(
    step: { taskId: string; title: string; description: string },
    ctx: StepContext,
    stepIndex: number,
  ): Promise<void> {
    const agentStore = useAgentStore.getState();
    const planStore = useAgentPlanStore.getState();

    console.log('[PlanRuntime] executeStep:', step.title, '创建 session...');
    // Create a session for this step
    const sessionId = await sessionsApi.start(
      'plan-runtime',
      'claude',
      undefined,
      ctx.cwd,
      'dangerously-skip-permissions',
    );
    console.log('[PlanRuntime] executeStep:', step.title, 'sessionId:', sessionId);

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
        case 'impact_warning': {
          agentStore.appendToken(sessionId, `\n⚠ ${event.summary}\n`);
          break;
        }
      }
    });

    // Send the step prompt with dependency results
    const prompt = buildStepPrompt(step, ctx, stepIndex);
    console.log('[PlanRuntime] executeStep:', step.title, '发送 prompt, 长度:', prompt.length);
    await provider.send(prompt);

    console.log('[PlanRuntime] executeStep:', step.title, '开始等待完成...');

    // Wait for stream completion via done/error events (P0 修复：移除轮询 + setTimeout，用 Promise 驱动)
    let streamUnlisten: (() => void) | undefined;

    await new Promise<void>((resolve, reject) => {
      // 安全超时：每步骤最多 10 分钟
      const safetyTimer = setTimeout(() => {
        streamUnlisten?.();
        provider.stop().catch(() => {});
        reject(new Error('Step execution timed out'));
      }, 600_000);

      streamUnlisten = provider.onStream((event: AgentStreamEvent) => {
        if (event.type === 'done') {
          clearTimeout(safetyTimer);
          resolve();
        } else if (event.type === 'error') {
          clearTimeout(safetyTimer);
          reject(new Error(event.error));
        }
        // token/thinking/tool 事件通过 agentStore 处理，此处只关心生命周期
      });

      // 中止检查
      if (this.aborted) {
        clearTimeout(safetyTimer);
        streamUnlisten?.();
        provider.stop().catch(() => {});
        reject(new Error('Aborted'));
      }
    }).catch(err => {
      // 确保超时/中止时也清理流监听器
      streamUnlisten?.();
      throw err;
    });

    // Cleanup provider
    const idx = this.providers.indexOf(provider);
    if (idx !== -1) this.providers.splice(idx, 1);
    await provider.stop().catch(() => {});
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
