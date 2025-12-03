const { onCall } = require("firebase-functions/v2/https");
const { GoogleGenAI, Type } = require("@google/genai");
const logger = require("firebase-functions/logger");

// Initialize the Gemini AI lazily
let genAI;

// Retry helper for handling API overload (503) errors
const retryWithBackoff = async (
    fn,
    maxRetries = 3,
    initialDelay = 1000,
) => {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if it's a 503 overload error
            const is503 = error?.message?.includes("503") ||
                error?.message?.includes("overloaded") ||
                error?.message?.includes("UNAVAILABLE");

            if (is503 && attempt < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                logger.info(`API overloaded, retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            // If not a 503 or last attempt, throw the error
            throw error;
        }
    }

    throw lastError;
};

/**
 * Unified Cloud Function to handle all AI requests
 * This keeps the API key secure on the server side
 */
exports.processAIRequest = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    // Initialize client if not already done
    if (!genAI) {
        genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    try {
        const { action, ...data } = request.data;

        if (!action) {
            throw new Error("Action is required");
        }

        logger.info(`Processing AI request: ${action}`);

        switch (action) {
            case 'analyzeEntry':
                return await handleAnalyzeEntry(data);
            case 'lookupLocation':
                return await handleLookupLocation(data);
            case 'biographerAnalysis':
                return await handleBiographerAnalysis(data);
            case 'editEntryImage':
                return await handleEditEntryImage(data);
            case 'generateMemoryScape':
                return await handleGenerateMemoryScape(data);
            case 'generateChapter':
                return await handleGenerateChapter(data);
            case 'contextualPrompts':
                return await handleContextualPrompts(data);
            case 'ancestralScenario':
                return await handleAncestralScenario(data);
            case 'ancestralAdvice':
                return await handleAncestralAdvice(data);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    } catch (error) {
        logger.error("Error processing request:", error);
        throw new Error(`Failed to process request: ${error.message}`);
    }
});

// --- Handlers ---

async function handleAnalyzeEntry(data) {
    const { input, isAudio, promptContext, imageData, location } = data;
    if (!input) throw new Error("Input is required");

    const modelId = "gemini-2.5-flash";
    const promptText = promptContext
        ? `The user is answering this specific question: "${promptContext}".`
        : "The user is providing a free-form journal entry.";

    const locationText = location
        ? `The user is recording this at Latitude: ${location.latitude}, Longitude: ${location.longitude}. Use the Google Maps tool to identify this location if possible.`
        : "";

    const systemPrompt = `
    ${isAudio ? "You are a dedicated personal archivist. Listen to this audio journal entry" : "You are a dedicated personal archivist. Analyze this written journal entry"} ${imageData ? "and the attached image" : ""}. ${promptText} ${locationText}
    
    Task 1: Transcription
       - ${isAudio ? "Transcribe the audio to clear, natural English. Preserve the speaker's unique voice, cadence, and emotion. Fix stuttering or non-speech fillers (um, ah) unless they add meaning, but do NOT rewrite or summarize the speech. It must be a faithful transcription." : "Proofread the text for clarity while maintaining the original voice."}
       - Return this as 'transcription'.
    
    Task 2: Deep Analysis
       - Title: Create a poetic and meaningful title.
       - Summary: Write a compassionate 2-3 sentence summary in the second person ("You..."). Connect the thoughts to the user's values.
       - Mood: Identify the primary emotional tone using exactly one word.
       - Tags: 3-5 relevant thematic tags.
       - Insights: Extract 3-6 distinct insights (philosophy, memory, advice, observation, question). These should be valuable takeaways from the entry.
       ${location ? "- Location: Identify the specific place name and address using Google Maps." : ""}
    
    Return strictly JSON.
    `;

    const parts = [];
    if (isAudio) {
        parts.push({
            inlineData: {
                mimeType: input.mimeType || "audio/webm",
                data: input.data,
            },
        });
    } else {
        parts.push({ text: `User Entry Text: "${input}"` });
    }

    if (imageData) {
        parts.push({
            inlineData: {
                mimeType: imageData.mimeType || "image/jpeg",
                data: imageData.data,
            },
        });
    }

    parts.push({ text: systemPrompt });

    const tools = [];
    let toolConfig = undefined;

    if (location) {
        tools.push({ googleMaps: {} });
        toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                },
            },
        };
    }

    const generationConfig = {
        tools: tools.length > 0 ? tools : undefined,
        toolConfig: toolConfig,
    };

    if (!location) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = {
            type: Type.OBJECT,
            properties: {
                transcription: { type: Type.STRING },
                summary: { type: Type.STRING },
                title: { type: Type.STRING },
                mood: { type: Type.STRING },
                locationName: { type: Type.STRING, nullable: true },
                locationAddress: { type: Type.STRING, nullable: true },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                insights: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ["philosophy", "memory", "advice", "observation", "question"] },
                            title: { type: Type.STRING },
                            content: { type: Type.STRING },
                        },
                        required: ["type", "title", "content"],
                    },
                },
            },
            required: ["transcription", "summary", "title", "mood", "tags", "insights"],
        };
    } else {
        parts.push({
            text: `
        Output must be valid JSON following this structure:
        {
            "transcription": "string",
            "summary": "string",
            "title": "string",
            "mood": "string",
            "locationName": "string or null",
            "locationAddress": "string or null",
            "tags": ["string"],
            "insights": [{ "type": "philosophy|memory|advice|observation|question", "title": "string", "content": "string" }]
        }
        `,
        });
    }

    const response = await retryWithBackoff(async () => {
        return await genAI.models.generateContent({
            model: modelId,
            contents: { parts },
            config: generationConfig,
        });
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");

    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return { success: true, data: JSON.parse(cleanText) };
}

async function handleLookupLocation(data) {
    const { query } = data;
    if (!query) return null;

    const response = await genAI.models.generateContent({
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

    let resultData = {};
    try {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        resultData = JSON.parse(cleanText);
    } catch (e) {
        return null;
    }

    let mapUrl = '';
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const mapChunk = response.candidates[0].groundingMetadata.groundingChunks.find(
            (c) => c.maps?.uri
        );
        if (mapChunk) {
            mapUrl = mapChunk.maps.uri;
        }
    }

    return {
        success: true,
        data: {
            name: resultData.name || query,
            address: resultData.address || '',
            url: mapUrl
        }
    };
}

async function handleBiographerAnalysis(data) {
    const { entries } = data;
    const lifeSummary = entries.map(e => `Title: ${e.title}, Summary: ${e.summary}, Date: ${new Date(e.createdAt).toLocaleDateString()}`).join('\n');

    if (entries.length === 0) {
        return {
            success: true,
            data: {
                id: 'bio-start',
                text: "Let's start your story. Tell me about where you were born and your earliest memory.",
                category: 'biography',
                gapIdentified: 'The Beginning'
            }
        };
    }

    const response = await genAI.models.generateContent({
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
        success: true,
        data: {
            id: `bio-${Date.now()}`,
            text: result.question,
            category: 'biography',
            gapIdentified: result.gapIdentified,
            isGenerated: true
        }
    };
}

async function handleEditEntryImage(data) {
    const { image, instruction } = data;
    // image is expected to be { mimeType, data (base64) }

    const prompt = `
    Task: Redraw the image based on the user's instruction.
    User Instruction: "${instruction}"
    Guidelines: STRICTLY FOLLOW the instruction. IGNORE details from the original image if they conflict.
    `;

    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: image.mimeType || 'image/jpeg',
                        data: image.data
                    }
                },
                { text: prompt }
            ]
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return {
                    success: true,
                    data: {
                        mimeType: part.inlineData.mimeType,
                        data: part.inlineData.data
                    }
                };
            }
        }
    }
    throw new Error("No image generated");
}

async function handleGenerateMemoryScape(data) {
    const { entry, refinement, identityImage } = data;

    const promptInstructions = refinement
        ? `The user is requesting a specific change: "${refinement}". You MUST honor this instruction above all else in the new prompt.`
        : "";

    const promptResponse = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Read this journal entry and write a detailed, artistic image generation prompt.
        ${promptInstructions}
        Entry Title: ${entry.title}
        Summary: ${entry.summary}
        Mood: ${entry.mood}
        Instructions: Output ONLY the prompt. Describe a high-quality, cinematic scene. ${identityImage ? "Mention a central character." : "Focus on environment."}`,
    });

    const imagePrompt = promptResponse.text;
    if (!imagePrompt) throw new Error("Failed to generate image prompt");

    if (identityImage) {
        const refResponse = await genAI.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: identityImage.mimeType || 'image/jpeg',
                            data: identityImage.data
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
                    return {
                        success: true,
                        data: {
                            mimeType: part.inlineData.mimeType,
                            data: part.inlineData.data
                        }
                    };
                }
            }
        }
    }

    const imageResponse = await genAI.models.generateImages({
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

    return {
        success: true,
        data: {
            mimeType: 'image/jpeg',
            data: base64Data
        }
    };
}

async function handleGenerateChapter(data) {
    const { entries, periodName } = data;
    const combinedText = entries.map(e =>
        `Date: ${new Date(e.createdAt).toLocaleDateString()}\nTitle: ${e.title}\nContent: ${e.transcription}`
    ).join('\n\n---\n\n');

    const response = await genAI.models.generateContent({
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
    return { success: true, data: { ...result, period: periodName } };
}

async function handleContextualPrompts(data) {
    const { entries } = data;
    const recentEntries = entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const context = recentEntries.map(e => `Title: ${e.title}, Mood: ${e.mood}, Summary: ${e.summary}`).join('\n');

    try {
        const response = await genAI.models.generateContent({
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
        if (!text) return { success: true, data: [] };
        const result = JSON.parse(text);
        const prompts = result.map((p, index) => ({
            id: `ai-prompt-${Date.now()}-${index}`,
            text: p.text,
            category: p.category,
            isGenerated: true
        }));
        return { success: true, data: prompts };
    } catch (e) {
        return { success: true, data: [] };
    }
}

async function handleAncestralScenario(data) {
    const { entries } = data;
    const context = entries.slice(0, 20).map(e => `Topic: ${e.tags.join(', ')} | Summary: ${e.summary}`).join('\n');

    const response = await genAI.models.generateContent({
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
    return { success: true, data: JSON.parse(text) };
}

async function handleAncestralAdvice(data) {
    const { scenario, entries } = data;
    const context = entries.map(e => `[${e.tags.join(', ')}] ${e.transcription}`).join('\n---\n');

    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are the "Digital Ancestor" of this user. Your descendant is facing this scenario: "${scenario}".
        Based ONLY on the user's journal entries below, formulate advice.
        Journal Entries: ${context}`,
        config: {
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });

    return { success: true, data: response.text || "I don't have enough information to advise on this yet." };
}
