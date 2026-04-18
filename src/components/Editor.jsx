import { useState, useEffect, useRef } from 'react';
import { Eye, Edit3, Sparkles, BookOpen, Share, Calendar, Hexagon, Database, Settings, Kanban } from 'lucide-react';
import { marked } from 'marked';
import AIPanel from './AIPanel';
import SummarizerPanel from './SummarizerPanel';

export default function Editor({ file, onChange }) {
  const [isPreview, setIsPreview] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isSummarizerOpen, setIsSummarizerOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExportingNotion, setIsExportingNotion] = useState(false);
  const textareaRef = useRef(null);
  
  const [notionModalOpen, setNotionModalOpen] = useState(false);
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDataSourceId, setNotionDataSourceId] = useState('');
  
  const [gcalModalOpen, setGcalModalOpen] = useState(false);
  const [gcalClientId, setGcalClientId] = useState('');

  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', title: '' });
  const [pendingExportContent, setPendingExportContent] = useState(null);
  const [isExportingTrello, setIsExportingTrello] = useState(false);
  const [trelloModalOpen, setTrelloModalOpen] = useState(false);
  const [trelloApiKey, setTrelloApiKey] = useState('');
  const [trelloToken, setTrelloToken] = useState('');
  const [trelloListId, setTrelloListId] = useState('');

  const handleExportFromAI = (app, content) => {
    if (app === 'notion') {
      handleExportNotion(content);
    } else if (app === 'gcal') {
      handleExportGCal(content);
    } else if (app === 'trello') {
      handleExportTrello(content);
    } else if (app === 'obsidian') {
      handleExportObsidian(content);
    } else if (app === 'note') {
      onChange({ content: file.content + '\n\n' + content });
      setAlertModal({ isOpen: true, title: 'Success', message: 'Tasks appended to the current note.' });
    }
  };

  const handleExportNotion = async (customContent = null) => {
    if (typeof customContent !== 'string') customContent = null;
    try {
      const res = await fetch('http://127.0.0.1:8002/settings');
      const settings = await res.json();
      let apiKey = settings.notion_api_key;
      let dataSourceId = settings.notion_data_source_id;

      if (!apiKey || !dataSourceId) {
        setPendingExportContent(customContent);
        setNotionApiKey(apiKey || '');
        setNotionDataSourceId(dataSourceId || '');
        setNotionModalOpen(true);
        return;
      }

      executeNotionExport(apiKey, dataSourceId, customContent);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to fetch settings from backend.' });
    }
  };

  const executeNotionExport = async (apiKey, dataSourceId, customContent = null) => {
    setIsExportingNotion(true);
    try {
      const textToExport = customContent || file.content || '';
      const tasks = textToExport.split('\n')
        .filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]'))
        .map(line => line.replace(/^- \[[ x]\] /, '').trim());

      const payload = {
        notion_api_key: apiKey,
        notion_data_source_id: dataSourceId
      };

      if (tasks.length > 0) {
        payload.tasks = tasks;
      } else {
        payload.title = file.title || 'Untitled Note';
        payload.content = textToExport;
      }

      const response = await fetch('http://127.0.0.1:8002/export/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.detail || "Failed to export to Notion");
      }
      
      setAlertModal({ isOpen: true, title: 'Success', message: 'Successfully saved to Notion!\nURL: ' + data.url });
    } catch (err) {
      console.error(err);
      let errorMsg = err.message;
      if (errorMsg === 'Failed to fetch') {
        errorMsg += '\n\nCould not connect to the backend server. Please make sure the Python backend is running on port 8002.';
      }
      setAlertModal({ isOpen: true, title: 'Error', message: 'Error saving to Notion:\n' + errorMsg });
    } finally {
      setIsExportingNotion(false);
      setShowExportMenu(false);
    }
  };

  const handleNotionModalSubmit = async () => {
    if (!notionApiKey || !notionDataSourceId) return;
    try {
      await fetch('http://127.0.0.1:8002/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_api_key: notionApiKey, notion_data_source_id: notionDataSourceId })
      });
      setNotionModalOpen(false);
      executeNotionExport(notionApiKey, notionDataSourceId, pendingExportContent);
      setPendingExportContent(null);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to save settings to backend.' });
    }
  };

  const handleExportTrello = async (customContent = null) => {
    if (typeof customContent !== 'string') customContent = null;
    try {
      const res = await fetch('http://127.0.0.1:8002/settings');
      const settings = await res.json();
      let apiKey = settings.trello_api_key;
      let token = settings.trello_token;
      let listId = settings.trello_list_id;

      if (!apiKey || !token || !listId) {
        setPendingExportContent(customContent);
        setTrelloApiKey(apiKey || '');
        setTrelloToken(token || '');
        setTrelloListId(listId || '');
        setTrelloModalOpen(true);
        return;
      }
      executeTrelloExport(apiKey, token, listId, customContent);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to fetch settings from backend.' });
    }
  };

  const executeTrelloExport = async (apiKey, token, listId, customContent = null) => {
    setIsExportingTrello(true);
    try {
      const textToExport = customContent || file.content || '';
      const tasks = textToExport.split('\n')
        .filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]'))
        .map(line => line.replace(/^- \[[ x]\] /, '').trim());

      const payload = {
        trello_api_key: apiKey,
        trello_token: token,
        trello_list_id: listId
      };

      if (tasks.length > 0) {
        payload.tasks = tasks;
      } else {
        payload.title = file.title || 'Untitled Note';
        payload.content = textToExport;
      }

      const response = await fetch('http://127.0.0.1:8002/export/trello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.detail || "Failed to export to Trello");
      }
      setAlertModal({ isOpen: true, title: 'Success', message: 'Successfully saved to Trello!\nCard URL: ' + data.url });
    } catch (err) {
      console.error(err);
      setAlertModal({ isOpen: true, title: 'Error', message: 'Error saving to Trello:\n' + err.message });
    } finally {
      setIsExportingTrello(false);
      setShowExportMenu(false);
    }
  };

  const handleTrelloModalSubmit = async () => {
    if (!trelloApiKey || !trelloToken || !trelloListId) return;
    try {
      await fetch('http://127.0.0.1:8002/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trello_api_key: trelloApiKey, 
          trello_token: trelloToken, 
          trello_list_id: trelloListId 
        })
      });
      setTrelloModalOpen(false);
      executeTrelloExport(trelloApiKey, trelloToken, trelloListId, pendingExportContent);
      setPendingExportContent(null);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to save settings to backend.' });
    }
  };

  const handleExportObsidian = (customContent = null) => {
    if (typeof customContent !== 'string') customContent = null;
    const title = encodeURIComponent(file.title || 'Untitled');
    const content = encodeURIComponent(customContent || file.content || '');
    window.open(`obsidian://new?name=${title}&content=${content}`, '_blank');
    setShowExportMenu(false);
  };

  const handleExportGCal = async (customContent = null) => {
    if (typeof customContent !== 'string') customContent = null;
    try {
      const res = await fetch('http://127.0.0.1:8002/settings');
      const settings = await res.json();
      let clientId = settings.gcal_client_id;
      if (!clientId) {
        setPendingExportContent(customContent);
        setGcalClientId(clientId || '');
        setGcalModalOpen(true);
        return;
      }
      executeGCalExport(clientId, customContent);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to fetch settings from backend.' });
    }
  };

  const executeGCalExport = (clientId, customContent = null) => {
    if (!window.google) {
       setAlertModal({ isOpen: true, title: 'Error', message: 'Google Identity Services script not loaded yet. Please wait a second and try again.' });
       return;
    }
    
    const textToExport = customContent || file.content || '';
    const tasks = textToExport.split('\n')
      .filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]'))
      .map(line => line.replace(/^- \[[ x]\] /, '').trim());
    
    if (tasks.length === 0) {
      setAlertModal({ isOpen: true, title: 'No Tasks', message: 'No tasks found in this note. Make sure they start with "- [ ]".' });
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: async (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          if (tokenResponse.error === 'invalid_client') {
            fetch('http://127.0.0.1:8002/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gcal_client_id: '' })
            }).catch(e => console.error(e));
          }
          setAlertModal({ isOpen: true, title: 'Authentication Error', message: tokenResponse.error + " (Client ID might be invalid)" });
          return;
        }
        
        try {
          const formatDateLocal = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          
          const today = formatDateLocal(new Date());
          let successCount = 0;
          
          for (const task of tasks) {
            let taskText = task;
            let eventDate = today;
            
            // Extract the date from the end of the task (e.g., "Task Name - **2026-10-15**" or "Task Name - today")
            const dateMatch = task.match(/(?:\s-\s|\s—\s)\*?\*?([^*]+)\*?\*?$/);
            if (dateMatch) {
                const dateStr = dateMatch[1].trim().toLowerCase();
                taskText = task.substring(0, dateMatch.index).trim();
                
                if (dateStr === 'tomorrow') {
                    const t = new Date();
                    t.setDate(t.getDate() + 1);
                    eventDate = formatDateLocal(t);
                } else if (dateStr !== 'today') {
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        eventDate = formatDateLocal(parsedDate);
                    }
                }
            }

            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tokenResponse.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                summary: taskText,
                start: { date: eventDate },
                end: { date: eventDate }
              })
            });
            
            if (res.ok) successCount++;
          }
          
          setAlertModal({ isOpen: true, title: 'Success', message: `Successfully added ${successCount} task(s) to your Google Calendar!` });
        } catch (err) {
          setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to add events: ' + err.message });
        } finally {
          setShowExportMenu(false);
        }
      },
    });
    
    tokenClient.requestAccessToken();
  };

  const handleGCalModalSubmit = async () => {
    if (!gcalClientId) return;
    try {
      await fetch('http://127.0.0.1:8002/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcal_client_id: gcalClientId })
      });
      setGcalModalOpen(false);
      executeGCalExport(gcalClientId, pendingExportContent);
      setPendingExportContent(null);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to save settings to backend.' });
    }
  };

  const renderMarkdown = (content) => {
    return { __html: marked.parse(content || '') };
  };

  const handleSelectionChange = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        setSelectedText(textareaRef.current.value.substring(start, end));
      } else {
        setSelectedText('');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div className="topbar">
        <input 
          className="title-input" 
          value={file.title} 
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Note Title"
        />
        <div className="action-buttons" style={{ position: 'relative' }}>
          <button 
            className={`ai-btn ${showExportMenu ? 'active' : ''}`}
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="Save note to Apps"
          >
            <Share size={18} /> Save note to
          </button>
          
          {showExportMenu && (
            <div className="export-dropdown fade-in" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '0.5rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              minWidth: '180px'
            }}>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                <button 
                  className="icon-btn" 
                  onClick={handleExportNotion}
                  disabled={isExportingNotion}
                  style={{ flex: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                >
                  <Database size={16} color="#000000" /> {isExportingNotion ? 'Saving to Notion...' : 'To Notion'}
                </button>
                <button 
                  className="icon-btn" 
                  style={{ padding: '0.25rem', border: 'none', background: 'transparent', opacity: 0.6 }} 
                  title="Edit Notion API Config"
                  onClick={async () => {
                    try {
                      const res = await fetch('http://127.0.0.1:8002/settings');
                      const settings = await res.json();
                      setNotionApiKey(settings.notion_api_key || '');
                      setNotionDataSourceId(settings.notion_data_source_id || '');
                    } catch (e) {
                      setNotionApiKey('');
                      setNotionDataSourceId('');
                    }
                    setNotionModalOpen(true);
                    setShowExportMenu(false);
                  }}
                >
                  <Settings size={14} />
                </button>
              </div>
              <button 
                className="icon-btn" 
                onClick={handleExportObsidian}
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
              >
                <Hexagon size={16} color="#7C3AED" /> To Obsidian
              </button>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                <button 
                  className="icon-btn" 
                  onClick={handleExportGCal}
                  style={{ flex: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                >
                  <Calendar size={16} color="#3B82F6" /> Save tasks to Google Calendar
                </button>
                <button 
                  className="icon-btn" 
                  style={{ padding: '0.25rem', border: 'none', background: 'transparent', opacity: 0.6 }} 
                  title="Edit Google Calendar Config"
                  onClick={async () => {
                    try {
                      const res = await fetch('http://127.0.0.1:8002/settings');
                      const settings = await res.json();
                      setGcalClientId(settings.gcal_client_id || '');
                    } catch (e) {
                      setGcalClientId('');
                    }
                    setGcalModalOpen(true);
                    setShowExportMenu(false);
                  }}
                >
                  <Settings size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                <button 
                  className="icon-btn" 
                  onClick={handleExportTrello}
                  disabled={isExportingTrello}
                  style={{ flex: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                >
                  <Kanban size={16} color="#0079BF" /> {isExportingTrello ? 'Saving to Trello...' : 'To Trello'}
                </button>
                <button 
                  className="icon-btn" 
                  style={{ padding: '0.25rem', border: 'none', background: 'transparent', opacity: 0.6 }} 
                  title="Edit Trello Config"
                  onClick={async () => {
                    try {
                      const res = await fetch('http://127.0.0.1:8002/settings');
                      const settings = await res.json();
                      setTrelloApiKey(settings.trello_api_key || '');
                      setTrelloToken(settings.trello_token || '');
                      setTrelloListId(settings.trello_list_id || '');
                    } catch (e) {
                      setTrelloApiKey('');
                      setTrelloToken('');
                      setTrelloListId('');
                    }
                    setTrelloModalOpen(true);
                    setShowExportMenu(false);
                  }}
                >
                  <Settings size={14} />
                </button>
              </div>
            </div>
          )}

          <button
            className={`ai-btn ${isSummarizerOpen ? 'active' : ''}`}
            onClick={() => { setIsSummarizerOpen(!isSummarizerOpen); setIsAIPanelOpen(false); setShowExportMenu(false); }}
            title="Open Summarizer"
          >
            <BookOpen size={18} />
            Summarize
          </button>
          <button 
            className={`ai-btn ${isAIPanelOpen ? 'active' : ''}`}
            onClick={() => { setIsAIPanelOpen(!isAIPanelOpen); setIsSummarizerOpen(false); }}
            title="Open AI Tools"
          >
            <Sparkles size={18} />
            AI Tools
          </button>
          <button 
            className={`icon-btn ${!isPreview ? 'active' : ''}`} 
            onClick={() => { setIsPreview(false); setShowExportMenu(false); }}
          >
            <Edit3 size={18} /> Edit
          </button>
          <button 
            className={`icon-btn ${isPreview ? 'active' : ''}`} 
            onClick={() => { setIsPreview(true); setShowExportMenu(false); }}
          >
            <Eye size={18} /> Preview
          </button>
        </div>
      </div>
      
      <div className="editor-main-wrapper">
        <div className="editor-content-area fade-in">
          {isPreview ? (
            <div 
              className="markdown-preview"
              dangerouslySetInnerHTML={renderMarkdown(file.content)}
            />
          ) : (
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={file.content}
              onChange={(e) => onChange({ content: e.target.value })}
              onSelect={handleSelectionChange}
              onKeyUp={handleSelectionChange}
              onMouseUp={handleSelectionChange}
              placeholder="Start typing your markdown..."
              autoFocus
            />
          )}
        </div>

        {isAIPanelOpen && (
          <AIPanel 
            file={file} 
            selectedText={selectedText} 
            onClose={() => setIsAIPanelOpen(false)} 
            onExport={handleExportFromAI}
          />
        )}
        {isSummarizerOpen && (
          <SummarizerPanel
            isOpen={isSummarizerOpen}
            onClose={() => setIsSummarizerOpen(false)}
            content={file.content}
          />
        )}

        {/* In-App Modals */}
        {gcalModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="modal-content fade-in" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={20} /> Google Calendar Config</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Please provide your Google OAuth Client ID to connect.</p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Google Client ID</label>
                <input 
                  type="text" 
                  value={gcalClientId} 
                  onChange={(e) => setGcalClientId(e.target.value)}
                  placeholder="xxxxxx-yyyyyy.apps.googleusercontent.com"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => setGcalModalOpen(false)}>Cancel</button>
                <button className="start-btn primary" onClick={handleGCalModalSubmit} disabled={!gcalClientId} style={{ padding: '0.5rem 1rem' }}>Save & Connect</button>
              </div>
            </div>
          </div>
        )}

        {notionModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="modal-content fade-in" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={20} /> Notion Configuration</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Please provide your integration details.</p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>API Key (Integration Token)</label>
                <input 
                  type="password" 
                  value={notionApiKey} 
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Data Source ID</label>
                <input 
                  type="text" 
                  value={notionDataSourceId} 
                  onChange={(e) => setNotionDataSourceId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => setNotionModalOpen(false)}>Cancel</button>
                <button className="start-btn primary" onClick={handleNotionModalSubmit} disabled={!notionApiKey || !notionDataSourceId} style={{ padding: '0.5rem 1rem' }}>Save & Export</button>
              </div>
            </div>
          </div>
        )}

        {trelloModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="modal-content fade-in" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Kanban size={20} /> Trello Configuration</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Configure Trello to export your tasks or notes.</p>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>API Key</label>
                <input 
                  type="text" 
                  value={trelloApiKey} 
                  onChange={(e) => setTrelloApiKey(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Token</label>
                <input 
                  type="password" 
                  value={trelloToken} 
                  onChange={(e) => setTrelloToken(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>List ID</label>
                <input 
                  type="text" 
                  value={trelloListId} 
                  onChange={(e) => setTrelloListId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => setTrelloModalOpen(false)}>Cancel</button>
                <button className="start-btn primary" onClick={handleTrelloModalSubmit} disabled={!trelloApiKey || !trelloToken || !trelloListId} style={{ padding: '0.5rem 1rem' }}>Save & Export</button>
              </div>
            </div>
          </div>
        )}

        {alertModal.isOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="modal-content fade-in" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: alertModal.title === 'Error' ? '#ef4444' : 'var(--text-primary)' }}>{alertModal.title}</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{alertModal.message}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="start-btn primary" onClick={() => setAlertModal({ isOpen: false, message: '', title: '' })} style={{ padding: '0.5rem 1.5rem' }}>OK</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

