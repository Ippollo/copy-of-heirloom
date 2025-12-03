const { onCall } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("firebase-functions/logger");

// Initialize the Gemini AI with API key from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Cloud Function to generate journal entries using Gemini AI
 * This keeps the API key secure on the server side
 */
exports.generateJournalEntry = onCall(async (request) => {
    try {
        const { prompt, imageData } = request.data;

        if (!prompt) {
            throw new Error("Prompt is required");
        }

        logger.info("Generating journal entry", { prompt: prompt.substring(0, 100) });

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        let result;
        if (imageData) {
            // Handle image + text prompt
            const imagePart = {
                inlineData: {
                    data: imageData.split(",")[1], // Remove data:image/... prefix
                    mimeType: "image/jpeg",
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            // Handle text-only prompt
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        const text = response.text();

        logger.info("Successfully generated content");
        return { success: true, text };
    } catch (error) {
        logger.error("Error generating content:", error);
        throw new Error(`Failed to generate content: ${error.message}`);
    }
});
