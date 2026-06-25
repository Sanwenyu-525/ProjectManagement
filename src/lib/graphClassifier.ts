import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../api/terminal';
import { graphApi } from '../api/project';
import { stripAnsi } from './stripAnsi';
import type { GraphData, BusinessClassification } from '../types';
import type { TerminalOutputEvent, TerminalExitEvent } from '../shared/terminalTypes';

const MAX_FILES_IN_PROMPT = 200;

function computeCacheKey(data: GraphData): string {
  const paths = data.nodes.map(n => n.filePath).sort().join('|');
  const edges = data.edges.map(e => `${e.sourceNodeId}->${e.targetNodeId}`).sort().join('|');
  // Simple djb2 hash for compact key
  let hash = 5381;
  for (let i = 0; i < paths.length; i++) {
    hash = ((hash << 5) + hash + paths.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < edges.length; i++) {
    hash = ((hash << 5) + hash + edges.charCodeAt(i)) | 0;
  }
  return `${data.nodes.length}-${data.edges.length}-${hash}`;
}

function buildPrompt(data: GraphData): string {
  // Sort nodes by directory then fileName
  const sorted = [...data.nodes].sort((a, b) =>
    a.directory.localeCompare(b.directory) || a.fileName.localeCompare(b.fileName)
  );

  // Truncate if too many files
  const truncated = sorted.length > MAX_FILES_IN_PROMPT;
  const nodes = truncated ? sorted.slice(0, MAX_FILES_IN_PROMPT) : sorted;

  // Build nodeId -> index map for compact edge representation
  const nodeIdToIdx = new Map<string, number>();
  nodes.forEach((n, i) => nodeIdToIdx.set(n.id, i));

  const fileList = nodes.map((n, i) =>
    `${i}|${n.directory ? n.directory + '/' : ''}${n.fileName}|${n.language}`
  ).join('\n');

  // Only include edges where both endpoints are in the node set
  const edges = data.edges
    .filter(e => nodeIdToIdx.has(e.sourceNodeId) && nodeIdToIdx.has(e.targetNodeId))
    .map(e => `${nodeIdToIdx.get(e.sourceNodeId)}->${nodeIdToIdx.get(e.targetNodeId)}`)
    .join('\n');

  // Build id->path lookup for the prompt
  const idLookup = nodes.map((n, i) => `${i}=${n.id}`).join('\n');

  return `你是项目架构分析器。根据以下文件结构和 import 依赖关系，将文件按业务模块分组。

规则：
- 每个模块代表一个独立的业务功能或子系统
- 模块名使用简短中文（如"认证系统"、"项目管理"、"终端"）
- 每个模块 3-50 个文件，太大的拆分，太小的合并
- 目录结构是最重要的分组依据
- 输出纯 JSON，不要 markdown 代码块

文件列表（格式：序号|目录/文件名|语言）：
${fileList}

依赖关系（格式：源序号->目标序号）：
${edges}

序号与文件ID映射（格式：序号=UUID）：
${idLookup}

返回 JSON 格式：
{
  "modules": [
    {
      "id": "mod_1",
      "name": "模块名",
      "description": "一句话描述该模块的职责",
      "fileNodeIds": ["uuid1", "uuid2"],
      "dependsOn": ["mod_2"]
    }
  ],
  "uncategorized": ["uuid3"]
}${truncated ? `\n\n注意：项目共有 ${sorted.length} 个文件，上面只展示了前 ${MAX_FILES_IN_PROMPT} 个。` : ''}`;
}

async function callClaude(prompt: string, cwd: string): Promise<string> {
  const terminalId = `graph-classify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];

  return new Promise<string>((resolve, reject) => {
    let resultText: string | null = null;
    let jsonBuffer = '';
    const emittedTextLengths = new Map<number, number>();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('AI 分类超时'));
    }, 180_000);

    function cleanup() {
      clearTimeout(timeout);
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
    }

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

    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      cleanup();

      if (event.payload.code !== 0 || !resultText) {
        reject(new Error(`AI 分类失败 (exit ${event.payload.code})`));
        return;
      }
      resolve(resultText);
    });

    terminalApi.startAgentPipedPty(terminalId, 'claude', args, cwd, prompt).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

function parseClassification(text: string, data: GraphData): BusinessClassification {
  let jsonStr = text.trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Try to extract JSON object if embedded in other text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed: unknown = JSON.parse(jsonStr);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI 返回的不是有效的 JSON 对象');
  }

  const classification = parsed as BusinessClassification;

  // Validate and fill filePaths
  const nodeIdToPath = new Map<string, string>();
  for (const n of data.nodes) {
    nodeIdToPath.set(n.id, n.filePath);
  }

  if (!Array.isArray(classification.modules)) {
    throw new Error('AI 返回的 modules 不是数组');
  }

  for (const mod of classification.modules) {
    if (!mod.id || !mod.name || !Array.isArray(mod.fileNodeIds)) {
      throw new Error('模块结构不完整');
    }
    mod.filePaths = mod.fileNodeIds
      .map((id: string) => nodeIdToPath.get(id) ?? '')
      .filter(Boolean);
    mod.dependsOn = mod.dependsOn ?? [];
  }

  classification.uncategorized = classification.uncategorized ?? [];

  return classification;
}

export async function classifyBusinessModules(
  data: GraphData,
  projectId: string,
  cwd: string,
): Promise<BusinessClassification> {
  const cacheKey = computeCacheKey(data);

  // Check cache
  const cached = await graphApi.getAiCache(projectId, cacheKey);
  if (cached) {
    try {
      return parseClassification(cached, data);
    } catch {
      // Cache corrupt, re-analyze
    }
  }

  const prompt = buildPrompt(data);
  const resultText = await callClaude(prompt, cwd);
  const classification = parseClassification(resultText, data);

  // Cache the raw text
  await graphApi.setAiCache(projectId, cacheKey, resultText).catch(() => {
    // Non-critical: cache write failure shouldn't block the result
  });

  return classification;
}
