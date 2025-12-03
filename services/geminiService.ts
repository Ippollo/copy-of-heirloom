
import { GoogleGenAI, Type } from "@google/genai";
import { AiResponse, JournalEntry, LocationData, Chapter, Prompt } from "../types";
import { getUserIdentityImage } from "./dbService";
import { blobToBase64 } from "./audioUtils";
import { analyzeEntryFunction } from "./firebaseConfig";

// Retry helper for handling API overload (503) errors
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if it's a 503 overload error
            const is503 = error?.message?.includes('503') ||
                error?.message?.includes('overloaded') ||
                error?.message?.includes('UNAVAILABLE');

            if (is503 && attempt < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`API overloaded, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // If not a 503 or last attempt, throw the error
            throw error;
        }
    }

    throw lastError;
};


export const analyzeEntry = async (
    input: Blob | string,
    promptContext?: string,
    imageBlob?: Blob,
    location?: LocationData
): Promise<AiResponse> => {
    try {
        const isAudio = input instanceof Blob;

        // Prepare input data for Cloud Function
        let inputData: any;
        if (isAudio) {
            const base64Audio = await blobToBase64(input as Blob);
            inputData = {
                data: base64Audio,
                mimeType: (input as Blob).type || 'audio/webm'
            };
        } else {
            inputData = input;
        }

        // Prepare image data if present
        let imageData: any = undefined;
        if (imageBlob) {
            const base64Image = await blobToBase64(imageBlob);
            imageData = {
                data: base64Image,
                mimeType: imageBlob.type || 'image/jpeg'
            };
        }

        // Call the Cloud Function
        const response = await analyzeEntryFunction({
            input: inputData,
            isAudio,
            promptContext,
            imageData,
            location
        });

        const result = response.data as any;
        if (!result.success) {
            throw new Error('Cloud Function returned error');
        }

        return result.data as AiResponse;

    } catch (error: any) {
        console.error("Cloud Function Error:", error);
        return {
            transcription: typeof input === 'string' ? input : `Error processing audio: ${error.message || "Unknown error"}`,
            summary: "Processing failed. Please check your connection.",
            title: "Error Entry",
            mood: "Error",
            tags: [],
            insights: []
        };
    }
};


export const lookupLocation = async (query: string): Promise<{ name: string, address: string, url?: string } | null> => {
    if (!process.env.API_KEY || !query.trim()) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Find the location matching this query: "${query}". 
            Return a JSON object with:
            - name: official name
            - address: full address
            
            Do not use markdown code blocks. Just return the raw JSON object.`,
            config: {
                tools: [{ googleMaps: {} }],
            }
        });

        const text = response.text;
        if (!text) return null;

        let data: any = {};
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(cleanText);
        } catch (e) {
            return null;
        }

        let mapUrl = '';
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const mapChunk = response.candidates[0].groundingMetadata.groundingChunks.find(
                (c: any) => c.maps?.uri
            );
            if (mapChunk) {
                mapUrl = mapChunk.maps.uri;
            }
        }

        return {
            name: data.name || query,
            address: data.address || '',
            url: mapUrl
        };
    } catch (e) {
        return null;
    }
};

export const getBiographerAnalysis = async (entries: JournalEntry[]): Promise<Prompt> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const lifeSummary = entries.map(e => `Title: ${e.title}, Summary: ${e.summary}, Date: ${new Date(e.createdAt).toLocaleDateString()}`).join('\n');

    if (entries.length === 0) {
        return {
            id: 'bio-start',
            text: "Let's start your story. Tell me about where you were born and your earliest memory.",
            category: 'biography',
            gapIdentified: 'The Beginning'
        };
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an expert biographer writing the life story of this user.
            Here are the summaries of the chapters (entries) we have so far:
            ${lifeSummary}

            Your Task:
            1. Analyze what major life themes or periods are missing (e.g., Childhood, Parents, First Love, Career Failure, Values, Marriage, Friendships).
            2. Identify the SINGLE most important "Missing Chapter".
            3. Formulate a deep, specific interview question to get the user to tell that story.
            
            Return strictly JSON.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        gapIdentified: { type: Type.STRING, description: "The missing theme, e.g. 'Early Childhood'" },
                        question: { type: Type.STRING, description: "The interview question to ask the user." }
                    },
                    required: ["gapIdentified", "question"]
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        const result = JSON.parse(text);

        return {
            id: `bio-${Date.now()}`,
            text: result.question,
            category: 'biography',
            gapIdentified: result.gapIdentified,
            isGenerated: true
        };

    } catch (error) {
        return {
            id: 'bio-error',
            text: "What is a memory that you haven't thought about in a long time?",
            category: 'biography',
            gapIdentified: 'Uncovered Memories'
        };
    }
};

