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
  ShieldCheck
} from 'lucide-react';
import { fetchSettings, saveSettings, testApiKey } from '../utils/api';

export default function SettingsModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedSettings, setSavedSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }
  const [saveToast, setSaveToast] = useState(null);

  // Load existing settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setTestResult(null);
    setSaveToast(null);

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-muted/60 border border-border/60 text-foreground">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-foreground">Application Settings</h2>
              <p className="text-[11px] text-muted-foreground">Configure AI research engine and local runtime</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-t border-border/60">
          <div>
            {savedSettings?.hasApiKey && (
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
          </div>

          <div className="flex items-center gap-2.5">
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
          </div>
        </div>
      </div>
    </div>
  );
}
