// Quick test script to debug image generation
// Run this in browser console on localhost:5173

async function testImageGeneration() {
    const { generateMemoryScape } = await import('./services/geminiService');
    
    const testEntry = {
        id: 'test',
        title: 'Test Entry',
        summary: 'A beautiful sunset over the ocean',
        mood: 'peaceful',
        transcription: 'Test',
        createdAt: Date.now(),
        tags: [],
        insights: [],
        duration: 0,
        inputType: 'text'
    };
    
    try {
        console.log('Testing generateMemoryScape...');
        const blob = await generateMemoryScape(testEntry);
        console.log('Success! Image generated:', blob);
        
        // Display the image
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.src = url;
        document.body.appendChild(img);
    } catch (error) {
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
    }
}

testImageGeneration();
