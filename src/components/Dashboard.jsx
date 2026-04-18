import React from 'react';
import { LayoutDashboard, FileText, CheckSquare, Sparkles, Plus, Calendar, Activity, Database, Kanban } from 'lucide-react';

const Dashboard = ({ nodes, calendarEvents, summaries, setActiveTab, handleCreateNode }) => {
  const notesCount = nodes.filter(n => n.type === 'file').length;
  const foldersCount = nodes.filter(n => n.type === 'folder').length;
  const completedTasks = calendarEvents.filter(e => e.completed).length;
  const totalTasks = calendarEvents.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Grab recent items
  const recentNotes = [...nodes].filter(n => n.type === 'file').sort((a, b) => b.lastModified - a.lastModified).slice(0, 3);
  const recentSummaries = [...summaries].slice(0, 3);

  return (
    <div className="dashboard-page fade-in" style={{ padding: '2rem', height: '100%', overflowY: 'auto', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="start-hero" style={{ alignItems: 'flex-start', textAlign: 'left', marginBottom: '2.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '2.2rem', marginBottom: '0.5rem' }}>
          <LayoutDashboard size={36} color="var(--accent)" />
          Welcome Back
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Here is an overview of your active workflow and tasks.</p>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Stats Card: Notes */}
        <div className="setting-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #5e6ad2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} /> Notes & Files</h3>
            <span style={{ background: 'rgba(94, 106, 210, 0.1)', color: '#5e6ad2', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Storage</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{notesCount}</span>
            <span style={{ color: 'var(--text-secondary)' }}>Notes</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Organized in {foldersCount} folders</p>
        </div>

        {/* Stats Card: Tasks */}
        <div className="setting-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckSquare size={18} /> Active Tasks</h3>
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Trello / GCal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{completedTasks}</span>
            <span style={{ color: 'var(--text-secondary)' }}>/ {totalTasks} Completed</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercentage}%`, height: '100%', background: '#10b981', transition: 'width 0.5s ease' }}></div>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{progressPercentage}% overall completion rate.</p>
        </div>

        {/* Stats Card: Summaries */}
        <div className="setting-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={18} /> AI Analyses</h3>
            <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Insights</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{summaries.length}</span>
            <span style={{ color: 'var(--text-secondary)' }}>Summaries</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Extracted from web, video, and text.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr)', gap: '2rem' }}>
        
        {/* Quick Actions */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--accent)" /> Quick Actions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button 
              className="setting-card" 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', padding: '1.5rem' }}
              onClick={() => { setActiveTab('note'); handleCreateNode('file'); }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ background: 'rgba(94, 106, 210, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--accent)' }}>
                 <Plus size={24} />
              </div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>New Note</span>
            </button>
            
            <button 
              className="setting-card" 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', padding: '1.5rem' }}
              onClick={() => setActiveTab('tasks')}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%', color: '#10b981' }}>
                 <CheckSquare size={24} />
              </div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Extract Tasks</span>
            </button>
            
            <button 
              className="setting-card" 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s', padding: '1.5rem' }}
              onClick={() => setActiveTab('summarize')}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '50%', color: '#f59e0b' }}>
                 <Sparkles size={24} />
              </div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>AI Summarizer</span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--text-secondary)" /> Recent Notes
          </h3>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0.5rem' }}>
            {recentNotes.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recent notes found.</div>
            ) : (
              recentNotes.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <FileText size={16} color="var(--accent)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Modified {new Date(n.lastModified).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            )}
            {recentNotes.length > 0 && (
              <div 
                style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => setActiveTab('note')}
              >
                View Explorer &rarr;
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
