import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import ModelBrowser from '../components/ModelBrowser';
import UiPrefsSection from '../components/UiPrefsSection';
import VoiceSection from '../components/VoiceSection';
import MicSection from '../components/MicSection';
import LogSection from '../components/LogSection';
import type { UiPrefs } from '../lib/uiPrefs';
import { useI18n } from '../lib/i18n';

interface ModelInfo {
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

interface SettingsProps {
  onCancel: () => void;
  /** Como se ve la app (pizarras, reproduccion...); sin esto no se muestra la seccion */
  uiPrefs?: UiPrefs;
  onUiPrefsChange?: (prefs: UiPrefs) => void;
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export default function Settings({ onCancel, uiPrefs, onUiPrefsChange, theme, onThemeChange }: SettingsProps) {
  const { t, lang } = useI18n();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [computeDevice, setComputeDevice] = useState<string | null>(null);

  // Hardware que usa el modelo local (GPU si la PC tiene una con memoria suficiente)
  const loadComputeDevice = async () => {
    try {
      const res = await invoke<string>('get_compute_device');
      if (typeof res === 'string') setComputeDevice(res);
    } catch (err) {
      console.error('Error loading compute device:', err);
    }
  };

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
      // El backend guarda el modelo activo y lo carga en memoria
      await invoke('select_model', { modelId });
      await loadModels();
      // El modelo se carga en segundo plano; luego se sabe si quedo en GPU o CPU
      setTimeout(() => { void loadComputeDevice(); }, 5000);
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
    if (!confirm(t('models.confirmDelete'))) return;
    try {
      await invoke('delete_model', { modelId });
      await loadModels();
    } catch (err) {
      console.error('Error deleting model:', err);
    }
  };

  useEffect(() => {
    loadModels();
    loadComputeDevice();

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
        <h2 id="settings-title"><span aria-hidden="true">⚙️</span> {t('settings.title')}</h2>
        <button onClick={onCancel} className="modal-back-btn">
          <span aria-hidden="true">←</span> {t('settings.back')}
        </button>
      </div>

      {uiPrefs && onUiPrefsChange && (
        <UiPrefsSection prefs={uiPrefs} onChange={onUiPrefsChange} theme={theme} onThemeChange={onThemeChange} />
      )}

      {uiPrefs && onUiPrefsChange && (
        <VoiceSection
          voice={lang === 'en' ? uiPrefs.voiceEn : uiPrefs.voice}
          // Cada idioma recuerda su voz. Elegir una voz natural es pedir que la maestra lea: se enciende la lectura
          onChange={voice => onUiPrefsChange({
            ...uiPrefs,
            [lang === 'en' ? 'voiceEn' : 'voice']: voice,
            readAloud: uiPrefs.readAloud || voice !== 'system',
          })}
          readAloud={uiPrefs.readAloud}
          onReadAloudChange={readAloud => onUiPrefsChange({ ...uiPrefs, readAloud })}
        />
      )}

      <MicSection />

      <div className="provider-section">
        <h2><span aria-hidden="true">💻</span> {t('settings.hardware')}</h2>
        <p className="compute-device">{computeDevice ?? t('settings.detecting')}</p>
      </div>

      <LogSection />

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

    </>
  );
}
