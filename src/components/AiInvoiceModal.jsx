import { useState, useRef, useEffect } from 'react';
import { X, Upload, Sparkles, FileText, CheckCircle2, Loader2, Key, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { toast } from './Toast';

export default function AiInvoiceModal({ isOpen, onClose, onApply, currentItemsCount = 0 }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'text'
  const [file, setFile] = useState(null);
  const [fileBase64, setFileBase64] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fgsb_gemini_api_key') || '');
  const [hasServerKey, setHasServerKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Configuration options for applying
  const [replaceItems, setReplaceItems] = useState(true);
  const [applyClient, setApplyClient] = useState(true);
  const [applyDetails, setApplyDetails] = useState(true);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Check server API key status
      fetch('/api/ai/status')
        .then(r => r.json())
        .then(d => {
          setHasServerKey(Boolean(d?.hasServerKey));
          if (!d?.hasServerKey && !localStorage.getItem('fgsb_gemini_api_key')) {
            setShowKeyInput(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const reader = new FileReader();

    if (selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setFileBase64(base64);
      };
      reader.readAsDataURL(selected);
    } else if (selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf')) {
      setPreviewUrl('');
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setFileBase64(base64);
      };
      reader.readAsDataURL(selected);
    } else if (selected.type === 'application/json' || selected.name.toLowerCase().endsWith('.json')) {
      setPreviewUrl('');
      reader.onload = () => {
        try {
          setTextContent(reader.result);
          const base64 = btoa(unescape(encodeURIComponent(reader.result)));
          setFileBase64(base64);
        } catch {
          setFileBase64('');
        }
      };
      reader.readAsText(selected);
    } else {
      toast('Please upload an Image (PNG/JPG), PDF, or JSON file', 'warning');
      setFile(null);
      setFileBase64('');
      setPreviewUrl('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const fakeEvent = { target: { files: [dropped] } };
      handleFileChange(fakeEvent);
    }
  };

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('fgsb_gemini_api_key', key.trim());
  };

  const handleExtract = async () => {
    if (activeTab === 'upload' && !file) {
      toast('Please upload a file or switch to paste text', 'warning');
      return;
    }
    if (activeTab === 'text' && !textContent.trim()) {
      toast('Please paste invoice or item details text', 'warning');
      return;
    }
    if (!hasServerKey && !apiKey.trim()) {
      setShowKeyInput(true);
      toast('Please enter your Google Gemini API Key to continue', 'warning');
      return;
    }

    setLoading(true);
    setExtractedData(null);

    try {
      const payload = {
        apiKey: apiKey.trim(),
        text: activeTab === 'text' ? textContent : '',
      };

      if (activeTab === 'upload' && file && fileBase64) {
        payload.file = {
          data: fileBase64,
          name: file.name,
          mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/json'),
        };
      }

      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Error ${res.status}: Extraction failed`);
      }

      if (result.success && result.data) {
        setExtractedData(result.data);
        const count = result.data.items?.length || 0;
        toast(`Extracted ${count} item${count === 1 ? '' : 's'} successfully!`, 'success');
      } else {
        throw new Error('No items or invoice data recognized');
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'AI extraction failed. Check your API key or document.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (!extractedData || !extractedData.items || extractedData.items.length === 0) {
      toast('No items to apply', 'warning');
      return;
    }

    onApply({
      items: extractedData.items,
      client: applyClient ? extractedData.client : null,
      details: applyDetails ? extractedData.details : null,
      notes: extractedData.notes || '',
      replaceItems,
    });

    toast(`Applied ${extractedData.items.length} items to invoice!`, 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '850px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#fff',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                AI Smart Auto-Fill (Invoice & Items)
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                Upload an invoice (PDF, Image, JSON) or paste text to auto-populate items & party details.
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* API Key Status / Configuration Bar */}
        <div style={{
          background: 'var(--bg-secondary, #f8fafc)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '8px',
          padding: '0.6rem 0.85rem',
          marginBottom: '1rem',
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={15} style={{ color: hasServerKey || apiKey ? '#10b981' : '#f59e0b' }} />
            <span>
              {hasServerKey ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>Gemini Server Key Connected</span>
              ) : apiKey ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>Personal Gemini Key Saved</span>
              ) : (
                <span style={{ color: '#b45309', fontWeight: 500 }}>No Gemini API Key found</span>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary, #4f46e5)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {showKeyInput ? 'Hide Key Settings' : 'Change / Set API Key'}
            </button>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.78rem', color: 'var(--primary, #4f46e5)', fontWeight: 500 }}
            >
              Get Free Gemini Key ↗
            </a>
          </div>

          {showKeyInput && (
            <div style={{ width: '100%', marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <input
                type="password"
                className="form-input"
                placeholder="Paste your Google Gemini API Key (AIzaSy...)"
                value={apiKey}
                onChange={e => handleSaveApiKey(e.target.value)}
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              />
            </div>
          )}
        </div>

        {/* Main Content Area (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {!extractedData ? (
            <>
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                >
                  <Upload size={15} /> Upload Document (PDF / Image / JSON)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`btn ${activeTab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                >
                  <FileText size={15} /> Paste Text / Prompt
                </button>
              </div>

              {/* Tab 1: Upload */}
              {activeTab === 'upload' && (
                <div>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color, #cbd5e1)',
                      borderRadius: '12px',
                      padding: '2rem 1.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-secondary, #f8fafc)',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <Upload size={36} style={{ color: 'var(--primary, #6366f1)', opacity: 0.8, marginBottom: '0.5rem' }} />
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.95rem' }}>
                      {file ? file.name : 'Click to upload or drag and drop your document'}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                      Supports <strong>PDF Invoices, Bill Images (PNG, JPG), or JSON files</strong>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp,.json"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* Preview of uploaded image or file indicator */}
                  {file && (
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary, #f1f5f9)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileText size={18} style={{ color: 'var(--primary, #4f46e5)' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{file.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => { setFile(null); setFileBase64(''); setPreviewUrl(''); }}
                        title="Remove file"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {previewUrl && (
                    <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                      <img
                        src={previewUrl}
                        alt="Bill Preview"
                        style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Text / Prompt */}
              {activeTab === 'text' && (
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    Paste Invoice Text, WhatsApp Order, or Item Prompt:
                  </label>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="Example:&#10;1. 5 Bags Cement @ 380 each, 28% GST&#10;2. 10 Boxes of Screws @ 120 each, 18% GST&#10;Customer: Sharma Traders, GSTIN: 07AAAAA0000A1Z5"
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem', fontFamily: 'monospace', resize: 'vertical' }}
                  />
                </div>
              )}
            </>
          ) : (
            /* Results Review Table */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Extracted {extractedData.items?.length || 0} Line Items
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setExtractedData(null)}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                >
                  <RefreshCw size={13} /> Re-extract / Change Document
                </button>
              </div>

              {/* Detected Party / Details Card */}
              {(extractedData.client?.name || extractedData.details?.invoiceNumber) && (
                <div style={{
                  background: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--primary, #4f46e5)' }}>
                    Detected Invoice & Party Details:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {extractedData.client?.name && (
                      <div><strong>Client:</strong> {extractedData.client.name}</div>
                    )}
                    {extractedData.client?.gstin && (
                      <div><strong>GSTIN:</strong> {extractedData.client.gstin}</div>
                    )}
                    {extractedData.details?.invoiceNumber && (
                      <div><strong>Invoice #:</strong> {extractedData.details.invoiceNumber}</div>
                    )}
                    {extractedData.details?.invoiceDate && (
                      <div><strong>Date:</strong> {extractedData.details.invoiceDate}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', maxHeight: '240px' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Item Description</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ textAlign: 'right' }}>GST %</th>
                      <th style={{ textAlign: 'right' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.items?.map((item, idx) => {
                      const lineTotal = (item.quantity * item.rate * (1 + (item.taxPercent || 0) / 100)).toFixed(2);
                      return (
                        <tr key={item.id || idx}>
                          <td style={{ fontWeight: 500 }}>{item.name}</td>
                          <td className="text-muted">{item.hsn || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                          <td className="text-muted">{item.unit || 'Nos'}</td>
                          <td style={{ textAlign: 'right' }}>₹{Number(item.rate || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>{item.taxPercent}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{lineTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Application Options */}
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={replaceItems}
                    onChange={e => setReplaceItems(e.target.checked)}
                    style={{ accentColor: 'var(--primary, #4f46e5)' }}
                  />
                  <span>
                    Replace current invoice items {currentItemsCount > 0 ? `(${currentItemsCount} existing item${currentItemsCount === 1 ? '' : 's'} will be replaced)` : ''}
                  </span>
                </label>

                {extractedData.client?.name && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={applyClient}
                      onChange={e => setApplyClient(e.target.checked)}
                      style={{ accentColor: 'var(--primary, #4f46e5)' }}
                    />
                    <span>Auto-fill client details ({extractedData.client.name})</span>
                  </label>
                )}

                {(extractedData.details?.invoiceNumber || extractedData.details?.invoiceDate) && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={applyDetails}
                      onChange={e => setApplyDetails(e.target.checked)}
                      style={{ accentColor: 'var(--primary, #4f46e5)' }}
                    />
                    <span>Auto-fill invoice date / number if available</span>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          marginTop: '1.25rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          alignItems: 'center',
        }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>

          {!extractedData ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={loading || (activeTab === 'upload' && !file) || (activeTab === 'text' && !textContent.trim())}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                borderColor: '#6366f1',
                minWidth: '170px',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" /> Extracting with AI...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Extract with Gemini AI
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplyClick}
              style={{
                background: '#10b981',
                borderColor: '#059669',
              }}
            >
              <CheckCircle2 size={16} /> Apply to Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
