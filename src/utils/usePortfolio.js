import { useState, useEffect, useCallback } from 'react';
import {
  uploadCASFile,
  uploadBrokerStatement,
  fetchSamplePortfolio,
  savePortfolio,
  fetchSavedPortfolio,
  clearSavedPortfolio,
  exportPortfolioCSV
} from './api';

const LOCAL_STORAGE_KEY = 'stock_ai_cached_portfolio';

let globalPortfolio = null;
let globalLoading = false;
let globalError = null;
let globalBrokerNotice = null;
let globalIsBrokerUploading = false;
let globalSaveStatus = null;
let isInitialized = false;

const listeners = new Set();

function emitChange() {
  listeners.forEach(fn => fn());
}

export function usePortfolio() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  // Initialize once from localStorage or SQLite
  useEffect(() => {
    if (globalPortfolio) return;

    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.stocks?.length > 0 || parsed.holdings?.length > 0 || parsed.mutual_funds?.length > 0)) {
          globalPortfolio = parsed;
          emitChange();
          return;
        }
      } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }

    // Fallback to SQLite store
    fetchSavedPortfolio()
      .then(res => {
        if (res?.data && (res.data.holdings?.length > 0 || res.data.stocks?.length > 0 || res.data.mutual_funds?.length > 0)) {
          globalPortfolio = res.data;
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(res.data));
          } catch (_) {}
          emitChange();
        }
      })
      .catch(() => {});
  }, []);

  const updatePortfolioState = useCallback((data) => {
    globalPortfolio = data;
    if (data) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('LocalStorage quota exceeded');
      }
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    emitChange();
  }, []);

  const handleParseStatement = useCallback(async (file, password, enrichPrices) => {
    globalLoading = true;
    globalError = null;
    emitChange();
    try {
      const result = await uploadCASFile(file, password, enrichPrices);
      updatePortfolioState(result);
      try {
        await savePortfolio(result, result.meta || {});
      } catch (_) {}
      return result;
    } catch (err) {
      globalError = err.message || 'Failed to parse CAS statement';
      emitChange();
      throw err;
    } finally {
      globalLoading = false;
      emitChange();
    }
  }, [updatePortfolioState]);

  const handleUploadBrokerSpreadsheet = useCallback(async (file) => {
    if (!file || !globalPortfolio) return;
    globalIsBrokerUploading = true;
    globalError = null;
    emitChange();

    try {
      const res = await uploadBrokerStatement(file, globalPortfolio);
      let updatedPortfolio = res.portfolio;

      if (updatedPortfolio) {
        updatePortfolioState(updatedPortfolio);
        try {
          await savePortfolio(updatedPortfolio, updatedPortfolio.meta || {});
        } catch (saveErr) {
          console.warn('Could not auto-save to DB:', saveErr);
        }

        const count = updatedPortfolio.summary?.broker_enriched_count || 0;
        globalBrokerNotice = {
          type: 'success',
          message: `Successfully imported ${res.broker_data?.broker || 'broker'} buy prices for ${count} positions. Accurate P&L active.`
        };
        emitChange();
        setTimeout(() => {
          globalBrokerNotice = null;
          emitChange();
        }, 6000);
      }
    } catch (err) {
      globalError = 'Failed to import broker buy prices: ' + err.message;
      emitChange();
    } finally {
      globalIsBrokerUploading = false;
      emitChange();
    }
  }, [updatePortfolioState]);

  const handleLoadDemo = useCallback(async () => {
    globalLoading = true;
    globalError = null;
    emitChange();
    try {
      const demo = await fetchSamplePortfolio();
      updatePortfolioState(demo);
      try {
        await savePortfolio(demo, demo.meta || {});
      } catch (_) {}
    } catch (err) {
      globalError = 'Failed to load sample portfolio: ' + err.message;
      emitChange();
    } finally {
      globalLoading = false;
      emitChange();
    }
  }, [updatePortfolioState]);

  const handleClearPortfolio = useCallback(async () => {
    try {
      await clearSavedPortfolio();
    } catch (_) {}
    updatePortfolioState(null);
  }, [updatePortfolioState]);

  const handleSaveToDatabase = useCallback(async () => {
    if (!globalPortfolio) return;
    globalSaveStatus = 'saving';
    emitChange();
    try {
      await savePortfolio(globalPortfolio, globalPortfolio.meta || {});
      globalSaveStatus = 'saved';
      emitChange();
      setTimeout(() => {
        globalSaveStatus = null;
        emitChange();
      }, 3000);
    } catch (err) {
      globalSaveStatus = 'error';
      globalError = 'Failed to save to database: ' + err.message;
      emitChange();
      setTimeout(() => {
        globalSaveStatus = null;
        emitChange();
      }, 4000);
    }
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (!globalPortfolio) return;
    try {
      await exportPortfolioCSV(globalPortfolio, globalPortfolio.summary);
    } catch (err) {
      globalError = 'Failed to export CSV: ' + err.message;
      emitChange();
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    if (!globalPortfolio) return;
    const jsonStr = JSON.stringify(globalPortfolio, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_ai_portfolio_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    portfolioData: globalPortfolio,
    loading: globalLoading,
    error: globalError,
    brokerNotice: globalBrokerNotice,
    isBrokerUploading: globalIsBrokerUploading,
    saveStatus: globalSaveStatus,
    setPortfolioData: updatePortfolioState,
    updatePortfolioState,
    handleParseStatement,
    handleUploadBrokerSpreadsheet,
    handleLoadDemo,
    handleClearPortfolio,
    handleSaveToDatabase,
    handleExportCSV,
    handleExportJSON,
    clearError: () => {
      globalError = null;
      emitChange();
    }
  };
}
