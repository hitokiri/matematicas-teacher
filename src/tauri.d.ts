export interface TauriCore {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    __TAURI__: {
      core: TauriCore;
    };
  }
}

export {};
