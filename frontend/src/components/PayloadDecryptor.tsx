'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Download,
  Key,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { decryptPayload } from '@zerovault/shared/dist/crypto';
import { fetchApi } from '@/lib/api';

export interface PayloadDecryptorProps {
  listingId?: string;
  initialDecryptionKey?: string;
  initialIv?: string;
  onDecrypted?: (plaintext: string) => void;
}

type DecryptionState = 'IDLE' | 'FETCHING' | 'FETCHED' | 'DECRYPTING' | 'SUCCESS' | 'ERROR';

export const PayloadDecryptor: React.FC<PayloadDecryptorProps> = ({
  listingId: initialListingId = '',
  initialDecryptionKey = '',
  initialIv = '',
  onDecrypted,
}) => {
  const [listingId, setListingId] = useState(initialListingId);
  const [decryptionKey, setDecryptionKey] = useState(initialDecryptionKey);
  const [iv, setIv] = useState(initialIv);
  const [ciphertext, setCiphertext] = useState('');
  const [rawPayloadRaw, setRawPayloadRaw] = useState('');

  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<DecryptionState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialListingId) {
      setListingId(initialListingId);
    }
  }, [initialListingId]);

  useEffect(() => {
    if (initialDecryptionKey) {
      setDecryptionKey(initialDecryptionKey);
    }
  }, [initialDecryptionKey]);

  useEffect(() => {
    if (initialIv) {
      setIv(initialIv);
    }
  }, [initialIv]);

  const handleFetchPayload = async () => {
    if (!listingId.trim()) {
      setErrorMessage('Please enter a valid Listing ID');
      setStatus('ERROR');
      return;
    }

    setStatus('FETCHING');
    setErrorMessage(null);
    setDecryptedContent(null);

    try {
      const response = await fetchApi(`/listings/${encodeURIComponent(listingId.trim())}/payload`, {
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream, application/json, text/plain',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch payload (HTTP ${response.status})`
        );
      }

      const textData = await response.text();
      setRawPayloadRaw(textData);

      try {
        const parsed = JSON.parse(textData);
        if (parsed.ciphertext) {
          setCiphertext(parsed.ciphertext);
          if (parsed.iv && !iv) {
            setIv(parsed.iv);
          }
          if (parsed.key && !decryptionKey) {
            setDecryptionKey(parsed.key);
          }
        } else {
          setCiphertext(textData);
        }
      } catch {
        setCiphertext(textData);
      }

      setStatus('FETCHED');
    } catch (err: any) {
      console.error('Payload fetch error:', err);
      setErrorMessage(err.message || 'Error downloading encrypted payload');
      setStatus('ERROR');
    }
  };

  const handleDecrypt = async () => {
    if (!ciphertext.trim()) {
      setErrorMessage('No encrypted payload loaded yet.');
      setStatus('ERROR');
      return;
    }

    if (!decryptionKey.trim()) {
      setErrorMessage('Please enter the AES-256 decryption key.');
      setStatus('ERROR');
      return;
    }

    if (!iv.trim()) {
      setErrorMessage('Please enter the 12-byte Initialization Vector (IV).');
      setStatus('ERROR');
      return;
    }

    setStatus('DECRYPTING');
    setErrorMessage(null);

    try {
      const plaintext = await decryptPayload({
        ciphertext: ciphertext.trim(),
        iv: iv.trim(),
        key: decryptionKey.trim(),
      });

      setDecryptedContent(plaintext);
      setStatus('SUCCESS');

      if (onDecrypted) {
        onDecrypted(plaintext);
      }
    } catch (err: any) {
      console.error('Decryption failed:', err);
      setErrorMessage(
        'Decryption failed: Tag mismatch or invalid key/IV. Ensure key matches settled escrow commitment.'
      );
      setStatus('ERROR');
    }
  };

  const handleCopy = () => {
    if (!decryptedContent) return;
    navigator.clipboard.writeText(decryptedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!decryptedContent) return;
    const blob = new Blob([decryptedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ZeroVault-Report-${listingId.slice(0, 8) || 'decrypted'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded border border-[#232732] bg-[#14171E] overflow-hidden font-mono text-xs">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#232732] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
          <h3 className="font-semibold text-[#F0F2F5]">
            Client-Side Decryption Terminal
          </h3>
        </div>
        <span className="text-[10px] text-[#16A34A] border border-[#16A34A]/30 px-2 py-0.5 rounded bg-[#0F1A14]">
          AES-256-GCM
        </span>
      </div>

      <div className="p-5 space-y-5">
        
        {/* Step 1: Retrieval */}
        <div className="space-y-2">
          <label className="text-[11px] text-[#848B98] block uppercase tracking-wider">
            [Step 01] Listing Payload Retrieval
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              placeholder="Enter Listing ID..."
              className="flex-1 px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] focus:outline-none focus:border-[#2563EB]"
            />
            <button
              onClick={handleFetchPayload}
              disabled={status === 'FETCHING'}
              className="px-4 py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              {status === 'FETCHING' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{status === 'FETCHING' ? 'Fetching...' : 'Fetch payload'}</span>
            </button>
          </div>
        </div>

        {/* Ciphertext Indicator */}
        {ciphertext && (
          <div className="p-3 rounded border border-[#232732] bg-[#0C0E12] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[#848B98]">
              <span className="text-[#16A34A]">✓ Ciphertext blob loaded in memory</span>
              <span>{ciphertext.length} characters</span>
            </div>
            <div className="max-h-16 overflow-y-auto text-[10px] text-[#848B98] break-all">
              {ciphertext.slice(0, 140)}...
            </div>
          </div>
        )}

        {/* Step 2: Decryption Parameters */}
        <div className="space-y-3 pt-2 border-t border-[#232732]">
          <label className="text-[11px] text-[#848B98] block uppercase tracking-wider">
            [Step 02] Decryption Key & Initialization Vector
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] text-[#848B98]">AES-256 Key:</span>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={decryptionKey}
                  onChange={(e) => setDecryptionKey(e.target.value)}
                  placeholder="key_0x..."
                  className="w-full px-3 py-2 pr-9 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] focus:outline-none focus:border-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#848B98] hover:text-[#F0F2F5]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[#848B98]">12-Byte IV:</span>
              <input
                type="text"
                value={iv}
                onChange={(e) => setIv(e.target.value)}
                placeholder="iv_hex..."
                className="w-full px-3 py-2 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <button
            onClick={handleDecrypt}
            disabled={status === 'DECRYPTING'}
            className="w-full py-2.5 px-4 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {status === 'DECRYPTING' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            <span>{status === 'DECRYPTING' ? 'Decrypting in memory...' : 'Decrypt vulnerability payload'}</span>
          </button>
        </div>

        {/* Feedback states */}
        {errorMessage && (
          <div className="p-3 rounded border border-[#DC2626]/40 bg-[#170E10] text-[#DC2626] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-all">{errorMessage}</span>
          </div>
        )}

        {/* Plaintext Result */}
        {decryptedContent && (
          <div className="space-y-3 pt-2 border-t border-[#232732]">
            <div className="flex items-center justify-between">
              <span className="text-[#16A34A] flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-4 h-4" /> Plaintext Decrypted
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#3B4252] text-[#848B98] hover:text-[#F0F2F5] transition-colors flex items-center gap-1 text-[11px]"
                >
                  {copied ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadReport}
                  className="px-2.5 py-1 rounded border border-[#232732] bg-[#0C0E12] hover:border-[#3B4252] text-[#848B98] hover:text-[#F0F2F5] transition-colors flex items-center gap-1 text-[11px]"
                >
                  <Download className="w-3 h-3" />
                  <span>Download report</span>
                </button>
              </div>
            </div>

            <pre className="p-3 rounded border border-[#232732] bg-[#0C0E12] text-[#F0F2F5] max-h-56 overflow-y-auto whitespace-pre-wrap break-all text-[11px] font-mono leading-relaxed">
              {decryptedContent}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
};
export default PayloadDecryptor;
