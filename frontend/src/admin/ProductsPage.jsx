import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react';
import { adminApi } from '../api/client';
import { formatPrice } from '../lib/format';

const PAGE_SIZE = 10;
const EMPTY_FORM = {
  id: '', name: '', description: '', keywords: '', categoryId: '', brandId: '',
  price: '', mrp: '', warrantyMonths: '', imageUrl: '', specifications: '', isActive: true,
};

/** "ram: 8 GB" lines <-> { ram: '8 GB' } */
const specsToText = (specs = {}) =>
  Object.entries(specs).map(([key, value]) => `${key}: ${value}`).join('\n');
const textToSpecs = (text) =>
  Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.split(/:(.*)/s).map((part) => part?.trim()))
      .filter(([key, value]) => key && value)
  );

function ProductModal({ product, categories, brands, onClose, onSaved }) {
  const isNew = !product;
  const [form, setForm] = useState(() =>
    isNew
      ? EMPTY_FORM
      : {
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          keywords: product.keywords ?? '',
          categoryId: product.category.id,
          brandId: product.brand.id,
          price: product.price,
          mrp: product.mrp ?? '',
          warrantyMonths: product.warrantyMonths ?? '',
          imageUrl: product.images?.[0] ?? '',
          specifications: specsToText(product.specifications),
          isActive: product.isActive,
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The list rows carry no keywords; fetch the full record when editing.
  useEffect(() => {
    if (isNew) return undefined;
    let cancelled = false;
    adminApi
      .get(`/products/${product.id}`)
      .then((full) => !cancelled && setForm((prev) => ({ ...prev, keywords: full.keywords ?? '' })))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isNew, product]);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      name: form.name,
      description: form.description || null,
      keywords: form.keywords || null,
      categoryId: form.categoryId,
      brandId: form.brandId,
      price: Number(form.price),
      mrp: form.mrp === '' ? null : Number(form.mrp),
      warrantyMonths: form.warrantyMonths === '' ? null : Number(form.warrantyMonths),
      specifications: textToSpecs(form.specifications),
      isActive: form.isActive,
    };
    // Keep the other gallery images; only the first one is edited here.
    const otherImages = product?.images?.slice(1) ?? [];
    body.images = form.imageUrl ? [form.imageUrl, ...otherImages] : otherImages;

    try {
      const saved = isNew
        ? await adminApi.post('/products', { ...body, ...(form.id ? { id: form.id } : {}) })
        : await adminApi.patch(`/products/${product.id}`, body);
      onSaved(saved, isNew);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const leafCategories = categories.filter((c) => c.parentId);

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog-card admin-wide-modal">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{isNew ? 'Add Product' : 'Edit Product'}</h3>
            <p className="modal-subtitle">{isNew ? 'It appears on the storefront as soon as it is saved.' : product.id}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="admin-form-error" role="alert">
              {error.message}
              {error.details?.map?.((d) => <div key={d.field}>{d.field}: {d.message}</div>)}
            </div>
          )}

          <div className="admin-form-grid">
            <div className="form-group-field admin-span-2">
              <label className="field-label">Name</label>
              <input className="modal-number-input" value={form.name} onChange={set('name')} required minLength={2} />
            </div>

            {isNew && (
              <div className="form-group-field">
                <label className="field-label">Product ID (optional)</label>
                <input className="modal-number-input" value={form.id} onChange={set('id')} placeholder="Generated if left blank" />
              </div>
            )}

            <div className="form-group-field">
              <label className="field-label">Category</label>
              <select className="modal-select-input" value={form.categoryId} onChange={set('categoryId')} required>
                <option value="">Choose…</option>
                {leafCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group-field">
              <label className="field-label">Brand</label>
              <select className="modal-select-input" value={form.brandId} onChange={set('brandId')} required>
                <option value="">Choose…</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="form-group-field">
              <label className="field-label">Price (₹)</label>
              <input type="number" min="0" step="1" className="modal-number-input" value={form.price} onChange={set('price')} required />
            </div>

            <div className="form-group-field">
              <label className="field-label">MRP (₹, optional)</label>
              <input type="number" min="0" step="1" className="modal-number-input" value={form.mrp} onChange={set('mrp')} />
            </div>

            <div className="form-group-field">
              <label className="field-label">Warranty (months)</label>
              <input type="number" min="0" className="modal-number-input" value={form.warrantyMonths} onChange={set('warrantyMonths')} />
            </div>

            <div className="form-group-field admin-span-2">
              <label className="field-label">Image URL</label>
              <input type="url" className="modal-number-input" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://…" />
            </div>

            <div className="form-group-field admin-span-2">
              <label className="field-label">Description</label>
              <textarea className="modal-number-input admin-textarea" rows={2} value={form.description} onChange={set('description')} />
            </div>

            <div className="form-group-field">
              <label className="field-label">Search keywords (comma separated)</label>
              <textarea className="modal-number-input admin-textarea" rows={3} value={form.keywords} onChange={set('keywords')} />
            </div>

            <div className="form-group-field">
              <label className="field-label">Specifications (one "name: value" per line)</label>
              <textarea className="modal-number-input admin-textarea" rows={3} value={form.specifications} onChange={set('specifications')} placeholder={'ram: 8 GB\nstorage: 256 GB'} />
            </div>

            <label className="admin-check admin-span-2">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
              <span>On sale (untick to hide it from the storefront)</span>
            </label>
          </div>

          <div className="modal-actions-footer">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-btn-confirm" disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Add Product' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProductsPage({ onTriggerToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [modal, setModal] = useState(null); // null | { product } | { product: null } for "new"

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => setPage(1), [query, categoryFilter]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([adminApi.get('/categories'), adminApi.get('/brands')])
      .then(([c, b]) => {
        if (cancelled) return;
        setCategories(c);
        setBrands(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    adminApi
      .getPage(
        '/products',
        { q: query, categoryId: categoryFilter, includeInactive: true, sort: query ? undefined : 'name_asc', page, size: PAGE_SIZE },
        { signal: controller.signal }
      )
      .then((result) => {
        setRows(result.items);
        setMeta(result.meta);
        setLoadState('ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setLoadError(err.message);
        setLoadState('error');
      });
    return () => controller.abort();
  }, [query, categoryFilter, page, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const toggleActive = async (product) => {
    try {
      if (product.isActive) await adminApi.delete(`/products/${product.id}`);
      else await adminApi.patch(`/products/${product.id}`, { isActive: true });
      onTriggerToast?.(`${product.name} is ${product.isActive ? 'now hidden from' : 'back on'} the storefront`);
      reload();
    } catch (err) {
      onTriggerToast?.(`Could not update product: ${err.message}`);
    }
  };

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="admin-page-content">
      <section className="section-block inventory-section">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <div className="flex-row items-center gap-2">
              <span className="section-blue-bullet"></span>
              <h2 className="section-title">Products</h2>
            </div>
            <p className="section-subtitle">Add, edit or retire catalogue products. Changes reach the storefront immediately.</p>
          </div>
          <button type="button" className="export-csv-btn admin-primary-btn" onClick={() => setModal({ product: null })}>
            <Plus size={14} />
            <span>Add Product</span>
          </button>
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="inventory-search-input"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="inventory-dropdowns">
            <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category">
              <option value="">Category: All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.parentId ? `— ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="inventory-table-card">
          <div className="table-responsive-wrapper">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>PRODUCT NAME & ID</th>
                  <th>BRAND</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>TOTAL STOCK</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loadState === 'error' && (
                  <tr><td colSpan={7} className="table-state-cell text-danger">Could not load products: {loadError}</td></tr>
                )}
                {loadState === 'loading' && rows.length === 0 && (
                  <tr><td colSpan={7} className="table-state-cell">Loading products…</td></tr>
                )}
                {loadState === 'ready' && rows.length === 0 && (
                  <tr><td colSpan={7} className="table-state-cell">No products match.</td></tr>
                )}
                {loadState !== 'error' && rows.map((p) => (
                  <tr key={p.id} className={p.isActive ? '' : 'admin-row-inactive'}>
                    <td>
                      <div className="product-identity-wrap">
                        <span className="product-name-title">{p.name}</span>
                        <span className="product-sku-code">{p.id}</span>
                      </div>
                    </td>
                    <td>{p.brand.name}</td>
                    <td><span className="category-tag-pill">{p.category.name}</span></td>
                    <td>
                      <span className="unit-price-val">{formatPrice(p.price)}</span>
                      {p.mrp > p.price && <div className="store-city-sub">MRP {formatPrice(p.mrp)}</div>}
                    </td>
                    <td>{p.stock.totalAvailable.toLocaleString('en-IN')} units · {p.stock.storesWithStock} stores</td>
                    <td>
                      {p.isActive ? (
                        <span className="status-badge badge-active"><span className="status-dot-green"></span>On sale</span>
                      ) : (
                        <span className="status-badge badge-depleted"><span className="status-dot-red"></span>Retired</span>
                      )}
                    </td>
                    <td>
                      <div className="quick-action-cell">
                        <button type="button" className="action-btn btn-restock" onClick={() => setModal({ product: p })}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button type="button" className={`action-btn ${p.isActive ? 'btn-rush-po' : 'btn-reorder'}`} onClick={() => toggleActive(p)}>
                          {p.isActive ? 'Retire' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="inventory-pagination-row">
            <span className="pagination-count-label">
              <strong>{(meta?.totalItems ?? 0).toLocaleString('en-IN')}</strong> products
            </span>
            <div className="pagination-pills-wrap">
              <button type="button" className="page-nav-btn" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              <span className="page-num-btn active">{page}</span>
              <span className="pagination-ellipsis">of {totalPages}</span>
              <button type="button" className="page-nav-btn" onClick={() => setPage((n) => Math.min(totalPages, n + 1))} disabled={page >= totalPages} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {modal && (
        <ProductModal
          product={modal.product}
          categories={categories}
          brands={brands}
          onClose={() => setModal(null)}
          onSaved={(saved, isNew) => {
            setModal(null);
            onTriggerToast?.(`${saved.name} ${isNew ? 'added' : 'updated'}`);
            reload();
          }}
        />
      )}
    </div>
  );
}
