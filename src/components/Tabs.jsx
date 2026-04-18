import React from 'react';

/**
 * A reusable Tabs component.
 * @param {Array} tabs - Array of objects { id, label, icon }
 * @param {String} activeTab - The currently active tab ID
 * @param {Function} onTabChange - Function to call when a tab is clicked
 */
const Tabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="tabs-container">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={tab.label}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Tabs;
