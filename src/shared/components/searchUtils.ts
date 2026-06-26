import type { FileEntry } from '../../api/types';

/** 代码文件扩展名 — 搜索结果中优先排序 */
export const CODE_EXTS = new Set(['ts','tsx','js','jsx','rs','py','go','java','c','cpp','h','cs','rb','swift','kt','dart','lua']);

export function fileIcon(ext?: string): string {
  if (!ext) return 'draft';
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return 'code';
  if (ext === 'json' || ext === 'md' || ext === 'mdx') return 'description';
  if (ext === 'css' || ext === 'scss' || ext === 'less') return 'palette';
  if (ext === 'svg' || ext === 'png' || ext === 'jpg') return 'image';
  return 'draft';
}

/** 文件相关性排序：代码文件 > 配置/文档 > 其他 */
export function sortByRelevance(files: FileEntry[]): FileEntry[] {
  return [...files].sort((a, b) => {
    const aCode = a.extension ? CODE_EXTS.has(a.extension) : false;
    const bCode = b.extension ? CODE_EXTS.has(b.extension) : false;
    if (aCode !== bCode) return aCode ? -1 : 1;
    return a.name.length - b.name.length;
  });
}
