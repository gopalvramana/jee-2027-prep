// ── Firebase Initialisation ────────────────────────────────────────────────
// Uses the Firebase compat SDK (loaded via CDN in each HTML page).
// All other modules access auth + db via window._auth / window._db.

const firebaseConfig = {
  apiKey:            "AIzaSyBb0tSoaqiQHy_54qPI74WHb_mfw9-3p_I",
  authDomain:        "jee-2027-prep.firebaseapp.com",
  projectId:         "jee-2027-prep",
  storageBucket:     "jee-2027-prep.firebasestorage.app",
  messagingSenderId: "555805901897",
  appId:             "1:555805901897:web:60d8e049bbe8c312ba6b98"
};

firebase.initializeApp(firebaseConfig);

window._auth = firebase.auth();
window._db   = firebase.firestore();
