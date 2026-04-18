import { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, Copy, Check, Languages, ListTodo, Mail, Lightbulb, FileText, RefreshCw, Send, Link as LinkIcon, AlignRight, Mic, Play, Square, Database, Calendar, Hexagon, PlusSquare, Kanban } from 'lucide-react';
import Tabs from './Tabs';

export default function AIPanel({ file, selectedText, onClose, onExport }) {
  const [activeTab, setActiveTab] = useState('rewrite');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState(null);
  
  const [rewriteTone, setRewriteTone] = useState('Professional');
  const [emailTone, setEmailTone] = useState('Formal');
  const [emailLength, setEmailLength] = useState('Detailed');
  const [translateLang, setTranslateLang] = useState('Spanish');
  const [simplifyTranslate, setSimplifyTranslate] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playAudio = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const isArabic = /[\u0600-\u06FF]/.test(text);
      utterance.lang = isArabic ? 'ar-SA' : 'en-US';
      utterance.rate = 0.95;
      
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported in this browser.");
    }
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const tabs = [
    { id: 'rewrite', label: 'Rewrite', icon: <RefreshCw size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo size={16} /> },
    { id: 'email', label: 'Email', icon: <Mail size={16} /> },
    { id: 'insights', label: 'Insights', icon: <FileText size={16} /> },
    { id: 'translate', label: 'Translate', icon: <Languages size={16} /> },
    { id: 'ideas', label: 'Ideas', icon: <Lightbulb size={16} /> },
  ];

  const handleAction = async (tabIdOverride = null) => {
    const tabId = tabIdOverride || activeTab;
    stopAudio();
    setLoading(true);
    setResult('');
    setError(null);

    const contentToUse = selectedText || file.content;
    let prompt = '';

    switch (tabId) {
      case 'rewrite':
        prompt = `Rewrite the following content in a ${rewriteTone} tone. Ensure the core meaning is preserved but the delivery is adjusted to be ${rewriteTone}.`;
        break;
      case 'tasks':
        prompt = "Review the content below and extract all actionable tasks and to-do items. Format them as a clear markdown checklist using '- [ ] Task' syntax.";
        break;
      case 'email':
        prompt = `Based on the content below, write a professional email. Tone: ${emailTone}, Duration: ${emailLength}. Start with a 'Subject:' line followed by the 'Body:'.`;
        break;
      case 'insights':
        prompt = "Analyze the content and extract structured insights: Key Points, Dates, Important Numbers, and Decisions Made. Use clear headings for each section.";
        break;
      case 'translate':
        prompt = `Translate the following text into ${translateLang}. Keep the meaning exact. ${simplifyTranslate ? 'Use simpler vocabulary where possible.' : ''}`;
        break;
      case 'ideas':
        prompt = "Reorganize the content below into a logical structure with clear headings, bullet points, and a summary section to improve readability and flow.";
        break;
      default:
        prompt = "Analyze the following content:";
    }

    try {
      const res = await fetch('http://127.0.0.1:8002/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: contentToUse,
          prompt: prompt
        })
      });

      if (!res.ok) throw new Error('Failed to connect to AI server');
      
      const data = await res.json();
      setResult(data.summary);
    } catch (err) {
      setError(err.message || 'Connection Error');
      setResult('Error: Connection to AI backend failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    // Optional: add a toast notification here
  };

  const clearResult = () => {
    stopAudio();
    setResult('');
    setError(null);
  };



  const renderRewriteOptions = () => (
    <div className="tab-options">
      <div className="option-group">
        <label>Tone:</label>
        <select value={rewriteTone} onChange={(e) => setRewriteTone(e.target.value)}>
          <option>Formal</option>
          <option>Simple</option>
          <option>Professional</option>
          <option>Short</option>
        </select>
      </div>
      <button className="run-btn" onClick={() => handleAction('rewrite')} disabled={loading}>
        {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />} 
        {result ? 'Rewrite Again' : 'Rewrite'}
      </button>
    </div>
  );

  const renderEmailOptions = () => (
    <div className="tab-options">
      <div className="option-row">
        <div className="option-group">
          <label>Tone:</label>
          <select value={emailTone} onChange={(e) => setEmailTone(e.target.value)}>
            <option>Formal</option>
            <option>Friendly</option>
          </select>
        </div>
        <div className="option-group">
          <label>Length:</label>
          <select value={emailLength} onChange={(e) => setEmailLength(e.target.value)}>
            <option>Short</option>
            <option>Detailed</option>
          </select>
        </div>
      </div>
      <button className="run-btn" onClick={() => handleAction('email')} disabled={loading}>
        {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
        {result ? 'Regenerate Email' : 'Generate Email'}
      </button>
    </div>
  );

  const renderTranslateOptions = () => (
    <div className="tab-options">
      <div className="option-group">
        <label>Target Language:</label>
        <select value={translateLang} onChange={(e) => setTranslateLang(e.target.value)}>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
          <option>Chinese</option>
          <option>Japanese</option>
          <option>Arabic</option>
        </select>
      </div>
      <div className="option-check">
        <input 
          type="checkbox" 
          id="simplify" 
          checked={simplifyTranslate} 
          onChange={(e) => setSimplifyTranslate(e.target.checked)} 
        />
        <label htmlFor="simplify">Simplify output</label>
      </div>
      <button className="run-btn" onClick={() => handleAction('translate')} disabled={loading}>
        {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
        {result ? 'Translate Again' : 'Translate'}
      </button>
    </div>
  );

  return (
    <div className="ai-split-panel modern-ai-panel">
      <div className="ai-split-header">
        <div className="ai-header-title">
          <Sparkles size={18} />
          <h3>AI Tools</h3>
          {selectedText && <span className="selection-badge">Selection Active</span>}
        </div>
        <button onClick={onClose} className="icon-btn" title="Close"><X size={18} /></button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); clearResult(); }} />

      <div className="ai-panel-body">
        {activeTab === 'rewrite' && renderRewriteOptions()}
        {activeTab === 'email' && renderEmailOptions()}
        {activeTab === 'translate' && renderTranslateOptions()}
        
        {!result && !loading && (activeTab === 'tasks' || activeTab === 'insights' || activeTab === 'ideas') && (
           <div className="tab-initial-state">
              <button className="run-btn-large" onClick={() => handleAction()}>
                 <Send size={18} />
                 Generate {tabs.find(t => t.id === activeTab).label}
              </button>
           </div>
        )}

        {loading && (
          <div className="ai-loading">
            <Loader2 size={32} className="spin" />
            <p>Analyzing content...</p>
          </div>
        )}

        {result && !loading && (
          <div className="ai-result-container fade-in">
            <div className="result-header">
              <span>AI Output</span>
              <div className="result-actions">
                <button className="icon-btn small" onClick={copyToClipboard} title="Copy result">
                  <Copy size={14} /> Copy
                </button>
                <button className="icon-btn small" onClick={clearResult} title="Clear result">
                  <RefreshCw size={14} /> Start Over
                </button>
              </div>
            </div>
            
            {activeTab === 'rewrite' ? (
              <textarea 
                className="ai-editable-result" 
                value={result} 
                onChange={(e) => setResult(e.target.value)}
              />
            ) : (
              <div className="ai-rendered-result">
                {result.split('\n').filter(line => line.trim()).map((line, i) => {
                  const isChecklist = /^(\*|-)\s\[[ x]\]/.test(line.trim());
                  if (isChecklist) {
                    const isChecked = line.includes('[x]');
                    return (
                      <div key={i} className="checklist-item">
                        <input type="checkbox" readOnly checked={isChecked} />
                        <span>{line.replace(/^(\*|-)\s\[[ x]\]\s?/, '')}</span>
                      </div>
                    );
                  }
                  return <p key={i}>{line}</p>;
                })}
              </div>
            )}
            
            {activeTab === 'tasks' && result && onExport && (
              <div className="task-export-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Export Tasks:</div>
                <button className="icon-btn small" onClick={() => onExport('note', result)}>
                  <PlusSquare size={14} /> Append to Note
                </button>
                <button className="icon-btn small" onClick={() => onExport('notion', result)}>
                  <Database size={14} color="#000000" /> To Notion
                </button>
                <button className="icon-btn small" onClick={() => onExport('gcal', result)}>
                  <Calendar size={14} color="#3B82F6" /> To Google Calendar
                </button>
                <button className="icon-btn small" onClick={() => onExport('obsidian', result)}>
                  <Hexagon size={14} color="#7C3AED" /> To Obsidian
                </button>
                <button className="icon-btn small" onClick={() => onExport('trello', result)}>
                  <Kanban size={14} color="#0079BF" /> To Trello
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

