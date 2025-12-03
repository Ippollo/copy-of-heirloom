
const API_KEY = process.env.ELEVEN_LABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

export const createVoiceClone = async (name: string, samples: Blob[]): Promise<string> => {
  if (!API_KEY) {
      console.warn("ElevenLabs API Key missing. Returning mock ID.");
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      return "mock-voice-id-" + Date.now();
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', 'Vocal Journal Clone');
  
  // Append samples
  samples.forEach((blob, index) => {
    // Ensure we send a filename with extension
    const file = new File([blob], `sample_${index}.webm`, { type: blob.type || 'audio/webm' });
    formData.append('files', file);
  });

  try {
      const response = await fetch(`${BASE_URL}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("ElevenLabs Error:", error);
        throw new Error(error.detail?.message || "Failed to create voice clone");
      }

      const data = await response.json();
      return data.voice_id;
  } catch (error) {
      console.error("Voice Clone Failed", error);
      throw error;
  }
};

export const generateSpeech = async (text: string, voiceId: string): Promise<ArrayBuffer> => {
  if (!API_KEY) throw new Error("ElevenLabs API Key missing");
  
  // If it's a mock ID, throw error to trigger fallback
  if (voiceId.startsWith('mock-voice-id')) throw new Error("Cannot generate speech with mock ID");

  const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1', // Low latency model
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      }
    }),
  });

  if (!response.ok) {
      const err = await response.text();
      console.error("TTS Error", err);
      throw new Error("TTS Failed");
  }
  
  return await response.arrayBuffer();
}
