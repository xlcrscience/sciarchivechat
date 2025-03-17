const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const apiKeyInput = document.getElementById('api-key');
const submitApiKeyButton = document.getElementById('submit-api-key');
const apiKeyMessage = document.getElementById('api-key-message');
const contextLoadingBar = document.getElementById('context-loading-bar');

let context = "";
let apiKey = null;
let contextLoading = false;
let conversationHistory = [];

async function loadContext() {
    if (contextLoading) return;

    contextLoading = true;

    try {
        const response = await fetch('context.txt');
        if (!response.ok) {
            throw new Error(`Failed to load context file: ${response.status}`);
        }
        context = await response.text();
        console.log("Context loaded successfully.");
        contextLoadingBar.classList.add('loaded');
    } catch (error) {
        console.error("Error loading context:", error);
        context = "Unable to load context.";
        appendMessage('bot', 'Context failed to load.');
    } finally {
        contextLoading = false;
    }
}

submitApiKeyButton.addEventListener('click', () => {
    apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        apiKeyInput.disabled = true;
        submitApiKeyButton.disabled = true;
        apiKeyMessage.textContent = "API Key submitted. Ready to chat!";
        apiKeyMessage.classList.remove('error');
        apiKeyMessage.classList.add('success');
    } else {
        apiKeyMessage.textContent = "Please enter an API Key.";
        apiKeyMessage.classList.add('error');
        apiKey = null;
    }
});

sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

loadContext();

function sendMessage() {
    const message = userInput.value.trim();

    if (!message) return;
    if (!apiKey) {
        appendMessage('bot', 'Please submit your API key.');
        return;
    }

    if (contextLoading) {
        appendMessage('bot', 'Please wait for the context to load before sending messages.');
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
    return div; // Return the div for typing animation
}

async function typeMessage(element, text) {
    element.classList.add('typing');
    element.innerHTML = ''; // Clear content initially
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before typing starts
    for (let i = 0; i < text.length; i++) {
        element.innerHTML = text.substring(0, i + 1);
        await new Promise(resolve => setTimeout(resolve, 10)); // Typing speed (5ms per character)
    }
    element.classList.remove('typing');
}

function getBotResponse(message, apiKey) {
    let prompt = `Context: ${context}\n\n` +
                 `Conversation History:\n`;
    
    conversationHistory.forEach(entry => {
        prompt += `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}\n`;
    });

    prompt += `\nCurrent Question: ${message}\n\n` +
              `Please provide a well-formatted answer using Markdown syntax. Use headings, bullet points, numbered lists, and other appropriate formatting to make the response clear and easy to read.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Create a placeholder message element with typing indicator
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
        // Remove typing class and start animation
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
