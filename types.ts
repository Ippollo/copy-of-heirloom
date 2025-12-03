
export interface Insight {
  type: 'philosophy' | 'memory' | 'advice' | 'observation' | 'question';
  title: string;
  content: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string; // e.g. "Blue Bottle Coffee"
  address?: string;
}

export interface JournalEntry {
  id: string;
  createdAt: number; // timestamp
  audioBlob?: Blob; 
  snapshotBlob?: Blob; // User uploaded photo
  generatedImageBlob?: Blob; // AI generated art
  duration?: number; 
  transcription: string;
  summary?: string;
  title: string;
  mood: string;
  tags: string[];
  insights: Insight[];
  location?: LocationData;
  isProcessing: boolean;
  prompt?: string;
  inputType?: 'audio' | 'text';
}

export interface AiResponse {
  transcription: string;
  summary: string;
  title: string;
  mood: string;
  tags: string[];
  insights: Insight[];
  locationName?: string;
  locationAddress?: string;
}

export enum RecorderState {
  Idle,
  Recording,
  Paused,
  Processing,
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
  relationship: string;
}

export interface LegacyConfig {
  recipients: Recipient[];
  dedicationMessage: string;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Aoede' | 'Personal';
}

export interface Prompt {
  id: string;
  text: string;
  category: 'intention' | 'reflection' | 'gratitude' | 'challenge' | 'insight' | 'biography';
  isGenerated?: boolean;
  gapIdentified?: string; // For Biographer mode: "Childhood", "Career", etc.
}

export interface UserVoiceSettings {
  authorName: string;
  isClonedVoiceEnabled: boolean;
  useClonedVoiceForMentor: boolean;
  useClonedVoiceForLegacy: boolean;
  matchedVoiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Aoede';
  elevenLabsVoiceId?: string; // New: Store external ID
}

export interface Chapter {
  title: string;
  content: string;
  period: string; // e.g. "October 2023" or "2023"
}
