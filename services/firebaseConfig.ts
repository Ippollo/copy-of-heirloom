import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase configuration
// Note: These values are safe to expose in frontend code
const firebaseConfig = {
    apiKey: "AIzaSyDVAwIJF7RAWBtuWB7eTJwymM9aZvmlLB0",
    authDomain: "gen-lang-client-0553019950.firebaseapp.com",
    projectId: "gen-lang-client-0553019950",
    storageBucket: "gen-lang-client-0553019950.firebasestorage.app",
    messagingSenderId: "383998979256",
    appId: "1:383998979256:web:94a5006577283b9effd84d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Export callable function
export const processAIRequest = httpsCallable(functions, 'processAIRequest');
