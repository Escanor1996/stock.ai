import React, { useState, useRef } from 'react';
import {
  Upload,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function PortfolioUploader({
  onParsed = () => {},
  onLoadDemo = () => {},
  loading = false,
  error = null
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enrichPrices, setEnrichPrices] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState(null);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
        setLocalError(null);
      } else {
        setLocalError('Please select a valid PDF file.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
        setLocalError(null);
      } else {
        setLocalError('Please select a valid PDF file.');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setLocalError('Please select a CAS PDF file.');
      return;
    }
    setLocalError(null);
    onParsed(selectedFile, password, enrichPrices);
  };

  const activeError = localError || error;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── MAIN UPLOAD CONTAINER (Wealthfolio EmptyPlaceholder Pattern) ── */}
      <div className="lg:col-span-2 space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 transition-all backdrop-blur-xl ${
            dragActive
              ? 'border-foreground bg-muted/40'
              : 'border-border hover:border-muted-foreground/60 bg-card/60'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-col items-center justify-center text-center space-y-4">
            {/* Circular Icon Badge */}
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Upload className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground">
                {selectedFile ? selectedFile.name : 'Upload Demat CAS Statement'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to unlock`
                  : 'Drag and drop your official CDSL, NSDL, or CAMS monthly e-CAS PDF statement.'}
              </p>
            </div>

            {/* File Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border rounded-full transition-all duration-150"
              >
                {selectedFile ? 'Change File' : 'Browse Computer'}
              </button>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="px-3.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-full transition-all duration-150"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Password & Unlock Form */}
          <form onSubmit={handleSubmit} className="mt-8 pt-6 border-t border-border/40 max-w-md mx-auto space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>PDF Password</span>
                </label>
                <span className="text-[11px] text-muted-foreground">PAN (ABCDE1234F) or DOB (DDMMYYYY)</span>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter PDF password"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Pricing Enrichment Toggle */}
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={enrichPrices}
                  onChange={(e) => setEnrichPrices(e.target.checked)}
                  className="rounded border-border bg-card text-foreground focus:ring-0"
                />
                <span>Enrich live market quotes via Yahoo Finance</span>
              </label>
            </div>

            {/* Error Message */}
            {activeError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activeError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="w-full py-2.5 px-4 bg-foreground text-background hover:bg-foreground/90 font-semibold text-xs rounded-full shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Decrypting & Categorizing Statement...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Unlock & Load Portfolio</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── SIDEBAR DEMO & SECURITY CARDS ── */}
      <div className="space-y-4">
        {/* Instant Demo Card */}
        <div className="glass-card p-5 space-y-3">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
            Instant Demo Preview
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Test the complete Wealthfolio design language with pre-loaded Direct Stocks, ETFs, Mutual Funds, and 12-month analytics.
          </p>
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loading}
            className="w-full py-2 px-4 bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-semibold rounded-full transition-all duration-150 flex items-center justify-center gap-2"
          >
            <span>Load Sample Portfolio</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Security & Privacy Card */}
        <div className="glass-card p-5 space-y-2 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-success" />
            <span>Local Processing Guarantee</span>
          </div>
          <p className="leading-relaxed">
            All statements are decrypted in memory on your local machine. Passwords and unencrypted holdings data are never sent to third-party cloud servers.
          </p>
        </div>
      </div>
    </div>
  );
}
