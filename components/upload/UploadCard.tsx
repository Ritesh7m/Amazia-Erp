"use client";

import React, { useState, useRef } from 'react';
import { Loader2, X, CheckCircle2, Upload, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORTED_INVOICE_TYPES } from '@/constants';
import { InvoiceType } from '@/types';


function ShopifyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 8h10l1 12H6L7 8Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M9 8a3 3 0 1 1 6 0" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function FedexIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 16V8a1 1 0 0 1 1-1h9v9H4a1 1 0 0 1-1-1Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M13 10h4.2a1 1 0 0 1 .8.4l2 2.6a1 1 0 0 1 .2.6V16a1 1 0 0 1-1 1H13"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="17.5" r="1.4" stroke="currentColor" strokeWidth={1.6} />
      <circle cx="16.5" cy="17.5" r="1.4" stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}

function CsvFileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 76" fill="none" className={className}>
      <path
        d="M16 4h24l12 12v56a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d="M40 4v12h12" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
      <rect x="17" y="44" width="30" height="17" rx="8.5" fill="currentColor" />
      <text
        x="32"
        y="56"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        className="fill-brand-card"
        fontFamily="system-ui, sans-serif"
      >
        CSV
      </text>
    </svg>
  );
}


export default function UploadCard({ onCancel }: { onCancel?: () => void }) {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(SUPPORTED_INVOICE_TYPES.FEDEX);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      toast.error('Invalid file type. Please upload a .CSV file.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const endpoint =
      invoiceType === SUPPORTED_INVOICE_TYPES.FEDEX ? '/api/import/fedex' : '/api/import/etsy';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Invoice processed.');
        clearFile();
      } else {
        toast.error(data.message || 'Import failed.');
      }
    } catch (error) {
      toast.error('Something went wrong while processing this file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Same derivation approach as before: label/icon are computed from
  // SUPPORTED_INVOICE_TYPES, not hardcoded, so new types keep working.
  const getOptionMeta = (type: InvoiceType) => {
    if (type === SUPPORTED_INVOICE_TYPES.FEDEX) {
      return { label: 'FedEx Billing', Icon: FedexIcon };
    }
    return { label: `${String(type).charAt(0)}${String(type).slice(1).toLowerCase()} Statement`, Icon: ShopifyIcon };
  };

  const invoiceOptions = (Object.values(SUPPORTED_INVOICE_TYPES) as InvoiceType[]).map((value) => ({
    value,
    ...getOptionMeta(value),
  }));

  return (
    <div className="w-full max-w-xl mx-auto bg-brand-card rounded-[28px] shadow-glass p-9">
      {/* Header */}
      <div className="mb-7 text-center">
        <h2 className="text-3xl font-extrabold text-brand-primary tracking-tight">Upload Billing File</h2>
        <p className="text-brand-muted mt-2.5 text-[15px] leading-relaxed max-w-sm mx-auto">
          Import Shopify or FedEx invoices to automatically generate expense information.
        </p>
      </div>

      {/* Invoice Type Selector */}
      <div className="flex gap-3 mb-6">
        {invoiceOptions.map(({ value, label, Icon }) => {
          const isActive = invoiceType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setInvoiceType(value)}
              className={`relative flex-1 min-w-0 flex items-center justify-center gap-2 py-[15px] px-4 rounded-full text-[14.5px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-brand-card border-2 border-brand-primary text-brand-primary'
                  : 'bg-transparent border border-brand-border text-brand-muted hover:border-brand-primary/40 hover:text-brand-primary'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-primary' : 'text-brand-muted'}`} />
              <span className="truncate">{label}</span>
              {isActive && (
                <span className="absolute -top-2.5 -right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary ring-[2.5px] ring-brand-card">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Upload Zone */}
      {!file ? (
        <div className="rounded-[22px] p-2.5 mb-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-[1.5px] border-dashed rounded-2xl py-14 px-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-brand-primary bg-brand-primary/5'
                : 'border-brand-border hover:border-brand-primary/50 hover:bg-brand-primary/[0.02]'
            }`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
            <div className="mx-auto mb-[18px] flex h-[104px] w-[104px] items-center justify-center rounded-full bg-brand-gold/20">
              <CsvFileIcon className="h-[52px] w-[52px] text-brand-primary" />
            </div>
            <p className="text-brand-primary font-bold text-[17px]">Drag &amp; Drop CSV File</p>
            <p className="text-brand-muted text-sm mt-1">
              or <span className="text-brand-primary underline underline-offset-2 font-medium">click to browse</span>
            </p>
            <p className="text-brand-muted/75 text-xs mt-2">Only CSV files are supported</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 mb-6 bg-brand-success/60 border border-brand-primary/15 rounded-2xl">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-brand-card border border-brand-border rounded-lg flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-brand-primary" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-brand-primary truncate">{file.name}</p>
              <p className="text-xs text-brand-muted mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            disabled={isUploading}
            className="p-2 text-brand-muted hover:text-brand-primary transition-colors rounded-lg"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

     {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="flex-1 py-4 px-4 rounded-full text-[15px] font-semibold text-brand-muted border border-brand-border bg-transparent hover:bg-brand-border/20 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`flex-[1.5] flex items-center justify-center gap-2 py-4 px-4 rounded-full text-[15px] font-semibold transition-all duration-200 ${
            !file || isUploading
              ? 'bg-brand-primary/25 text-white/70 cursor-not-allowed'
              : 'bg-brand-primary/65 text-white hover:bg-brand-primary'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin h-4 w-4" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Process Invoice
            </>
          )}
        </button>
      </div>
    </div>
  );
}