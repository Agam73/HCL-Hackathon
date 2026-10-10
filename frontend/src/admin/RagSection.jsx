import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Filter, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  Database,
  ArrowRight,
  FileSpreadsheet,
  FileCode,
  File
} from 'lucide-react';

export default function RagSection({ onTriggerToast }) {
  const [documents, setDocuments] = useState([
    {
      id: 1,
      name: 'store_104_promotions_policy.pdf',
      type: 'PDF',
      storeId: 'STR-104',
      chunks: '1,420',
      status: 'active',
      date: 'Today, 10:42 AM'
    },
    {
      id: 2,
      name: 'inventory_manifest_q3_allstores.csv',
      type: 'CSV',
      storeId: 'Global',
      chunks: '8,950',
      status: 'active',
      date: 'Yesterday'
    },
    {
      id: 3,
      name: 'pos_cashier_guidelines_v2.md',
      type: 'MD',
      storeId: 'STR-208',
      chunks: 'Embedding...',
      status: 'processing',
      date: '15 mins ago'
    },
    {
      id: 4,
      name: 'vendor_pricing_sheet_cornucopia.txt',
      type: 'TXT',
      storeId: 'STR-042',
      chunks: 'Syntax Error',
      status: 'failed',
      date: 'Oct 12, 2024'
    }
  ]);

  const [targetLocation, setTargetLocation] = useState('Store #104 (Austin Flagship)');
  const [docIdentifier, setDocIdentifier] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!docIdentifier) {
        setDocIdentifier(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!docIdentifier) {
        setDocIdentifier(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUploadIngest = () => {
    const fileName = selectedFile ? selectedFile.name : (docIdentifier ? `${docIdentifier}.pdf` : 'sop_omnichannel_retail_v3.pdf');
    const ext = fileName.split('.').pop().toUpperCase();

    setIsUploading(true);
    setUploadProgress(20);

    const timer1 = setTimeout(() => setUploadProgress(65), 500);
    const timer2 = setTimeout(() => {
      setUploadProgress(100);
      setIsUploading(false);
      setSelectedFile(null);
      setDocIdentifier('');

      const newDoc = {
        id: Date.now(),
        name: fileName,
        type: ext.length <= 4 ? ext : 'PDF',
        storeId: targetLocation.includes('104') ? 'STR-104' : targetLocation.includes('208') ? 'STR-208' : 'Global',
        chunks: '2,140',
        status: 'active',
        date: 'Just now'
      };

      setDocuments(prev => [newDoc, ...prev]);

      if (onTriggerToast) {
        onTriggerToast(`Document "${fileName}" ingested successfully. 2,140 vector chunks indexed.`);
      }
    }, 1200);
  };

  const retryDoc = (id) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === id) {
        return { ...doc, chunks: 'Embedding...', status: 'processing' };
      }
      return doc;
    }));

    setTimeout(() => {
      setDocuments(prev => prev.map(doc => {
        if (doc.id === id) {
          return { ...doc, chunks: '3,840', status: 'active' };
        }
        return doc;
      }));
      if (onTriggerToast) {
        onTriggerToast('Document re-indexed successfully.');
      }
    }, 1500);
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'PDF':
        return <FileText size={16} className="doc-icon-pdf" />;
      case 'CSV':
        return <FileSpreadsheet size={16} className="doc-icon-csv" />;
      case 'MD':
        return <FileCode size={16} className="doc-icon-md" />;
      default:
        return <File size={16} className="doc-icon-txt" />;
    }
  };

  return (
    <section id="knowledge-base" className="section-block rag-section">
      {/* Section Header */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <div className="flex-row items-center gap-2">
            <span className="section-blue-bullet"></span>
            <h2 className="section-title">RAG Knowledge Base & Document Index</h2>
          </div>
          <p className="section-subtitle">
            Ingest store manuals, inventory manifests, vendor contracts, and SOPs for the retail copilot
          </p>
        </div>
      </div>

      <div className="rag-columns-grid">
        {/* Left Column: Upload New Retail Corpus */}
        <div className="rag-upload-card">
          <div className="rag-card-header">
            <h3 className="rag-card-title">Upload New Retail Corpus</h3>
            <p className="rag-card-subtitle">
              Files are chunked, vectorized, and made instantly searchable for staff agents.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div 
            className={`dropzone-box ${selectedFile ? 'has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileSelect}
              accept=".pdf,.csv,.txt,.md"
            />
            <div className="dropzone-cloud-icon">
              <UploadCloud size={24} />
            </div>
            <div className="dropzone-primary-text">
              {selectedFile ? (
                <strong>Selected: {selectedFile.name}</strong>
              ) : (
                <>Drag & drop files here or <span className="browse-link">browse</span></>
              )}
            </div>
            <div className="dropzone-secondary-text">
              Supports PDF, CSV, TXT, Markdown (up to 50MB)
            </div>
            <div className="dropzone-embedding-badge">
              Semantic Embedding Model: <code>text-embedding-ada-002</code>
            </div>
          </div>

          {/* Form Fields */}
          <div className="rag-form-group">
            <label className="rag-form-label">Target Retail Location</label>
            <select 
              className="rag-select-input"
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
            >
              <option value="Store #104 (Austin Flagship)">Store #104 (Austin Flagship)</option>
              <option value="Store #208 (Seattle Metro)">Store #208 (Seattle Metro)</option>
              <option value="Store #315 (Denver Metro)">Store #315 (Denver Metro)</option>
              <option value="Global Hub (All Locations)">Global Hub (All Locations)</option>
            </select>
          </div>

          <div className="rag-form-group">
            <label className="rag-form-label">Document Identifier / Reference</label>
            <input
              type="text"
              className="rag-text-input"
              placeholder="e.g. Q3_Omnichannel_Fulfillment_SOP"
              value={docIdentifier}
              onChange={(e) => setDocIdentifier(e.target.value)}
            />
          </div>

          {/* Progress Bar when uploading */}
          {isUploading && (
            <div className="upload-progress-wrap">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <span className="progress-text">Generating chunks & embeddings... {uploadProgress}%</span>
            </div>
          )}

          {/* Submit Ingest Button */}
          <button
            type="button"
            className="rag-submit-btn"
            onClick={handleUploadIngest}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                <span>Vectorizing Corpus...</span>
              </>
            ) : (
              <>
                <Database size={16} />
                <span>Upload & Ingest to RAG</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Recent Ingested Documents */}
        <div className="rag-table-card">
          <div className="rag-table-header">
            <div className="flex-row items-center gap-2">
              <h3 className="rag-card-title">Recent Ingested Documents</h3>
              <span className="count-badge">{documents.length} Loaded</span>
            </div>
            <button type="button" className="icon-action-btn" title="Filter Documents">
              <Filter size={15} />
            </button>
          </div>

          {/* Documents Table */}
          <div className="table-responsive-wrapper">
            <table className="rag-doc-table">
              <thead>
                <tr>
                  <th>DOCUMENT NAME</th>
                  <th>TYPE</th>
                  <th>STORE ID</th>
                  <th>CHUNKS</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="doc-name-cell">
                        {getFileIcon(doc.type)}
                        <div className="doc-name-wrap">
                          <span className="doc-filename" title={doc.name}>{doc.name}</span>
                          <span className="doc-date-sub">{doc.date}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="type-badge">{doc.type}</span>
                    </td>
                    <td>
                      <span className="store-cell-code">{doc.storeId}</span>
                    </td>
                    <td>
                      <span className={`chunk-text ${doc.status === 'processing' ? 'italic-text' : doc.status === 'failed' ? 'error-text' : ''}`}>
                        {doc.chunks}
                      </span>
                    </td>
                    <td>
                      {doc.status === 'active' && (
                        <span className="status-badge badge-active">
                          <span className="status-dot-green"></span>
                          Active
                        </span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="status-badge badge-processing">
                          <Loader2 size={12} className="spin-icon" />
                          Processing
                        </span>
                      )}
                      {doc.status === 'failed' && (
                        <div className="flex-row items-center gap-1">
                          <span className="status-badge badge-failed">
                            Failed
                          </span>
                          <button 
                            type="button" 
                            className="retry-icon-btn" 
                            title="Retry Vectorization"
                            onClick={() => retryDoc(doc.id)}
                          >
                            <RotateCw size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="rag-table-footer">
            <span className="footer-refresh-note">Vectors refreshed every 15 minutes</span>
          </div>
        </div>
      </div>
    </section>
  );
}
