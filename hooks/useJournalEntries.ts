
import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { JournalEntry, LocationData } from '../types';
import { getAllEntries, saveEntry } from '../services/dbService';
import { analyzeEntry } from '../services/geminiService';

export function useJournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const loadedEntries = await getAllEntries();
      setEntries(loadedEntries);
    } catch (error) {
      console.error("Failed to load entries", error);
    }
  }, []);

  const totalRecordingSeconds = useMemo(() => {
      return entries.reduce((acc, curr) => {
          const duration = curr.duration || (curr.transcription ? curr.transcription.split(' ').length / 2.5 : 0);
          return acc + duration;
      }, 0);
  }, [entries]);

  const processNewEntry = async (
      input: Blob | string, 
      duration: number, 
      promptText?: string, 
      imageBlob?: Blob, 
      location?: LocationData
  ) => {
      const tempId = uuidv4();
      const isAudio = input instanceof Blob;
      const inputType = isAudio ? 'audio' : 'text';

      const tempEntry: JournalEntry = {
        id: tempId,
        createdAt: Date.now(),
        duration: duration,
        transcription: isAudio ? "Transcribing your memory..." : (input as string),
        title: "Analyzing...",
        mood: "...",
        tags: [],
        insights: [],
        isProcessing: true,
        prompt: promptText,
        snapshotBlob: imageBlob, 
        location: location,
        inputType: inputType
      };
  
      setEntries(prev => [tempEntry, ...prev]);
      setIsProcessing(true);
  
      try {
        if (isAudio) {
            await saveEntry({ ...tempEntry, audioBlob: input as Blob });
        } else {
            await saveEntry(tempEntry);
        }
        
        const aiData = await analyzeEntry(input, promptText, imageBlob, location);
  
        const finalEntry: JournalEntry = {
          ...tempEntry,
          transcription: aiData.transcription,
          summary: aiData.summary,
          title: aiData.title,
          mood: aiData.mood,
          tags: aiData.tags || [],
          insights: aiData.insights || [],
          isProcessing: false,
          location: location ? { ...location, name: aiData.locationName, address: aiData.locationAddress } : undefined
        };
        
        if (isAudio) {
            await saveEntry({ ...finalEntry, audioBlob: input as Blob });
        } else {
            await saveEntry(finalEntry);
        }
  
        setEntries(prev => prev.map(e => e.id === tempId ? finalEntry : e));
        return tempId; // Return ID for auto-expansion
        
      } catch (error) {
        console.error("Processing error:", error);
         const errorEntry: JournalEntry = {
          ...tempEntry,
          transcription: isAudio ? "Failed to transcribe audio." : (input as string),
          title: "Error Processing",
          isProcessing: false,
        };
         setEntries(prev => prev.map(e => e.id === tempId ? errorEntry : e));
         await saveEntry(isAudio ? { ...errorEntry, audioBlob: input as Blob } : errorEntry);
         return tempId;
      } finally {
        setIsProcessing(false);
      }
  };

  const deleteEntryState = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntryState = async (updatedEntry: JournalEntry) => {
      setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
      await saveEntry(updatedEntry);
  };

  const addEntryState = async (entry: JournalEntry) => {
      // For legacy training manually added entries without AI processing pipeline
      setEntries(prev => [entry, ...prev]);
      await saveEntry(entry);
  };

  return {
      entries,
      loadEntries,
      processNewEntry,
      deleteEntryState,
      updateEntryState,
      addEntryState,
      totalRecordingSeconds,
      isProcessing
  };
}
