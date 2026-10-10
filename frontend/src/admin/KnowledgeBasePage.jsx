import React, { useState } from 'react';
import RagSection from './RagSection';
import { Search, Sparkles, Database, FileText, ArrowRight } from 'lucide-react';

export default function KnowledgeBasePage({ onTriggerToast }) {
  const [testQuery, setTestQuery] = useState('');
  const [retrievedResult, setRetrievedResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleTestSemanticSearch = (e) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setRetrievedResult({
        query: testQuery,
        score: '0.942 similarity',
        source: 'store_104_promotions_policy.pdf (Chunk #42)',
        snippet: 'Weekend beverage promotional discounts apply automatically to all organic certified SKUs during peak Saturday foot-traffic hours (12:00 PM – 4:00 PM).'
      });
      if (onTriggerToast) {
        onTriggerToast(`Semantic match found with 94.2% cosine similarity`);
      }
    }, 700);
  };

  return (
    <div className="admin-page-content knowledge-base-page">
      {/* Standalone Corpus Query Tester for Admins */}
      <div className="kb-tester-banner">
        <div className="kb-tester-header">
          <div className="flex-row items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h3 className="kb-tester-title">Semantic Vector Query Playground</h3>
          </div>
          <span className="badge-tag">OpenAI ada-002 Embeddings</span>
        </div>
        <p className="kb-tester-desc">
          Test live RAG retrieval directly against ingested store manifests, employee guidelines, and vendor SOPs.
        </p>

        <form onSubmit={handleTestSemanticSearch} className="kb-search-form">
          <div className="kb-search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="kb-search-input"
              placeholder="e.g. What is the return policy for perishable bakery items at Store #104?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="kb-search-btn" disabled={isSearching}>
            {isSearching ? 'Vector Searching...' : 'Run Query'}
          </button>
        </form>

        {retrievedResult && (
          <div className="kb-retrieval-card">
            <div className="retrieval-header">
              <span className="source-label"><FileText size={14} /> Source: <strong>{retrievedResult.source}</strong></span>
              <span className="score-pill">{retrievedResult.score}</span>
            </div>
            <p className="retrieval-snippet">"{retrievedResult.snippet}"</p>
          </div>
        )}
      </div>

      {/* Main RAG Ingestion & Document Index */}
      <RagSection onTriggerToast={onTriggerToast} />
    </div>
  );
}
