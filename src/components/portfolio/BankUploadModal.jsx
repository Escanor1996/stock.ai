import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Lock,
  Eye,
  EyeOff,
  Landmark,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FileText,
  Trash2,
  Info
} from 'lucide-react';

export default function BankUploadModal({
  isOpen,
  onClose,
  onUpload,
  isUploading = false,
  error = null
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bankType, setBankType] = useState('auto');
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setPassword('');
      setShowPassword(false);
      setBankType('auto');
      setLocalError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isUploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUploading, onClose]);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const addFiles = (files) => {
    const valid = [];
    let hasInvalid = false;
    for (const f of files) {
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        valid.push(f);
      } else {
        hasInvalid = true;
      }
    }
    if (hasInvalid) {
      setLocalError('Only PDF statement files are supported.');
    } else {
      setLocalError(null);
    }
    if (valid.length > 0) {
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((item) => item.name + item.size));
        const newItems = valid.filter((item) => !existingNames.has(item.name + item.size));
        return [...prev, ...newItems];
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setLocalError('Please select at least one bank statement PDF.');
      return;
    }
    setLocalError(null);
    try {
      await onUpload(selectedFiles, password, bankType);
      onClose();
    } catch (err) {
      // Handled by parent
    }
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/40 flex items-center justify-between gap-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center border border-sky-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-foreground text-base">
                Import Bank Statement
              </h2>
              <p className="text-xs text-muted-foreground">
                HDFC Bank &bull; Standard Chartered &bull; Generic Indian Banks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              id="bank-statement-file-input"
              data-testid="bank-statement-file-input"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-sky-500 bg-sky-500/5'
                  : 'border-border/80 hover:border-muted-foreground/60 bg-muted/10 hover:bg-muted/20'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-2">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-foreground">
                Click to choose PDF or drag &amp; drop
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Select one or multiple bank statement PDFs
              </div>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Selected Statements ({selectedFiles.length})
                </div>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/40 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="truncate font-medium text-foreground">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bank Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Bank Format</span>
                <span className="text-[10px] text-muted-foreground font-normal">Auto-detects layout</span>
              </label>
              <select
                value={bankType}
                onChange={(e) => setBankType(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border/80 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="auto">Auto-Detect Bank (Recommended)</option>
                <option value="hdfc">HDFC Bank</option>
                <option value="scb">Standard Chartered Bank</option>
              </select>
            </div>

            {/* Password Input Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>PDF Password (If Encrypted)</span>
                </label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. Customer ID or DOB (DDMMYYYY)"
                  disabled={isUploading}
                  id="bank-statement-password-input"
                  className="w-full px-3 py-2 pr-9 text-xs rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {/* Helper explanation text for bank password formats */}
              <div className="p-2.5 bg-muted/30 rounded-lg text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p>
                      <strong className="text-foreground">HDFC Bank:</strong> Usually your Customer ID (or DOB in DDMMYYYY).
                    </p>
                    <p>
                      <strong className="text-foreground">Standard Chartered:</strong> First 4 letters of your name + DDMM of birth.
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 italic">
                      Leave blank if your statement is already unencrypted.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message Banner */}
            {displayError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Unable to Process Statement</div>
                  <div>{displayError}</div>
                </div>
              </div>
            )}

            {/* Privacy Note */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Statements are processed strictly locally. No credentials or login data stored.</span>
            </div>
          </div>

          {/* Modal Action Buttons (Sticky Footer) */}
          <div className="p-3.5 border-t border-border/40 flex items-center justify-end gap-2.5 bg-muted/20 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-border/80 hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="bank-statement-submit-btn"
              data-testid="bank-statement-submit-btn"
              disabled={isUploading || selectedFiles.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Decrypting &amp; Parsing...</span>
                </>
              ) : (
                <>
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Parse Statement{selectedFiles.length > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
