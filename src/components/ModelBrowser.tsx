import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  filename: string;
  mmproj_filename?: string | null;
  size_mb: number;
  is_downloaded: boolean;
  is_downloading: boolean;
  download_progress: number;
  is_active: boolean;
  recommended_for: string[];
  tags: string[];
}

interface ModelBrowserProps {
  models: ModelInfo[];
  onListModels: () => Promise<void>;
  onDownload: (modelId: string) => Promise<void>;
  onSelect: (modelId: string) => Promise<void>;
  onDelete: (modelId: string) => Promise<void>;
  onPause: (modelId: string) => Promise<void>;
  onResume: (modelId: string) => Promise<void>;
  onCancel: (modelId: string) => Promise<void>;
}

export default function ModelBrowser({
  models,
  onListModels,
  onDownload,
  onSelect,
  onDelete,
  onPause,
  onResume,
  onCancel,
}: ModelBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);

  // Actualizar progreso de descarga en tiempo real
  useEffect(() => {
    const modelsDownloading = models.filter(m => m.is_downloading);
    const hasDownloading = modelsDownloading.length > 0;
    
    if (hasDownloading) {
      setDownloadingModels(new Set(modelsDownloading.map(m => m.id)));
      
      intervalRef.current = window.setInterval(async () => {
        for (const model of modelsDownloading) {
          try {
            const progress = await invoke<number | null>('get_download_progress', { modelId: model.id });
            if (progress !== null && progress !== undefined) {
              setDownloadProgress(prev => ({ ...prev, [model.id]: progress }));
              
              if (progress === 100 || progress === -1) {
                setTimeout(() => {
                  onListModels();
                  setDownloadProgress(prev => {
                    const newState = { ...prev };
                    delete newState[model.id];
                    return newState;
                  });
                  setDownloadingModels(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(model.id);
                    return newSet;
                  });
                }, 500);
              }
            }
          } catch (err) {
            console.error(`Error getting status for ${model.id}:`, err);
          }
        }
      }, 500);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDownloadingModels(new Set());
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [models, onListModels]);

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // El modelo activo va siempre arriba, en su propia seccion
  const activeModels = filteredModels.filter(m => m.is_active);
  const downloadedModels = filteredModels.filter(m => m.is_downloaded && !m.is_active);
  const availableModels = filteredModels.filter(m => !m.is_downloaded && !m.is_downloading);
  const downloadingModelsList = filteredModels.filter(m => m.is_downloading);

  const handlePause = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onPause(modelId);
    } catch (err) {
      console.error('Error pausing download:', err);
    }
  };

  const handleResume = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onResume(modelId);
    } catch (err) {
      console.error('Error resuming download:', err);
    }
  };

  const handleCancel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Cancelar la descarga?')) return;
    try {
      await onCancel(modelId);
      setDownloadProgress(prev => {
        const newState = { ...prev };
        delete newState[modelId];
        return newState;
      });
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
      setTimeout(() => onListModels(), 500);
    } catch (err) {
      console.error('Error cancelling download:', err);
    }
  };

  const getProgress = (model: ModelInfo) => {
    if (downloadingModels.has(model.id) && downloadProgress[model.id] !== undefined) {
      return downloadProgress[model.id];
    }
    return model.download_progress;
  };

  const getAccuracy = (model: ModelInfo) => {
    if (model.recommended_for.includes('high-accuracy')) return 90;
    if (model.recommended_for.includes('medium-accuracy')) return 70;
    return 50;
  };

  const getSpeed = (model: ModelInfo) => {
    if (model.recommended_for.includes('fast')) return 90;
    if (model.recommended_for.includes('medium')) return 70;
    return 50;
  };

  const renderSection = (title: string, modelsList: ModelInfo[], icon: string) => {
    if (modelsList.length === 0) return null;

    return (
      <div className="models-section">
        <div className="section-header">
          <h2>{icon} {title}</h2>
        </div>
        
        <div className="models-list">
          {modelsList.map((model) => {
            const progress = getProgress(model);
            const isDownloading = model.is_downloading || downloadingModels.has(model.id);

            return (
              <div
                key={model.id}
                className={`model-card ${model.is_active ? 'active' : ''} ${isDownloading ? 'downloading' : ''}`}
              >
                <div className="model-card-main">
                  <div className="model-info">
                    <div className="model-header">
                      <h3 className="model-name">{model.name}</h3>
                      {model.is_active && (
                        <span className="badge active-badge">✓ Active</span>
                      )}
                      {model.mmproj_filename && (
                        <span className="badge recommended-badge">🖼 Lee dibujos</span>
                      )}
                      {model.recommended_for.length > 0 && !model.is_downloaded && (
                        <span className="badge recommended-badge">Recommended</span>
                      )}
                    </div>
                    <p className="model-description">{model.description}</p>
                  </div>

                  <div className="model-metrics">
                    <div className="metric">
                      <span className="metric-label">accuracy</span>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill accuracy" 
                          style={{ width: `${getAccuracy(model)}%` }}
                        />
                      </div>
                    </div>
                    <div className="metric">
                      <span className="metric-label">speed</span>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill speed" 
                          style={{ width: `${getSpeed(model)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="model-footer">
                    <div className="model-tags">
                      {model.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    
                    <div className="model-actions">
                      <span className="model-size">💾 {model.size_mb.toFixed(0)} MB</span>
                      
                      {!model.is_downloaded && !isDownloading && (
                        <button
                          onClick={() => onDownload(model.id)}
                          className="btn btn-download"
                        >
                          ⬇ Download
                        </button>
                      )}

                      {model.is_downloaded && !model.is_active && (
                        <button
                          onClick={() => onSelect(model.id)}
                          className="btn btn-select"
                        >
                          Select
                        </button>
                      )}
                      
                      {model.is_active && (
                        <span className="status-active">Active</span>
                      )}
                      
                      {model.is_downloaded && (
                        <button
                          onClick={() => onDelete(model.id)}
                          className="btn btn-delete"
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {isDownloading && (
                    <div className="download-progress">
                      <div className="progress-bar-container">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="progress-info">
                          <span className="progress-text">
                            {progress < 100 ? '⬇️ Downloading...' : '✓ Download complete'}
                          </span>
                          <span className="progress-percent">{progress.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="download-controls">
                        <button
                          onClick={(e) => handlePause(model.id, e)}
                          className="btn btn-pause"
                        >
                          ⏸ Pause
                        </button>
                        <button
                          onClick={(e) => handleResume(model.id, e)}
                          className="btn btn-resume"
                        >
                          ▶ Resume
                        </button>
                        <button
                          onClick={(e) => handleCancel(model.id, e)}
                          className="btn btn-cancel"
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="models-page">
      <div className="models-header">
        <div>
          <h1>Math Models</h1>
          <p className="header-description">
            Select a math model or download additional models. Different models offer varying levels of accuracy and speed.
          </p>
        </div>
      </div>

      <div className="models-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search models by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="toolbar-actions">
          <button
            onClick={onListModels}
            className="btn btn-icon"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {renderSection('Active Model', activeModels, '✅')}
      {renderSection('Downloading', downloadingModelsList, '⏳')}
      {renderSection('Downloaded Models', downloadedModels, '📦')}
      {renderSection('Available to Download', availableModels, '⬇️')}

      {filteredModels.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No models found</p>
        </div>
      )}
    </div>
  );
}
