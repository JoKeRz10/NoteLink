export class PluginManager {
  constructor(appContext) {
    // appContext exposes methods like { onFileOpened, onFileSaved, addRibbonIcon }
    this.appContext = appContext;
    this.plugins = [];
    this.ribbonIcons = [];
  }

  // Called by App.jsx to expose ribbon items
  getRibbonIcons() {
    return this.ribbonIcons;
  }

  addRibbonIcon(iconId, IconComponent, title, onClick) {
    this.ribbonIcons.push({
      id: iconId,
      IconComponent,
      title,
      onClick
    });
    // Trigger React re-render by calling an appContext hook if necessary
    if (this.appContext.triggerRender) {
      this.appContext.triggerRender();
    }
  }

  // Load basic initial plugins
  initializeCorePlugins() {
    // Basic "Stats" Word Count Demo Plugin
    const initWordCount = () => {
      // In a real system, plugins would probably be separate modules.
      // Here we just hook right in.
      console.log("[Plugin: WordCount] Initialized!");
      
      this.addRibbonIcon("word-count-btn", null, "Word Count Demo Plugin", () => {
         const currentFile = this.appContext.getActiveFile();
         if (currentFile && currentFile.type === 'file') {
             const words = (currentFile.content || "").split(/\s+/).filter(w => w.length > 0).length;
             alert(`Document "${currentFile.title}" contains ${words} words.`);
         } else {
             alert("No file is currently active!");
         }
      });
    };
    initWordCount();
  }
}
