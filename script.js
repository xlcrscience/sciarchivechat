const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const apiKeyInput = document.getElementById('api-key');
const passkeyInput = document.getElementById('passkey');
const submitApiKeyButton = document.getElementById('submit-api-key');
const apiKeyMessage = document.getElementById('api-key-message');
const contextLoadingBar = document.getElementById('context-loading-bar');
const suggestionsSection = document.getElementById('suggestions-section');
const suggestionsList = document.getElementById('suggestions-list');

let context = "";
let apiKey = null;
let passkeyValid = false;
let contextLoading = false;
let conversationHistory = [];

// Precomputed SHA-256 hash of "XLCRSCI2025"
const VALID_PASSKEY_HASH = "2a32f4fe7baa4f2b7179ab0e03037f7a7eec963f43778976e49500d6d68711d3";

// Function to hash a string using SHA-256
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Function to generate smart questions using the API
async function generateSmartQuestions(context, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `Given the following context: "${context}", generate 2-3 concise, relevant questions that a Science Department Teacher might ask about this context. Return only the questions as a plain list, one per line, with no extra text or numbering.`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        if (!response.ok) throw new Error('API failed to generate questions');
        const data = await response.json();
        const questionsText = data.candidates[0].content.parts[0].text.trim();
        return questionsText.split('\n').filter(q => q.trim() !== '');
    } catch (error) {
        console.error("Error generating smart questions:", error);
        return [
            "What can you tell me about this topic?",
            "How does this relate to science?",
            "Why is this important to study?"
        ]; // Fallback questions
    }
}

async function loadContext() {
    if (contextLoading || !passkeyValid) {
        console.log("Context loading skipped: passkeyValid =", passkeyValid);
        return;
    }

    contextLoading = true;
    console.log("Starting context load...");

    try {
        const response = await fetch('context.txt');
        if (!response.ok) {
            throw new Error(`Failed to load context file: ${response.status}`);
        }
        const encodedContext = await response.text();
        console.log("Raw context file content:", encodedContext);
        context = atob(encodedContext.trim());
        console.log("Decoded context:", context);
        contextLoadingBar.classList.add('loaded');
        apiKeyMessage.textContent = "API and Passkey accepted. Ready to chat.";

        // Generate and display smart questions
        const suggestions = await generateSmartQuestions(context, apiKey);
        suggestionsSection.style.display = 'block';
        suggestionsList.innerHTML = '';
        suggestions.forEach(question => {
            const li = document.createElement('li');
            li.textContent = question;
            li.addEventListener('click', () => {
                userInput.value = question;
                sendMessage();
            });
            suggestionsList.appendChild(li);
        });
    } catch (error) {
        console.error("Error loading context:", error);
        context = "Unable to load context.";
        apiKeyMessage.textContent = `Context failed to load: ${error.message}`;
        apiKeyMessage.classList.add('error');
        apiKeyMessage.classList.remove('success');
    } finally {
        contextLoading = false;
        console.log("Context loading finished.");
    }
}

submitApiKeyButton.addEventListener('click', async () => {
    apiKey = apiKeyInput.value.trim();
    const passkey = passkeyInput.value.trim();

    if (!apiKey || !passkey) {
        apiKeyMessage.textContent = "Please enter both API Key and Passkey.";
        apiKeyMessage.classList.add('error');
        apiKeyMessage.classList.remove('success');
        apiKey = null;
        passkeyValid = false;
        return;
    }

    const passkeyHash = await hashString(passkey);
    console.log("User passkey hash:", passkeyHash);
    console.log("Expected hash:", VALID_PASSKEY_HASH);

    if (passkeyHash === VALID_PASSKEY_HASH) {
        apiKeyInput.disabled = true;
        passkeyInput.disabled = true;
        submitApiKeyButton.disabled = true;
        passkeyValid = true;
        apiKeyMessage.textContent = "API Key and Passkey submitted. Loading context...";
        apiKeyMessage.classList.remove('error');
        apiKeyMessage.classList.add('success');
        await loadContext();
    } else {
        apiKeyMessage.textContent = "Incorrect passkey.";
        apiKeyMessage.classList.add('error');
        apiKeyMessage.classList.remove('success');
        apiKey = null;
        passkeyValid = false;
    }
});

sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const message = userInput.value.trim();

    if (!message) return;
    if (!apiKey || !passkeyValid) {
        appendMessage('bot', 'Please submit a valid API key and passkey.');
        return;
    }

    if (contextLoading) {
        appendMessage('bot', 'Please wait for the context to load before sending messages.');
        return;
    }

    if (!context || context === "Unable to load context.") {
        appendMessage('bot', 'Context not loaded. Please check the context file.');
        return;
    }

    appendMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });
    userInput.value = '';

    getBotResponse(message, apiKey);
}

function appendMessage(sender, message, isHtml = false) {
    const div = document.createElement('div');
    div.classList.add('message', sender);
    if (isHtml) {
        div.innerHTML = message;
    } else {
        div.textContent = message;
    }
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

async function typeMessage(element, text) {
    element.classList.add('typing');
    element.innerHTML = '';
    await new Promise(resolve => setTimeout(resolve, 500));
    for (let i = 0; i < text.length; i++) {
        element.innerHTML = text.substring(0, i + 1);
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    element.classList.remove('typing');
}

function getBotResponse(message, apiKey) {
    if (!passkeyValid) {
        appendMessage('bot', 'Invalid passkey. Please restart and try again.');
        return;
    }

    let prompt = `Context: ${context}\n\n` +
                 `Conversation History:\n`;
    
    conversationHistory.forEach(entry => {
        prompt += `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}\n`;
    });

    prompt += `\nCurrent Question: ${message}\n\n` +
              `You are an expert of Science Department at The Excelsior School and you love educating students about science. Please provide a well-formatted answer using Markdown syntax. Keep the tone formal and encouraging, you can also use humour very slightly. Use headings, bullet points, numbered lists, and other appropriate formatting to make the response clear and easy to read.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const messageElement = appendMessage('bot', '', true);
    messageElement.classList.add('typing');

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
        let reply = data.candidates[0].content.parts[0].text || 'No reply';
        reply = markdownToHtml(reply);
        messageElement.classList.remove('typing');
        typeMessage(messageElement, reply).then(() => {
            conversationHistory.push({ role: 'assistant', content: reply });
        });
    })
    .catch((error) => {
        console.error("Gemini API error:", error);
        messageElement.classList.remove('typing');
        typeMessage(messageElement, 'Error: Check your API key or connection. See console for details.');
    });
}

function markdownToHtml(markdownText) {
    return marked.parse(markdownText);
}
