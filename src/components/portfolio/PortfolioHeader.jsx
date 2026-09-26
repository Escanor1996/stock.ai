import React from 'react';
import {
  FileSpreadsheet,
  FileCode,
  Download,
  CheckCircle2,
  Trash2,
  Wallet
} from 'lucide-react';

export default function PortfolioHeader({
  portfolioData = null,
  onExportCSV = () => {},
  onExportJSON = () => {},
  onSave = () => {},
  onClear = () => {},
  saveStatus = null, // 'saving' | 'saved' | null
  isExporting = false
}) {
  return (
    <div className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Title & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground shrink-0">
          <Wallet className="w-4 h-4" />
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-serif text-xl font-bold text-foreground tracking-tight">
              Portfolio Intelligence
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/30">
              v1.1 Active
            </span>
            {portfolioData?.is_sample && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30">
                Demo Mode
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consolidated Demat & Mutual Fund statements with 1-Year historical analytics.
          </p>
        </div>
      </div>

      {/* Action Buttons (Wealthfolio Pill Button Pattern) */}
      {portfolioData && (
        <div className="flex items-center flex-wrap gap-2">
          {/* Export CSV */}
          <button
            type="button"
            onClick={onExportCSV}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={onExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-full transition-all duration-150 active:scale-95"
          >
            <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export JSON</span>
          </button>

          {/* Save to DB */}
          <button
            type="button"
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-background bg-foreground hover:bg-foreground/90 rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50"
          >
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-background" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-background" />
                <span>Save to DB</span>
              </>
            )}
          </button>

          {/* Reset / Clear */}
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-full transition-all duration-150 active:scale-95"
            title="Clear active portfolio"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      )}
    </div>
  );
}
