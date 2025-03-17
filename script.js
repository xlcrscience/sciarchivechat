const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const apiKeyInput = document.getElementById('api-key');
const submitApiKeyButton = document.getElementById('submit-api-key');
const apiKeyMessage = document.getElementById('api-key-message'); // Get the message paragraph

let context = ""; // Initialize an empty context
let apiKey = null; // Store API key internally after submission
let contextLoading = false;  // Flag to track if context is loading

// Function to load context from a text file
async function loadContext() {
    if (contextLoading) return; // Prevent multiple calls

    contextLoading = true;
    appendMessage('bot', 'Loading context... Please wait.'); // User feedback

    try {
        const response = await fetch('context.txt');
        if (!response.ok) {
            throw new Error(`Failed to load context file: ${response.status}`);
        }
        context = await response.text();
        console.log("Context loaded successfully.");
        appendMessage('bot', 'Context loaded.');  // Update user

        //Optionally limit context size here before sending, if you want
        //context = context.substring(0, MAX_CONTEXT_SIZE); //Replace MAX_CONTEXT_SIZE

    } catch (error) {
        console.error("Error loading context:", error);
        appendMessage('bot', 'Error: Could not load context file.');
        context = "Unable to load context."; //Fallback
    } finally {
        contextLoading = false;
    }
}

loadContext(); // Load context on page load

// API Key Submission
submitApiKeyButton.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();  // Store API key in variable
    if (apiKey) {
        apiKeyInput.disabled = true; //Disable input
        submitApiKeyButton.disabled = true;  // Disable button
        apiKeyMessage.textContent = "API Key submitted.  Ready to chat!";  // Display success
        apiKeyMessage.classList.remove('error'); // Remove error class, if present
        apiKeyMessage.classList.add('success');  // Add a success class (optional, for styling)

    } else {
        apiKeyMessage.textContent = "Please enter an API Key.";
        apiKeyMessage.classList.add('error'); // Add error class
        apiKey = null; // Clear any previous invalid key
    }
});

sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission (if inside a form)
        sendMessage();
    }
});

function sendMessage() {
    const message = userInput.value.trim();

    if (!message) return;
    if (!apiKey) {
        appendMessage('bot', 'Please submit your API key.');
        return;
    }

    if (contextLoading) {  //Check before sending
      appendMessage('bot', 'Please wait for the context to load before sending messages.');
      return;
    }

    appendMessage('user', message);
    userInput.value = '';

    getBotResponse(message, apiKey); // Use stored API key
}

function appendMessage(sender, message) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    div.textContent = message;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function getBotResponse(message, apiKey) { // apiKey is now an argument
    const prompt = `Context: ${context}\nQuestion: ${message}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('API failed');
        return response.json();
    })
    .then(data => {
        const reply = data.candidates[0].content.parts[0].text || 'No reply';
        appendMessage('bot', reply);
    })
    .catch((error) => {
        console.error("Gemini API error:", error);
        appendMessage('bot', 'Error: Check your API key or connection. See console for details.');
    });
}