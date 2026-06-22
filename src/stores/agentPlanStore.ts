import { create } from 'zustand';

type PlanMode = 'idle' | 'parsing' | 'executing' | 'paused' | 'completed' | 'error';
type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

interface PlanStep {
  taskId: string;
  title: string;
  description: string;
  status: StepStatus;
  sessionId: string | null;
  error: string | null;
}

interface AgentPlanStore {
  mode: PlanMode;
  planTaskId: string | null;
  steps: PlanStep[];
  currentStepIndex: number;
  goal: string;
  cwd: string | null;
  error: string | null;
  sessionId: string | null;

  setMode: (mode: PlanMode) => void;
  setPlanTaskId: (id: string) => void;
  setSteps: (steps: PlanStep[]) => void;
  updateStepStatus: (taskId: string, status: StepStatus) => void;
  setStepSessionId: (taskId: string, sessionId: string) => void;
  setCurrentStepIndex: (index: number) => void;
  setGoal: (goal: string) => void;
  setCwd: (cwd: string) => void;
  setError: (error: string | null) => void;
  setSessionId: (id: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  mode: 'idle' as PlanMode,
  planTaskId: null,
  steps: [],
  currentStepIndex: -1,
  goal: '',
  cwd: null as string | null,
  error: null,
  sessionId: null,
};

export const useAgentPlanStore = create<AgentPlanStore>((set) => ({
  ...INITIAL_STATE,

  setMode: (mode) => set({ mode }),

  setPlanTaskId: (id) => set({ planTaskId: id }),

  setSteps: (steps) => set({ steps }),

  updateStepStatus: (taskId, status) =>
    set((state) => ({
      steps: state.steps.map(s =>
        s.taskId === taskId ? { ...s, status } : s,
      ),
    })),

  setStepSessionId: (taskId, sessionId) =>
    set((state) => ({
      steps: state.steps.map(s =>
        s.taskId === taskId ? { ...s, sessionId } : s,
      ),
    })),

  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),

  setGoal: (goal) => set({ goal }),

  setCwd: (cwd) => set({ cwd }),

  setError: (error) => set({ error }),

  setSessionId: (id) => set({ sessionId: id }),

  reset: () => set(INITIAL_STATE),
}));
