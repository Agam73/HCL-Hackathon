import React, { useState } from 'react';
import { 
  CreditCard, 
  ShoppingCart, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  Zap,
  Info,
  ArrowUpRight
} from 'lucide-react';

export default function AnalyticsSection({ onTriggerRestockToast }) {
  const [timeframe, setTimeframe] = useState('7d');
  const [hoveredDay, setHoveredDay] = useState(null);
  const [executingRestock, setExecutingRestock] = useState(false);

  const timeframes = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'q3', label: 'Q3 2024' }
  ];

  const weeklyData = [
    { day: 'Mon', actual: 88, projected: 82, formattedActual: '$88.2k', formattedProjected: '$82.0k', isPeak: false },
    { day: 'Tue', actual: 118, projected: 104, formattedActual: '$118.5k', formattedProjected: '$104.2k', isPeak: false },
    { day: 'Wed', actual: 106, projected: 115, formattedActual: '$106.1k', formattedProjected: '$115.0k', isPeak: false },
    { day: 'Thu', actual: 142, projected: 138, formattedActual: '$142.3k', formattedProjected: '$138.4k', isPeak: false },
    { day: 'Fri', actual: 168, projected: 162, formattedActual: '$168.9k', formattedProjected: '$162.1k', isPeak: false },
    { day: 'Sat (Peak)', actual: 198.4, projected: 190, formattedActual: '$198.4k', formattedProjected: '$190.0k', isPeak: true },
    { day: 'Sun', actual: 154, projected: 148, formattedActual: '$154.2k', formattedProjected: '$148.5k', isPeak: false }
  ];

  const handleExecuteRestock = () => {
    setExecutingRestock(true);
    setTimeout(() => {
      setExecutingRestock(false);
      if (onTriggerRestockToast) {
        onTriggerRestockToast('Automated Purchase Order RPO-4401 dispatched to Supplier Logistics Hub. Restock scheduled in 18 hrs.');
      }
    }, 900);
  };

  return (
    <section id="dashboard" className="section-block analytics-section">
      {/* Section Header */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <div className="flex-row items-center gap-2">
            <span className="section-blue-bullet"></span>
            <h2 className="section-title">Store Analytics & Intelligence</h2>
          </div>
          <p className="section-subtitle">
            Real-time AI-aggregated metrics across omni-channel retail locations
          </p>
        </div>

        {/* Timeframe Filter Pills */}
        <div className="timeframe-pills">
          {timeframes.map((tf) => (
            <button
              key={tf.id}
              type="button"
              className={`pill-btn ${timeframe === tf.id ? 'active' : ''}`}
              onClick={() => setTimeframe(tf.id)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Metric KPI Cards */}
      <div className="kpi-grid">
        {/* Card 1: Gross Sales */}
        <div className="kpi-card">
          <div className="kpi-top-row">
            <span className="kpi-label">TOTAL GROSS SALES</span>
            <div className="kpi-icon-pill icon-blue">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">$1,284,950</span>
          </div>
          <div className="kpi-trend-row">
            <span className="trend-badge trend-up">
              <TrendingUp size={13} />
              +14.3%
            </span>
            <span className="trend-comparison">vs last month</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footer-metric">Target: <strong>$1.20M</strong></span>
            <span className="kpi-footer-metric text-primary">AI forecast: <strong>+18.5% EOM</strong></span>
          </div>
        </div>

        {/* Card 2: Completed Orders */}
        <div className="kpi-card">
          <div className="kpi-top-row">
            <span className="kpi-label">COMPLETED ORDERS</span>
            <div className="kpi-icon-pill icon-blue">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">48,320</span>
          </div>
          <div className="kpi-trend-row">
            <span className="trend-badge trend-up">
              <TrendingUp size={13} />
              +8.6%
            </span>
            <span className="trend-comparison">vs last month</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footer-metric">Avg. Basket: <strong>$26.59</strong></span>
            <span className="kpi-footer-metric text-primary"><strong>94.2%</strong> Auto-Fulfilled</span>
          </div>
        </div>

        {/* Card 3: Supply Risk Inventory */}
        <div className="kpi-card danger-accent">
          <div className="kpi-top-row">
            <span className="kpi-label">SUPPLY RISK INVENTORY</span>
            <div className="kpi-icon-pill icon-red">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">38 <span className="kpi-unit">SKUs</span></span>
          </div>
          <div className="kpi-trend-row">
            <span className="trend-badge trend-danger">
              ! 12 Critical
            </span>
            <span className="trend-comparison text-danger-text">Stockouts imminently</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-footer-metric text-danger-text">Action required</span>
            <span className="kpi-footer-metric">Across 4 retail zones</span>
          </div>
        </div>
      </div>

      {/* Row 2: Charts and AI Demand Insights */}
      <div className="charts-insights-grid">
        {/* Weekly Velocity Chart Card */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Weekly Demand & Revenue Velocity</h3>
              <p className="chart-subtitle">Mon – Sun sales actuals plotted against AI predicted volume</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-box actual-box"></span>
                Actual Revenue
              </span>
              <span className="legend-item">
                <span className="legend-line projected-line"></span>
                AI Projected
              </span>
            </div>
          </div>

          {/* Interactive Chart Canvas Area */}
          <div className="chart-body-wrapper">
            {/* Peak Day Callout Pin */}
            <div className="peak-callout-badge">
              <div className="peak-dot-indicator"></div>
              <span>Peak Day: <strong>Saturday</strong></span>
              <span className="peak-divider">·</span>
              <span className="peak-actual">$198.4k actualized</span>
            </div>

            {/* SVG Interactive Chart */}
            <div className="chart-visual-container">
              {/* SVG Overlay for Projected Trend Spline */}
              <svg className="chart-svg-spline" viewBox="0 0 700 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="projectedGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Area under spline */}
                <path
                  d="M 50 145 C 150 130, 200 120, 250 115 C 320 110, 380 90, 450 70 C 520 50, 560 35, 570 30 C 600 25, 630 60, 660 75 L 660 180 L 50 180 Z"
                  fill="url(#projectedGlow)"
                />
                {/* Dashed spline line */}
                <path
                  d="M 50 145 C 150 130, 200 120, 250 115 C 320 110, 380 90, 450 70 C 520 50, 560 35, 570 30 C 600 25, 630 60, 660 75"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                  strokeDasharray="5,4"
                  strokeLinecap="round"
                />
                {/* Saturday highlight circle */}
                <circle cx="570" cy="30" r="5" fill="#FFFFFF" stroke="#0284C7" strokeWidth="3" />
                <circle cx="570" cy="30" r="9" fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.7" />
              </svg>

              {/* Bar Columns Container */}
              <div className="bars-flex-container">
                {weeklyData.map((d, index) => {
                  const maxVal = 210;
                  const barHeightPct = (d.actual / maxVal) * 100;
                  const isHovered = hoveredDay === index;
                  return (
                    <div
                      key={d.day}
                      className={`bar-column-wrap ${d.isPeak ? 'peak-column' : ''}`}
                      onMouseEnter={() => setHoveredDay(index)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {/* Bar Hover Tooltip */}
                      {isHovered && (
                        <div className="bar-tooltip">
                          <div className="tooltip-title">{d.day}</div>
                          <div className="tooltip-row">
                            <span>Actual:</span> <strong>{d.formattedActual}</strong>
                          </div>
                          <div className="tooltip-row text-info">
                            <span>AI Forecast:</span> <strong>{d.formattedProjected}</strong>
                          </div>
                        </div>
                      )}

                      <div className="bar-track">
                        <div
                          className={`bar-fill ${d.isPeak ? 'bar-peak-fill' : ''}`}
                          style={{ height: `${barHeightPct}%` }}
                        ></div>
                      </div>
                      <span className={`bar-label ${d.isPeak ? 'label-peak' : ''}`}>
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* AI Demand Insights Card */}
        <div className="ai-insights-card">
          <div className="ai-insights-header">
            <div className="ai-title-wrap">
              <div className="ai-sparkle-pill">
                <Sparkles size={16} />
              </div>
              <h3 className="ai-insights-title">AI Demand Insights</h3>
            </div>
            <div className="active-agent-pill">
              <span className="agent-indicator-dot"></span>
              Active Agent
            </div>
          </div>

          <p className="ai-insights-desc">
            Continuous inference based on current foot traffic, weather forecast, and POS checkout velocity.
          </p>

          <div className="insights-list">
            {/* Insight 1: Organic Beverages */}
            <div className="insight-item-box surge-box">
              <div className="insight-item-header">
                <div className="flex-row items-center gap-2">
                  <div className="insight-icon green-icon">
                    <TrendingUp size={15} />
                  </div>
                  <h4 className="insight-item-title">Organic Beverages (+32%)</h4>
                </div>
              </div>
              <p className="insight-item-body">
                Unusual surge detected at Store #104. Recommended shelf-space allocation expansion for weekend rush.
              </p>
            </div>

            {/* Insight 2: SKU-8842 Risk */}
            <div className="insight-item-box risk-box">
              <div className="insight-item-header">
                <div className="flex-row items-center gap-2">
                  <div className="insight-icon red-icon">
                    <AlertTriangle size={15} />
                  </div>
                  <h4 className="insight-item-title">SKU-8842 Stockout Risk</h4>
                </div>
              </div>
              <p className="insight-item-body">
                Depletion projected in under 48h. Automated supplier purchase order RPO-4401 has been generated.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="ai-cta-row">
            <button
              type="button"
              className="execute-restock-btn"
              onClick={handleExecuteRestock}
              disabled={executingRestock}
            >
              <Zap size={16} className={executingRestock ? 'spin-icon' : ''} />
              <span>{executingRestock ? 'Transmitting Orders...' : 'Execute Recommended Restocks'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
