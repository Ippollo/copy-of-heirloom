
import JSZip from 'jszip';
import { JournalEntry, LegacyConfig } from '../types';
import { getEntryAudio } from './dbService';

// Helper to transform "You" based summaries to Third Person for recipients
const personalizeSummaryForLegacy = (text: string | undefined, authorName: string) => {
    if (!text) return '';
    const name = authorName.trim() || "The author";
    
    let processed = text;
    // Replace "You" (case insensitive) with Name
    // Handle verbs to avoid "Name were" or "Name have"
    processed = processed.replace(/\bYou were\b/gi, `${name} was`);
    processed = processed.replace(/\bYou are\b/gi, `${name} is`);
    processed = processed.replace(/\bYou have\b/gi, `${name} has`);
    
    // General replacement for remaining "You"
    processed = processed.replace(/\bYou\b/g, name);
    processed = processed.replace(/\byou\b/g, name); // lowercase might be object
    
    // Possessives
    processed = processed.replace(/\byour\b/gi, `${name}'s`);
    processed = processed.replace(/\byours\b/gi, `${name}'s`);

    return processed;
};

const generateHtmlContent = (entries: JournalEntry[], config: LegacyConfig, authorName: string, hasDedicationAudio: boolean): string => {
  const sortedEntries = [...entries].sort((a, b) => a.createdAt - b.createdAt); // Chronological for reading

  const recipientNames = config.recipients.map(r => r.name).join(', ');
  const titleText = recipientNames ? `For ${recipientNames}` : "For You";

  const entriesHtml = sortedEntries.map(entry => {
    const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const extension = 'webm'; 
    const audioFileName = `audio/${entry.id}.${extension}`;

    const insightsHtml = entry.insights && entry.insights.length > 0 
        ? `<div class="insights-container">
             ${entry.insights.map(i => `
                <div class="insight-card insight-${i.type}">
                    <div class="insight-header">${i.type}</div>
                    <div class="insight-title">${i.title}</div>
                    <div class="insight-text">${i.content}</div>
                </div>
             `).join('')}
           </div>`
        : '';

    // Transform summary from "You felt..." to "John felt..."
    const legacySummary = personalizeSummaryForLegacy(entry.summary, authorName);

    return `
      <article class="entry">
        <header class="entry-header">
          <span class="entry-date">${dateStr}</span>
          <h2 class="entry-title">${entry.title}</h2>
          <div class="entry-meta">
            <span class="mood-tag">${entry.mood}</span>
            ${entry.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
          </div>
        </header>
        
        ${legacySummary ? `<div class="entry-summary"><strong>Summary:</strong> ${legacySummary}</div>` : ''}
        
        ${insightsHtml}

        <div class="entry-content">
          <p>${entry.transcription.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="entry-audio">
          <audio controls src="${audioFileName}"></audio>
        </div>
      </article>
    `;
  }).join('');

  const dedicationAudioHtml = hasDedicationAudio 
    ? `<div class="audio-dedication">
         <p class="audio-label">Voice Note from ${authorName}:</p>
         <audio controls src="dedication.webm"></audio>
       </div>` 
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Journal of ${authorName}</title>
    <style>
        body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; background: #f9f5f1; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .cover { text-align: center; padding: 80px 20px; border-bottom: 1px solid #e0d6cc; margin-bottom: 60px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .cover h1 { font-size: 3em; color: #5d453b; margin-bottom: 10px; letter-spacing: -0.02em; }
        .cover h3 { font-size: 1.3em; font-weight: normal; color: #8a6a5c; margin-top: 0; margin-bottom: 30px; }
        .dedication { font-style: italic; color: #725548; max-width: 600px; margin: 30px auto; font-size: 1.15em; line-height: 1.6; }
        
        .audio-dedication { background: #fdf8f6; padding: 20px; border-radius: 50px; display: inline-block; margin-top: 20px; border: 1px solid #eaddd7; }
        .audio-label { font-family: sans-serif; font-size: 0.8em; text-transform: uppercase; letter-spacing: 1px; color: #a18072; margin: 0 0 10px 0; font-weight: bold; }
        .audio-dedication audio { height: 32px; }

        .entry { background: white; padding: 40px; margin-bottom: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .entry-header { margin-bottom: 20px; border-bottom: 1px solid #f0f0f0; padding-bottom: 20px; }
        .entry-date { text-transform: uppercase; letter-spacing: 1px; font-size: 0.85em; color: #999; display: block; margin-bottom: 5px; }
        .entry-title { margin: 0 0 10px 0; color: #4a372f; font-size: 1.8em; }
        .entry-meta { font-family: sans-serif; font-size: 0.8em; margin-top: 10px;}
        .mood-tag { background: #eaddd7; padding: 3px 8px; border-radius: 4px; margin-right: 10px; color: #5d453b; font-weight: bold; }
        .tag { color: #8a6a5c; margin-right: 5px; }
        .entry-summary { background: #fdf8f6; padding: 15px; border-left: 3px solid #d2bab0; margin-bottom: 25px; font-style: italic; color: #5d453b; font-size: 0.95em; }
        
        .insights-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px; font-family: sans-serif; }
        .insight-card { padding: 15px; border-radius: 6px; border: 1px solid #eee; background: #fafafa; }
        .insight-header { font-size: 0.7em; text-transform: uppercase; font-weight: bold; color: #888; margin-bottom: 5px; }
        .insight-title { font-weight: bold; color: #444; font-size: 0.95em; margin-bottom: 5px; }
        .insight-text { font-size: 0.9em; color: #666; line-height: 1.4; }
        .insight-philosophy { background-color: #fffbeb; border-color: #fcd34d; }
        .insight-memory { background-color: #eff6ff; border-color: #93c5fd; }
        /* Changed Advice to Earthy/Slate tones */
        .insight-advice { background-color: #f1f5f9; border-color: #cbd5e1; }

        .entry-content { font-size: 1.1em; margin-bottom: 30px; }
        .entry-audio audio { width: 100%; outline: none; }
        
        footer { text-align: center; margin-top: 80px; color: #aaa; font-size: 0.9em; font-family: sans-serif; }
    </style>
</head>
<body>
    <div class="container">
        <section class="cover">
            <h1>The Journal of ${authorName}</h1>
            <h3>${titleText}</h3>
            <div class="dedication">
                "${config.dedicationMessage}"
            </div>
            ${dedicationAudioHtml}
        </section>
        
        <main>
            ${entriesHtml}
        </main>

        <footer>
            Generated by Heirloom
        </footer>
    </div>
</body>
</html>`;
};

export const generateLegacyArchive = async (entries: JournalEntry[], config: LegacyConfig, authorName: string, dedicationAudioBlob?: Blob): Promise<void> => {
  const zip = new JSZip();
  const audioFolder = zip.folder("audio");

  // Add HTML entry point
  const htmlContent = generateHtmlContent(entries, config, authorName, !!dedicationAudioBlob);
  zip.file("index.html", htmlContent);

  // Add Dedication Audio if present
  if (dedicationAudioBlob) {
      zip.file("dedication.webm", dedicationAudioBlob);
  }

  // Add audio files
  for (const entry of entries) {
      if (audioFolder) {
          try {
            const blob = await getEntryAudio(entry.id);
            if (blob) {
                const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
                audioFolder.file(`${entry.id}.${extension}`, blob);
            }
          } catch (e) {
              console.error("Failed to export audio for entry", entry.id, e);
          }
      }
  }

  // Generate the zip blob
  const content = await zip.generateAsync({ type: "blob" });
  
  // Trigger download
  const recipientLabel = config.recipients.length === 1 ? config.recipients[0].name.replace(/\s+/g, '_') : 'Recipients';
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Journal_for_${recipientLabel}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
