import { useState, useMemo } from 'react';
import { X, Search, Package, CheckCircle2, Plus } from 'lucide-react';
import { formatCurrency } from '../utils';

export default function ProductPickerModal({ isOpen, onClose, products = [], currency = 'INR', onAddProducts }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { [productId]: quantity }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.hsn || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  if (!isOpen) return null;

  const toggleProduct = (prod) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[prod.id] !== undefined) {
        delete next[prod.id];
      } else {
        next[prod.id] = 1;
      }
      return next;
    });
  };

  const setQty = (id, qty) => {
    const n = Number(qty);
    setSelected(prev => ({
      ...prev,
      [id]: n > 0 ? n : 1,
    }));
  };

  const selectedCount = Object.keys(selected).length;

  const handleConfirm = () => {
    const itemsToAdd = [];
    for (const [id, qty] of Object.entries(selected)) {
      const prod = products.find(p => p.id === id);
      if (!prod) continue;
      const rate = Number(prod.sellingPrice ?? prod.rate ?? 0);
      itemsToAdd.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: prod.name || '',
        hsn: prod.hsn || '',
        quantity: Number(qty) > 0 ? Number(qty) : 1,
        unit: prod.unit || 'Nos',
        rate,
        discount: 0,
        taxPercent: Number(prod.taxPercent ?? 18),
        cessPercent: 0,
      });
    }
    if (itemsToAdd.length > 0) {
      onAddProducts(itemsToAdd);
    }
    setSelected({});
    setSearch('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '95vw',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Package size={22} style={{ color: 'var(--primary, #4f46e5)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Select Predefined Products
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                Pick one or more saved products/services from your catalog to add to this invoice.
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="search-box" style={{ marginBottom: '0.85rem' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search predefined products by name or HSN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Product List */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>
              {products.length === 0
                ? 'No predefined products yet. Add products in the Products page first!'
                : 'No products match your search.'}
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>Pick</th>
                  <th style={{ textAlign: 'left' }}>Product / Service</th>
                  <th>HSN</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>GST %</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(prod => {
                  const isChecked = selected[prod.id] !== undefined;
                  const price = Number(prod.sellingPrice ?? prod.rate ?? 0);
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => toggleProduct(prod)}
                      style={{
                        cursor: 'pointer',
                        background: isChecked ? 'var(--primary-light, rgba(79, 70, 229, 0.08))' : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProduct(prod)}
                          style={{ width: 16, height: 16, accentColor: 'var(--primary, #4f46e5)', cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{prod.name}</div>
                        {prod.unit && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unit: {prod.unit}</span>}
                      </td>
                      <td className="text-muted">{prod.hsn || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(price, currency)}</td>
                      <td style={{ textAlign: 'right' }}>{prod.taxPercent ?? 0}%</td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {isChecked ? (
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={selected[prod.id]}
                            onChange={e => setQty(prod.id, e.target.value)}
                            className="form-input"
                            style={{ width: 68, padding: '0.25rem 0.4rem', textAlign: 'center', fontSize: '0.82rem' }}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
            {selectedCount} product{selectedCount === 1 ? '' : 's'} selected
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedCount === 0}
              onClick={handleConfirm}
            >
              <Plus size={16} /> Add Selected to Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
