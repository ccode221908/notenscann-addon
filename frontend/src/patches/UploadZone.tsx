import { useState, useRef, useCallback } from 'react';
import { uploadScore } from '../api';
import type { ScoreRead } from '../types';

interface UploadZoneProps {
  onUploaded: (score: ScoreRead) => void;
}

const FORMATS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff'];

export default function UploadZone({ onUploaded }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      try {
        const score = await uploadScore(file, ocrEnabled);
        onUploaded(score);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload fehlgeschlagen. Bitte erneut versuchen.';
        setError(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded, ocrEnabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);
  const handleClick = useCallback(() => {
    if (!isUploading) inputRef.current?.click();
  }, [isUploading]);
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { handleFile(file); e.target.value = ''; }
  }, [handleFile]);

  const borderColor = isDragging ? '#7c3aed' : '#d1d5db';
  const bg = isDragging
    ? 'linear-gradient(135deg, rgba(238,235,255,0.8) 0%, rgba(219,234,254,0.8) 100%)'
    : '#fff';

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto 32px' }}>
      <div
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: '16px',
          padding: '44px 32px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          background: bg,
          transition: 'all 0.2s ease',
          userSelect: 'none',
          boxShadow: isDragging ? '0 0 0 4px rgba(124,58,237,0.12)' : '0 2px 12px rgba(0,0,0,0.06)',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label="Partitur hochladen"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.tiff,.tif,.pdf"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
        <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: '14px' }}>
          {isUploading ? '⏳' : isDragging ? '📂' : '⬆️'}
        </div>
        <p style={{ color: '#374151', margin: '0 0 6px', fontSize: '16px', fontWeight: 600 }}>
          {isUploading
            ? 'Wird hochgeladen…'
            : isDragging
            ? 'Datei hier ablegen'
            : 'Notenblatt hochladen'}
        </p>
        {!isUploading && (
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 16px' }}>
            Datei hierher ziehen oder klicken zum Auswählen
          </p>
        )}

        {/* Format chips */}
        {!isUploading && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {FORMATS.map((fmt) => (
              <span key={fmt} style={{
                background: '#f3f4f6', border: '1px solid #e5e7eb',
                borderRadius: '20px', padding: '2px 10px',
                fontSize: '12px', color: '#6b7280', fontFamily: 'monospace',
              }}>
                {fmt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* OCR Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', paddingLeft: '4px' }}>
        <div
          onClick={() => !isUploading && setOcrEnabled(!ocrEnabled)}
          style={{
            width: '40px', height: '22px', borderRadius: '11px',
            background: ocrEnabled ? '#7c3aed' : '#d1d5db',
            position: 'relative', transition: 'background 0.2s',
            cursor: isUploading ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', top: '3px',
            left: ocrEnabled ? '21px' : '3px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }} />
        </div>
        <span
          onClick={() => !isUploading && setOcrEnabled(!ocrEnabled)}
          style={{ fontSize: '14px', color: '#374151', cursor: isUploading ? 'not-allowed' : 'pointer', userSelect: 'none' }}
        >
          Liedtexte erkennen (OCR)
        </span>
      </div>

      {error && (
        <div style={{
          marginTop: '12px', padding: '12px 16px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '10px', color: '#dc2626', fontSize: '14px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>⚠️</span> {error}
        </div>
      )}
    </div>
  );
}
