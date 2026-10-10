import React, { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { adminApi } from '../api/client';

const EMPTY_FORM = {
  id: '', name: '', type: 'STORE', addressLine: '', city: '', state: '', postalCode: '',
  latitude: '', longitude: '', phone: '', opensAt: '', closesAt: '', isActive: true,
};

const blankToNull = (value) => (value === '' ? null : value);
const numberOrNull = (value) => (value === '' ? null : Number(value));

function StoreModal({ store, onClose, onSaved }) {
  const isNew = !store;
  const [form, setForm] = useState(() =>
    isNew
      ? EMPTY_FORM
      : {
          id: store.id,
          name: store.name,
          type: store.type,
          addressLine: store.address.line ?? '',
          city: store.address.city ?? '',
          state: store.address.state ?? '',
          postalCode: store.address.postalCode ?? '',
          latitude: store.location?.latitude ?? '',
          longitude: store.location?.longitude ?? '',
          phone: store.phone ?? '',
          opensAt: store.hours?.opensAt?.slice(0, 5) ?? '',
          closesAt: store.hours?.closesAt?.slice(0, 5) ?? '',
          isActive: store.isActive,
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      name: form.name,
      type: form.type,
      addressLine: blankToNull(form.addressLine),
      city: form.city,
      state: blankToNull(form.state),
      postalCode: blankToNull(form.postalCode),
      latitude: numberOrNull(form.latitude),
      longitude: numberOrNull(form.longitude),
      phone: blankToNull(form.phone),
      opensAt: blankToNull(form.opensAt),
      closesAt: blankToNull(form.closesAt),
      isActive: form.isActive,
    };

    try {
      const saved = isNew
        ? await adminApi.post('/stores', { ...body, id: form.id })
        : await adminApi.patch(`/stores/${store.id}`, body);
      onSaved(saved, isNew);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog-card admin-wide-modal">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{isNew ? 'Add Store' : 'Edit Store'}</h3>
            <p className="modal-subtitle">{isNew ? 'New stores appear in the customer store picker straight away.' : store.id}</p>
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
            {isNew && (
              <div className="form-group-field">
                <label className="field-label">Store ID</label>
                <input className="modal-number-input" value={form.id} onChange={set('id')} placeholder="ST-PUN-01" required />
              </div>
            )}

            <div className={`form-group-field ${isNew ? '' : 'admin-span-2'}`}>
              <label className="field-label">Name</label>
              <input className="modal-number-input" value={form.name} onChange={set('name')} required minLength={2} />
            </div>

            <div className="form-group-field">
              <label className="field-label">Type</label>
              <select className="modal-select-input" value={form.type} onChange={set('type')}>
                <option value="STORE">Store</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>

            <div className="form-group-field">
              <label className="field-label">Phone</label>
              <input className="modal-number-input" value={form.phone} onChange={set('phone')} />
            </div>

            <div className="form-group-field admin-span-2">
              <label className="field-label">Address</label>
              <input className="modal-number-input" value={form.addressLine} onChange={set('addressLine')} />
            </div>

            <div className="form-group-field">
              <label className="field-label">City</label>
              <input className="modal-number-input" value={form.city} onChange={set('city')} required />
            </div>

            <div className="form-group-field">
              <label className="field-label">State</label>
              <input className="modal-number-input" value={form.state} onChange={set('state')} />
            </div>

            <div className="form-group-field">
              <label className="field-label">Postal code</label>
              <input className="modal-number-input" value={form.postalCode} onChange={set('postalCode')} />
            </div>

            <div className="form-group-field admin-pair">
              <div>
                <label className="field-label">Opens</label>
                <input type="time" className="modal-number-input" value={form.opensAt} onChange={set('opensAt')} />
              </div>
              <div>
                <label className="field-label">Closes</label>
                <input type="time" className="modal-number-input" value={form.closesAt} onChange={set('closesAt')} />
              </div>
            </div>

            <div className="form-group-field">
              <label className="field-label">Latitude</label>
              <input type="number" step="any" min="-90" max="90" className="modal-number-input" value={form.latitude} onChange={set('latitude')} />
            </div>

            <div className="form-group-field">
              <label className="field-label">Longitude</label>
              <input type="number" step="any" min="-180" max="180" className="modal-number-input" value={form.longitude} onChange={set('longitude')} />
            </div>

            <label className="admin-check admin-span-2">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
              <span>Open (untick to close the store and remove it from the store picker)</span>
            </label>
          </div>

          <div className="modal-actions-footer">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-btn-confirm" disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Add Store' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** `stores` and `reloadStores` come from AdminLayout, which shares the list with the navbar. */
export default function StoresPage({ stores, reloadStores, onTriggerToast }) {
  const [modal, setModal] = useState(null); // null | { store } | { store: null } for "new"

  const toggleActive = async (store) => {
    try {
      if (store.isActive) await adminApi.delete(`/stores/${store.id}`);
      else await adminApi.patch(`/stores/${store.id}`, { isActive: true });
      onTriggerToast?.(`${store.name} is now ${store.isActive ? 'closed' : 'open'}`);
      reloadStores();
    } catch (err) {
      onTriggerToast?.(`Could not update store: ${err.message}`);
    }
  };

  return (
    <div className="admin-page-content">
      <section className="section-block inventory-section">
        <div className="section-header-row">
          <div className="section-title-wrap">
            <div className="flex-row items-center gap-2">
              <span className="section-blue-bullet"></span>
              <h2 className="section-title">Stores & Warehouses</h2>
            </div>
            <p className="section-subtitle">Open, edit or close locations. Customers only see open stores.</p>
          </div>
          <button type="button" className="export-csv-btn admin-primary-btn" onClick={() => setModal({ store: null })}>
            <Plus size={14} />
            <span>Add Store</span>
          </button>
        </div>

        <div className="inventory-table-card">
          <div className="table-responsive-wrapper">
            <table className="inventory-data-table">
              <thead>
                <tr>
                  <th>STORE NAME & ID</th>
                  <th>TYPE</th>
                  <th>LOCATION</th>
                  <th>HOURS</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 && (
                  <tr><td colSpan={7} className="table-state-cell">Loading stores…</td></tr>
                )}
                {stores.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'admin-row-inactive'}>
                    <td>
                      <div className="product-identity-wrap">
                        <span className="product-name-title">{s.name}</span>
                        <span className="product-sku-code">{s.id}</span>
                      </div>
                    </td>
                    <td><span className="category-tag-pill">{s.type === 'WAREHOUSE' ? 'Warehouse' : 'Store'}</span></td>
                    <td>
                      <div className="store-location-wrap">
                        <span className="store-code-bold">{s.address.city}</span>
                        <span className="store-city-sub">{s.address.line}</span>
                      </div>
                    </td>
                    <td>{s.hours ? `${s.hours.opensAt.slice(0, 5)} – ${s.hours.closesAt.slice(0, 5)}` : '—'}</td>
                    <td>{(s.unitsInStock ?? 0).toLocaleString('en-IN')} units · {s.skuCount ?? 0} products</td>
                    <td>
                      {s.isActive ? (
                        <span className="status-badge badge-active"><span className="status-dot-green"></span>Open</span>
                      ) : (
                        <span className="status-badge badge-depleted"><span className="status-dot-red"></span>Closed</span>
                      )}
                    </td>
                    <td>
                      <div className="quick-action-cell">
                        <button type="button" className="action-btn btn-restock" onClick={() => setModal({ store: s })}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button type="button" className={`action-btn ${s.isActive ? 'btn-rush-po' : 'btn-reorder'}`} onClick={() => toggleActive(s)}>
                          {s.isActive ? 'Close' : 'Reopen'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {modal && (
        <StoreModal
          store={modal.store}
          onClose={() => setModal(null)}
          onSaved={(saved, isNew) => {
            setModal(null);
            onTriggerToast?.(`${saved.name} ${isNew ? 'added' : 'updated'}`);
            reloadStores();
          }}
        />
      )}
    </div>
  );
}
