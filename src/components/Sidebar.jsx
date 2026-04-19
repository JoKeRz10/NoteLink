import { Plus, FileText, Trash2, Search, Folder, FolderOpen, Edit2, FilePlus, FolderPlus, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';


// Recursive Node Component
function SidebarNode({ node, nodes, level, activeFileId, onSelectFile, onCreateNode, onUpdateNode, onDeleteNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.title);

  const children = nodes.filter(n => n.parentId === node.id);
  const isFolder = node.type === 'folder';

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      onUpdateNode(node.id, { title: renameValue.trim() });
    } else {
       setRenameValue(node.title);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setRenameValue(node.title);
      setIsRenaming(false);
    }
  };

  return (
    <div>
      <div 
        className={`node-row ${node.id === activeFileId ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) setIsExpanded(!isExpanded);
          else onSelectFile(node.id);
        }}
      >
        <div className="node-content">
          <span className="node-icon">
            {isFolder ? (isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />) : <FileText size={16} />}
          </span>
          {isRenaming ? (
            <input 
              autoFocus
              className="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="node-title">{node.title}</span>
          )}
        </div>
        
        <div className="node-actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" onClick={() => setIsRenaming(true)} title="Rename">
            <Edit2 size={12} />
          </button>
          {isFolder && (
            <>
              <button className="icon-btn" onClick={() => onCreateNode('file', node.id)} title="New File">
                <FilePlus size={12} />
              </button>
            </>
          )}
          <button className="icon-btn delete-btn" onClick={() => {
              if (window.confirm(`Delete ${node.title}?`)) {
                 onDeleteNode(node.id);
              }
            }} title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      
      {isFolder && isExpanded && (
        <div className="folder-children">
          {children.sort((a,b) => {
             if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
             return b.lastModified - a.lastModified;
          }).map(child => (
            <SidebarNode 
              key={child.id}
              node={child}
              nodes={nodes}
              level={level + 1}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
              onCreateNode={onCreateNode}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ nodes, activeFileId, onSelectFile, onCreateNode, onUpdateNode, onDeleteNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const response = await fetch(`http://127.0.0.1:8002/search?q=${encodeURIComponent(searchQuery)}`);
          if (response.ok) {
            const data = await response.json();
            setSearchResults(data);
          }
        } catch (err) {
          console.error("Search failed:", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const filteredNodes = searchResults;


  const rootNodes = useMemo(() => {
    if (!nodes || !Array.isArray(nodes)) return [];
    const nodeIds = new Set(nodes.map(n => n.id));
    return nodes.filter(n => !n.parentId || !nodeIds.has(n.parentId));
  }, [nodes]);


  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>Explorer</span>
        <div style={{display: 'flex', gap: '0.2rem'}}>
          <button onClick={() => onCreateNode('file', null)} className="icon-btn" title="New Note">
            <FilePlus size={16} />
          </button>
          <button onClick={() => onCreateNode('folder', null)} className="icon-btn" title="New Folder">
            <FolderPlus size={16} />
          </button>
        </div>
      </div>
      
      <div className="sidebar-search-container">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search notes..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X 
              size={14} 
              style={{ position: 'absolute', right: '8px', cursor: 'pointer', opacity: 0.5 }} 
              onClick={() => setSearchQuery('')}
            />
          )}
        </div>
      </div>

      <div className="sidebar-content">
        {searchQuery.trim() ? (
          <div className="search-results">
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Search Results
            </div>
            {isSearching ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="loader-mini" style={{ margin: '0 auto' }}></div>
              </div>
            ) : (filteredNodes && filteredNodes.length > 0) ? (
              filteredNodes.map(node => (
                node && (
                  <div 
                    key={node.id}
                    className={`node-row ${node.id === activeFileId ? 'active' : ''}`}
                    onClick={() => node.id && onSelectFile(node.id)}
                    style={{ paddingLeft: '8px' }}
                  >
                    <div className="node-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="node-icon"><FileText size={16} /></span>
                        <span className="node-title">{node.title || 'Untitled'}</span>
                      </div>
                      {node.snippet && (
                        <div 
                          className="search-snippet" 
                          dangerouslySetInnerHTML={{ __html: node.snippet }}
                          style={{ fontSize: '0.75rem', opacity: 0.6, paddingLeft: '24px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                        />
                      )}
                    </div>
                  </div>
                )
              ))
            ) : (

              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No matches found.
              </div>
            )}
          </div>
        ) : (
          rootNodes.sort((a,b) => {
               if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
               return b.lastModified - a.lastModified;
          }).map(node => (
            <SidebarNode 
              key={node.id}
              node={node}
              nodes={nodes}
              level={0}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
              onCreateNode={onCreateNode}
              onUpdateNode={onUpdateNode}
              onDeleteNode={onDeleteNode}
            />
          ))
        )}
        {!searchQuery && nodes.length === 0 && (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            No notes or folders.
          </div>
        )}
      </div>
    </div>
  );
}
