import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, LLMProvider, UserProfile, TestLogEntry, ModelConfig } from '../types';
import { getAllUsers, resetUserPassword } from '../services/firebaseService';
import { DEFAULT_MODELS_CONFIG } from '../services/storageService';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  testLogs: TestLogEntry[];
  onClearLogs: () => void;
  isTestMode?: boolean;
  setIsTestMode?: (val: boolean) => void;
  testModels?: any[];
  setTestModels?: (val: any[]) => void;
  userRole?: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  testLogs,
  onClearLogs,
  userRole
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'logs'>('settings');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  // Fetch users when tab is opened
  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      const fetchUsers = async () => {
        setLoadingUsers(true);
        setPermissionError(false);
        try {
          const users = await getAllUsers();
          setUsersList(users);
        } catch (e: any) {
          if (e.message === 'PERMISSION_DENIED') {
            setPermissionError(true);
          }
          setUsersList([]);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [testLogs, activeTab]);

  if (!isOpen) return null;

  const currentProvider: LLMProvider = localSettings.llmProvider || 'groq';
  const currentModels: ModelConfig[] = localSettings.modelsConfig?.[currentProvider] || DEFAULT_MODELS_CONFIG[currentProvider];

  const handleProviderChange = (provider: LLMProvider) => {
    setLocalSettings(prev => ({
      ...prev,
      llmProvider: provider,
      modelsConfig: prev.modelsConfig || { ...DEFAULT_MODELS_CONFIG },
    }));
  };

  // Toggle model enabled/disabled (✓ / ✕)
  const handleToggleModel = (modelId: string) => {
    setLocalSettings(prev => {
      const p = prev.llmProvider || 'groq';
      const list = [...(prev.modelsConfig?.[p] || DEFAULT_MODELS_CONFIG[p])];
      const idx = list.findIndex(m => m.id === modelId);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          enabled: !list[idx].enabled,
        };
      }
      return {
        ...prev,
        modelsConfig: {
          ...prev.modelsConfig,
          [p]: list,
        },
      };
    });
  };

  // Move model priority up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setLocalSettings(prev => {
      const p = prev.llmProvider || 'groq';
      const list = [...(prev.modelsConfig?.[p] || DEFAULT_MODELS_CONFIG[p])];
      const temp = list[index - 1];
      list[index - 1] = list[index];
      list[index] = temp;
      return {
        ...prev,
        modelsConfig: {
          ...prev.modelsConfig,
          [p]: list,
        },
      };
    });
  };

  // Move model priority down
  const handleMoveDown = (index: number) => {
    const list = localSettings.modelsConfig?.[currentProvider] || DEFAULT_MODELS_CONFIG[currentProvider];
    if (index >= list.length - 1) return;
    setLocalSettings(prev => {
      const p = prev.llmProvider || 'groq';
      const updated = [...(prev.modelsConfig?.[p] || DEFAULT_MODELS_CONFIG[p])];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return {
        ...prev,
        modelsConfig: {
          ...prev.modelsConfig,
          [p]: updated,
        },
      };
    });
  };

  // Reset current provider models to default
  const handleResetDefaults = () => {
    setLocalSettings(prev => ({
      ...prev,
      modelsConfig: {
        ...prev.modelsConfig,
        [currentProvider]: DEFAULT_MODELS_CONFIG[currentProvider].map(m => ({ ...m })),
      },
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleResetPassword = async (email?: string) => {
    if (!email) {
      alert('У пользователя нет email адреса.');
      return;
    }
    if (confirm(`Отправить письмо для сброса пароля на ${email}?`)) {
      try {
        await resetUserPassword(email);
        alert('Письмо отправлено!');
      } catch (e: any) {
        alert('Ошибка: ' + e.message);
      }
    }
  };

  // Active chain for visualization
  const activeChain = currentModels.filter(m => m.enabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col h-[90vh]">
        {/* Header */}
        <div className="bg-surfaceHover px-4 sm:px-6 py-4 flex justify-between items-center border-b border-white/5 flex-shrink-0">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('settings')}
              className={`text-xs sm:text-sm font-bold uppercase transition-colors px-2 py-1 rounded whitespace-nowrap ${
                activeTab === 'settings' ? 'text-primary bg-primary/10' : 'text-textMuted hover:text-white'
              }`}
            >
              ⚙️ Настройки LLM & Fallback
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`text-xs sm:text-sm font-bold uppercase transition-colors px-2 py-1 rounded flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'logs' ? 'text-primary bg-primary/10' : 'text-textMuted hover:text-white'
              }`}
            >
              🧪 Логи Fallback {testLogs.length > 0 && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{testLogs.length}</span>}
            </button>
            {(userRole === 'admin' || userRole === 'owner') && (
              <button
                onClick={() => setActiveTab('users')}
                className={`text-xs sm:text-sm font-bold uppercase transition-colors px-2 py-1 rounded whitespace-nowrap ${
                  activeTab === 'users' ? 'text-primary bg-primary/10' : 'text-textMuted hover:text-white'
                }`}
              >
                👥 Пользователи
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-textMuted hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            aria-label="Закрыть"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-background space-y-6">
          {/* TAB 1: LLM Settings & Fallback */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Provider Selection */}
              <div className="bg-surface/50 border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <label className="block text-white text-sm font-bold">
                      Сервис LLM
                    </label>
                    <p className="text-xs text-textMuted mt-0.5">
                      Выберите активный сервис для генерации рекомендаций и описаний
                    </p>
                  </div>

                  {/* Dropdown / Select */}
                  <div className="relative min-w-[200px]">
                    <select
                      value={currentProvider}
                      onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                      className="w-full bg-surfaceHover border border-white/20 text-white font-semibold rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary cursor-pointer transition-colors"
                    >
                      <option value="groq">Groq (Быстрый & надежный)</option>
                      <option value="openrouter">OpenRouter (Широкий выбор)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-medium ${currentProvider === 'groq' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-textMuted'}`}>
                    Активен: {currentProvider === 'groq' ? '⚡ Groq' : '🌐 OpenRouter'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 text-textMuted">
                    Всего моделей: {currentModels.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Активных в цепочке: {activeChain.length}
                  </span>
                </div>
              </div>

              {/* Fallback Models List */}
              <div className="bg-surface/50 border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-white text-sm font-bold flex items-center gap-2">
                      <span>Список моделей и приоритет Fallback</span>
                      <span className="text-[11px] font-normal text-textMuted bg-white/5 px-2 py-0.5 rounded">
                        Сервис: {currentProvider === 'groq' ? 'Groq' : 'OpenRouter'}
                      </span>
                    </h3>
                    <p className="text-xs text-textMuted mt-0.5">
                      Запрос отправляется модели #1. При ошибке (429, 5xx, timeout) происходит автоматический переход к следующей активной модели.
                    </p>
                  </div>

                  <button
                    onClick={handleResetDefaults}
                    className="text-xs text-textMuted hover:text-white px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors self-start sm:self-auto"
                    title="Сбросить порядок и блокировки к исходным значениям"
                  >
                    <i className="fa-solid fa-rotate-left mr-1.5"></i>
                    По умолчанию
                  </button>
                </div>

                {/* Models priority list */}
                <div className="space-y-2.5 mt-4">
                  {currentModels.map((model, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === currentModels.length - 1;

                    return (
                      <div
                        key={model.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-all gap-3 ${
                          model.enabled
                            ? 'bg-surface border-white/10 hover:border-white/20'
                            : 'bg-black/20 border-red-500/20 opacity-60'
                        }`}
                      >
                        {/* Left: Priority badge + Model Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              model.enabled
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-white/5 text-textMuted'
                            }`}
                            title={`Приоритет: #${idx + 1}`}
                          >
                            #{idx + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold truncate ${model.enabled ? 'text-white' : 'text-textMuted line-through'}`}>
                                {model.name}
                              </span>
                              {!model.enabled && (
                                <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded font-medium">
                                  Заблокирована
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-textMuted font-mono truncate">
                              {model.id}
                            </div>
                          </div>
                        </div>

                        {/* Right: Controls (Toggle button ✓/✕ and Move ↑/↓) */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {/* Priority move buttons */}
                          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
                            <button
                              onClick={() => handleMoveUp(idx)}
                              disabled={isFirst}
                              className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                                isFirst
                                  ? 'text-white/20 cursor-not-allowed'
                                  : 'text-textMuted hover:text-white hover:bg-white/10'
                              }`}
                              title="Повысить приоритет (Вверх)"
                            >
                              <i className="fa-solid fa-arrow-up"></i>
                            </button>
                            <button
                              onClick={() => handleMoveDown(idx)}
                              disabled={isLast}
                              className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                                isLast
                                  ? 'text-white/20 cursor-not-allowed'
                                  : 'text-textMuted hover:text-white hover:bg-white/10'
                              }`}
                              title="Понизить приоритет (Вниз)"
                            >
                              <i className="fa-solid fa-arrow-down"></i>
                            </button>
                          </div>

                          {/* Mandatory Toggle Button: ✓ / ✕ */}
                          <button
                            onClick={() => handleToggleModel(model.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                              model.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                            }`}
                            title={model.enabled ? 'Нажмите, чтобы заблокировать модель (✕)' : 'Нажмите, чтобы активировать модель (✓)'}
                          >
                            <span className="text-sm font-black leading-none">
                              {model.enabled ? '✓' : '✕'}
                            </span>
                            <span>
                              {model.enabled ? 'Активна' : 'Заблокирована'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chain Visualization */}
                <div className="mt-5 pt-4 border-t border-white/5">
                  <div className="text-xs text-textMuted font-medium mb-2">
                    🎯 Текущий маршрут Fallback:
                  </div>
                  {activeChain.length === 0 ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg">
                      ⚠️ Все модели заблокированы! Запросы будут падать с ошибкой. Включите хотя бы одну модель (✓).
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-black/30 rounded-lg border border-white/5 text-xs">
                      {activeChain.map((m, i) => (
                        <React.Fragment key={m.id}>
                          <span className="bg-primary/10 border border-primary/30 text-primary px-2.5 py-1 rounded font-mono font-medium flex items-center gap-1.5">
                            <span className="text-[10px] opacity-75">#{i + 1}</span>
                            <span>{m.id}</span>
                          </span>
                          {i < activeChain.length - 1 && (
                            <i className="fa-solid fa-arrow-right text-[10px] text-textMuted"></i>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* API Keys Configuration */}
              <div className="bg-surface/50 border border-white/10 rounded-xl p-4 sm:p-5">
                <label className="block text-white text-sm font-bold mb-1">
                  🔑 API Ключи провайдеров
                </label>
                <p className="text-xs text-textMuted mb-4">
                  Сервер использует ключи из безопасных переменных окружения. При желании вы можете указать свой личный ключ.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-textMuted uppercase mb-1.5">
                      Groq API Key
                    </label>
                    <input
                      type="password"
                      value={localSettings.apiKeys?.groq || ''}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          apiKeys: {
                            ...localSettings.apiKeys,
                            groq: e.target.value,
                          },
                        })
                      }
                      placeholder="gsk_..."
                      className="w-full bg-surfaceHover border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-textMuted/50 focus:border-primary outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-textMuted uppercase mb-1.5">
                      OpenRouter API Key
                    </label>
                    <input
                      type="password"
                      value={localSettings.apiKeys?.openrouter || ''}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          apiKeys: {
                            ...localSettings.apiKeys,
                            openrouter: e.target.value,
                          },
                        })
                      }
                      placeholder="sk-or-..."
                      className="w-full bg-surfaceHover border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-textMuted/50 focus:border-primary outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Fallback Logs Viewer */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/50 p-4 rounded-xl border border-white/10">
                <div>
                  <h3 className="text-white text-sm font-bold flex items-center gap-2">
                    <span>Логи попыток и Fallback</span>
                    <span className="text-xs text-textMuted font-normal">
                      (В реальном времени)
                    </span>
                  </h3>
                  <p className="text-xs text-textMuted mt-0.5">
                    Фиксирует каждую попытку: провайдер, модель, задержку, статус и срабатывание fallback цепочки.
                  </p>
                </div>

                {testLogs.length > 0 && (
                  <button
                    onClick={onClearLogs}
                    className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
                  >
                    <i className="fa-solid fa-trash mr-1.5"></i>
                    Очистить логи
                  </button>
                )}
              </div>

              {testLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-textMuted border border-white/10 rounded-xl bg-surface/30">
                  <i className="fa-solid fa-server text-4xl mb-3 opacity-40"></i>
                  <p className="text-sm font-semibold text-white">Логов пока нет</p>
                  <p className="text-xs text-textMuted max-w-sm mt-1">
                    Отправьте любой запрос в поисковую строку, чтобы увидеть детали выполнения и fallback-попыток.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {testLogs.map((log, idx) => {
                    const attempts = log.attempts || [];
                    const hasFallback = log.fallback_used || attempts.length > 1;

                    return (
                      <div
                        key={`${log.id}-${idx}`}
                        className="bg-surface border border-white/10 rounded-xl overflow-hidden shadow-sm"
                      >
                        {/* Top bar */}
                        <div className="bg-surfaceHover px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 border-b border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-white uppercase px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-mono">
                              {log.provider ? log.provider.toUpperCase() : 'LLM'}
                            </span>
                            <span className="text-xs font-mono text-white/90 font-medium">
                              {log.model}
                            </span>
                            <span className="text-[11px] text-textMuted font-mono">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {hasFallback ? (
                              <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                <i className="fa-solid fa-shuffle"></i> Fallback сработал
                              </span>
                            ) : (
                              <span className="text-[11px] bg-white/5 text-textMuted px-2 py-0.5 rounded">
                                Без fallback (с 1-й попытки)
                              </span>
                            )}

                            {log.error ? (
                              <span className="text-[11px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">
                                ОШИБКА
                              </span>
                            ) : (
                              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                <i className="fa-solid fa-check"></i> {log.metadata?.responseTime || 0} мс
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-3">
                          <div className="text-xs">
                            <span className="text-textMuted uppercase font-bold text-[10px] block mb-1">
                              Запрос пользователя
                            </span>
                            <div className="text-white/90 bg-black/20 p-2.5 rounded-lg border border-white/5 font-sans">
                              "{log.query}"
                            </div>
                          </div>

                          {/* Fallback Attempts Details */}
                          {attempts.length > 0 && (
                            <div>
                              <span className="text-textMuted uppercase font-bold text-[10px] block mb-1.5">
                                Цепочка попыток (Fallback chain):
                              </span>
                              <div className="space-y-1.5">
                                {attempts.map((att, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono border ${
                                      att.status === 'SUCCESS'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                        : 'bg-red-500/10 border-red-500/20 text-red-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">Попытка #{att.attempt}:</span>
                                      <span>{att.model}</span>
                                      <span className="text-[10px] opacity-75">({att.provider})</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span>{att.latency} мс</span>
                                      <span className="font-bold">
                                        {att.status === 'SUCCESS' ? '✓ УСПЕХ' : `✕ ОШИБКА ${att.statusCode || ''}`}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AI Chat Response */}
                          {log.response?.chat_response && (
                            <div>
                              <span className="text-textMuted uppercase font-bold text-[10px] block mb-1">
                                Ответ модели
                              </span>
                              <div className="text-xs text-textMain bg-black/30 p-2.5 rounded-lg border border-white/5">
                                {log.response.chat_response}
                              </div>
                            </div>
                          )}

                          {/* Error if present */}
                          {log.error && (
                            <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/30 p-2.5 rounded-lg">
                              <span className="font-bold block mb-0.5">Ошибка:</span>
                              {log.error}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Users (Firestore) */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <h3 className="text-white font-bold mb-4 flex items-center justify-between">
                <span>👥 Зарегистрированные пользователи</span>
                <button
                  onClick={() => {
                    setLoadingUsers(true);
                    getAllUsers()
                      .then(u => {
                        setUsersList(u);
                        setLoadingUsers(false);
                      })
                      .catch(e => {
                        if (e.message === 'PERMISSION_DENIED') setPermissionError(true);
                        setLoadingUsers(false);
                      });
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  <i className="fa-solid fa-rotate"></i> Обновить
                </button>
              </h3>

              {permissionError && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg text-sm mb-4">
                  <h4 className="text-red-400 font-bold mb-2">ДОСТУП ОГРАНИЧЕН</h4>
                  <p className="text-textMuted text-xs">
                    Для просмотра списка пользователей требуются права администратора в Firestore.
                  </p>
                </div>
              )}

              {loadingUsers ? (
                <div className="flex justify-center p-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-white/5">
                  <table className="w-full text-left text-sm text-textMuted">
                    <thead className="text-xs uppercase bg-white/5 text-white">
                      <tr>
                        <th className="px-4 py-3 border-b border-white/5">Пользователь</th>
                        <th className="px-4 py-3 border-b border-white/5">Роль</th>
                        <th className="px-4 py-3 border-b border-white/5 text-center">Списки</th>
                        <th className="px-4 py-3 border-b border-white/5 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-surface/50">
                      {usersList.map((user) => (
                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">
                            {user.username}
                            {user.email && <div className="text-[10px] text-textMuted">{user.email}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-textMuted">
                              {user.role || 'user'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-3 text-xs">
                              <span title="В закладках"><i className="fa-solid fa-bookmark text-secondary"></i> {user.wishlistCount || 0}</span>
                              <span title="Просмотрено"><i className="fa-solid fa-check text-primary"></i> {user.watchedCount || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {user.email && (
                              <button
                                onClick={() => handleResetPassword(user.email)}
                                className="text-textMuted hover:text-red-400 transition-colors"
                                title="Сбросить пароль"
                              >
                                <i className="fa-solid fa-lock"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {usersList.length === 0 && !permissionError && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center opacity-50">
                            Пользователи не найдены
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-surfaceHover px-4 sm:px-6 py-4 flex justify-between sm:justify-end gap-3 border-t border-white/5 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-textMuted hover:text-white transition-colors"
          >
            Закрыть
          </button>
          {activeTab === 'settings' && (
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-red-700 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>Сохранить настройки</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
