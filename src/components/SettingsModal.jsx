import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Cpu,
  Trash2,
  ShieldCheck,
  Wifi,
  Smartphone,
  Download,
  Upload,
  Copy,
  Check,
  QrCode,
  Database,
  Radio,
  FileJson
} from 'lucide-react';
import {
  fetchSettings,
  saveSettings,
  testApiKey,
  fetchSyncStatus,
  fetchSyncQr,
  importSyncData,
  downloadSyncExportJson
} from '../utils/api';
import QRCode from 'qrcode';

export default function SettingsModal({ isOpen, onClose, initialTab = 'sync' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // ── Engine Tab State ──
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedSettings, setSavedSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveToast, setSaveToast] = useState(null);

  // ── Sync Tab State ──
  const [syncStatus, setSyncStatus] = useState(null);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [selectedIp, setSelectedIp] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [importMode, setImportMode] = useState('merge');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // Synchronize initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'sync');
    }
  }, [isOpen, initialTab]);

  // Load settings and sync status when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setTestResult(null);
    setSaveToast(null);
    setSyncFeedback(null);

    // Fetch Engine Settings
    fetchSettings()
      .then((data) => {
        setSavedSettings(data);
        setApiKey('');
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Fetch Sync Status
    loadSyncData();
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadSyncData = async () => {
    setIsLoadingSync(true);
    setSyncError(null);
    try {
      const status = await fetchSyncStatus();
      setSyncStatus(status);
      const primaryIp = status.ips?.[0] || '127.0.0.1';
      setSelectedIp(primaryIp);

      const pairingUrl = `http://${primaryIp}:${status.port || 3001}`;
      try {
        const url = await QRCode.toDataURL(pairingUrl, { margin: 2, scale: 6 });
        setQrDataUrl(url);
      } catch {
        const qrRes = await fetchSyncQr().catch(() => null);
        if (qrRes?.qr_data_url) {
          setQrDataUrl(qrRes.qr_data_url);
        }
      }
    } catch (err) {
      console.error('Failed to load sync status:', err);
      setSyncError(err.message || 'Could not connect to sync service');
    } finally {
      setIsLoadingSync(false);
    }
  };

  const handleIpChange = async (newIp) => {
    setSelectedIp(newIp);
    const pairingUrl = `http://${newIp}:${syncStatus?.port || 3001}`;
    try {
      const url = await QRCode.toDataURL(pairingUrl, { margin: 2, scale: 6 });
      setQrDataUrl(url);
    } catch (err) {
      console.warn('QR regeneration error:', err);
    }
  };

  const handleCopyUrl = () => {
    const port = syncStatus?.port || 3001;
    const url = `http://${selectedIp || '127.0.0.1'}:${port}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      await downloadSyncExportJson();
      setSyncFeedback({
        type: 'success',
        message: 'Database exported successfully as JSON file.'
      });
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: 'Failed to export database: ' + err.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSyncFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const res = await importSyncData(parsed, importMode);
        setSyncFeedback({
          type: 'success',
          message: res.message || `Data successfully imported in ${importMode} mode!`
        });
        await loadSyncData();
        setTimeout(() => setSyncFeedback(null), 6000);
      } catch (err) {
        setSyncFeedback({
          type: 'error',
          message: 'Import failed: ' + (err.message || 'Invalid JSON format')
        });
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setSyncFeedback({ type: 'error', message: 'Failed to read the selected file.' });
      setIsImporting(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // ── Engine Tab Handlers ──
  const handleTest = async () => {
    const keyToSend = apiKey.trim();
    if (!keyToSend && !savedSettings?.hasApiKey) {
      setTestResult({ success: false, message: 'Please enter a Gemini API key to test' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testApiKey(keyToSend);
      setTestResult({
        success: true,
        message: res.message || 'Connection verified! Multi-model Gemini fallback pipeline is active.'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Verification failed. Please check the key.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const keyToSave = apiKey.trim();
    if (!keyToSave && savedSettings?.hasApiKey) {
      setSaveToast({
        type: 'info',
        message: 'Current API key is already configured and active.'
      });
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    if (!keyToSave && !savedSettings?.hasApiKey) {
      setSaveToast({
        type: 'error',
        message: 'Please paste a Gemini API key before saving.'
      });
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveToast(null);

    try {
      const res = await saveSettings(keyToSave);
      setSavedSettings({
        hasApiKey: res.hasApiKey,
        apiKeyMasked: res.hasApiKey ? (keyToSave.length > 10 ? `${keyToSave.slice(0, 6)}...${keyToSave.slice(-4)}` : '••••••••') : '',
        engine: res.engine
      });
      setApiKey('');
      setSaveToast({
        type: 'success',
        message: res.message || 'Settings saved successfully'
      });
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      setSaveToast({
        type: 'error',
        message: err.message || 'Failed to save settings'
      });
      setTimeout(() => setSaveToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await saveSettings('');
      setApiKey('');
      setSavedSettings({
        hasApiKey: false,
        apiKeyMasked: '',
        engine: 'stock.ai Algorithm (Offline Heuristic)'
      });
      setTestResult(null);
      setSaveToast({
        type: 'info',
        message: 'API key cleared. System reverted to offline mathematical heuristic.'
      });
      setTimeout(() => setSaveToast(null), 4000);
    } catch (err) {
      setSaveToast({
        type: 'error',
        message: 'Failed to clear key: ' + err.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentPairingUrl = `http://${selectedIp || '127.0.0.1'}:${syncStatus?.port || 3001}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-muted/60 border border-border/60 text-foreground">
              {activeTab === 'sync' ? <Wifi className="w-4 h-4 text-emerald-500" /> : <Settings className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-foreground">Settings & Sync</h2>
              <p className="text-[11px] text-muted-foreground">Configure AI research engine and Local Wi-Fi device synchronization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border/60 px-6 pt-2 bg-muted/20 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'sync'
                ? 'border-emerald-500 text-foreground bg-card'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <div className="relative">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <span>Local Wi-Fi Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('engine')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'engine'
                ? 'border-warning text-foreground bg-card'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span>AI Research Engine</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: LOCAL WI-FI SYNC                                             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              {/* Device Pairing Card */}
              <div className="p-4 rounded-xl bg-background/90 border border-border/70 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                        Local Wi-Fi Pairing Address
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Connect Android app on same Wi-Fi network without cloud dependency
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Listening :3001
                  </span>
                </div>

                {/* Pairing URL Bar & QR Code */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Left 2 Cols: IP Address & Copy */}
                  <div className="md:col-span-2 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Active Local IP Endpoint
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={currentPairingUrl}
                          className="w-full bg-muted/60 border border-border/80 rounded-lg px-3 py-2 text-xs font-mono text-foreground font-semibold focus:outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={handleCopyUrl}
                          className="px-3 py-2 bg-foreground text-background hover:bg-foreground/90 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-xs"
                          title="Copy Pairing URL"
                        >
                          {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Network Interfaces Selector if multiple */}
                    {syncStatus?.ips && syncStatus.ips.length > 1 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-medium">Available Network Interfaces:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {syncStatus.ips.map((ip) => (
                            <button
                              key={ip}
                              type="button"
                              onClick={() => handleIpChange(ip)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                                selectedIp === ip
                                  ? 'bg-foreground text-background border-foreground font-bold'
                                  : 'bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground'
                              }`}
                            >
                              {ip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1.5 pt-1">
                      <Smartphone className="w-3.5 h-3.5 text-info shrink-0" />
                      <span>In Android Stock AI app, open <strong>Settings &rarr; Local Wi-Fi Sync</strong> and enter this IP.</span>
                    </div>
                  </div>

                  {/* Right Col: Pairing QR Code */}
                  <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-card border border-border/60 shadow-xs">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Pairing QR Code"
                        className="w-24 h-24 rounded-lg bg-white p-1"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-muted-foreground animate-pulse" />
                      </div>
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground mt-1.5 text-center">
                      Scan with Stock AI
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Indicators & Row Counts */}
              <div className="p-4 rounded-xl bg-background/90 border border-border/70 space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-info" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                      Database Records & Sync Readiness
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={loadSyncData}
                    disabled={isLoadingSync}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Refresh Status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSync ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Portfolio Stocks</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.portfolio_holdings ?? syncStatus?.counts?.holdings ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Mutual Funds</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.mutual_funds ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Bank Accounts</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.bank ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">EPFO Passbooks</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.epfo ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">AI 360° Analyses</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.ai_analysis ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Stock Watchlist</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.watchlist ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Tracked Tickers</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {syncStatus?.counts?.stocks ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block font-medium">Sync Protocol</span>
                    <span className="text-xs font-bold font-mono text-emerald-600">
                      v{syncStatus?.version || '1.0'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Last database write timestamp:</span>
                  <span className="font-mono font-medium text-foreground">
                    {syncStatus?.last_updated ? new Date(syncStatus.last_updated).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Offline / Air-Gapped Manual Transfer */}
              <div className="p-4 rounded-xl bg-background/90 border border-border/70 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                      Offline / Air-Gapped JSON Transfer
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Backup or restore datasets manually without an active Wi-Fi connection
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-lg border border-border/60 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`px-2 py-0.5 rounded font-semibold transition-all ${
                        importMode === 'merge' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Smart Merge
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`px-2 py-0.5 rounded font-semibold transition-all ${
                        importMode === 'replace' ? 'bg-destructive/20 text-destructive font-bold shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Replace All
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Export Button */}
                  <button
                    type="button"
                    onClick={handleExportJson}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-muted/80 hover:bg-muted text-foreground border border-border/80 transition-all shadow-xs"
                  >
                    {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-info" />}
                    <span>Export Full JSON</span>
                  </button>

                  {/* Import File Trigger */}
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs cursor-pointer">
                    {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{isImporting ? 'Importing...' : `Import JSON (${importMode === 'merge' ? 'Merge' : 'Replace'})`}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFileChange}
                      disabled={isImporting}
                      className="hidden"
                    />
                  </label>
                </div>

                <p className="text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>An automated pre-sync safety backup (<code>equisense.db.pre-sync-*.bak</code>) is created prior to any write.</span>
                </p>
              </div>

              {/* Sync Feedback Toast */}
              {syncFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  syncFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-destructive/10 border-destructive/30 text-destructive'
                }`}>
                  {syncFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{syncFeedback.message}</span>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: AI RESEARCH ENGINE                                           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'engine' && (
            <div className="space-y-5">
              {/* Active Engine Card */}
              <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted border border-border/40 shrink-0 mt-0.5">
                  {savedSettings?.hasApiKey ? (
                    <Sparkles className="w-4 h-4 text-warning" />
                  ) : (
                    <Cpu className="w-4 h-4 text-info" />
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Active Intelligence Engine
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${
                      savedSettings?.hasApiKey
                        ? 'bg-success/10 text-success border-success/30'
                        : 'bg-muted/80 text-muted-foreground border-border/60'
                    }`}>
                      {savedSettings?.hasApiKey ? 'Cloud Fin-LLM Active' : 'Offline Heuristic Mode'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground font-serif">
                    {savedSettings?.hasApiKey ? 'Google Gemini 3.5 Flash' : 'stock.ai Mathematical Algorithm'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {savedSettings?.hasApiKey
                      ? 'Synthesizes 360° qualitative investment theses, governance audits, and secular growth runway.'
                      : 'Deterministic quantitative evaluation across Capital Efficiency, Solvency, Growth, and Valuation.'}
                  </p>
                </div>
              </div>

              {/* Gemini API Key Form */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Google Gemini API Key</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-info hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Get a free key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={savedSettings?.hasApiKey ? `Key active (${savedSettings.apiKeyMasked}) — enter new key to replace` : 'Paste your Gemini API key (e.g. AIzaSy... or AQ.Ab...)'}
                    disabled={isLoading}
                    className="w-full bg-background border border-border/80 rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder-muted-foreground font-mono focus:outline-none focus:border-ring transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Test Connection Result Box */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  testResult.success
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'bg-destructive/10 border-destructive/30 text-destructive'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{testResult.message}</span>
                </div>
              )}

              {/* Save Status Toast */}
              {saveToast && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  saveToast.type === 'success'
                    ? 'bg-success/10 border-success/30 text-success'
                    : saveToast.type === 'error'
                    ? 'bg-destructive/10 border-destructive/30 text-destructive'
                    : 'bg-info/10 border-info/30 text-info'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveToast.message}</span>
                </div>
              )}

              {/* Privacy & Storage Guarantee */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 text-[11px] text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  <span>Offline-First Guarantee</span>
                </div>
                <p className="leading-relaxed">
                  All portfolio balances, bank statements, passbooks, and SQLite records remain strictly local to your machine. The Gemini API key is only utilized for requested stock research theses.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-t border-border/60 shrink-0">
          <div>
            {activeTab === 'engine' && savedSettings?.hasApiKey && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                title="Remove saved API key and use offline heuristic"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Key</span>
              </button>
            )}
            {activeTab === 'sync' && (
              <span className="text-[11px] text-muted-foreground font-mono">
                Device: {syncStatus?.device || 'equisense-web'} ({syncStatus?.hostname || 'localhost'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === 'engine' ? (
              <>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || (!apiKey.trim() && !savedSettings?.hasApiKey)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted/80 border border-border/80 rounded-full transition-all disabled:opacity-50"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>Test Connection</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-background bg-foreground hover:bg-foreground/90 rounded-full transition-all shadow-xs disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Settings</span>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-muted/80 border border-border/80 rounded-full transition-all shadow-xs"
              >
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
