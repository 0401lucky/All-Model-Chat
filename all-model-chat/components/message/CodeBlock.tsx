import React, { useState, useRef, useLayoutEffect } from 'react';
import { Check, ClipboardCopy, Maximize, ExternalLink, ChevronDown, ChevronUp, FileCode2 } from 'lucide-react';

const isLikelyHtml = (textContent: string): boolean => {
  if (!textContent) return false;
  const s = textContent.trim().toLowerCase();
  return s.startsWith('<!doctype html>') || (s.includes('<html') && s.includes('</html>')) || (s.startsWith('<svg') && s.includes('</svg>'));
};

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  onOpenHtmlPreview: (html: string, options?: { initialTrueFullscreen?: boolean }) => void;
}

const COLLAPSE_THRESHOLD_PX = 250;

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, onOpenHtmlPreview }) => {
    const preRef = useRef<HTMLPreElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const codeText = useRef<string>('');
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const hasUserInteracted = useRef(false);

    useLayoutEffect(() => {
        const containerElement = containerRef.current;
        if (!containerElement) return;

        const codeElement = containerElement.querySelector('code');
        if (codeElement) {
            codeText.current = codeElement.innerText;
        }

        const doesOverflow = (containerElement.querySelector('pre')?.scrollHeight ?? 0) > COLLAPSE_THRESHOLD_PX;
        setIsOverflowing(doesOverflow);
        
        if (!hasUserInteracted.current) {
            setIsExpanded(!doesOverflow);
        }
    }, [children]);

    const handleToggleExpand = () => {
        hasUserInteracted.current = true;
        setIsExpanded(prev => !prev);
    };
    
    const handleCopy = async () => {
        if (!codeText.current || copied) return;
        try {
            await navigator.clipboard.writeText(codeText.current);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const codeContent = React.Children.only(children) as React.ReactElement;
    let language = className?.replace('language-', '') || 'txt';
    let mimeType = 'text/plain';
    if (language === 'html' || language === 'xml' || language === 'svg') mimeType = 'text/html';
    else if (language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts') mimeType = 'application/javascript';
    else if (language === 'css') mimeType = 'text/css';
    else if (language === 'json') mimeType = 'application/json';
    else if (language === 'markdown' || language === 'md') mimeType = 'text/markdown';

    const likelyHTML = isLikelyHtml(codeText.current);
    const downloadMimeType = mimeType !== 'text/plain' ? mimeType : (likelyHTML ? 'text/html' : 'text/plain');
    const finalLanguage = language === 'txt' && likelyHTML ? 'html' : (language === 'xml' && likelyHTML ? 'html' : language);


    return (
        <div className="code-block-container relative group my-4 bg-[var(--markdown-pre-bg)] border border-[var(--theme-border-secondary)] rounded-lg">
            <div className='code-block-header flex items-center justify-between z-10'>
                <span className="text-xs text-[var(--theme-text-tertiary)] select-none font-mono uppercase">
                    {finalLanguage}
                </span>
                
                <div className='flex items-center gap-1 sm:gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200'>
                    {likelyHTML && (
                        <>
                            <button className="code-block-utility-button rounded-md" title="True Fullscreen Preview" onClick={() => onOpenHtmlPreview(codeText.current, { initialTrueFullscreen: true })}> <ExternalLink size={14} /> </button>
                            <button className="code-block-utility-button rounded-md" title="Modal Preview" onClick={() => onOpenHtmlPreview(codeText.current)}> <Maximize size={14} /> </button>
                        </>
                    )}
                    <button className="code-block-utility-button rounded-md" title={`Download ${finalLanguage.toUpperCase()}`} onClick={() => {
                        let filename = `snippet.${finalLanguage}`;
                        if (downloadMimeType === 'text/html') {
                            const titleMatch = codeText.current.match(/<title[^>]*>([^<]+)<\/title>/i);
                            if (titleMatch && titleMatch[1]) {
                                let saneTitle = titleMatch[1].trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
                                if (saneTitle.length > 100) saneTitle = saneTitle.substring(0, 100);
                                if (saneTitle) filename = `${saneTitle}.html`;
                            }
                        }
                        const blob = new Blob([codeText.current], { type: downloadMimeType });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }}> <FileCode2 size={14} /> </button>
                     <button className="code-block-utility-button rounded-md" title={copied ? "Copied!" : "Copy code"} onClick={handleCopy}>
                        {copied ? <Check size={14} className="text-[var(--theme-text-success)]" /> : <ClipboardCopy size={14} />}
                    </button>
                    {isOverflowing && (
                        <button onClick={handleToggleExpand} className="code-block-utility-button rounded-md" aria-expanded={isExpanded} title={isExpanded ? 'Collapse' : 'Expand'}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>
            </div>
            <div 
                ref={containerRef}
                className="overflow-hidden rounded-b-lg"
                style={{
                    maxHeight: isOverflowing && !isExpanded ? `${COLLAPSE_THRESHOLD_PX}px` : 'none',
                    transition: 'max-height 0.3s ease-in-out',
                }}
            >
                <pre ref={preRef} className={className}>
                    {codeContent}
                </pre>
            </div>
            {isOverflowing && !isExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--markdown-pre-bg)] to-transparent pointer-events-none"></div>
            )}
        </div>
    );
};
