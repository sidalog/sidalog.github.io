// Firebase web config for sidalog (identifies the project; not a secret).
window.SIDALOG_FIREBASE = {
  apiKey: "AIzaSyBSwAsgyEJusqNPxzCjbDNujVpauZnUAVw",
  authDomain: "sidalog-b527f.firebaseapp.com",
  projectId: "sidalog-b527f",
  storageBucket: "sidalog-b527f.firebasestorage.app",
  messagingSenderId: "333682161010",
  appId: "1:333682161010:web:15333a4b4e78a4c326d9eb"
};

// 'Suggest a place' and place feedback go to Sida's Google Apps Script, which emails him.
window.SIDALOG_FEEDBACK = { mode: 'script', endpoint: 'https://script.google.com/macros/s/AKfycbwJDvGE1QiNHi7EN2T4MR5DyTdqCxpGk1KfHAhDbWdNnnTMNq9uX9zLflmulO_KWu78yg/exec' };
