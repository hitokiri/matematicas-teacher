export interface SolutionStep {
  step: number;
  explanation: string;
}

export interface Solution {
  problem: string;
  steps: SolutionStep[];
  final_answer: string;
}

export interface AppSettings {
  active_model_id: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  filename: string;
  mmproj_filename?: string | null;
  size_mb: number;
  benchmark?: string | null;
  tokens_per_second?: number | null;
  is_recommended?: boolean;
  is_downloaded: boolean;
  is_downloading: boolean;
  download_progress: number;
  is_active: boolean;
  recommended_for: string[];
  tags: string[];
}

export async function solveProblem(problemText: string): Promise<Solution> {
  const result = await window.__TAURI__.core.invoke('solve_problem', {
    problemText,
  });
  return result as Solution;
}

export async function getSettings(): Promise<AppSettings> {
  const result = await window.__TAURI__.core.invoke('get_settings');
  return result as AppSettings;
}

export async function listModels(): Promise<ModelInfo[]> {
  const result = await window.__TAURI__.core.invoke('list_models');
  return result as ModelInfo[];
}

export async function downloadModel(modelId: string): Promise<void> {
  await window.__TAURI__.core.invoke('download_model', { modelId });
}

export async function selectModel(modelId: string): Promise<void> {
  await window.__TAURI__.core.invoke('select_model', { modelId });
}

export async function deleteModel(modelId: string): Promise<void> {
  await window.__TAURI__.core.invoke('delete_model', { modelId });
}
