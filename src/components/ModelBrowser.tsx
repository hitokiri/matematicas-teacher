import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useT } from '../lib/i18n';
import { Check, CircleCheck, Download, HardDrive, Hourglass, Image as ImageIcon, Inbox, Package, Pause, Play, RefreshCw, Search, Star, Target, Trash2, X, Zap, type LucideIcon } from 'lucide-react'
import Ico from './Ico'

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
  const t = useT();
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
    if (!confirm(t('models.confirmCancel'))) return;
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


  const renderSection = (title: string, modelsList: ModelInfo[], icon: LucideIcon) => {
    if (modelsList.length === 0) return null;

    return (
      <div className="models-section">
        <div className="section-header">
          <h3 className="section-title"><Ico as={icon} /> {title}</h3>
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
                      <h4 className="model-name">{model.name}</h4>
                      {model.is_active && (
                        <span className="badge active-badge"><Ico as={Check} /> {t('models.badgeActive')}</span>
                      )}
                      {model.mmproj_filename && (
                        <span className="badge recommended-badge"><Ico as={ImageIcon} /> {t('models.badgeVision')}</span>
                      )}
                      {model.is_recommended && (
                        <span className="badge recommended-badge"><Ico as={Star} /> {t('models.badgeRecommended')}</span>
                      )}
                    </div>
                    <p className="model-description">{model.description}</p>
                  </div>

                  <div className="model-metrics">
                    <div className="metric" title={t('models.metricMathTitle')}>
                      <span className="metric-label"><Ico as={Target} /> {t('models.metricMath')}</span>
                      <span className="metric-value">{model.benchmark ?? t('models.noData')}</span>
                    </div>
                    <div className="metric" title={t('models.metricSpeedTitle')}>
                      <span className="metric-label"><Ico as={Zap} /> {t('models.metricSpeed')}</span>
                      <span className="metric-value">
                        {model.tokens_per_second
                          ? t('models.tokensPerSecond', { n: model.tokens_per_second.toFixed(0) })
                          : t('models.speedUnknown')}
                      </span>
                    </div>
                  </div>

                  <div className="model-footer">
                    <div className="model-tags">
                      {model.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                    
                    <div className="model-actions">
                      <span className="model-size"><Ico as={HardDrive} /> {model.size_mb.toFixed(0)} MB</span>
                      
                      {!model.is_downloaded && !isDownloading && (
                        <button
                          onClick={() => onDownload(model.id)}
                          className="btn btn-download"
                          aria-label={t('models.downloadAria', { name: model.name })}
                        >
                          <Ico as={Download} /> {t('models.download')}
                        </button>
                      )}

                      {model.is_downloaded && !model.is_active && (
                        <button
                          onClick={() => onSelect(model.id)}
                          className="btn btn-select"
                          aria-label={t('models.useAria', { name: model.name })}
                        >
                          {t('models.use')}
                        </button>
                      )}
                      
                      {model.is_active && (
                        <span className="status-active">{t('models.inUse')}</span>
                      )}
                      
                      {model.is_downloaded && (
                        <button
                          onClick={() => onDelete(model.id)}
                          className="btn btn-delete"
                          aria-label={t('models.deleteAria', { name: model.name })}
                        >
                          <Ico as={Trash2} /> {t('models.delete')}
                        </button>
                      )}
                    </div>
                  </div>

                  {isDownloading && (
                    <div className="download-progress">
                      <div className="progress-bar-container">
                        <div
                          className="progress-bar"
                          role="progressbar"
                          aria-label={t('models.progressAria', { name: model.name })}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                        >
                          <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="progress-info">
                          <span className="progress-text">
                            {progress < 100 ? <><Ico as={Download} /> {t('models.downloading')}</> : <><Ico as={Check} /> {t('models.done')}</>}
                          </span>
                          <span className="progress-percent">{progress.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="download-controls">
                        <button
                          onClick={(e) => handlePause(model.id, e)}
                          className="btn btn-pause"
                          aria-label={t('models.pauseAria', { name: model.name })}
                        >
                          <Ico as={Pause} /> {t('models.pause')}
                        </button>
                        <button
                          onClick={(e) => handleResume(model.id, e)}
                          className="btn btn-resume"
                          aria-label={t('models.resumeAria', { name: model.name })}
                        >
                          <Ico as={Play} /> {t('models.resume')}
                        </button>
                        <button
                          onClick={(e) => handleCancel(model.id, e)}
                          className="btn btn-cancel"
                          aria-label={t('models.cancelAria', { name: model.name })}
                        >
                          <Ico as={X} /> {t('models.cancel')}
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
          <h2>{t('models.title')}</h2>
          <p className="header-description">
            {t('models.help')}
          </p>
        </div>
      </div>

      <div className="models-toolbar">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true"><Ico as={Search} /></span>
          <input
            type="search"
            aria-label={t('models.search')}
            placeholder={t('models.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="toolbar-actions">
          <button
            onClick={onListModels}
            className="btn btn-icon"
            title={t('models.refreshTitle')}
            aria-label={t('models.refresh')}
          >
            <Ico as={RefreshCw} />
          </button>
        </div>
      </div>

      {renderSection(t('models.sectionActive'), activeModels, CircleCheck)}
      {renderSection(t('models.sectionDownloading'), downloadingModelsList, Hourglass)}
      {renderSection(t('models.sectionDownloaded'), downloadedModels, Package)}
      {renderSection(t('models.sectionAvailable'), availableModels, Download)}

      {filteredModels.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true"><Ico as={Inbox} /></div>
          <p>{t('models.none')}</p>
        </div>
      )}
    </div>
  );
}
