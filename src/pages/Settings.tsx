import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ModelBrowser from '../components/ModelBrowser';
import type { AppSettings } from '../App';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  filename: string;
  size_mb: number;
  is_downloaded: boolean;
  is_downloading: boolean;
  download_progress: number;
  is_active: boolean;
  recommended_for: string[];
  tags: string[];
}

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onCancel: () => void;
}

export default function Settings({ settings, onSave, onCancel }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingSuccess, setSavingSuccess] = useState(false);

  const loadModels = async () => {
    try {
      const res = await invoke<ModelInfo[]>('list_models');
      setModels(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading models:', err);
    }
  };

  const handleDownload = async (modelId: string) => {
    try {
      await invoke('download_model', { modelId });
      await loadModels(); // mostrar la tarjeta en estado "descargando" de inmediato
      
      // Esperar a que la descarga termine haciendo polling
      for (let i = 0; i < 600; i++) { // Max 5 minutos (600 * 500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const progress = await invoke<number | null>('get_download_progress', { modelId });
        
        if (progress === 100 || progress === null) {
          // Descarga completada (o cancelada), refrescar lista
          await loadModels();
          break;
        } else if (progress === -1) {
          // Error en descarga
          console.error('Error en la descarga');
          await loadModels();
          break;
        }
      }
    } catch (err) {
      console.error('Error downloading model:', err);
      await loadModels();
    }
  };

  const handleSelect = async (modelId: string) => {
    try {
      await invoke('select_model', { modelId });
      // Elegir un modelo local implica usar el proveedor local
      setLocalSettings(prev => ({ ...prev, provider: 'local', active_model_id: modelId }));
      await loadModels();
    } catch (err) {
      console.error('Error selecting model:', err);
    }
  };

  const handleCancel = async (modelId: string) => {
    try {
      await invoke('cancel_download', { modelId });
      await loadModels();
    } catch (err) {
      console.error('Error cancelling download:', err);
    }
  };

  const handlePause = async (modelId: string) => {
    try {
      await invoke('pause_download', { modelId });
      await loadModels();
    } catch (err) {
      console.error('Error pausing download:', err);
    }
  };

  const handleResume = async (modelId: string) => {
    try {
      await invoke('resume_download', { modelId });
      await loadModels();
    } catch (err) {
      console.error('Error resuming download:', err);
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm('¿Estas seguro de eliminar este modelo?')) return;
    try {
      await invoke('delete_model', { modelId });
      await loadModels();
    } catch (err) {
      console.error('Error deleting model:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localSettings);
      setSavingSuccess(true);
      setTimeout(() => setSavingSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadModels();

    // Como Handy: el backend emite eventos cuando cambia el estado de los modelos
    const unlisteners: Array<() => void> = [];
    let disposed = false;
    for (const event of ['model-download-complete', 'models-updated']) {
      Promise.resolve(listen(event, () => { void loadModels(); }))
        .then(un => {
          if (typeof un !== 'function') return;
          if (disposed) un(); else unlisteners.push(un);
        })
        .catch(() => {});
    }
    return () => {
      disposed = true;
      unlisteners.forEach(un => un());
    };
  }, []);

  return (
    <>
      <div className="modal-header">
        <h1>⚙️ Configuración</h1>
        <button onClick={onCancel} className="modal-back-btn">
          ← Volver
        </button>
      </div>

      <div className="provider-section">
        <h2>🤖 Proveedor de IA</h2>
        <div className="provider-options">
          <div 
            className={`provider-option ${localSettings.provider === 'local' ? 'active' : ''}`}
            onClick={() => setLocalSettings({ ...localSettings, provider: 'local' })}
          >
            <input
              type="radio"
              id="provider-local"
              name="provider"
              value="local"
              checked={localSettings.provider === 'local'}
              onChange={() => setLocalSettings({ ...localSettings, provider: 'local' })}
              onClick={(e) => e.stopPropagation()}
            />
            <label htmlFor="provider-local">Modelo Local (GGUF)</label>
          </div>
          
          <div 
            className={`provider-option ${localSettings.provider === 'openai' ? 'active' : ''}`}
            onClick={() => setLocalSettings({ ...localSettings, provider: 'openai' })}
          >
            <input
              type="radio"
              id="provider-openai"
              name="provider"
              value="openai"
              checked={localSettings.provider === 'openai'}
              onChange={() => setLocalSettings({ ...localSettings, provider: 'openai' })}
              onClick={(e) => e.stopPropagation()}
            />
            <label htmlFor="provider-openai">OpenAI (GPT-4)</label>
          </div>
          
          <div 
            className={`provider-option ${localSettings.provider === 'anthropic' ? 'active' : ''}`}
            onClick={() => setLocalSettings({ ...localSettings, provider: 'anthropic' })}
          >
            <input
              type="radio"
              id="provider-anthropic"
              name="provider"
              value="anthropic"
              checked={localSettings.provider === 'anthropic'}
              onChange={() => setLocalSettings({ ...localSettings, provider: 'anthropic' })}
              onClick={(e) => e.stopPropagation()}
            />
            <label htmlFor="provider-anthropic">Anthropic (Claude)</label>
          </div>
        </div>

        {localSettings.provider === 'openai' && (
          <div className="api-key-section">
            <label>🔑 API Key de OpenAI</label>
            <input
              type="password"
              value={localSettings.openai_key}
              onChange={(e) => setLocalSettings({ ...localSettings, openai_key: e.target.value })}
              placeholder="sk-proj-..."
            />
          </div>
        )}

        {localSettings.provider === 'anthropic' && (
          <div className="api-key-section">
            <label>🔑 API Key de Anthropic</label>
            <input
              type="password"
              value={localSettings.anthropic_key}
              onChange={(e) => setLocalSettings({ ...localSettings, anthropic_key: e.target.value })}
              placeholder="sk-ant-..."
            />
          </div>
        )}
      </div>

      <ModelBrowser
        models={models}
        onListModels={loadModels}
        onDownload={handleDownload}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
      />

      <div className="save-section">
        {savingSuccess && <span className="save-status">✓ Guardado correctamente</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`btn ${saving ? 'btn-secondary' : 'btn-primary'}`}
        >
          {saving ? '⏳ Guardando...' : savingSuccess ? '✓ Guardado' : '💾 Guardar Configuración'}
        </button>
      </div>
    </>
  );
}
