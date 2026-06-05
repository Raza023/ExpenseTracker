import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    // We only need the databaseURL now, as we're not using Firebase Auth
    databaseURL: "https://mysurvey-96bd8-default-rtdb.firebaseio.com",
    projectId: "mysurvey-96bd8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
