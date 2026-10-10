import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  ChevronDown, 
  MoreVertical, 
  Check, 
  AlertTriangle, 
  X, 
  Plus, 
  Minus,
  PackageCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function InventorySection({ onTriggerToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionModal, setActionModal] = useState(null); // { item, type }

  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'Aerofit Wireless Smart Earbuds',
      sku: 'SKU-88421',
      storeId: 'STR-104',
      location: 'Austin Flagship',
      category: 'Electronics',
      units: 412,
      maxLimit: 500,
      fillPct: 82,
      price: 79.99,
      status: 'in-stock',
      statusText: 'In Stock',
      actionType: 'restock',
      actionLabel: 'Restock'
    },
    {
      id: 2,
      name: 'Organic Fair-Trade Cold Brew (12pk)',
      sku: 'SKU-44109',
      storeId: 'STR-104',
      location: 'Austin Flagship',
      category: 'Grocery',
      units: 14,
      limitText: 'Limit: 30',
      fillPct: 46,
      price: 34.50,
      status: 'low-stock',
      statusText: 'Low Stock',
      actionType: 'reorder',
      actionLabel: 'Reorder'
    },
    {
      id: 3,
      name: 'Nordic Tactical Mesh Office Chair',
      sku: 'SKU-92104',
      storeId: 'STR-208',
      location: 'Seattle Metro',
      category: 'Furniture',
      units: 0,
      limitText: 'Depleted',
      fillPct: 0,
      price: 249.00,
      status: 'out-of-stock',
      statusText: 'Out of Stock',
      actionType: 'rush-po',
      actionLabel: 'Rush PO'
    },
    {
      id: 4,
      name: 'UltraGlow 4K Smart Monitor 27"',
      sku: 'SKU-33882',
      storeId: 'Global Hub',
      location: 'Central Distribution',
      category: 'Electronics',
      units: 88,
      fillPct: 45,
      price: 389.99,
      status: 'in-stock',
      statusText: 'In Stock',
      actionType: 'restock',
      actionLabel: 'Restock'
    },
    {
      id: 5,
      name: 'Artisan Sourdough Bakery Loaf',
      sku: 'SKU-12848',
      storeId: 'STR-104',
      location: 'Austin Flagship',
      category: 'Fresh Bakery',
      units: 6,
      limitText: 'Limit: 15',
      fillPct: 40,
      price: 6.50,
      status: 'low-stock',
      statusText: 'Low Stock',
      actionType: 'reorder',
      actionLabel: 'Reorder'
    },
    {
      id: 6,
      name: 'EcoClean Plant-Based Detergent (2L)',
      sku: 'SKU-67851',
      storeId: 'STR-315',
      location: 'Denver Metro',
      category: 'Household',
      units: 215,
      fillPct: 70,
      price: 18.99,
      status: 'in-stock',
      statusText: 'In Stock',
      actionType: 'restock',
      actionLabel: 'Restock'
    }
  ]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStore =
        storeFilter === 'All' ||
        item.storeId.includes(storeFilter) ||
        item.location.includes(storeFilter);

      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'in-stock' && item.status === 'in-stock') ||
        (statusFilter === 'low-stock' && item.status === 'low-stock') ||
        (statusFilter === 'out-of-stock' && item.status === 'out-of-stock');

      const matchCategory =
        categoryFilter === 'All' || item.category === categoryFilter;

      return matchSearch && matchStore && matchStatus && matchCategory;
    });
  }, [products, searchTerm, storeFilter, statusFilter, categoryFilter]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = 'SKU,Product Name,Store ID,Location,Category,Stock Units,Price,Status\n';
    const rows = filteredProducts.map(p => 
      `"${p.sku}","${p.name}","${p.storeId}","${p.location}","${p.category}",${p.units},${p.price},"${p.statusText}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NovaMart_Live_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onTriggerToast) {
      onTriggerToast(`Exported ${filteredProducts.length} SKU records to CSV`);
    }
  };

  // Submit Quick Action Modal
  const handleConfirmAction = (quantity) => {
    if (!actionModal) return;
    const { item, type } = actionModal;

    setProducts(prev => prev.map(p => {
      if (p.id === item.id) {
        const newUnits = p.units + Number(quantity);
        return {
          ...p,
          units: newUnits,
          status: 'in-stock',
          statusText: 'In Stock',
          fillPct: Math.min(100, Math.max(30, (newUnits / 300) * 100))
        };
      }
      return p;
    }));

    if (onTriggerToast) {
      onTriggerToast(`Order confirmed: ${quantity} units for ${item.name} (${type.toUpperCase()})`);
    }
    setActionModal(null);
  };

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
            Real-time SKU catalog, stock levels, and store allocation status
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
            placeholder="Search product name, SKU, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Dropdowns */}
        <div className="inventory-dropdowns">
          <select 
            className="filter-select"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
          >
            <option value="All">All Stores</option>
            <option value="STR-104">Store #104 (Austin)</option>
            <option value="STR-208">Store #208 (Seattle)</option>
            <option value="STR-315">Store #315 (Denver)</option>
            <option value="Global Hub">Global Hub</option>
          </select>

          <select 
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">Stock Status: All</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>

          <select 
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">Category: All</option>
            <option value="Electronics">Electronics</option>
            <option value="Grocery">Grocery</option>
            <option value="Furniture">Furniture</option>
            <option value="Fresh Bakery">Fresh Bakery</option>
            <option value="Household">Household</option>
          </select>

          {/* Export CSV Button */}
          <button 
            type="button" 
            className="export-csv-btn"
            onClick={handleExportCSV}
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
                <th>PRODUCT NAME & SKU</th>
                <th>STORE ID & LOCATION</th>
                <th>CATEGORY</th>
                <th>STOCK LEVEL</th>
                <th>UNIT PRICE</th>
                <th>STATUS</th>
                <th>QUICK ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                return (
                  <tr key={p.id}>
                    {/* Product Name & SKU */}
                    <td>
                      <div className="product-identity-wrap">
                        <span className="product-name-title">{p.name}</span>
                        <span className="product-sku-code">{p.sku}</span>
                      </div>
                    </td>

                    {/* Store ID & Location */}
                    <td>
                      <div className="store-location-wrap">
                        <span className="store-code-bold">{p.storeId}</span>
                        <span className="store-city-sub">{p.location}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-tag-pill">
                        {p.category}
                      </span>
                    </td>

                    {/* Stock Level Bar */}
                    <td>
                      <div className="stock-level-cell">
                        <div className="stock-numbers-row">
                          <span className={`stock-units-val ${p.units === 0 ? 'text-danger' : p.status === 'low-stock' ? 'text-warning' : ''}`}>
                            {p.units} units
                          </span>
                          <span className="stock-limit-note">
                            {p.limitText || `${p.fillPct}%`}
                          </span>
                        </div>
                        <div className="stock-track-bar">
                          <div
                            className={`stock-fill-bar ${
                              p.status === 'out-of-stock'
                                ? 'fill-red'
                                : p.status === 'low-stock'
                                ? 'fill-amber'
                                : 'fill-green'
                            }`}
                            style={{ width: `${Math.max(p.fillPct, p.units > 0 ? 8 : 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td>
                      <span className="unit-price-val">${p.price.toFixed(2)}</span>
                    </td>

                    {/* Status Pill */}
                    <td>
                      {p.status === 'in-stock' && (
                        <span className="status-badge badge-active">
                          <span className="status-dot-green"></span>
                          In Stock
                        </span>
                      )}
                      {p.status === 'low-stock' && (
                        <span className="status-badge badge-low-stock">
                          <span className="status-dot-amber"></span>
                          Low Stock
                        </span>
                      )}
                      {p.status === 'out-of-stock' && (
                        <span className="status-badge badge-depleted">
                          <span className="status-dot-red"></span>
                          Out of Stock
                        </span>
                      )}
                    </td>

                    {/* Quick Action */}
                    <td>
                      <div className="quick-action-cell">
                        {p.actionType === 'restock' && (
                          <button
                            type="button"
                            className="action-btn btn-restock"
                            onClick={() => setActionModal({ item: p, type: 'Restock', defaultQty: 50 })}
                          >
                            Restock
                          </button>
                        )}
                        {p.actionType === 'reorder' && (
                          <button
                            type="button"
                            className="action-btn btn-reorder"
                            onClick={() => setActionModal({ item: p, type: 'Reorder', defaultQty: 30 })}
                          >
                            Reorder
                          </button>
                        )}
                        {p.actionType === 'rush-po' && (
                          <button
                            type="button"
                            className="action-btn btn-rush-po"
                            onClick={() => setActionModal({ item: p, type: 'Rush PO', defaultQty: 25 })}
                          >
                            Rush PO
                          </button>
                        )}
                        <button 
                          type="button" 
                          className="action-dots-btn"
                          title="More options"
                          onClick={() => {
                            if (onTriggerToast) onTriggerToast(`Detailed audit log opened for ${p.sku}`);
                          }}
                        >
                          <MoreVertical size={15} />
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
            Showing <strong>1 to {filteredProducts.length}</strong> of <strong>1,428</strong> products
          </span>

          <div className="pagination-pills-wrap">
            <button 
              type="button" 
              className="page-nav-btn"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <button 
              type="button" 
              className={`page-num-btn ${currentPage === 1 ? 'active' : ''}`}
              onClick={() => setCurrentPage(1)}
            >
              1
            </button>
            <button 
              type="button" 
              className={`page-num-btn ${currentPage === 2 ? 'active' : ''}`}
              onClick={() => setCurrentPage(2)}
            >
              2
            </button>
            <button 
              type="button" 
              className={`page-num-btn ${currentPage === 3 ? 'active' : ''}`}
              onClick={() => setCurrentPage(3)}
            >
              3
            </button>
            <span className="pagination-ellipsis">...</span>
            <button 
              type="button" 
              className="page-num-btn"
              onClick={() => setCurrentPage(238)}
            >
              238
            </button>
            <button 
              type="button" 
              className="page-nav-btn"
              onClick={() => setCurrentPage(currentPage + 1)}
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
                <p className="modal-subtitle">{actionModal.item.name} ({actionModal.item.sku})</p>
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
                const form = e.target;
                const qty = form.quantity.value;
                handleConfirmAction(qty);
              }}
              className="modal-body-form"
            >
              <div className="modal-meta-grid">
                <div className="meta-box">
                  <span className="meta-label">Current Stock</span>
                  <span className="meta-value">{actionModal.item.units} units</span>
                </div>
                <div className="meta-box">
                  <span className="meta-label">Retail Location</span>
                  <span className="meta-value">{actionModal.item.location}</span>
                </div>
                <div className="meta-box">
                  <span className="meta-label">Unit Cost</span>
                  <span className="meta-value">${actionModal.item.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="form-group-field">
                <label className="field-label">Quantity to Dispatch / Order</label>
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

              <div className="form-group-field">
                <label className="field-label">Logistics Priority</label>
                <select className="modal-select-input" defaultValue="expedited">
                  <option value="standard">Standard Carrier (3-5 days)</option>
                  <option value="expedited">AI Expedited Smart-Routing (Next Day)</option>
                  <option value="emergency">Emergency Fleet Drone / Same-Day</option>
                </select>
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
                >
                  Confirm & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
