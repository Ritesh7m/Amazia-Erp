"use client";

import React, { useState, useRef } from 'react';
import { Loader2, X, CheckCircle2, Upload, Truck, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORTED_INVOICE_TYPES } from '@/constants';
import { InvoiceType } from '@/types';

// Custom Cloud SVG styled with your brand colors
function PremiumCloudIcon({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg width="100%" height="100%" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M93.3333 41.6667C93.3333 24.1777 79.1557 10 61.6667 10C47.4697 10 35.4526 19.3364 31.3323 32.1856C20.6722 33.5654 12.5 42.6373 12.5 53.75C12.5 66.1764 22.5736 76.25 35 76.25H90C101.046 76.25 110 67.2957 110 56.25C110 45.4746 101.488 36.6853 90.8166 36.2625C91.6624 38.0163 92.2961 39.8787 92.6841 41.8159C93.1091 41.7766 93.3333 41.6667 93.3333 41.6667Z" fill="var(--color-brand-success)" stroke="var(--color-brand-primary)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
        <path d="M61.6667 43.3333V63.3333" stroke="var(--color-brand-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M51.6667 53.3333L61.6667 43.3333L71.6667 53.3333" stroke="var(--color-brand-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="absolute -bottom-2 right-4 bg-[var(--color-brand-card)] rounded-lg shadow-sm border border-[var(--color-brand-border)] p-1 flex flex-col items-center justify-center">
        <div className="w-7 h-8 border-2 border-[var(--color-brand-primary)] rounded text-[8px] font-bold text-[var(--color-brand-primary)] flex items-center justify-center relative bg-[var(--color-brand-card)] z-10">
          CSV
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[var(--color-brand-primary)] bg-[var(--color-brand-background)] rounded-bl" />
        </div>
      </div>
    </div>
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

    const endpoint = invoiceType === SUPPORTED_INVOICE_TYPES.FEDEX ? '/api/import/fedex' : '/api/import/etsy';

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

  return (
        <div className="w-full max-w-[800px] mx-auto bg-[var(--color-brand-card)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-glass)] p-6 md:p-8 border border-[var(--color-brand-border)]">
      
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-brand-primary)] tracking-tight">Upload Billing File</h2>
        <p className="text-[var(--color-brand-muted)] mt-2 text-[15px] leading-relaxed max-w-lg mx-auto">
          Import Shopify or FedEx invoices to automatically generate expense information.
        </p>
      </div>

      {/* Segmented Control */}
      <div className="flex p-1.5 mb-6 bg-[var(--color-brand-background)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] shadow-sm">
        <button
          type="button"
          onClick={() => setInvoiceType(SUPPORTED_INVOICE_TYPES.FEDEX)}
          className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-[14px] text-[14px] font-semibold transition-all duration-300 ${
            invoiceType === SUPPORTED_INVOICE_TYPES.FEDEX
              ? 'bg-[var(--color-brand-primary)] text-white shadow-md'
              : 'bg-transparent text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)]'
          }`}
        >
          <Truck className="h-4 w-4" />
          FedEx Billing
        </button>
        <button
          type="button"
          onClick={() => setInvoiceType(SUPPORTED_INVOICE_TYPES.ETSY)}
          className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-[14px] text-[14px] font-semibold transition-all duration-300 ${
            invoiceType === SUPPORTED_INVOICE_TYPES.ETSY
              ? 'bg-[var(--color-brand-primary)] text-white shadow-md'
              : 'bg-transparent text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)]'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Etsy Statement
        </button>
      </div>

      {/* Upload Zone / File Preview */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          
          className={`relative h-[220px] flex flex-col items-center justify-center border-2 border-dashed rounded-[var(--radius-xl)] cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-background)]'
              : 'border-[var(--color-brand-border)] bg-[var(--color-brand-background)]/40 hover:bg-[var(--color-brand-background)] hover:border-[var(--color-brand-primary)]/50'
          }`}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
          
          <PremiumCloudIcon className="mb-4 w-24 h-16" />
          
          <p className="text-[var(--color-brand-primary)] font-bold text-[16px]">Drag & Drop your CSV file here</p>
          <p className="text-[var(--color-brand-muted)] text-[14px] mt-1">
            or <span className="text-[var(--color-brand-primary)] font-bold underline underline-offset-4 decoration-2 decoration-[var(--color-brand-primary)]/30 hover:decoration-[var(--color-brand-primary)] transition-colors">Browse Files</span>
          </p>
          <p className="text-[var(--color-brand-muted)] text-xs mt-4 font-medium opacity-75">CSV files only • Max size 20 MB</p>
        </div>
      ) : (
        <div className="h-[240px] flex flex-col justify-center">
          <div className="flex items-center justify-between p-4 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--color-brand-success)] border border-[var(--color-brand-border)] rounded-xl flex items-center justify-center text-[var(--color-brand-primary)] font-bold text-[10px] tracking-wide">
                CSV
              </div>
              <div>
                <p className="text-[15px] font-bold text-[var(--color-brand-primary)]">{file.name}</p>
                <p className="text-xs text-[var(--color-brand-muted)] mt-0.5">{(file.size / 1024).toFixed(1)} KB • Uploaded just now</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-brand-success)] text-[var(--color-brand-primary)] text-[12px] font-bold rounded-full border border-[var(--color-brand-border)]">
                <CheckCircle2 className="h-4 w-4" /> Ready to upload
              </span>
              <button
                type="button"
                onClick={clearFile}
                disabled={isUploading}
                className="p-2 text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)] transition-colors rounded-lg"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-[var(--color-brand-border)] flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="py-2.5 px-6 rounded-xl text-[14px] font-bold text-[var(--color-brand-muted)] border border-[var(--color-brand-border)] bg-transparent hover:bg-[var(--color-brand-background)] transition-colors disabled:opacity-50 shadow-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-[14px] font-bold transition-all duration-300 shadow-sm ${
            !file || isUploading
              ? 'bg-[var(--color-brand-border)] text-white/70 cursor-not-allowed'
              : 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)] shadow-md'
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