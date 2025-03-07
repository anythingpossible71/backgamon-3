console.log("Debug file loaded successfully");

// Try to access the document
try {
  console.log("Document title: " + document.title);
} catch(e) {
  console.log("Error accessing document: " + e.message);
}

// Check if p5 is loaded
try {
  if (typeof p5 !== 'undefined') {
    console.log("p5.js is loaded");
  } else {
    console.log("p5.js is NOT loaded");
  }
} catch(e) {
  console.log("Error checking p5: " + e.message);
}

// Override p5's setup function to ensure ours runs
window.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded");
});
