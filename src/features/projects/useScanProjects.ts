import { useState, useCallback } from 'react';
import { message } from 'antd';
import { projectsApi, detectApi } from '../../api';
import type { DetectedProject, ScanGroup, ScanResult } from '../../types';

interface UseScanProjectsOptions {
  onImportComplete?: () => void;
}

export function useScanProjects({ onImportComplete }: UseScanProjectsOptions = {}) {
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanMaxDepth, setScanMaxDepth] = useState(1);
  const [scanResults, setScanResults] = useState<DetectedProject[]>([]);
  const [scanGroups, setScanGroups] = useState<ScanGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [importing, setImporting] = useState(false);

  const handleScan = useCallback(async () => {
    if (!scanPath.trim()) {
      message.warning('请输入或选择扫描路径');
      return;
    }
    setScanning(true);
    setScanResults([]);
    setScanGroups([]);
    setSelectedKeys([]);
    try {
      const result = await detectApi.scanDirectory(scanPath.trim(), scanMaxDepth) as ScanResult;
      const projects = result.projects || [];
      const groups = result.groups || [];
      setScanResults(projects);
      setScanGroups(groups);
      if (projects.length === 0) {
        message.info('未发现任何项目');
      } else {
        const groupedCount = projects.filter((p: DetectedProject) => p.groupId).length;
        message.success(`发现 ${projects.length} 个项目${groupedCount > 0 ? `，其中 ${groupedCount} 个存在关联` : ''}`);
      }
    } catch (err) {
      message.error(`扫描失败: ${String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [scanPath, scanMaxDepth]);

  const handleImportSelected = useCallback(async () => {
    if (selectedKeys.length === 0) {
      message.warning('请先选择要导入的项目');
      return;
    }
    setImporting(true);
    try {
      const toImport = selectedKeys
        .map((key) => scanResults[Number(key)])
        .filter(Boolean)
        .map((project: DetectedProject) => ({
          name: project.name,
          description: project.description,
          techStack: project.techStack,
          source: project.source,
          localPath: project.localPath,
          openCommand: project.openCommand,
          frontendCommand: project.frontendCommand,
          backendCommand: project.backendCommand,
          iconType: project.iconType,
          iconUrl: project.iconUrl,
          iconColor: project.iconColor,
        }));
      const result = await projectsApi.batchImport(toImport);
      if (result.imported > 0) {
        message.success(`成功导入 ${result.imported} 个项目${result.skipped > 0 ? `，${result.skipped} 个已存在跳过` : ''}`);
      } else if (result.skipped > 0) {
        message.info(`${result.skipped} 个项目已存在，无需重复导入`);
      }
      if (result.errors.length > 0) {
        message.warning(`${result.errors.length} 个导入失败`);
      }
    } catch (err) {
      message.error(`导入失败: ${String(err)}`);
    }
    setImporting(false);
    setScanModalOpen(false);
    setScanResults([]);
    setSelectedKeys([]);
    onImportComplete?.();
  }, [selectedKeys, scanResults, onImportComplete]);

  const resetScan = useCallback(() => {
    setScanResults([]);
    setSelectedKeys([]);
  }, []);

  return {
    scanModalOpen,
    setScanModalOpen,
    scanPath,
    setScanPath,
    scanMaxDepth,
    setScanMaxDepth,
    scanResults,
    scanGroups,
    scanning,
    selectedKeys,
    setSelectedKeys,
    importing,
    handleScan,
    handleImportSelected,
    resetScan,
  };
}
