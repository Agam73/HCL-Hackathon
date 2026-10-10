import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Download,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatPrice } from '../lib/format';

const PAGE_SIZE = 10;

const STATUS_VIEW = {
  IN_STOCK: { text: 'In Stock', badge: 'badge-active', dot: 'status-dot-green', fill: 'fill-green', action: 'Restock', btn: 'btn-restock', qty: 50 },
  LOW_STOCK: { text: 'Low Stock', badge: 'badge-low-stock', dot: 'status-dot-amber', fill: 'fill-amber', action: 'Reorder', btn: 'btn-reorder', qty: 30 },
  OUT_OF_STOCK: { text: 'Out of Stock', badge: 'badge-depleted', dot: 'status-dot-red', fill: 'fill-red', action: 'Rush PO', btn: 'btn-rush-po', qty: 25 },
};

/**
 * Live inventory for one store, straight from the database.
 *
 *   client        the API client to call with (admin portal or signed-in manager)
 *   stores        [{ id, name, address: { city } }] for the store dropdown
 *   storeId       the store being shown
 *   onStoreChange called with a store id; omit to lock the view to `storeId`
 */
export default function InventorySection({ client, stores = [], storeId, onStoreChange, onTriggerToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [actionModal, setActionModal] = useState(null); // { item, type, defaultQty }
  const [saving, setSaving] = useState(false);

  const store = stores.find((s) => s.id === storeId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Any change of filter or store starts again from the first page.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter, storeId]);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/categories')
      .then((list) => !cancelled && setCategories(list.filter((c) => c.parentId)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!storeId) return undefined;
    const controller = new AbortController();
    setLoadState('loading');
    client
      .getPage(
        `/stores/${storeId}/inventory`,
        {
          q: debouncedSearch,
          status: statusFilter,
          categoryId: categoryFilter,
          page: currentPage,
          size: PAGE_SIZE,
        },
        { signal: controller.signal }
      )
      .then((page) => {
        setRows(page.items);
        setMeta(page.meta);
        setLoadState('ready');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setLoadError(err.message);
        setLoadState('error');
      });
    return () => controller.abort();
  }, [client, storeId, debouncedSearch, statusFilter, categoryFilter, currentPage, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Export CSV handler (the rows currently shown)
  const handleExportCSV = () => {
    const headers = 'Product ID,Product Name,Store ID,Category,Stock Units,Reorder Level,Price (INR),Status\n';
    const body = rows.map(r =>
      `"${r.product.id}","${r.product.name.replaceAll('"', '""')}","${r.storeId}","${r.product.categoryName}",${r.quantityAvailable},${r.reorderLevel},${r.product.price},"${STATUS_VIEW[r.availability].text}"`
    ).join('\n');

    const blob = new Blob([headers + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Inventory_${storeId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onTriggerToast) {
      onTriggerToast(`Exported ${rows.length} records to CSV`);
    }
  };

  // Submit Quick Action Modal - adds stock in the database
  const handleConfirmAction = async (quantity) => {
    if (!actionModal) return;
    const { item, type } = actionModal;
    setSaving(true);
    try {
      const result = await client.patch(`/stores/${item.storeId}/inventory/${item.product.id}`, {
        delta: Number(quantity),
        reason: `${type} of ${quantity} units from the inventory screen`,
      });
      if (onTriggerToast) {
        onTriggerToast(`${type} confirmed: ${item.product.name} now has ${result.quantityAvailable} units`);
      }
      setActionModal(null);
      reload();
    } catch (err) {
      if (onTriggerToast) onTriggerToast(`Could not update stock: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = meta?.totalPages ?? 1;
  const firstRow = meta && meta.totalItems > 0 ? (meta.page - 1) * meta.size + 1 : 0;
  const lastRow = meta ? firstRow + rows.length - (rows.length ? 1 : 0) : 0;

  return (
    <section id="inventory" className="section-block inventory-section">
      {/* Section Header */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <div className="flex-row items-center gap-2">
            <span className="section-blue-bullet"></span>
            <h2 className="section-title">Live Inventory Overview</h2>
          </div>
          <p className="section-subtitle">
            Real-time stock levels for {store ? `${store.name} (${store.address.city})` : 'the selected store'}
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="inventory-toolbar">
        {/* Search */}
        <div className="inventory-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="inventory-search-input"
            placeholder="Search product name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Dropdowns */}
        <div className="inventory-dropdowns">
          {onStoreChange && (
            <select
              className="filter-select"
              value={storeId ?? ''}
              onChange={(e) => onStoreChange(e.target.value)}
              aria-label="Store"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isActive ? '' : ' (closed)'}
                </option>
              ))}
            </select>
          )}

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Stock status"
          >
            <option value="">Stock Status: All</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Category"
          >
            <option value="">Category: All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            className="export-csv-btn"
            onClick={handleExportCSV}
            disabled={rows.length === 0}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Inventory Table Card */}
      <div className="inventory-table-card">
        <div className="table-responsive-wrapper">
          <table className="inventory-data-table">
            <thead>
              <tr>
                <th>PRODUCT NAME & ID</th>
                <th>STORE</th>
                <th>CATEGORY</th>
                <th>STOCK LEVEL</th>
                <th>UNIT PRICE</th>
                <th>STATUS</th>
                <th>QUICK ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loadState === 'error' && (
                <tr><td colSpan={7} className="table-state-cell text-danger">Could not load inventory: {loadError}</td></tr>
              )}
              {loadState === 'loading' && rows.length === 0 && (
                <tr><td colSpan={7} className="table-state-cell">Loading inventory…</td></tr>
              )}
              {loadState === 'ready' && rows.length === 0 && (
                <tr><td colSpan={7} className="table-state-cell">No products match these filters.</td></tr>
              )}
              {loadState !== 'error' && rows.map((r) => {
                const view = STATUS_VIEW[r.availability];
                // Bar is full at four times the reorder level.
                const fillPct = Math.min(100, Math.round((r.quantityAvailable / Math.max(1, r.reorderLevel * 4)) * 100));
                return (
                  <tr key={r.product.id}>
                    {/* Product Name & ID */}
                    <td>
                      <div className="product-identity-wrap">
                        <span className="product-name-title">{r.product.name}</span>
                        <span className="product-sku-code">{r.product.id} · {r.product.brandName}</span>
                      </div>
                    </td>

                    {/* Store */}
                    <td>
                      <div className="store-location-wrap">
                        <span className="store-code-bold">{r.storeId}</span>
                        <span className="store-city-sub">{store?.address.city}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-tag-pill">
                        {r.product.categoryName}
                      </span>
                    </td>

                    {/* Stock Level Bar */}
                    <td>
                      <div className="stock-level-cell">
                        <div className="stock-numbers-row">
                          <span className={`stock-units-val ${r.availability === 'OUT_OF_STOCK' ? 'text-danger' : r.availability === 'LOW_STOCK' ? 'text-warning' : ''}`}>
                            {r.quantityAvailable} units
                          </span>
                          <span className="stock-limit-note">
                            Reorder at {r.reorderLevel}
                          </span>
                        </div>
                        <div className="stock-track-bar">
                          <div
                            className={`stock-fill-bar ${view.fill}`}
                            style={{ width: `${Math.max(fillPct, r.quantityAvailable > 0 ? 8 : 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td>
                      <span className="unit-price-val">{formatPrice(r.product.price)}</span>
                    </td>

                    {/* Status Pill */}
                    <td>
                      <span className={`status-badge ${view.badge}`}>
                        <span className={view.dot}></span>
                        {view.text}
                      </span>
                    </td>

                    {/* Quick Action */}
                    <td>
                      <div className="quick-action-cell">
                        <button
                          type="button"
                          className={`action-btn ${view.btn}`}
                          onClick={() => setActionModal({ item: r, type: view.action, defaultQty: view.qty })}
                        >
                          {view.action}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination & Count */}
        <div className="inventory-pagination-row">
          <span className="pagination-count-label">
            Showing <strong>{firstRow} to {lastRow}</strong> of <strong>{(meta?.totalItems ?? 0).toLocaleString('en-IN')}</strong> products
          </span>

          <div className="pagination-pills-wrap">
            <button
              type="button"
              className="page-nav-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="page-num-btn active">{currentPage}</span>
            <span className="pagination-ellipsis">of {totalPages}</span>
            <button
              type="button"
              className="page-nav-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Modal Dialog */}
      {actionModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog-card">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{actionModal.type} Item</h3>
                <p className="modal-subtitle">{actionModal.item.product.name} ({actionModal.item.product.id})</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActionModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAction(e.target.quantity.value);
              }}
              className="modal-body-form"
            >
              <div className="modal-meta-grid">
                <div className="meta-box">
                  <span className="meta-label">Current Stock</span>
                  <span className="meta-value">{actionModal.item.quantityAvailable} units</span>
                </div>
                <div className="meta-box">
                  <span className="meta-label">Retail Location</span>
                  <span className="meta-value">{store?.name ?? actionModal.item.storeId}</span>
                </div>
                <div className="meta-box">
                  <span className="meta-label">Unit Price</span>
                  <span className="meta-value">{formatPrice(actionModal.item.product.price)}</span>
                </div>
              </div>

              <div className="form-group-field">
                <label className="field-label">Quantity to add to stock</label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={actionModal.defaultQty || 25}
                  min="1"
                  max="1000"
                  className="modal-number-input"
                  required
                />
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setActionModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn-confirm"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Confirm & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
