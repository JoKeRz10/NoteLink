import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, AlignLeft, Play, Square, Loader2, Link as LinkIcon, FileText } from 'lucide-react';

export default function SummarizerPanel({ isOpen, onClose, content }) {
  const [source, setSource] = useState('note');
  const [urlInput, setUrlInput] = useState('');
  const [type, setType] = useState('text');
  const [textLength, setTextLength] = useState('medium');
  const [audioDuration, setAudioDuration] = useState('1m');
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (!isOpen) handleStopAudio();
    return () => handleStopAudio();
  }, [isOpen]);

  const handleStopAudio = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const generateSummary = async () => {
    if (source === 'url' && !urlInput.trim()) {
      setSummary('Please enter an external link first. / الرجاء إدخال رابط خارجي أولاً.');
      return;
    }
    setIsGenerating(true);
    setSummary('');
    handleStopAudio();

    try {
      const contentToUse = content ? content.replace(/[#*`_~>-]/g, '').trim() : '';

      // For URL source: language is unknown (fetched externally), so tell AI to auto-detect
      // For note source: detect from the actual note content
      const isArabic = source === 'note' ? /[\u0600-\u06FF]/.test(contentToUse) : null;

      let prompt = '';

      if (source === 'url') {
        // Bilingual prompt: AI will detect language of the fetched content automatically
        if (type === 'text') {
          const lengthInstruction = textLength === 'short'
            ? 'very short (~30 words) / قصير جداً (~30 كلمة)'
            : textLength === 'detailed'
              ? 'detailed and thorough (~150 words) / مفصل (~150 كلمة)'
              : 'medium length (~75 words) / متوسط (~75 كلمة)';
          prompt = `You are an expert summarizer. Analyze the content below and detect its language automatically. Output the summary in the SAME language as the content — Arabic if Arabic, English if English.\n\nLength: [${lengthInstruction}]\nFormat: Use bullet points.\nProvide the summary directly without any introduction.`;
        } else {
          const durationInstruction = audioDuration === '30s'
            ? '~60 words / ~60 كلمة (30 seconds)'
            : audioDuration === '2m'
              ? '~260 words / ~260 كلمة (2 minutes)'
              : '~130 words / ~130 كلمة (1 minute)';
          prompt = `You are an expert audio summarizer. Analyze the content below and detect its language automatically. Output the summary in the SAME language as the content — Arabic if Arabic, English if English.\n\nLength: [${durationInstruction}]\nFormat: Use short conversational sentences. No bullet points or tables.\nProvide the text directly without any introduction.`;
        }
      } else {
        // Note source: we know the language from detection
        if (type === 'text') {
          const lengthMap = {
            short: isArabic ? 'قصير جداً (حوالي 30 كلمة)' : 'very short (about 30 words)',
            medium: isArabic ? 'متوسط (حوالي 75 كلمة)' : 'medium (about 75 words)',
            detailed: isArabic ? 'مفصل (حوالي 150 كلمة)' : 'detailed (about 150 words)',
          };
          prompt = isArabic
            ? `أنت خبير في التلخيص.\nلخص النص التالي باللغة العربية حصراً.\nالطول المطلوب: [${lengthMap[textLength]}]\nاستخدم النقاط لتسهيل القراءة.\nأعطني الملخص مباشرة بدون مقدمات.`
            : `You are an expert summarizer.\nSummarize the content EXCLUSIVELY in English.\nTarget length: [${lengthMap[textLength]}]\nUse bullet points.\nProvide summary directly without introduction.`;
        } else {
          const durationMap = {
            '30s': isArabic ? 'حوالي 60 كلمة لمدة 30 ثانية' : 'about 60 words for 30 seconds',
            '1m': isArabic ? 'حوالي 130 كلمة لمدة دقيقة' : 'about 130 words for 1 minute',
            '2m': isArabic ? 'حوالي 260 كلمة لمدة دقيقتين' : 'about 260 words for 2 minutes',
          };
          prompt = isArabic
            ? `أنت خبير في التلخيص الصوتي.\nلخص النص باللغة العربية بأسلوب حواري سلس.\nالطول المطلوب: [${durationMap[audioDuration]}]\nتجنب النقاط، استخدم جملاً سلسة.\nأعطني النص مباشرة بدون مقدمات.`
            : `You are an expert audio summarizer.\nSummarize EXCLUSIVELY in English in a conversational style.\nTarget length: [${durationMap[audioDuration]}]\nAvoid bullet points, use flowing sentences.\nProvide text directly without introduction.`;
        }
      }

      const body = source === 'url'
        ? { url: urlInput, prompt }
        : { content: contentToUse, prompt };

      const res = await fetch('http://127.0.0.1:8002/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setSummary(data.summary || 'Could not generate summary. / لم يتمكن الذكاء الاصطناعي من توليد ملخص.');
    } catch (err) {
      setSummary(`Connection error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!isGenerating && summary && type === 'audio' && !summary.includes('خطأ') && !summary.includes('الرجاء')) {
      playAudio(summary);
    }
  }, [isGenerating]);

  const playAudio = (textToRead) => {
    if (!window.speechSynthesis) { alert('متصفحك لا يدعم تحويل النص إلى صوت.'); return; }
    handleStopAudio();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    const isArabic = /[\u0600-\u06FF]/.test(textToRead);
    utterance.lang = isArabic ? 'ar-SA' : 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  if (!isOpen) return null;

  return (
    <div className="summarizer-overlay">
      <div className="summarizer-modal fade-in">
        <div className="summarizer-header">
          <div className="summarizer-title">
            <div className="ai-icon-container">✨</div>
            <h3>AI Summarizer</h3>
          </div>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="summarizer-body">
          {/* Source */}
          <div className="setting-group">
            <label>Source</label>
            <div className="segment-control">
              <button className={`segment-btn ${source === 'note' ? 'active' : ''}`} onClick={() => setSource('note')}>
                <FileText size={16} /> Current Note
              </button>
              <button className={`segment-btn ${source === 'url' ? 'active' : ''}`} onClick={() => setSource('url')}>
                <LinkIcon size={16} /> External Link
              </button>
            </div>
          </div>

          {source === 'url' && (
            <div className="setting-group fade-in">
              <label>Content URL (YouTube, article, etc.)</label>
              <input
                type="url"
                className="url-input"
                placeholder="https://www.youtube.com/watch?v=..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                dir="ltr"
              />
            </div>
          )}

          {/* Type */}
          <div className="setting-group">
            <label>Format</label>
            <div className="segment-control">
              <button className={`segment-btn ${type === 'text' ? 'active' : ''}`} onClick={() => { setType('text'); setTextLength('medium'); }}>
                <AlignLeft size={16} /> Text
              </button>
              <button className={`segment-btn ${type === 'audio' ? 'active' : ''}`} onClick={() => { setType('audio'); setAudioDuration('1m'); }}>
                <Mic size={16} /> Audio
              </button>
            </div>
          </div>

          {/* Length */}
          <div className="setting-group">
            <label>{type === 'text' ? 'Summary Length' : 'Audio Duration'}</label>
            {type === 'text' ? (
              <div className="segment-control">
                <button className={`segment-btn ${textLength === 'short' ? 'active' : ''}`} onClick={() => setTextLength('short')}>Short</button>
                <button className={`segment-btn ${textLength === 'medium' ? 'active' : ''}`} onClick={() => setTextLength('medium')}>Medium</button>
                <button className={`segment-btn ${textLength === 'detailed' ? 'active' : ''}`} onClick={() => setTextLength('detailed')}>Detailed</button>
              </div>
            ) : (
              <div className="segment-control">
                <button className={`segment-btn ${audioDuration === '30s' ? 'active' : ''}`} onClick={() => setAudioDuration('30s')}>30 Secs</button>
                <button className={`segment-btn ${audioDuration === '1m' ? 'active' : ''}`} onClick={() => setAudioDuration('1m')}>1 Min</button>
                <button className={`segment-btn ${audioDuration === '2m' ? 'active' : ''}`} onClick={() => setAudioDuration('2m')}>2 Mins</button>
              </div>
            )}
          </div>

          <button className="generate-btn" onClick={generateSummary} disabled={isGenerating}>
            {isGenerating ? (
              <><Loader2 className="spin" size={18} /> Analyzing {source === 'note' ? 'note' : 'link'}...</>
            ) : (
              <>✨ {type === 'text' ? 'Generate Summary' : 'Generate Audio'}</>
            )}
          </button>

          {/* Result */}
          <div className={`result-area ${summary ? 'show' : ''}`}>
            {type === 'audio' && summary && !isGenerating && !summary.includes('خطأ') && (
              <div className="audio-player">
                <div className="audio-info">
                  <Mic className={`audio-icon ${isPlaying ? 'pulse' : ''}`} size={24} />
                  <span>{isPlaying ? 'Playing...' : 'Audio summary ready'}</span>
                </div>
                <div className="audio-controls">
                  <button className="audio-btn" onClick={() => isPlaying ? handleStopAudio() : playAudio(summary)}>
                    {isPlaying ? <Square size={20} /> : <Play size={20} />}
                  </button>
                </div>
              </div>
            )}

            {summary && !isGenerating && (
              <div className="summary-text-box" dir="auto">
                <p>{summary}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
