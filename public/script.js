const { ipcRenderer } = require('electron');
// Remove these console.log statements
// console.log('script.js is loaded');

let isSubmitting = false;
let retryCount = 0;
const MAX_RETRIES = 10;

function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const messageElement = document.getElementById('message');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (!loginForm || !usernameInput || !passwordInput) {
        console.warn('Login form or inputs not found, attempt:', retryCount + 1);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(initializeLoginForm, 100);
        }
        return;
    }

    // Remove these console.log statements
    // console.log('Login form found, initializing...');
    
    // Focus username input after a short delay
    setTimeout(() => {
        usernameInput.focus();
    }, 100);

    // Remove existing listeners
    const newForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newForm, loginForm);
    
    // Get fresh references after cloning
    const newUsernameInput = document.getElementById('username');
    const newPasswordInput = document.getElementById('password');

    // Add input event listeners
    newUsernameInput.addEventListener('input', (e) => {
        // Remove these console.log statements
        // console.log('Username input event fired');
    });

    newPasswordInput.addEventListener('input', (e) => {
        // Remove these console.log statements
        // console.log('Password input event fired');
    });

    // Define the submit handler
    async function handleSubmit(e) {
        e.preventDefault();
        if (isSubmitting) return;
        
        isSubmitting = true;
        // Remove these console.log statements
        // console.log('Processing login submission...');

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    username: newUsernameInput.value, 
                    password: newPasswordInput.value 
                }),
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.role === 'captain') {
                    ipcRenderer.send('load-page', 'captain');
                } else if (data.role === 'admin') {
                    ipcRenderer.send('load-page', 'admin');
                } else {
                    messageElement.textContent = 'Unknown role. Please contact administrator.';
                }
            } else {
                messageElement.textContent = data.message || 'Invalid username or password';
            }
        } catch (error) {
            console.error('Login error:', error);
            messageElement.textContent = 'An error occurred. Please try again.';
        } finally {
            isSubmitting = false;
        }
    }

    // Add the submit listener to the new form
    newForm.addEventListener('submit', handleSubmit);
}

// Remove the MutationObserver and replace with a simpler approach
let formCheckInterval;

function ensureFormExists() {
    if (!document.getElementById('loginForm')) {
        // Remove these console.log statements
        // console.log('Login form not found, reinitializing...');
        initializeLoginForm();
    }
}

// Start checking when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeLoginForm();
        formCheckInterval = setInterval(ensureFormExists, 1000);
    });
} else {
    initializeLoginForm();
    formCheckInterval = setInterval(ensureFormExists, 1000);
}

// Clean up interval when leaving the page
window.addEventListener('beforeunload', () => {
    if (formCheckInterval) {
        clearInterval(formCheckInterval);
    }
});

// Add error handling for failed page loads
window.addEventListener('error', (event) => {
    console.error('Page error:', event.error);
});
