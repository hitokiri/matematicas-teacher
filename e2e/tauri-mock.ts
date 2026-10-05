// @ts-nocheck
// Tauri API mock for E2E testing
// This file is loaded before the app starts to provide mock Tauri APIs

console.log('[E2E Mock] Setting up Tauri mocks...');

// Estado persistido en localStorage para simular el store de Tauri entre recargas
const STORE_KEY = '__e2e_state__';
const defaultModels = () => [
  { id: 'm-big', name: 'Llama 3.1 8B Instruct', description: 'Modelo potente', filename: 'big.gguf', size_mb: 4915, recommended_for: ['matematicas'], tags: ['8B'], downloaded: false },
  { id: 'm-small', name: 'Qwen 2.5 1.5B Instruct', description: 'Modelo ligero', filename: 'small.gguf', size_mb: 1024, recommended_for: ['rapido'], tags: ['1.5B'], downloaded: false },
];
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    settings: { active_model_id: null },
    models: defaultModels(),
  };
};
const state = loadState();
const persist = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));
// Descargas en curso: id -> { progress, paused }  (solo en memoria)
const downloads = {};
setInterval(() => {
  for (const id of Object.keys(downloads)) {
    const d = downloads[id];
    if (d.paused || d.progress >= 100) continue;
    d.progress = Math.min(100, d.progress + 25);
    if (d.progress === 100) {
      const m = state.models.find((x) => x.id === id);
      if (m) m.downloaded = true;
      persist();
    }
  }
}, 300);

const toInfo = (m) => {
  const d = downloads[m.id];
  const downloading = !!d && d.progress < 100 && !m.downloaded;
  return {
    id: m.id, name: m.name, description: m.description, filename: m.filename,
    size_mb: m.size_mb, recommended_for: m.recommended_for, tags: m.tags,
    is_downloaded: m.downloaded,
    is_downloading: downloading,
    download_progress: m.downloaded ? 100 : d ? d.progress : 0,
    is_active: m.downloaded && state.settings.active_model_id === m.id,
  };
};

const mockInvoke = (cmd, args) => {
  console.log('[Tauri Mock] invoke:', cmd, args);
  const find = () => state.models.find((x) => x.id === args.modelId);

  switch (cmd) {
    case 'get_settings':
      return Promise.resolve({ ...state.settings });

    case 'get_compute_device':
      return Promise.resolve('CPU');

    case 'list_models':
      return Promise.resolve(state.models.map(toInfo));

    case 'download_model':
      if (!find()) return Promise.reject('Modelo no encontrado');
      downloads[args.modelId] = { progress: 0, paused: false };
      return Promise.resolve(undefined);

    case 'get_download_progress':
      return Promise.resolve(downloads[args.modelId] ? downloads[args.modelId].progress : null);

    case 'pause_download':
      if (downloads[args.modelId]) downloads[args.modelId].paused = true;
      return Promise.resolve(undefined);

    case 'resume_download':
      if (downloads[args.modelId]) downloads[args.modelId].paused = false;
      return Promise.resolve(undefined);

    case 'cancel_download': {
      const had = !!downloads[args.modelId];
      delete downloads[args.modelId];
      return Promise.resolve(had);
    }

    case 'select_model': {
      const m = find();
      if (!m || !m.downloaded) return Promise.reject('El modelo no esta descargado');
      state.settings.active_model_id = m.id;
      persist();
      return Promise.resolve(undefined);
    }

    case 'delete_model': {
      const m = find();
      if (!m) return Promise.reject('Modelo no encontrado');
      m.downloaded = false;
      delete downloads[m.id];
      if (state.settings.active_model_id === m.id) state.settings.active_model_id = null;
      persist();
      return Promise.resolve(undefined);
    }

    case 'solve_problem': {
      window.__lastSolveArgs = args;
      const text = args.problemText || '';
      if (text.trim() === 'fallo') return Promise.reject('No se pudo conectar al modelo local');
      return Promise.resolve({
        problem: text || 'Problema dibujado',
        steps: [
          { step: 1, explanation: 'Identificamos la operacion', calculation: '3 x 6' },
          { step: 2, explanation: 'Multiplicamos', calculation: '3 x 6 = 18' },
        ],
        final_answer: '18',
      });
    }

    default:
      return Promise.resolve(undefined);
  }
};

const mockListen = (event, callback) => {
  return Promise.resolve({
    unlisten: () => {},
  });
};

const mockEmit = (event, data) => {
  console.log('[Tauri Mock] emit:', event, data);
};

const mockConvertFileSrc = (path) => {
  return path;
};

// Set up the Tauri globals
window.__TAURI_INTERNALS__ = {
  transformCallback: (callback) => {
    const promise = new Promise((resolve) => {
      resolve(callback?.());
    });
    return {
      id: Date.now(),
      promise,
    };
  },
  unregisterCallback: () => {},
  invoke: mockInvoke,
  convertFileSrc: mockConvertFileSrc,
};

window.__TAURI__ = {
  core: { invoke: mockInvoke },
  events: { listen: mockListen, emit: mockEmit },
};

export {};
