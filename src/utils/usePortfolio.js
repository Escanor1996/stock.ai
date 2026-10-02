import { useState, useEffect, useCallback } from 'react';
import {
  uploadCASFile,
  uploadBrokerStatement,
  uploadEPFOPassbook,
  deleteEPFOAccount,
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
let globalIsEPFOUploading = false;
let globalSaveStatus = null;
let isInitialized = false;

const listeners = new Set();

function emitChange() {
  listeners.forEach(fn => fn());
}

function normalizeHolding(item) {
  if (!item) return item;
  let sym = (item.symbol || '').toUpperCase().trim();
  let name = item.name || '';
  if (item.isin === 'INE0HOQ01053' || sym === 'BILLIONBRAINS') {
    sym = 'GROWW';
    if (!name || name.includes('BILLIONBRAINS')) name = 'Groww (Billionbrains Garage)';
  } else if (item.isin === 'INE742F01042' || sym === 'ADANI') {
    sym = 'ADANIPORTS';
  } else if (item.isin === 'INE00WC01027') {
    sym = 'AFFLE';
  } else if (item.isin === 'INE049B01025' || sym === 'WOCKHARDT') {
    sym = 'WOCKPHARMA';
  } else if (item.isin === 'INE249Z01020' || sym === 'MAZAGON') {
    sym = 'MAZDOCK';
  } else if (item.isin === 'INE1TAE01010' || sym === 'TATA') {
    sym = 'TATAMOTORS';
  } else if (item.isin === 'INE251B01027' || sym === 'ZEN') {
    sym = 'ZENTEC';
  } else if (item.isin === 'INE285K01026' || sym === 'TECHNO') {
    sym = 'TECHNOE';
  }
  const hasBrokerBuyPrice = Boolean(item.has_broker_buy_price || (item.cost_basis !== undefined && item.cost_basis !== null && item.cost_basis > 0));
  const buyPrice = item.buy_price && item.buy_price > 0
    ? item.buy_price
    : (hasBrokerBuyPrice && item.quantity > 0 ? Math.round((item.cost_basis / item.quantity) * 100) / 100 : item.price);
  return { ...item, symbol: sym, name, has_broker_buy_price: hasBrokerBuyPrice, buy_price: buyPrice };
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
        if (parsed && (parsed.stocks?.length > 0 || parsed.holdings?.length > 0 || parsed.mutual_funds?.length > 0 || parsed.epfo_accounts?.length > 0)) {
          const norm = (arr) => Array.isArray(arr) ? arr.map(normalizeHolding) : arr;
          globalPortfolio = {
            ...parsed,
            stocks: norm(parsed.stocks),
            holdings: norm(parsed.holdings),
            direct_stocks: norm(parsed.direct_stocks),
            etfs: norm(parsed.etfs)
          };
          emitChange();
          // Sync with database scores asynchronously
          fetch('/api/portfolio/scores')
            .then(r => r.json())
            .then(sRes => {
              if (sRes?.success && sRes.scores && globalPortfolio?.stocks) {
                let changed = false;
                const syncScores = (list) => {
                  if (!Array.isArray(list)) return list;
                  return list.map(item => {
                    const sym = (item.symbol || '').toUpperCase().trim();
                    const sc = sRes.scores[sym];
                    if (sc && sc.score != null && (item.score !== sc.score || item.is_ai_score !== sc.is_ai_score)) {
                      changed = true;
                      return {
                        ...item,
                        score: sc.score,
                        score_type: sc.score_type,
                        score_engine: sc.score_engine,
                        is_ai_score: sc.is_ai_score,
                        score_category: sc.score_category
                      };
                    }
                    return item;
                  });
                };
                const newStocks = syncScores(globalPortfolio.stocks);
                if (changed) {
                  globalPortfolio = {
                    ...globalPortfolio,
                    stocks: newStocks,
                    holdings: syncScores(globalPortfolio.holdings),
                    direct_stocks: syncScores(globalPortfolio.direct_stocks),
                    etfs: syncScores(globalPortfolio.etfs)
                  };
                  try {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(globalPortfolio));
                  } catch (_) {}
                  emitChange();
                }
              }
            })
            .catch(() => {});
          return;
        }
      } catch (e) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }

    // Fallback to SQLite store
    fetchSavedPortfolio()
      .then(res => {
        if (res?.data && (res.data.holdings?.length > 0 || res.data.stocks?.length > 0 || res.data.mutual_funds?.length > 0 || res.data.epfo_accounts?.length > 0)) {
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
  const updateStockScore = useCallback((symbol, scoreData) => {
    if (!globalPortfolio || !symbol || !scoreData) return;
    const sym = symbol.toUpperCase().trim();
    const isAI = scoreData.is_ai_score !== undefined
      ? scoreData.is_ai_score
      : Boolean(scoreData.engine && (scoreData.engine.includes('Gemini') || scoreData.engine.includes('AI') || !scoreData.engine.includes('Algorithm')));

    const updateList = (list) => {
      if (!Array.isArray(list)) return list;
      return list.map(item => {
        if ((item.symbol || '').toUpperCase().trim() === sym) {
          return {
            ...item,
            score: scoreData.score,
            score_type: isAI ? 'ai' : 'algo',
            score_engine: scoreData.engine || scoreData.score_engine || 'stock.ai Algorithm',
            is_ai_score: isAI,
            score_category: scoreData.score >= 80 ? 'Exceptional' : scoreData.score >= 65 ? 'Strong' : scoreData.score >= 50 ? 'Moderate' : 'High Risk'
          };
        }
        return item;
      });
    };

    const updated = {
      ...globalPortfolio,
      stocks: updateList(globalPortfolio.stocks),
      holdings: updateList(globalPortfolio.holdings),
      direct_stocks: updateList(globalPortfolio.direct_stocks),
      etfs: updateList(globalPortfolio.etfs)
    };
    updatePortfolioState(updated);
  }, [updatePortfolioState]);

  const handleParseStatement = useCallback(async (file, password, enrichPrices) => {
    globalLoading = true;
    globalError = null;
    emitChange();
    try {
      const result = await uploadCASFile(file, password, enrichPrices, globalPortfolio);
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

  const handleUploadEPFOPassbook = useCallback(async (files) => {
    if (!files) return;
    const fileList = Array.isArray(files)
      ? files
      : (files instanceof FileList ? Array.from(files) : [files]);
    if (fileList.length === 0) return;

    globalIsEPFOUploading = true;
    globalError = null;
    emitChange();

    try {
      const result = await uploadEPFOPassbook(fileList, globalPortfolio);
      if (!result.portfolio) {
        throw new Error('The EPFO passbook(s) could not be merged into the portfolio.');
      }
      updatePortfolioState(result.portfolio);
      return result.portfolio;
    } catch (err) {
      globalError = err.message || 'Failed to import EPFO passbook(s).';
      emitChange();
      throw err;
    } finally {
      globalIsEPFOUploading = false;
      emitChange();
    }
  }, [updatePortfolioState]);
  const handleDeleteEPFOAccount = useCallback(async (memberId) => {
    if (!memberId) return;
    try {
      const res = await deleteEPFOAccount(memberId);
      if (res.portfolio) {
        updatePortfolioState(res.portfolio);
      }
      return res;
    } catch (err) {
      globalError = err.message || 'Failed to remove EPFO account.';
      emitChange();
      throw err;
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
    isEPFOUploading: globalIsEPFOUploading,
    saveStatus: globalSaveStatus,
    setPortfolioData: updatePortfolioState,
    updatePortfolioState,
    updateStockScore,
    handleParseStatement,
    handleUploadBrokerSpreadsheet,
    handleLoadDemo,
    handleUploadEPFOPassbook,
    handleClearPortfolio,
    handleDeleteEPFOAccount,
    handleSaveToDatabase,
    handleExportCSV,
    handleExportJSON,
    clearError: () => {
      globalError = null;
      emitChange();
    }
  };
}
