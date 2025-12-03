
import { AiResponse, JournalEntry, LocationData, Chapter, Prompt } from "../types";
import { getUserIdentityImage } from "./dbService";
import { blobToBase64 } from "./audioUtils";
import { processAIRequest } from "./firebaseConfig";

// Helper to call Cloud Function and handle errors
const callCloudFunction = async (action: string, data: any) => {
    try {
        const response = await processAIRequest({ action, ...data });
        const result = response.data as any;
        if (!result.success) {
            throw new Error(result.error || 'Cloud Function returned error');
        }
        return result.data;
    } catch (error: any) {
        console.error(`Cloud Function Error (${action}):`, error);
        throw error;
    }
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

        return await callCloudFunction('analyzeEntry', {
            input: inputData,
            isAudio,
            promptContext,
            imageData,
            location
        });

    } catch (error: any) {
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
    if (!query.trim()) return null;
    try {
        return await callCloudFunction('lookupLocation', { query });
    } catch (e) {
        return null;
    }
};

export const getBiographerAnalysis = async (entries: JournalEntry[]): Promise<Prompt> => {
    try {
        return await callCloudFunction('biographerAnalysis', { entries });
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
    const base64Image = await blobToBase64(imageBlob);
    const result = await callCloudFunction('editEntryImage', {
        image: {
            mimeType: imageBlob.type || 'image/jpeg',
            data: base64Image
        },
        instruction
    });

    // Convert base64 back to Blob
    const byteCharacters = atob(result.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: result.mimeType });
};

export const generateMemoryScape = async (entry: JournalEntry, refinement?: string): Promise<Blob> => {
    const identityBlob = await getUserIdentityImage();
    let identityImage = undefined;

    if (identityBlob) {
        const base64Identity = await blobToBase64(identityBlob);
        identityImage = {
            mimeType: identityBlob.type || 'image/jpeg',
            data: base64Identity
        };
    }

    const result = await callCloudFunction('generateMemoryScape', {
        entry,
        refinement,
        identityImage
    });

    const byteCharacters = atob(result.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: result.mimeType });
};

export const generateChapter = async (entries: JournalEntry[], periodName: string): Promise<Chapter> => {
    return await callCloudFunction('generateChapter', { entries, periodName });
};

export const generateContextualPrompts = async (entries: JournalEntry[]): Promise<Prompt[]> => {
    try {
        return await callCloudFunction('contextualPrompts', { entries });
    } catch (e) {
        return [];
    }
};

export const generateAncestralScenario = async (entries: JournalEntry[]): Promise<{ scenario: string, topic: string }> => {
    return await callCloudFunction('ancestralScenario', { entries });
};

export const generateAncestralAdvice = async (scenario: string, entries: JournalEntry[]): Promise<string> => {
    return await callCloudFunction('ancestralAdvice', { scenario, entries });
};