export const editEntryImage = async (imageBlob: Blob, instruction: string): Promise<Blob> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const base64Image = await blobToBase64(imageBlob);

    const prompt = `
  Task: Redraw the image based on the user's instruction.
  User Instruction: "${instruction}"
  Guidelines: STRICTLY FOLLOW the instruction. IGNORE details from the original image if they conflict.
  `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: imageBlob.type || 'image/jpeg',
                        data: base64Image
                    }
                },
                { text: prompt }
            ]
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64Data = part.inlineData.data;
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const mimeType = part.inlineData.mimeType || 'image/jpeg';
                return new Blob([byteArray], { type: mimeType });
            }
        }
    }

    throw new Error("No image generated from edit request");
};

export const generateMemoryScape = async (entry: JournalEntry, refinement?: string): Promise<Blob> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const identityBlob = await getUserIdentityImage();

    const promptInstructions = refinement
        ? `The user is requesting a specific change: "${refinement}". You MUST honor this instruction above all else in the new prompt.`
        : "";

    const promptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Read this journal entry and write a detailed, artistic image generation prompt.
        ${promptInstructions}
        Entry Title: ${entry.title}
        Summary: ${entry.summary}
        Mood: ${entry.mood}
        Instructions: Output ONLY the prompt. Describe a high-quality, cinematic scene. ${identityBlob ? "Mention a central character." : "Focus on environment."}`,
    });

    const imagePrompt = promptResponse.text;
    if (!imagePrompt) throw new Error("Failed to generate image prompt");

    if (identityBlob) {
        const base64Identity = await blobToBase64(identityBlob);
        const refResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: identityBlob.type || 'image/jpeg',
                            data: base64Identity
                        }
                    },
                    {
                        text: `Generate an image of the person in the reference image. Scene: ${imagePrompt}. Style: Cinematic.`
                    }
                ]
            }
        });

        if (refResponse.candidates?.[0]?.content?.parts) {
            for (const part of refResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64Data = part.inlineData.data;
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const mimeType = part.inlineData.mimeType || 'image/jpeg';
                    return new Blob([byteArray], { type: mimeType });
                }
            }
        }
    }

    const imageResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: imagePrompt,
        config: {
            numberOfImages: 1,
            aspectRatio: '4:3',
            outputMimeType: 'image/jpeg'
        }
    });

    const base64Data = imageResponse.generatedImages?.[0]?.image?.imageBytes;
    if (!base64Data) throw new Error("No image generated");

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
};

export const generateChapter = async (entries: JournalEntry[], periodName: string): Promise<Chapter> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const combinedText = entries.map(e =>
        `Date: ${new Date(e.createdAt).toLocaleDateString()}\nTitle: ${e.title}\nContent: ${e.transcription}`
    ).join('\n\n---\n\n');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a biographer. Write a book chapter titled "${periodName}" based on the following entries.
        Entries: ${combinedText}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    period: { type: Type.STRING }
                },
                required: ["title", "content"]
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("Failed to generate chapter");

    const result = JSON.parse(text);
    return { ...result, period: periodName };
};

export const generateContextualPrompts = async (entries: JournalEntry[]): Promise<Prompt[]> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const recentEntries = entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const context = recentEntries.map(e => `Title: ${e.title}, Mood: ${e.mood}, Summary: ${e.summary}`).join('\n');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Based on these recent entries, generate 3 thought-provoking daily journal prompts.
            User Context: ${context}
            Return strictly JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            category: { type: Type.STRING, enum: ['reflection', 'intention', 'gratitude', 'challenge', 'insight'] }
                        },
                        required: ["text", "category"]
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        const result = JSON.parse(text);
        return result.map((p: any, index: number) => ({
            id: `ai-prompt-${Date.now()}-${index}`,
            text: p.text,
            category: p.category as any,
            isGenerated: true
        }));
    } catch (e) {
        return [];
    }
};

export const generateAncestralScenario = async (entries: JournalEntry[]): Promise<{ scenario: string, topic: string }> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = entries.slice(0, 20).map(e => `Topic: ${e.tags.join(', ')} | Summary: ${e.summary}`).join('\n');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on the user's life experiences, generate a hypothetical scenario that their adult child might face.
        User Context: ${context}
        Output JSON only.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING },
                    scenario: { type: Type.STRING }
                },
                required: ["topic", "scenario"]
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("Failed to generate scenario");
    return JSON.parse(text);
};

export const generateAncestralAdvice = async (scenario: string, entries: JournalEntry[]): Promise<string> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = entries.map(e => `[${e.tags.join(', ')}] ${e.transcription}`).join('\n---\n');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the "Digital Ancestor" of this user. Your descendant is facing this scenario: "${scenario}".
        Based ONLY on the user's journal entries below, formulate advice.
        Journal Entries: ${context}`,
        config: {
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });

    return response.text || "I don't have enough information to advise on this yet.";
};
