import { useState, useEffect, useRef } from 'react';
import { FileText, LayoutDashboard, Sparkles, CheckSquare, Calendar, Plus, Activity, Play, Pause, Database, Hexagon, Settings, Kanban, HelpCircle, Copy } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Dashboard from './components/Dashboard';
import { PluginManager } from './lib/PluginAPI';

function App() {
  const [nodes, setNodes] = useState(() => {
    try {
      const saved = localStorage.getItem('obsidian-nodes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse nodes:", e);
      return [];
    }
  });
  const [activeFileId, setActiveFileId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summaryLength, setSummaryLength] = useState(150);
  const [audioDuration, setAudioDuration] = useState(120);
  const [summaries, setSummaries] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summarizeMode, setSummarizeMode] = useState(null); // 'text' or 'audio' or null
  const [activeSummaryId, setActiveSummaryId] = useState(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [pluginIcons, setPluginIcons] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [isUploadingTaskFile, setIsUploadingTaskFile] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState('');
  const [calendarEvents, setCalendarEvents] = useState(() => {
    try {
      const saved = localStorage.getItem('notelink-calendar-events');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse calendar events:", e);
      return [];
    }
  });
  const hasLoaded = useRef(false);

  const [settingsModal, setSettingsModal] = useState({ isOpen: false, tab: 'ai' });
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDataSourceId, setNotionDataSourceId] = useState('');
  const [gcalClientId, setGcalClientId] = useState('');
  const [aiProvider, setAiProvider] = useState('local');
  const [aiApiKey, setAiApiKey] = useState('');

  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', title: '' });
  const [pendingExportContent, setPendingExportContent] = useState(null);
  const [isExportingNotion, setIsExportingNotion] = useState(false);
  const [isExportingTrello, setIsExportingTrello] = useState(false);

  const [trelloApiKey, setTrelloApiKey] = useState('');
  const [trelloToken, setTrelloToken] = useState('');
  const [trelloListId, setTrelloListId] = useState('');

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
        setSettingsModal({ isOpen: true, tab: 'notion' });
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
      const textToExport = customContent || '';
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
        payload.title = 'Generated Tasks';
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
      setSettingsModal({ isOpen: false, tab: 'notion' });
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
        setSettingsModal({ isOpen: true, tab: 'trello' });
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
      const textToExport = customContent || '';
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
        payload.title = 'Generated Tasks';
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
      setSettingsModal({ isOpen: false, tab: 'trello' });
      executeTrelloExport(trelloApiKey, trelloToken, trelloListId, pendingExportContent);
      setPendingExportContent(null);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to save settings to backend.' });
    }
  };

  const handleExportObsidian = (customContent = null) => {
    if (typeof customContent !== 'string') customContent = null;
    const title = encodeURIComponent('Generated Tasks');
    const content = encodeURIComponent(customContent || '');
    window.open(`obsidian://new?name=${title}&content=${content}`, '_blank');
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
        setSettingsModal({ isOpen: true, tab: 'gcal' });
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
    
    const textToExport = customContent || '';
    const tasks = textToExport.split('\n')
      .filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]'))
      .map(line => line.replace(/^- \[[ x]\] /, '').trim());
    
    if (tasks.length === 0) {
      setAlertModal({ isOpen: true, title: 'No Tasks', message: 'No tasks found.' });
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
      setSettingsModal({ isOpen: false, tab: 'gcal' });
      executeGCalExport(gcalClientId, pendingExportContent);
      setPendingExportContent(null);
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to save settings to backend.' });
    }
  };

  const handleAiSettingsModalSubmit = async () => {
    try {
      await fetch('http://127.0.0.1:8002/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_provider: aiProvider, ai_api_key: aiApiKey })
      });
      setSettingsModal({ isOpen: false, tab: 'ai' });
      setAlertModal({ isOpen: true, title: 'Success', message: 'AI settings saved successfully.' });
    } catch (err) {
      setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to save AI settings to backend.' });
    }
  };

  const handleSaveAsNote = (content) => {
    const noteId = Date.now().toString() + Math.random();
    const newNode = {
      id: noteId,
      type: 'file',
      parentId: null,
      title: 'Generated Tasks',
      content: content,
      lastModified: Date.now()
    };
    setNodes(prev => [...prev, newNode]);
    setActiveFileId(noteId);
    setActiveTab('note');
  };

  const stopVoice = () => {
    window.speechSynthesis.cancel();
    setIsPlayingVoice(false);
  };

  const [audioProgress, setAudioProgress] = useState(0);
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const findBestVoice = (lang) => {
    // Priority names for Arabic: Maged, Layla, Zeina, etc.
    const priority = lang === 'ar' ? ['Maged', 'Layla', 'Zeina', 'ar'] : ['Google', 'Microsoft', 'en'];
    for (const name of priority) {
       const v = availableVoices.find(voice => 
         voice.name.includes(name) || voice.lang.startsWith(lang)
       );
       if (v) return v;
    }
    return availableVoices.find(v => v.lang.startsWith(lang)) || availableVoices[0];
  };

  const playVoice = (text) => {
    stopVoice();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const lang = isArabic ? 'ar' : 'en';
    
    const voice = findBestVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = isArabic ? 'ar-SA' : 'en-US';
    }
    
    // Smooth progress based on characters (avg 150 words/min = 2.5 words/sec ~ 15 chars/sec)
    const durationEstimate = text.length * 75; 
    const start = Date.now();
    const interval = setInterval(() => {
       const elapsed = Date.now() - start;
       const p = Math.min((elapsed / durationEstimate) * 100, 99.9);
       setAudioProgress(p);
    }, 100);

    utterance.onend = () => {
      setIsPlayingVoice(false);
      setAudioProgress(100);
      clearInterval(interval);
      setTimeout(() => setAudioProgress(0), 1000);
    };
    utterance.onerror = () => {
      setIsPlayingVoice(false);
      clearInterval(interval);
      setAudioProgress(0);
    };
    window.speechSynthesis.speak(utterance);
    setIsPlayingVoice(true);
  };

  useEffect(() => {
    if (activeSummaryId) {
       const summary = summaries.find(s => s.id === activeSummaryId);
       if (summary && summary.mode === 'audio') {
          playVoice(summary.summary);
       }
    } else {
       stopVoice();
    }
  }, [activeSummaryId]);

  const getActiveFile = () => nodes.find(n => n.id === activeFileId);
  const activeFileRef = useRef();
  activeFileRef.current = getActiveFile();

  const pluginManager = useRef(null);

  useEffect(() => {
    const context = {
      triggerRender: () => {
        if(pluginManager.current) {
           setPluginIcons([...pluginManager.current.getRibbonIcons()]);
        }
      },
      getActiveFile: () => activeFileRef.current,
    };
    pluginManager.current = new PluginManager(context);
    try {
      pluginManager.current.initializeCorePlugins();
    } catch (e) {
      console.error("Plugin initialization failed:", e);
    }
  }, []);

  const fetchNotes = () => {
    fetch('http://127.0.0.1:8002/notes')
      .then(res => res.json())
      .then(data => {
        const dbNodes = data.map(n => ({
          ...n,
          type: 'file',
          parentId: null
        }));
        
        setNodes(prev => {
          if (!dbNodes || !Array.isArray(dbNodes)) return prev;
          const localNodes = [...prev];
          let hasChanges = false;
          for (const dbNode of dbNodes) {
             if (!dbNode || !dbNode.id) continue;
             const existingIdx = localNodes.findIndex(n => n.id === dbNode.id);
             if (existingIdx >= 0) {
                if (dbNode.lastModified > (localNodes[existingIdx].lastModified || 0)) {
                   localNodes[existingIdx] = { ...localNodes[existingIdx], ...dbNode };
                   hasChanges = true;
                }
             } else {
                localNodes.push(dbNode);
                hasChanges = true;
             }
          }
          return hasChanges ? localNodes : prev;
        });
        
        // Don't auto-select a note — let the "Ready to create?" landing page show

      })
      .catch(err => console.error("Failed to fetch notes:", err));
  };

  // Load from backend / local storage and set up polling
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    
    fetchNotes();
    
    // Fetch URL summaries and migrate if needed
    const fetchAndMigrateSummaries = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8002/url_summaries');
        const dbSummaries = await res.json();
        
        // Check for legacy data in localStorage
        const legacyData = localStorage.getItem('notelink-summaries');
        if (legacyData) {
          const parsedLegacy = JSON.parse(legacyData);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            console.log("Migrating legacy summaries to DB...");
            // Migrate each to DB
            for (const item of parsedLegacy) {
              await fetch('http://127.0.0.1:8002/url_summaries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
              });
            }
            // Clear legacy data once migrated
            localStorage.removeItem('notelink-summaries');
            
            // Re-fetch to get merged state
            const finalRes = await fetch('http://127.0.0.1:8002/url_summaries');
            const finalData = await finalRes.json();
            setSummaries(finalData);
            return;
          }
        }
        
        setSummaries(dbSummaries);
      } catch (err) {
        console.error("Failed to fetch/migrate URL summaries:", err);
      }
    };

    fetchAndMigrateSummaries();

    const intervalId = setInterval(fetchNotes, 3000);
    return () => clearInterval(intervalId);
  }, []);

  // Save to local storage and sync to backend
  useEffect(() => {
    if (hasLoaded.current) {
      localStorage.setItem('obsidian-nodes', JSON.stringify(nodes));
      
      // Sync to backend (only sync fully loaded notes to avoid overwriting content with undefined)
      const nodesToSync = nodes.filter(n => n.type !== 'file' || n.content !== undefined);
      if (nodesToSync.length > 0) {
        fetch('http://127.0.0.1:8002/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nodesToSync)
        }).catch(err => console.error("Sync failed:", err));
      }

    }
  }, [nodes]);

  // LocalStorage removed for summaries as we now use DB

  useEffect(() => {
    localStorage.setItem('notelink-calendar-events', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  const handleDeleteSummary = async (id) => {
    setSummaries(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`http://127.0.0.1:8002/url_summaries/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Failed to delete summary from DB:", err);
    }
  };

  const activeFile = getActiveFile();

  const fetchNoteDetail = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:8002/notes/${id}`);
      if (!res.ok) {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, content: "" } : n));
        return;
      }
      const data = await res.json();
      setNodes(prev => prev.map(n => n.id === id ? { 
        ...n, 
        content: data.content ?? "", 
        ai_summary: data.ai_summary 
      } : n));
    } catch (err) {
      console.error("Failed to fetch note detail:", err);
      setNodes(prev => prev.map(n => n.id === id ? { ...n, content: "" } : n));
    }
  };


  useEffect(() => {
    if (activeFileId) {
      const active = nodes.find(n => n.id === activeFileId);
      if (active && active.type === 'file' && active.content === undefined) {
        fetchNoteDetail(activeFileId);
      }
    }
  }, [activeFileId, nodes]);

  const handleCreateNode = (type, parentId = null) => {
    const newNode = {
      id: Date.now().toString() + Math.random(),
      type,
      parentId,
      title: type === 'folder' ? 'New Folder' : 'Untitled Note',
      content: type === 'file' ? '' : undefined,
      lastModified: Date.now()
    };
    setNodes(prev => [...prev, newNode]);
    if (type === 'file') {
      setActiveFileId(newNode.id);
    }
  };

  const handleUpdateNode = (id, updates) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates, lastModified: Date.now() } : n));
  };

  const handleDeleteNode = (id) => {
    // Recursive deletion
    const getDescendantIds = (nodeId) => {
      const children = nodes.filter(n => n.parentId === nodeId);
      let ids = [nodeId];
      for (const child of children) {
        ids = [...ids, ...getDescendantIds(child.id)];
      }
      return ids;
    };
    const idsToDelete = getDescendantIds(id);
    const newNodes = nodes.filter(n => !idsToDelete.includes(n.id));
    setNodes(newNodes);
    
    if (idsToDelete.includes(activeFileId)) {
      const availableFile = newNodes.find(n => n.type === 'file');
      setActiveFileId(availableFile ? availableFile.id : null);
    }
  };

  const handleFileUpload = async (files) => {
    for (const file of Array.from(files)) {
      const noteId = (Date.now() + Math.random()).toString();
      
      // 1. Create a placeholder note showing that processing has started
      const newNode = {
        id: noteId,
        type: 'file',
        parentId: null,
        title: file.name,
        content: `### 📄 Uploading: ${file.name}\n\n*Processing file and extracting content. This may take a moment for large media files...*\n\n---`,
        lastModified: Date.now()
      };
      
      setNodes(prev => [...prev, newNode]);
      setActiveFileId(noteId);

      // 2. Prepare FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'auto');

      // 3. Send to backend for extraction
      try {
        const response = await fetch('http://127.0.0.1:8002/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        
        // 4. Update the note with the extracted text!
        handleUpdateNode(noteId, { 
          content: data.text || "No text extracted from file." 
        });
        
      } catch (err) {
        console.error("Upload error:", err);
        handleUpdateNode(noteId, { 
          content: `### ❌ Failed: ${file.name}\n\nError occurred during extraction: ${err.message}` 
        });
      }
    }
  };

  const handleUrlAnalyze = async (url) => {
    if (!url || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setProgress(10);
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 60) return prev + 2;
        if (prev < 85) return prev + 0.5;
        if (prev < 99) return prev + 0.1;
        return prev;
      });
    }, 400);

    try {
      const response = await fetch('http://127.0.0.1:8002/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url,
          options: {
            length: summaryLength,
            duration: audioDuration,
            mode: summarizeMode
          }
        })
      });
      
      if (!response.ok) throw new Error("Analysis failed / فشل التحليل");
      const data = await response.json();
      
      const newSummary = {
        id: (Date.now() + Math.random()).toString(),
        url,
        title: data.title && data.title !== "Analysis Result" ? data.title : (url.includes('youtube') ? '🎥 YouTube Video Analysis' : '📄 Web Page Analysis'),
        summary: data.summary || "No summary generated.",
        mode: summarizeMode,
        timestamp: Date.now()
      };

      setSummaries(prev => [newSummary, ...prev]);
      
      // Save to backend DB
      fetch('http://127.0.0.1:8002/url_summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSummary)
      }).catch(err => console.error("Failed to save URL summary to DB:", err));

      setActiveSummaryId(newSummary.id);
      setProgress(100);
      
    } catch (err) {
      console.error("Analysis error:", err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleTaskFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploadingTaskFile(true);
    
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'auto');

      const response = await fetch('http://127.0.0.1:8002/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      
      const text = data.text || "No text extracted from file.";
      setTaskInput(prev => prev ? prev + '\n\n' + text : text);
      
    } catch (err) {
      console.error("Upload error:", err);
      alert(`❌ Error extracting text from file: ${err.message}`);
    } finally {
      setIsUploadingTaskFile(false);
      const fileInput = document.getElementById('task-file-upload');
      if (fileInput) fileInput.value = '';
    }
  };

  const handleGenerateTasks = async () => {
    if (!taskInput || isGeneratingTasks) return;
    setIsGeneratingTasks(true);
    try {
      const response = await fetch('http://127.0.0.1:8002/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: taskInput,
          prompt: "CRITICAL: YOU WILL BE SEVERELY PUNISHED IF YOUR RESPONSE STARTS WITH ANYTHING OTHER THAN '- [ ]'. NEVER, NEVER, NEVER use introductions, conversational text, or summaries. Extract a concise list of actionable tasks. EVERY SINGLE LINE OF YOUR OUTPUT MUST START EXACTLY WITH '- [ ]'. Format STRICTLY as: - [ ] Task Name - **Date**. IMPORTANT: You must intelligently assign the Date based on the task's difficulty and its importance in the meeting flow. The date MUST be strictly in 'YYYY-MM-DD' format (e.g., '2026-04-20'). If no explicit timeframe is suitable, assign 'today' or 'tomorrow' based on urgency. OUTPUT ABSOLUTELY NOTHING ELSE. NO BLANK LINES. NO TITLES. JUST THE RAW CHECKLIST.",
          options: { mode: 'text' }
        })
      });
      
      if (!response.ok) throw new Error("Task generation failed");
      const data = await response.json();
      const tasksMarkdown = data.summary;
      setGeneratedTasks(tasksMarkdown);

      // Automatically add to calendar
      const newEvents = tasksMarkdown.split('\n')
        .filter(line => line.trim().startsWith('- [ ]'))
        .map(line => {
          const dateMatch = line.match(/(?:\s-\s|\s—\s)\*?\*?([^*]+)\*?\*?$/);
          let taskText = line.replace(/^- \[[ x]\] /, '').trim();
          let dateStr = 'today';
          
          if (dateMatch) {
            dateStr = dateMatch[1].trim().toLowerCase();
            taskText = taskText.substring(0, taskText.lastIndexOf(dateMatch[0])).trim();
          }
          
          let date = new Date();
          const formatDateLocal = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };

          if (dateStr === 'tomorrow') {
            date.setDate(date.getDate() + 1);
          } else if (dateStr !== 'today') {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              date = parsed;
            }
          }
          
          return {
            id: Math.random().toString(36).substr(2, 9),
            title: taskText,
            date: formatDateLocal(date),
            completed: line.includes('[x]')
          };
        });
      
      setCalendarEvents(prev => [...prev, ...newEvents]);

    } catch (err) {
      console.error("Task generation error:", err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  return (
    <div className="app-container fade-in">
      {/* Navigation Sidebar */}
      <div className="ribbon">
        <div className="nav-items">
          <button className={`ribbon-action ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} title="Dashboard">
            <LayoutDashboard size={22} />
          </button>
          <button className={`ribbon-action ${activeTab === 'note' ? 'active' : ''}`} onClick={() => setActiveTab('note')} title="Note">
            <FileText size={22} />
          </button>
          <button className={`ribbon-action ${activeTab === 'summarize' ? 'active' : ''}`} onClick={() => setActiveTab('summarize')} title="Summarize">
            <Sparkles size={22} />
          </button>
          <button className={`ribbon-action ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')} title="Tasks">
            <CheckSquare size={22} />
          </button>
        </div>
        <div className="nav-bottom">
          <button className="ribbon-action" onClick={async () => {
            try {
              const res = await fetch('http://127.0.0.1:8002/settings');
              const settings = await res.json();
              setAiProvider(settings.ai_provider || 'local');
              setAiApiKey(settings.ai_api_key || '');
            } catch (e) {
              setAiProvider('local');
              setAiApiKey('');
            }
            setSettingsModal({ isOpen: true, tab: 'ai' });
          }} title="App Settings">
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* Conditional Sidebar for Notes */}
      {activeTab === 'note' && (
        <Sidebar 
          nodes={nodes} 
          activeFileId={activeFileId} 
          onSelectFile={setActiveFileId} 
          onCreateNode={handleCreateNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      )}
      
      <div className="main-content">
        {activeTab === 'note' ? (
          activeFile ? (
            activeFile.content === undefined ? (
              <div className="loading-container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="loader-mini" style={{ width: 40, height: 40, marginBottom: '1rem' }}></div>
                <p style={{ color: 'var(--text-secondary)' }}>Loading Note Content...</p>
              </div>
            ) : (
              <Editor 
                file={activeFile} 
                onChange={(updates) => handleUpdateNode(activeFile.id, updates)} 
                onUpload={handleFileUpload}
                key={activeFile.id}
              />

            )
          ) : (

            <div className="note-start-page fade-in">
              <div className="start-hero">
                <div className="icon-stack">
                  <FileText size={48} className="icon-main" />
                  <Sparkles size={24} className="icon-sub" />
                </div>
                <h1>Ready to create?</h1>
                <p>Start a new note or upload your files to get AI-powered insights.</p>
              </div>

              <div className="start-actions">
                <button 
                  className="start-btn primary" 
                  onClick={() => {
                    if (activeFile && activeFile.content === '') {
                        handleUpdateNode(activeFile.id, { content: ' ' }); // Adding space to 'bypass' the start page logic
                    } else {
                        handleCreateNode('file');
                    }
                  }}
                >
                  <Plus size={20} />
                  <span>Write New Note</span>
                </button>
                
                <div className="upload-container">
                  <button className="start-btn secondary" onClick={() => document.getElementById('file-upload').click()}>
                    <Activity size={20} />
                    <span>Upload PDF</span>
                  </button>
                  <input 
                    type="file" 
                    id="file-upload" 
                    accept=".pdf"
                    style={{display: 'none'}} 
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <div className="supported-formats">
                    <span>PDF ONLY</span>
                  </div>
                </div>
              </div>

              <div className="recent-divider">
                <span>Or select a note from the explorer</span>
              </div>
            </div>
          )
        ) : (
          activeTab === 'summarize' ? (
            <div className="summarize-landing-page fade-in" style={{ height: '100%', overflowY: 'auto', width: '100%', padding: '2rem' }}>
                {!activeSummaryId ? (
                <>
                <div className="start-hero">
                  <div className="icon-stack">
                    <Sparkles size={48} className="icon-main" />
                  </div>
                  <h1>AI Summarizer</h1>
                  <p>Generate tailored insights from YouTube or Web content.</p>
                </div>

                <div className="summarize-mode-selector">
                  <button 
                    className={`selector-card ${summarizeMode === 'text' ? 'active' : ''}`}
                    onClick={() => setSummarizeMode('text')}
                  >
                    <FileText size={32} />
                    <span>Text Summary</span>
                    <small>Concise bullet points & insights</small>
                  </button>
                  <button 
                    className={`selector-card ${summarizeMode === 'audio' ? 'active' : ''}`}
                    onClick={() => setSummarizeMode('audio')}
                  >
                    <Activity size={32} />
                    <span>Voice Narration</span>
                    <small>Narration-style script & flow</small>
                  </button>
                </div>

                <div className={`analysis-parameters ${summarizeMode ? 'fade-in' : 'hidden'}`}>
                  {summarizeMode === 'text' && (
                    <div className="setting-card full-width">
                       <label>Target Summary Length: <span className="highlighted-value">{summaryLength} words</span></label>
                       <input 
                        type="range" 
                        min="10" 
                        max="400" 
                        step="10" 
                        className="slider"
                        disabled={isAnalyzing}
                        value={summaryLength}
                        onChange={(e) => setSummaryLength(parseInt(e.target.value))}
                       />
                       <div className="slider-labels">
                         <span>Concise</span>
                         <span>Detailed</span>
                       </div>
                    </div>
                  )}

                  {summarizeMode === 'audio' && (
                    <div className="setting-card full-width">
                      <label>Max Script Duration: <span className="highlighted-value">{Math.floor(audioDuration / 60)}m {audioDuration % 60}s</span></label>
                      <input 
                        type="range" 
                        min="30" 
                        max="600" 
                        step="30" 
                        className="slider"
                        disabled={isAnalyzing}
                        value={audioDuration}
                        onChange={(e) => setAudioDuration(parseInt(e.target.value))}
                       />
                       <div className="slider-labels">
                         <span>30s</span>
                         <span>10m</span>
                       </div>
                    </div>
                  )}

                  <div className="url-analyze-section">
                    <div className="url-input-wrapper">
                      <input 
                        type="text" 
                        className="url-landing-input" 
                        id="summarize-url-input"
                        disabled={isAnalyzing}
                        placeholder="Paste YouTube Link here..."
                        onKeyPress={(e) => e.key === 'Enter' && handleUrlAnalyze(e.target.value)}
                      />
                      <button 
                        className="url-go-btn" 
                        disabled={isAnalyzing}
                        onClick={() => handleUrlAnalyze(document.getElementById('summarize-url-input').value)}
                      >
                        {isAnalyzing ? <div className="loader-mini" /> : <Sparkles size={16} />}
                        {isAnalyzing ? "Analyzing..." : "Generate Analysis"}
                      </button>
                    </div>
                    {isAnalyzing && (
                      <div className="progress-container">
                         <div className="progress-bar" style={{width: `${progress}%`}} />
                         <span className="progress-text">Deep AI Processing: {progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
                </>
                ) : (
                  <div className="latest-result-card fade-in">
                    <button className="back-btn-branded" onClick={() => { setActiveSummaryId(null); setSummarizeMode(null); }}>
                      <Plus size={16} style={{transform: 'rotate(45deg)', marginRight: '8px'}} />
                      Back to Selection / العودة للاختيار
                    </button>
                    <div className="result-header">
                      <div className="result-meta">
                        <h3>
                          {summaries.find(s => s.id === activeSummaryId)?.mode === 'text' ? <FileText size={18} /> : <Activity size={18} />}
                          {summaries.find(s => s.id === activeSummaryId)?.title}
                        </h3>
                      </div>
                      <button className="copy-btn" onClick={() => {
                        const s = summaries.find(ss => ss.id === activeSummaryId);
                        if(s) navigator.clipboard.writeText(s.summary);
                      }}>Copy Content</button>
                    </div>
                    
                    {summaries.find(s => s.id === activeSummaryId)?.mode === 'text' ? (
                      <div className="result-content markdown-body">
                        {summaries.find(s => s.id === activeSummaryId)?.summary}
                      </div>
                    ) : (
                      <div className="voice-script-placeholder">
                        <Activity size={64} className="icon-large" />
                        <h2>Voice Narration Ready</h2>
                        <p>The AI is currently presenting this as a vocal script. You can listen to the narration below or copy the script if needed.</p>
                        
                        {(isPlayingVoice || audioProgress > 0) && (
                          <div className="audio-tracker">
                            <div className="progress-labels">
                               <span>{isPlayingVoice ? "Narrating..." : "Playback Ready"}</span>
                               <span>{Math.round(audioProgress)}%</span>
                            </div>
                            <div className="audio-progress-bg">
                              <div className="audio-progress-fill" style={{width: `${audioProgress}%`}}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {summaries.find(s => s.id === activeSummaryId)?.mode === 'audio' && (
                      <div className="voice-footer">
                        <button 
                          className={`play-voice-btn ${isPlayingVoice ? 'playing' : ''}`} 
                          onClick={() => {
                             if (isPlayingVoice) stopVoice();
                             else playVoice(summaries.find(s => s.id === activeSummaryId)?.summary);
                          }}
                        >
                          {isPlayingVoice ? <Pause size={18} /> : <Play size={18} />}
                          {isPlayingVoice ? "Stop Narration" : "Listen to Script"}
                        </button>
                        <button 
                          className="play-voice-btn secondary" 
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                          onClick={() => {
                             setActiveSummaryId(null);
                             setSummarizeMode(null);
                          }}
                        >
                          <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
                          New Analysis / تحليل جديد
                        </button>
                        <button 
                          className="play-voice-btn" 
                          style={{ background: 'rgba(94, 106, 210, 0.1)', color: 'var(--accent)', marginLeft: 'auto' }}
                          onClick={() => {
                             const s = summaries.find(ss => ss.id === activeSummaryId);
                             if(s) {
                               navigator.clipboard.writeText(s.summary);
                               // Optional: Add a toast or alert if needed
                             }
                          }}
                        >
                          <Copy size={18} />
                          Copy Script / نسخ النص
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="summarized-history">
                  <h3>Summary List</h3>
                  <div className="history-list">
                    {summaries.map(s => (
                      <div 
                        key={s.id} 
                        className={`history-item ${activeSummaryId === s.id ? 'active' : ''}`}
                        onClick={() => setActiveSummaryId(s.id)}
                      >
                        <div className="history-info-group">
                          {s.mode === 'text' ? <FileText size={16} /> : <Activity size={16} />}
                          <div className="history-text">
                            <span>{s.title}</span>
                            <small>{s.mode === 'text' ? 'Summary' : 'Voice Script'} • {new Date(s.timestamp).toLocaleTimeString()}</small>
                          </div>
                        </div>
                        <div className="history-actions">
                           <button className="del-btn" onClick={(e) => { e.stopPropagation(); handleDeleteSummary(s.id); if(activeSummaryId === s.id) setActiveSummaryId(null); }}>
                             <Plus size={16} style={{transform: 'rotate(45deg)'}} />
                           </button>
                        </div>
                      </div>
                    ))}
                    {summaries.length === 0 && (
                      <div className="empty-history">No past results yet. / لا توجد نتائج سابقة.</div>
                    )}
                  </div>
                </div>
            </div>
          ) : activeTab === 'tasks' ? (
            <div className="tasks-page fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto', width: '100%' }}>
              <div className="start-hero">
                <div className="icon-stack">
                  <CheckSquare size={48} className="icon-main" />
                </div>
                <h1>Task Generator</h1>
                <p>Paste text below to automatically extract actionable tasks using AI.</p>
              </div>

              <div className="setting-card full-width" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Paste text or extract from PDF:</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <button 
                       className="start-btn secondary" 
                       style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', margin: 0 }}
                       onClick={() => document.getElementById('task-file-upload').click()}
                       disabled={isUploadingTaskFile}
                     >
                       {isUploadingTaskFile ? <div className="loader-mini" style={{ width: 16, height: 16 }} /> : <Activity size={16} />}
                       <span>{isUploadingTaskFile ? "Extracting..." : "Upload PDF"}</span>
                     </button>
                     <input 
                       type="file" 
                       id="task-file-upload" 
                       accept=".pdf"
                       style={{display: 'none'}} 
                       onChange={(e) => handleTaskFileUpload(e.target.files)}
                     />
                   </div>
                </div>
                <textarea 
                  className="task-input-textarea"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Paste your text here to extract tasks..."
                  style={{ width: '100%', minHeight: '300px', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginBottom: '1rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
                <button 
                  className="start-btn primary"
                  onClick={handleGenerateTasks}
                  disabled={isGeneratingTasks || !taskInput}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {isGeneratingTasks ? <div className="loader-mini" /> : <Sparkles size={20} />}
                  <span>{isGeneratingTasks ? "Extracting Tasks..." : "Generate Tasks"}</span>
                </button>
              </div>

              {generatedTasks && (
                <div className="latest-result-card fade-in" style={{ marginTop: '2rem' }}>
                  <div className="result-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                     <div className="result-meta">
                       <h3><CheckSquare size={18} /> Generated Tasks</h3>
                     </div>
                     <div className="task-export-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="icon-btn small" onClick={() => handleSaveAsNote(generatedTasks)}>
                          <FileText size={14} /> Save as Note
                        </button>
                        <button className="icon-btn small" onClick={() => handleExportNotion(generatedTasks)} disabled={isExportingNotion}>
                          <Database size={14} color="#000000" /> {isExportingNotion ? 'Saving...' : 'To Notion'}
                        </button>
                        <button className="icon-btn small" onClick={() => handleExportGCal(generatedTasks)}>
                          <Calendar size={14} color="#3B82F6" /> To Google Calendar
                        </button>
                        <button className="icon-btn small" onClick={() => handleExportTrello(generatedTasks)} disabled={isExportingTrello}>
                          <Kanban size={14} color="#0079BF" /> {isExportingTrello ? 'Saving...' : 'To Trello'}
                        </button>
                        <button className="icon-btn small" onClick={() => handleExportObsidian(generatedTasks)}>
                          <Hexagon size={14} color="#7C3AED" /> To Obsidian
                        </button>
                     </div>
                  </div>
                  <div className="result-content markdown-body" style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
                    {generatedTasks}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'dashboard' ? (
            <Dashboard 
              nodes={nodes} 
              calendarEvents={calendarEvents} 
              summaries={summaries} 
              setActiveTab={setActiveTab} 
              handleCreateNode={handleCreateNode} 
            />
          ) : (
            <div className="empty-state fade-in">
              <h2 style={{textTransform: 'capitalize'}}>{activeTab}</h2>
              <p>This module is coming soon. / قريباً.</p>
            </div>
          )
        )}
      </div>

      {settingsModal.isOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal-content fade-in" style={{ background: 'var(--bg-primary)', borderRadius: '12px', width: '700px', display: 'flex', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', minHeight: '400px' }}>
            
            <div className="settings-sidebar" style={{ width: '220px', background: 'var(--bg-secondary)', padding: '1.5rem', borderRight: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20} /> Settings</h3>
              
              <div 
                style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', background: settingsModal.tab === 'ai' ? 'var(--accent-color)' : 'transparent', color: settingsModal.tab === 'ai' ? '#fff' : 'var(--text-primary)' }}
                onClick={() => setSettingsModal({ ...settingsModal, tab: 'ai' })}
              >
                <Sparkles size={16} /> AI Provider
              </div>
              <div 
                style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', background: settingsModal.tab === 'notion' ? 'var(--accent-color)' : 'transparent', color: settingsModal.tab === 'notion' ? '#fff' : 'var(--text-primary)' }}
                onClick={() => setSettingsModal({ ...settingsModal, tab: 'notion' })}
              >
                <Database size={16} /> Notion
              </div>
              <div 
                style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', background: settingsModal.tab === 'trello' ? 'var(--accent-color)' : 'transparent', color: settingsModal.tab === 'trello' ? '#fff' : 'var(--text-primary)' }}
                onClick={() => setSettingsModal({ ...settingsModal, tab: 'trello' })}
              >
                <Kanban size={16} /> Trello
              </div>
              <div 
                style={{ padding: '0.75rem', cursor: 'pointer', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', background: settingsModal.tab === 'gcal' ? 'var(--accent-color)' : 'transparent', color: settingsModal.tab === 'gcal' ? '#fff' : 'var(--text-primary)' }}
                onClick={() => setSettingsModal({ ...settingsModal, tab: 'gcal' })}
              >
                <Calendar size={16} /> Google Calendar
              </div>
            </div>
            
            <div className="settings-body" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              
              {settingsModal.tab === 'ai' && (
                <div className="fade-in" style={{ flex: 1 }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={20} /> AI Settings <HelpCircle size={15} color="var(--text-secondary)" title="Choose an AI Provider. For Google Gemini, obtain a free API key from Google AI Studio." style={{ cursor: 'help' }} /></h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Choose between local processing (Ollama) or public cloud API (Google Gemini).</p>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>AI Provider</label>
                    <select 
                      value={aiProvider} 
                      onChange={(e) => setAiProvider(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="local">Local (Ollama / Gemma 4)</option>
                      <option value="gemini">Public (Google Gemini)</option>
                    </select>
                  </div>
                  
                  {aiProvider === 'gemini' && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Google Gemini API Key</label>
                      <input 
                        type="password" 
                        value={aiApiKey} 
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'auto', paddingTop: '1.5rem' }}>
                    <button className="icon-btn" onClick={() => setSettingsModal({ ...settingsModal, isOpen: false })}>Cancel</button>
                    <button className="start-btn primary" onClick={handleAiSettingsModalSubmit} style={{ padding: '0.5rem 1rem' }}>Save Settings</button>
                  </div>
                </div>
              )}

              {settingsModal.tab === 'notion' && (
                <div className="fade-in" style={{ flex: 1 }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={20} /> Notion Configuration <HelpCircle size={15} color="var(--text-secondary)" title="Create an Integration at notion.so/my-integrations to get an API Key. Copy the database ID from your Notion URL (the 32 character string before '?v=') to use as Data Source ID." style={{ cursor: 'help' }} /></h3>
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
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'auto', paddingTop: '1.5rem' }}>
                    <button className="icon-btn" onClick={() => setSettingsModal({ ...settingsModal, isOpen: false })}>Cancel</button>
                    <button className="start-btn primary" onClick={handleNotionModalSubmit} disabled={!notionApiKey || !notionDataSourceId} style={{ padding: '0.5rem 1rem' }}>Save & Export</button>
                  </div>
                </div>
              )}

              {settingsModal.tab === 'trello' && (
                <div className="fade-in" style={{ flex: 1 }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Kanban size={20} /> Trello Configuration <HelpCircle size={15} color="var(--text-secondary)" title="Go to trello.com/app-key to get your API Key and Token. The List ID can be the board URL or the direct ID of the List." style={{ cursor: 'help' }} /></h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Configure Trello to export your tasks.</p>
                  
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
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>List ID (Or Board URL)</label>
                    <input 
                      type="text" 
                      value={trelloListId} 
                      onChange={(e) => setTrelloListId(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'auto', paddingTop: '1.5rem' }}>
                    <button className="icon-btn" onClick={() => setSettingsModal({ ...settingsModal, isOpen: false })}>Cancel</button>
                    <button className="start-btn primary" onClick={handleTrelloModalSubmit} disabled={!trelloApiKey || !trelloToken || !trelloListId} style={{ padding: '0.5rem 1rem' }}>Save & Export</button>
                  </div>
                </div>
              )}

              {settingsModal.tab === 'gcal' && (
                <div className="fade-in" style={{ flex: 1 }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={20} /> Google Calendar Config <HelpCircle size={15} color="var(--text-secondary)" title="Go to Google Cloud Console, create an OAuth 2.0 Client ID for Web Application, and copy the Client ID." style={{ cursor: 'help' }} /></h3>
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
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: 'auto', paddingTop: '1.5rem' }}>
                    <button className="icon-btn" onClick={() => setSettingsModal({ ...settingsModal, isOpen: false })}>Cancel</button>
                    <button className="start-btn primary" onClick={handleGCalModalSubmit} disabled={!gcalClientId} style={{ padding: '0.5rem 1rem' }}>Save & Connect</button>
                  </div>
                </div>
              )}

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
  );
}

export default App;
