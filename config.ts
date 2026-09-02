// Firebase configuration
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAQhgQhGB83nGu5Xz7zA1Z2cVAohBVoVTA",
  authDomain: "saimilar-a41e0.firebaseapp.com",
  projectId: "saimilar-a41e0",
  storageBucket: "saimilar-a41e0.firebasestorage.app",
  messagingSenderId: "1027027097896",
  appId: "1:1027027097896:web:7fab77f543947539fa581d",
  measurementId: "G-V8XGJF55SH"
};

// API Keys configuration
// Секретные ключи (OpenRouter, Gemini, TMDB) НИКОГДА не должны находиться здесь.
// Приложение всегда использует серверные прокси (/api/*) для защиты ключей.
export const API_KEYS = {
  // Эти поля оставлены только для тех ключей, которые ДОПУСТИМО передавать клиенту 
  // (например, если пользователь вводит СВОЙ собственный ключ в настройках).
  OPENROUTER: '',
};

export const validateApiKeys = () => {
  console.log('🔒 Using Server-Side Proxies (/api/*) for security');
  return true;
};
