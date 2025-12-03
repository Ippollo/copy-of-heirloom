
import React, { useState, useEffect, useRef } from 'react';
import { JournalEntry } from '../types';
import { Calendar, Play, Pause, Trash2, Tag, Share2, Loader2, ChevronDown, ChevronUp, MapPin, Image as ImageIcon, Palette, Maximize2, X, RefreshCw, Plus, MoreVertical, Edit2, Save, Camera, Upload, Bold, Italic, List, Map, Mic, Check, ArrowRight, Lightbulb, Clock, Compass, Eye, HelpCircle, FileText } from 'lucide-react';
import { getEntryAudio, getEntryImage, saveEntry, deleteEntryImage, deleteEntry } from '../services/dbService';
import { generateMemoryScape, editEntryImage, lookupLocation } from '../services/geminiService';

interface EntryListProps {
  entries: JournalEntry[];
  onEntryDeleted: (id: string) => void;
  onEntryUpdated?: (entry: JournalEntry) => void;
  autoExpandId?: string | null;
}

interface EditableTextProps {
    value: string;
    onSave: (val: string) => void;
    className?: string;
    placeholder?: string;
    multiline?: boolean;
    as?: 'h3' | 'p' | 'div' | 'span';
    inputType?: string;
    isRichText?: boolean;
    showToolbar?: boolean;
}

const EditableText: React.FC<EditableTextProps> = ({ 
    value, 
    onSave, 
    className, 
    placeholder, 
    multiline, 
    as = 'p', 
    inputType = 'text',
    isRichText = false,
    showToolbar = false 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const [formats, setFormats] = useState({ bold: false, italic: false, list: false });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setLocalValue(value); }, [value]);
    
    // Auto-resize for textarea
    useEffect(() => { 
        if (isEditing && textareaRef.current && !isRichText) { 
            textareaRef.current.style.height = 'auto'; 
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; 
        } 
    }, [localValue, isEditing, isRichText]);

    const handleBlur = () => { 
        setTimeout(() => { 
            setIsEditing(false); 
            // For rich text, we grab innerHTML on save if using div, otherwise localValue is synced
            const valToSave = isRichText && divRef.current ? divRef.current.innerHTML : localValue;
            if (valToSave !== value) onSave(valToSave); 
        }, 200); 
    };

    const handleKeyDown = (e: React.KeyboardEvent) => { 
        if (!multiline && !isRichText && e.key === 'Enter') { 
            e.preventDefault(); 
            setIsEditing(false); 
            if (localValue !== value) onSave(localValue); 
        }
        checkFormats(); 
    };

    // Rich Text Formatters
    const checkFormats = () => {
        if (!isRichText) return;
        setFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            list: document.queryCommandState('insertUnorderedList')
        });
    };

    const execFormat = (command: string) => {
        document.execCommand(command, false);
        if (divRef.current) {
            divRef.current.focus();
            checkFormats();
        }
    };

    if (isEditing) {
        if (isRichText) {
            return (
                <div className="w-full relative">
                    {showToolbar && (
                        <div className="absolute -top-10 left-0 bg-white border border-paper-300 rounded-lg shadow-lg flex items-center p-1 gap-1 z-10 animate-in fade-in slide-in-from-bottom-2">
                            <button onMouseDown={(e) => { e.preventDefault(); execFormat('bold'); }} className={`p-1.5 rounded transition-colors ${formats.bold ? 'bg-paper-200 text-brand-800' : 'hover:bg-paper-100 text-gray-600'}`} title="Bold"><Bold className="w-4 h-4" /></button>
                            <button onMouseDown={(e) => { e.preventDefault(); execFormat('italic'); }} className={`p-1.5 rounded transition-colors ${formats.italic ? 'bg-paper-200 text-brand-800' : 'hover:bg-paper-100 text-gray-600'}`} title="Italic"><Italic className="w-4 h-4" /></button>
                            <button onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList'); }} className={`p-1.5 rounded transition-colors ${formats.list ? 'bg-paper-200 text-brand-800' : 'hover:bg-paper-100 text-gray-600'}`} title="List"><List className="w-4 h-4" /></button>
                        </div>
                    )}
                    <div
                        ref={divRef}
                        contentEditable
                        onBlur={handleBlur}
                        onMouseUp={checkFormats}
                        onKeyUp={checkFormats}
                        onInput={checkFormats}
                        dangerouslySetInnerHTML={{__html: localValue}}
                        className={`w-full bg-white border border-paper-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-200 outline-none shadow-sm text-brand-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${className}`}
                        style={{ minHeight: '100px' }}
                    />
                </div>
            );
        }

        return (
            <div className="w-full relative">
                {multiline ? (
                    <textarea ref={textareaRef} value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={handleBlur} autoFocus placeholder={placeholder} className={`w-full bg-white border border-paper-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-200 outline-none resize-none shadow-sm text-brand-900 ${className}`} style={{ minHeight: '100px' }} />
                ) : (
                    <input 
                        type={inputType} 
                        value={localValue} 
                        onChange={e => setLocalValue(e.target.value)} 
                        onBlur={handleBlur} 
                        onKeyDown={handleKeyDown} 
                        autoFocus 
                        placeholder={placeholder} 
                        style={{ colorScheme: 'light' }}
                        className={`w-full bg-white border border-paper-300 rounded px-2 py-1 focus:ring-2 focus:ring-brand-200 outline-none shadow-sm text-brand-900 ${inputType === 'datetime-local' ? '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100' : ''} ${className}`} 
                    />
                )}
            </div>
        );
    }

    const TagName = as as any;
    let displayContent: React.ReactNode = value;
    
    if (isRichText) {
        displayContent = value ? <div dangerouslySetInnerHTML={{__html: value}} /> : <div className="text-gray-300 italic select-none">{placeholder}</div>;
    } else {
        displayContent = value || <span className="text-gray-300 italic select-none">{placeholder}</span>;
        if (inputType === 'datetime-local' && value) displayContent = new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    return <TagName onClick={() => setIsEditing(true)} className={`cursor-text hover:bg-paper-50 rounded -mx-1 px-1 border border-transparent hover:border-paper-300 transition-all duration-200 ${isRichText ? '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5' : ''} ${className}`}>{displayContent}</TagName>;
};

const getInsightIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'philosophy': return <Lightbulb className="w-3.5 h-3.5" />;
        case 'memory': return <Clock className="w-3.5 h-3.5" />;
        case 'advice': return <Compass className="w-3.5 h-3.5" />;
        case 'observation': return <Eye className="w-3.5 h-3.5" />;
        case 'question': return <HelpCircle className="w-3.5 h-3.5" />;
        default: return <Lightbulb className="w-3.5 h-3.5" />;
    }
};

const EditableEntryCard: React.FC<{ entry: JournalEntry; onEntryDeleted: (id: string) => void; onEntryUpdated: (entry: JournalEntry) => void; defaultExpanded: boolean; autoScroll?: boolean; }> = ({ entry, onEntryDeleted, onEntryUpdated, defaultExpanded, autoScroll }) => {
    const [isCardExpanded, setIsCardExpanded] = useState(defaultExpanded);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false); 
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isGeneratingArt, setIsGeneratingArt] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [promptMode, setPromptMode] = useState(false);
    const [imagePrompt, setImagePrompt] = useState("");
    const [audioDuration, setAudioDuration] = useState(entry.duration || 0);
    const [currentTime, setCurrentTime] = useState(0);
    const [confirmEntryDelete, setConfirmEntryDelete] = useState(false);
    const [confirmImageDelete, setConfirmImageDelete] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTag, setNewTag] = useState("");
    const [isLookingUpLocation, setIsLookingUpLocation] = useState(false);

    useEffect(() => { 
        if (autoScroll) {
            setTimeout(() => {
                document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
        loadImage(); 
    }, []);
    
    useEffect(() => { loadImage(); }, [entry.snapshotBlob, entry.generatedImageBlob]);
    useEffect(() => { if (defaultExpanded) setIsCardExpanded(true); }, [defaultExpanded]);
    useEffect(() => { return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } stopCamera(); }; }, []);

    const formatTime = (seconds: number) => { if (!seconds || isNaN(seconds)) return "00:00"; const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
    const startCamera = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); streamRef.current = stream; setIsCameraOpen(true); } catch (err: any) { alert("Could not access camera"); } };
    const stopCamera = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; } setIsCameraOpen(false); };
    const takePhoto = () => { if (videoRef.current) { const canvas = document.createElement('canvas'); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; const ctx = canvas.getContext('2d'); if (ctx) { ctx.drawImage(videoRef.current, 0, 0); canvas.toBlob((blob) => { if (blob) { const updated = { ...entry, snapshotBlob: blob, generatedImageBlob: undefined }; saveEntry(updated); onEntryUpdated(updated); setImageUrl(URL.createObjectURL(blob)); stopCamera(); } }, 'image/jpeg', 0.8); } } };
    const loadImage = async () => { try { let blob = entry.snapshotBlob || entry.generatedImageBlob; if (!blob) blob = await getEntryImage(entry.id, 'snapshot'); if (!blob) blob = await getEntryImage(entry.id, 'art'); if (blob) { if (imageUrl) URL.revokeObjectURL(imageUrl); setImageUrl(URL.createObjectURL(blob)); } else { setImageUrl(null); } } catch (e) { } };
    const updateField = async (field: keyof JournalEntry, value: any) => { let finalValue = value; if (field === 'createdAt' && typeof value === 'string') finalValue = new Date(value).getTime(); const updated = { ...entry, [field]: finalValue }; await saveEntry(updated); onEntryUpdated(updated); };
    const handleLocationSave = async (val: string) => { if (!val.trim()) { await updateField('location', undefined); return; } const tempLocation = { ...entry.location, name: val, latitude: entry.location?.latitude || 0, longitude: entry.location?.longitude || 0 }; await updateField('location', tempLocation); setIsLookingUpLocation(true); try { const result = await lookupLocation(val); if (result) { const finalLocation = { name: result.name, address: result.address, latitude: entry.location?.latitude || 0, longitude: entry.location?.longitude || 0 }; await updateField('location', finalLocation); } } catch (e) { } finally { setIsLookingUpLocation(false); } };
    const handleShare = async () => { const textToShare = `${entry.title}\n\n${entry.summary || ''}\n\n${entry.transcription}`; if (navigator.share) try { await navigator.share({ title: entry.title, text: textToShare }); } catch (e) { } else try { await navigator.clipboard.writeText(textToShare); alert("Copied to clipboard."); } catch (err) { } };
    const handleDelete = async (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (!confirmEntryDelete) { setConfirmEntryDelete(true); setTimeout(() => setConfirmEntryDelete(false), 3000); return; } setIsMenuOpen(false); try { await deleteEntry(entry.id); onEntryDeleted(entry.id); } catch (err) { alert("Could not delete entry."); } };
    const toggleAudio = async (e?: React.MouseEvent) => { e?.stopPropagation(); if (isPlaying && audioRef.current) { audioRef.current.pause(); setIsPlaying(false); return; } if (audioRef.current) { audioRef.current.play(); setIsPlaying(true); return; } try { let blob = entry.audioBlob; if (!blob) blob = await getEntryAudio(entry.id); if (!blob) { alert("No audio recording found."); return; } const url = URL.createObjectURL(blob); const audio = new Audio(url); audioRef.current = audio; audio.addEventListener('loadedmetadata', () => { if(audio.duration !== Infinity && !isNaN(audio.duration)) setAudioDuration(audio.duration); }); audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime)); audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0); }); await audio.play(); setIsPlaying(true); } catch (err) { alert("Could not play audio."); } };
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { const time = parseFloat(e.target.value); setCurrentTime(time); if (audioRef.current) audioRef.current.currentTime = time; };
    const handleModifyImage = async () => { if (!imagePrompt.trim()) { handleGenerateArt(); return; } setIsGeneratingArt(true); setPromptMode(false); try { let blob = entry.snapshotBlob || entry.generatedImageBlob; if (!blob) blob = await getEntryImage(entry.id, 'snapshot'); if (!blob) blob = await getEntryImage(entry.id, 'art'); if (blob) { const newBlob = await editEntryImage(blob, imagePrompt); const updated = { ...entry, generatedImageBlob: newBlob }; await saveEntry(updated); onEntryUpdated(updated); setImageUrl(URL.createObjectURL(newBlob)); } else { const newBlob = await generateMemoryScape(entry, imagePrompt); const updated = { ...entry, generatedImageBlob: newBlob }; await saveEntry(updated); onEntryUpdated(updated); setImageUrl(URL.createObjectURL(newBlob)); } } catch(e) { alert("Failed to modify image."); } finally { setIsGeneratingArt(false); setImagePrompt(""); } };
    const handleGenerateArt = async () => { setIsGeneratingArt(true); try { const blob = await generateMemoryScape(entry); const updated = { ...entry, generatedImageBlob: blob }; await saveEntry(updated); onEntryUpdated(updated); setImageUrl(URL.createObjectURL(blob)); } catch (e) { alert("Art generation failed."); } finally { setIsGeneratingArt(false); } };
    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const updated = { ...entry, snapshotBlob: file, generatedImageBlob: undefined }; await saveEntry(updated); onEntryUpdated(updated); setImageUrl(URL.createObjectURL(file)); } if (e.target) e.target.value = ''; };
    const handleDeleteImage = async (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (!confirmImageDelete) { setConfirmImageDelete(true); setTimeout(() => setConfirmImageDelete(false), 3000); return; } setImageUrl(null); setConfirmImageDelete(false); try { await deleteEntryImage(entry.id, 'art'); await deleteEntryImage(entry.id, 'snapshot'); const updated = { ...entry, generatedImageBlob: undefined, snapshotBlob: undefined }; await saveEntry(updated); onEntryUpdated(updated); } catch(e) {} };
    const handleTagAdd = async () => { if (newTag.trim()) { const newTags = [...entry.tags, newTag.trim()]; await updateField('tags', newTags); } setNewTag(""); setIsAddingTag(false); };
    const handleInsightUpdate = async (index: number, newTitle: string, newContent: string) => { const newInsights = [...entry.insights]; newInsights[index] = { ...newInsights[index], title: newTitle, content: newContent }; await updateField('insights', newInsights); };
    const handleInsightDelete = async (index: number) => { const newInsights = entry.insights.filter((_, i) => i !== index); await updateField('insights', newInsights); };

    const dateInputValue = new Date(entry.createdAt).toISOString().slice(0, 16);
    const dateDisplay = new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const handleExpandCard = () => {
        setIsCardExpanded(true);
        setTimeout(() => {
            document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    if (!isCardExpanded) {
        return (
            <div id={`entry-${entry.id}`} onClick={handleExpandCard} className="bg-white p-5 rounded-2xl border border-paper-200 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-paper-300 relative">
               <div className="flex justify-between items-center">
                   <div className="flex-1 min-w-0 pr-4">
                       <div className="flex items-center gap-2 mb-1.5"><span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">{dateDisplay}</span>{entry.mood && <span className="px-2 py-0.5 bg-paper-100 text-brand-600 rounded-full text-[10px] font-bold uppercase border border-paper-200">{entry.mood}</span>}</div>
                       <h3 className="text-lg font-serif font-bold text-brand-900 truncate">{entry.title || "Untitled Memory"}</h3>
                       {/* Render preview safely stripping tags if needed or just showing raw text if simple */}
                       <div className="text-xs text-brand-500 line-clamp-1 mt-1 font-medium" dangerouslySetInnerHTML={{__html: entry.summary || entry.transcription}}></div>
                   </div>
                   <div className="flex items-center gap-3">{(entry.inputType === 'audio' || !entry.inputType) && <div className="p-2 rounded-full bg-paper-100 text-brand-400"><Mic className="w-4 h-4" /></div>}{imageUrl && <div className="w-10 h-10 rounded-lg bg-paper-100 bg-cover bg-center border border-paper-200" style={{backgroundImage: `url(${imageUrl})`}} />}<ChevronDown className="w-5 h-5 text-brand-300 group-hover:text-brand-500 transition-colors" /></div>
               </div>
            </div>
        );
    }

    return (
        <>
        {isCameraOpen && <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300"><video ref={(el) => { videoRef.current = el; if(el && streamRef.current) el.srcObject = streamRef.current; }} autoPlay playsInline muted className="flex-1 w-full h-full object-cover" /><div className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between pb-12"><button onClick={stopCamera} className="text-white p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors"><X className="w-8 h-8" /></button><button onClick={takePhoto} className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-all active:scale-95 shadow-2xl"></button><div className="w-16"></div></div></div>}
        <div id={`entry-${entry.id}`} className="bg-white rounded-2xl shadow-lg border-2 border-paper-300 overflow-hidden transition-all duration-300 group/card relative animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-paper-100 border-b border-paper-200 flex justify-between items-center sticky top-0 z-40">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-400" /><EditableText value={dateInputValue} inputType="datetime-local" onSave={(val) => updateField('createdAt', val)} className="text-xs font-bold text-brand-500 uppercase tracking-widest bg-transparent" /></div>
                <div className="flex items-center gap-2"><button onClick={() => setIsCardExpanded(false)} className="p-1.5 text-brand-400 hover:text-brand-600 rounded-full hover:bg-paper-200 transition-colors" title="Collapse"><ChevronUp className="w-5 h-5" /></button><div className="relative"><button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-1.5 text-brand-300 hover:text-brand-600 rounded-full transition-colors"><MoreVertical className="w-4 h-4" /></button>{isMenuOpen && <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-paper-200 z-50 overflow-hidden animate-in fade-in zoom-in-95"><button type="button" onClick={() => { handleShare(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-brand-600 hover:bg-paper-50 flex items-center gap-2"><Share2 className="w-3 h-3" /> Share</button><button type="button" onClick={handleDelete} className={`w-full text-left px-4 py-3 text-xs font-bold flex items-center gap-2 border-t border-paper-100 transition-colors ${confirmEntryDelete ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}>{confirmEntryDelete ? <><Check className="w-3 h-3" /> Confirm Delete?</> : <><Trash2 className="w-3 h-3" /> Delete Entry</>}</button></div>}</div></div>
            </div>
            <div className="p-6 md:p-8 flex flex-col gap-6">
                <div className="flex items-start justify-between gap-4"><EditableText as="h3" value={entry.title} onSave={(val) => updateField('title', val)} className="text-2xl md:text-3xl font-serif font-bold text-brand-900 leading-tight flex-1" placeholder="Untitled Memory" /></div>
                {(entry.inputType === 'audio' || !entry.inputType) && <div className="p-3 bg-paper-50 rounded-xl border border-paper-200 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 shadow-sm"><button onClick={toggleAudio} className="flex-shrink-0 w-12 h-12 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition-all shadow-md active:scale-95">{isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}</button><div className="flex-1 flex flex-col justify-center gap-1"><input type="range" min="0" max={audioDuration || 100} value={currentTime} onChange={handleSeek} className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400" /><div className="flex justify-between text-[10px] font-bold text-brand-400 uppercase tracking-widest px-1"><span>{formatTime(currentTime)}</span><span>{formatTime(audioDuration)}</span></div></div></div>}
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="md:w-[280px] flex-shrink-0 flex flex-col gap-4">
                        <div className="w-full flex flex-col gap-2">
                            <div className="w-full h-48 bg-paper-50 rounded-xl overflow-hidden border border-paper-200 relative group/image shadow-sm">
                                {isGeneratingArt ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20"><Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-2" /><span className="text-xs font-bold text-brand-500">Creating...</span></div> : imageUrl ? <img src={imageUrl} alt="Memory" className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLightboxOpen(true)} /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-brand-300 gap-2 hover:bg-paper-100/50 transition-colors cursor-pointer group/empty" onClick={handleGenerateArt}><div className="p-3 bg-white rounded-full shadow-sm group-hover/empty:scale-110 transition-transform mb-1"><Palette className="w-6 h-6 text-brand-400" /></div><span className="text-[10px] font-bold uppercase tracking-wide">Generate Art</span><div className="flex gap-2 mt-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}><button onClick={startCamera} className="p-1.5 bg-white border border-paper-200 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors" title="Take Photo"><Camera className="w-4 h-4" /></button><button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-white border border-paper-200 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors" title="Upload Photo"><Upload className="w-4 h-4" /></button></div></div>}
                                {promptMode && <div className="absolute inset-x-0 bottom-0 bg-white p-3 border-t border-paper-200 z-50 animate-in slide-in-from-bottom-2 shadow-lg"><div className="flex gap-2"><input value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="e.g. 'Add a cat'" className="flex-1 text-xs border border-paper-200 rounded px-2 py-1 outline-none focus:border-brand-500 text-brand-900 placeholder:text-brand-300 bg-white" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleModifyImage()} /><button onClick={handleModifyImage} className="p-1.5 bg-brand-600 text-white rounded hover:bg-brand-700"><ArrowRight className="w-3 h-3" /></button></div></div>}
                            </div>
                            {imageUrl && <div className="flex items-center justify-between bg-paper-50/50 p-2 rounded-lg border border-paper-200"><div className="flex gap-2"><button onClick={() => setPromptMode(!promptMode)} className={`p-1.5 rounded-md transition-colors ${promptMode ? 'bg-brand-200 text-brand-800' : 'hover:bg-white text-brand-500'}`} title="Edit with AI"><RefreshCw className="w-4 h-4" /></button><button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-white text-brand-500 rounded-md transition-colors" title="Upload"><Upload className="w-4 h-4" /></button><button onClick={startCamera} className="p-1.5 hover:bg-white text-brand-500 rounded-md transition-colors" title="Take Photo"><Camera className="w-4 h-4" /></button></div><button type="button" onClick={handleDeleteImage} className={`p-1.5 rounded-md transition-colors ${confirmImageDelete ? 'bg-red-500 text-white hover:bg-red-600' : 'hover:bg-red-50 text-brand-300 hover:text-red-500'}`} title={confirmImageDelete ? "Confirm Remove" : "Remove Image"}>{confirmImageDelete ? <Check className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}</button></div>}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleUploadImage} className="hidden" accept="image/*" />
                        <div className="space-y-3">
                             <div className="flex flex-col gap-1 text-xs font-medium text-brand-500 bg-paper-50/50 p-2 rounded-lg border border-transparent hover:border-paper-200 transition-colors"><div className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-2 text-brand-400 flex-shrink-0" /><div className="flex-1"><EditableText value={entry.location?.name || entry.location?.address || ""} onSave={handleLocationSave} placeholder="Add Location" className="bg-transparent w-full" /></div>{isLookingUpLocation && <Loader2 className="w-3 h-3 text-brand-300 animate-spin ml-1" />}</div>{(entry.location?.name || entry.location?.address) && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${entry.location.name} ${entry.location.address || ''}`)}`} target="_blank" rel="noopener noreferrer" className="ml-5 text-[10px] text-brand-400 hover:text-brand-600 hover:underline flex items-center gap-1"><Map className="w-3 h-3" /> View on Map</a>}</div>
                            <div className="flex flex-wrap gap-2">{entry.tags.map(tag => <span key={tag} className="flex items-center text-[10px] font-bold px-2 py-1 bg-white text-brand-600 rounded-md border border-paper-200 shadow-sm group/tag">{tag}<button onClick={() => { const newTags = entry.tags.filter(t => t !== tag); updateField('tags', newTags); }} className="ml-1.5 text-brand-300 hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></span>)}{isAddingTag ? <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTagAdd()} onBlur={handleTagAdd} className="w-20 text-[10px] px-2 py-1 bg-white border border-paper-200 text-brand-600 placeholder-brand-300 rounded outline-none" placeholder="Tag..." /> : <button onClick={() => setIsAddingTag(true)} className="text-[10px] font-bold px-2 py-1 bg-paper-50 border border-dashed border-paper-300 text-brand-400 rounded-md hover:border-brand-500 hover:text-brand-600 transition-colors flex items-center"><Plus className="w-3 h-3 mr-1" /> Tag</button>}</div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="mb-6 relative group/summary pl-4 border-l-2 border-brand-200"><EditableText value={entry.summary || ""} onSave={(val) => updateField('summary', val)} multiline className="text-sm md:text-base text-brand-700 italic leading-relaxed bg-transparent" placeholder="Write a summary..." /><div className="absolute top-0 right-0 opacity-0 group-hover/summary:opacity-100 transition-opacity pointer-events-none"><Edit2 className="w-3 h-3 text-brand-300" /></div></div>
                        
                        {entry.insights && entry.insights.length > 0 && <div className="grid grid-cols-1 gap-3 mb-8">
                            {entry.insights.map((insight, idx) => (
                                <div key={idx} className="group/insight p-4 rounded-xl border bg-paper-50 border-paper-200 hover:border-paper-300 transition-colors relative">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-400">
                                            {getInsightIcon(insight.type)} {insight.type}
                                        </span>
                                        <button onClick={() => handleInsightDelete(idx)} className="opacity-0 group-hover/insight:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"><X className="w-3 h-3" /></button>
                                    </div>
                                    <EditableText value={insight.title} onSave={(val) => handleInsightUpdate(idx, val, insight.content)} className="font-serif font-bold text-sm text-brand-900 mb-1 block" />
                                    <EditableText value={insight.content} onSave={(val) => handleInsightUpdate(idx, insight.title, val)} multiline className="text-xs text-brand-600 leading-relaxed block bg-transparent" />
                                </div>
                            ))}
                        </div>}

                        <div className="border-t border-paper-200 pt-6">
                            <button 
                                onClick={() => setIsTranscriptionOpen(!isTranscriptionOpen)}
                                className="w-full flex items-center justify-between text-[10px] font-bold text-brand-300 uppercase tracking-widest hover:text-brand-500 transition-colors group"
                            >
                                <span className="flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> Transcription
                                </span>
                                {isTranscriptionOpen ? <ChevronUp className="w-3 h-3 group-hover:text-brand-500" /> : <ChevronDown className="w-3 h-3 group-hover:text-brand-500" />}
                            </button>
                            
                            {isTranscriptionOpen && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                    <EditableText 
                                        as="div"
                                        value={entry.transcription} 
                                        onSave={(val) => updateField('transcription', val)} 
                                        multiline 
                                        showToolbar={true} 
                                        isRichText={true}
                                        className="text-brand-800 font-serif text-base leading-loose bg-transparent" 
                                        placeholder="Transcript..." 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {lightboxOpen && imageUrl && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLightboxOpen(false)}><button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white p-2"><X className="w-8 h-8" /></button><img src={imageUrl} alt="Full size" className="max-w-full max-h-full object-contain rounded-sm shadow-2xl" onClick={(e) => e.stopPropagation()} /></div>}
        </>
    );
};

const EntryList: React.FC<EntryListProps> = ({ entries, onEntryDeleted, onEntryUpdated, autoExpandId }) => {
  const [processingIndex, setProcessingIndex] = useState(0);
  const loadingMessages = ["Listening...", "Reflecting...", "Writing...", "Almost there..."];
  const [displayCount, setDisplayCount] = useState(10);
  
  useEffect(() => { const interval = setInterval(() => setProcessingIndex(p => (p + 1) % loadingMessages.length), 2000); return () => clearInterval(interval); }, []);
  const visibleEntries = entries.slice(0, displayCount);
  const hasMore = entries.length > displayCount;

  if (entries.length === 0) return null;

  return (
    <div className="w-full space-y-4 pb-12">
      {visibleEntries.map((entry) => {
          if (entry.isProcessing) return <div key={entry.id} className="bg-white rounded-2xl p-8 border border-paper-200 shadow-sm flex flex-col items-center justify-center text-center animate-pulse"><Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-4" /><p className="font-serif text-lg text-brand-800">{loadingMessages[processingIndex]}</p></div>;
          return <EditableEntryCard key={entry.id} entry={entry} onEntryDeleted={onEntryDeleted} onEntryUpdated={onEntryUpdated || (() => {})} defaultExpanded={entry.id === autoExpandId} autoScroll={entry.id === autoExpandId} />;
      })}
      {hasMore && <div className="flex justify-center pt-4"><button onClick={() => setDisplayCount(prev => prev + 10)} className="px-6 py-2 bg-white border border-paper-200 text-brand-600 rounded-full font-bold text-sm hover:bg-paper-50 transition-colors shadow-sm">Load More Memories</button></div>}
    </div>
  );
};

export default EntryList;
