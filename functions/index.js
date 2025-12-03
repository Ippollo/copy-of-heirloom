const { onCall } = require("firebase-functions/v2/https");
const { GoogleGenAI, Type } = require("@google/genai");
const logger = require("firebase-functions/logger");

// Initialize the Gemini AI with API key from environment
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
 * Cloud Function to analyze journal entries using Gemini AI
 * This keeps the API key secure on the server side
 */
exports.analyzeEntry = onCall(async (request) => {
    try {
        const { input, isAudio, promptContext, imageData, location } = request.data;

        if (!input) {
            throw new Error("Input is required");
        }

        logger.info("Analyzing journal entry");

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

        // Prepare contents
        const parts = [];

        // Input Part (Audio or Text)
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

        // Image Part
        if (imageData) {
            parts.push({
                inlineData: {
                    mimeType: imageData.mimeType || "image/jpeg",
                    data: imageData.data,
                },
            });
        }

        // Instructions Part
        parts.push({ text: systemPrompt });

        // Config
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

        // Wrap the API call in retry logic to handle temporary overload
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
        const result = JSON.parse(cleanText);

        logger.info("Successfully analyzed entry");
        return { success: true, data: result };
    } catch (error) {
        logger.error("Error analyzing entry:", error);
        throw new Error(`Failed to analyze entry: ${error.message}`);
    }
});
