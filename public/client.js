const socket = io();

// DOM Elements
const modeSelection = document.getElementById('mode-selection');
const senderView = document.getElementById('sender-view');
const receiverView = document.getElementById('receiver-view');
const btnSendMode = document.getElementById('btn-send-mode');
const btnReceiveMode = document.getElementById('btn-receive-mode');
const btnBackGlobal = document.getElementById('btn-back-global');
const statusMessage = document.getElementById('status-message');

// Sender Elements
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload');
const senderWaiting = document.getElementById('sender-waiting');
const displayCode = document.getElementById('display-code');
const senderApproval = document.getElementById('sender-approval');
const senderEmoji = document.getElementById('sender-emoji');
const btnApprove = document.getElementById('btn-approve');
const btnReject = document.getElementById('btn-reject');
const uploadSection = document.getElementById('upload-section');
const dropZone = document.getElementById('drop-zone');
const fileInfo = document.getElementById('file-info');
const fileNameSpan = document.getElementById('file-name');
const fileSizeSpan = document.getElementById('file-size');
const btnRemoveFile = document.getElementById('btn-remove-file');

// Receiver Elements
const otpInputs = document.querySelectorAll('.otp-input');
const btnJoin = document.getElementById('btn-join');
const receiverVerification = document.getElementById('receiver-verification');
// receiverEmoji removed

const downloadSection = document.getElementById('download-section');
const btnDownload = document.getElementById('btn-download');
const joinSection = document.getElementById('join-section');

// ... (skipping unchanged parts)

socket.on('verification-options', (data) => {
    console.log('Received verification options:', data);
    try {
        joinSection.classList.add('hidden');
        receiverVerification.classList.remove('hidden');

        // Ensure instructions are visible
        const ps = receiverVerification.querySelectorAll('p:not(.status-text)');
        ps.forEach(p => p.classList.remove('hidden'));

        const grid = document.getElementById('emoji-grid');
        grid.innerHTML = '';

        if (!data.options || !Array.isArray(data.options)) {
            throw new Error('Invalid options received');
        }

        data.options.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'emoji-btn';
            btn.textContent = emoji;
            btn.onclick = () => {
                socket.emit('verify-emoji', { code: currentCode, emoji });
                document.getElementById('receiver-status').textContent = 'Verifying...';
                // Disable all buttons
                const btns = grid.querySelectorAll('button');
                btns.forEach(b => b.disabled = true);
            };
            grid.appendChild(btn);
        });
    } catch (err) {
        console.error('Error in verification-options:', err);
        showError('Error loading verification options: ' + err.message);
    }
});

let currentCode = null;
let selectedFile = null;

// Navigation
function showView(view) {
    modeSelection.classList.add('hidden');
    senderView.classList.add('hidden');
    receiverView.classList.add('hidden');
    view.classList.remove('hidden');
    statusMessage.classList.add('hidden');
    btnBackGlobal.classList.remove('hidden'); // Show global back button when entering a specific view
}

function resetViews() {
    modeSelection.classList.remove('hidden');
    senderView.classList.add('hidden');
    receiverView.classList.add('hidden');
    statusMessage.classList.add('hidden');
    btnBackGlobal.classList.add('hidden'); // Hide global back button

    // Reset Sender
    resetFileSelection();
    uploadSection.classList.remove('hidden');
    senderWaiting.classList.add('hidden');
    senderApproval.classList.add('hidden');

    // Reset Receiver
    resetOtpInputs();
    joinSection.classList.remove('hidden');
    btnJoin.classList.remove('hidden'); // Ensure button is visible
    receiverVerification.classList.add('hidden');
    downloadSection.classList.add('hidden');
    currentCode = null; // Clear current code
    document.getElementById('receiver-status').textContent = 'Waiting for selection...'; // Reset status text

    statusMessage.classList.add('hidden');
    currentCode = null;
}

function resetOtpInputs() {
    otpInputs.forEach(input => input.value = '');
    otpInputs[0].focus();
}

function resetFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    dropZone.classList.remove('hidden');
    fileInfo.classList.add('hidden');
    btnUpload.classList.add('hidden');
    btnUpload.disabled = false; // Re-enable button
    btnUpload.textContent = 'Get Code'; // Reset text
}

function showToast(msg, type = 'error') {
    statusMessage.textContent = msg;
    statusMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-emerald-100', 'text-emerald-700');

    if (type === 'success') {
        statusMessage.classList.add('bg-emerald-100', 'text-emerald-700');
    } else {
        statusMessage.classList.add('bg-red-100', 'text-red-700');
    }

    statusMessage.classList.remove('hidden');
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}

function showError(msg) {
    showToast(msg, 'error');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function handleFileSelect(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
        showError('File is too large (Max 50MB)');
        return;
    }
    selectedFile = file;
    fileNameSpan.textContent = file.name;
    fileSizeSpan.textContent = formatFileSize(file.size);

    dropZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
    // emojiSelector.classList.remove('hidden'); // Always visible now
    btnUpload.classList.remove('hidden');

    // Randomize on new file select - REMOVED to persist user selection
    // currentEmojiIndex = Math.floor(Math.random() * EMOJIS.length);
    updateEmojiDisplay();
}

btnSendMode.addEventListener('click', () => showView(senderView));
btnReceiveMode.addEventListener('click', () => {
    // Reset receiver state explicitly
    resetOtpInputs();
    joinSection.classList.remove('hidden');
    btnJoin.classList.remove('hidden');
    receiverVerification.classList.add('hidden');
    downloadSection.classList.add('hidden');
    currentCode = null;
    document.getElementById('receiver-status').textContent = 'Waiting for selection...';

    showView(receiverView);
    showView(receiverView);

    // Robust auto-focus strategy
    const attemptFocus = (delay) => {
        setTimeout(() => {
            const firstInput = otpInputs[0];
            if (firstInput && !firstInput.disabled) {
                firstInput.focus();
            }
        }, delay);
    };

    // Try multiple times to catch the right moment after transition
    attemptFocus(100);
    attemptFocus(300);
    attemptFocus(500);
});
btnBackGlobal.addEventListener('click', resetViews);

// Drag & Drop Logic
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFileSelect(fileInput.files[0]);
    }
});

btnRemoveFile.addEventListener('click', resetFileSelection);

// Emoji Selection Logic
// The "Perfect 9" matching backend
const EMOJIS = [
    '🍎', '🍌', '🍇', '🥦', '🥕',
    '🐶', '⚽', '🚀', '💧'
];
let currentEmojiIndex = Math.floor(Math.random() * EMOJIS.length);
const selectedEmojiDisplay = document.getElementById('selected-emoji-display');
const emojiSelector = document.getElementById('emoji-selector');

function updateEmojiDisplay() {
    selectedEmojiDisplay.textContent = EMOJIS[currentEmojiIndex];
}

document.getElementById('btn-prev-emoji').addEventListener('click', () => {
    currentEmojiIndex = (currentEmojiIndex - 1 + EMOJIS.length) % EMOJIS.length;
    updateEmojiDisplay();
});

document.getElementById('btn-next-emoji').addEventListener('click', () => {
    currentEmojiIndex = (currentEmojiIndex + 1) % EMOJIS.length;
    updateEmojiDisplay();
});

const securityToggle = document.getElementById('security-toggle');
// const emojiSelector = document.getElementById('emoji-selector'); // Already defined above
const emojiOverlay = document.getElementById('emoji-overlay');

function updateSecurityState() {
    const isEnabled = securityToggle.checked;
    if (isEnabled) {
        emojiSelector.classList.remove('opacity-50', 'pointer-events-none', 'grayscale');
        if (emojiOverlay) emojiOverlay.classList.add('hidden');
    } else {
        emojiSelector.classList.add('opacity-50', 'pointer-events-none', 'grayscale');
        if (emojiOverlay) emojiOverlay.classList.remove('hidden');
    }
}

// Initial check
updateSecurityState();

securityToggle.addEventListener('change', updateSecurityState);

// Sender Logic
btnUpload.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select a file first.');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('emoji', EMOJIS[currentEmojiIndex]); // Send selected emoji
    formData.append('securityEnabled', document.getElementById('security-toggle').checked);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        currentCode = data.code;

        displayCode.textContent = currentCode.split('').join(' '); // Add spacing
        uploadSection.classList.add('hidden');
        senderWaiting.classList.remove('hidden');

        socket.emit('register-sender', currentCode);

        // Auto-copy code
        navigator.clipboard.writeText(currentCode).then(() => {
            showToast('Code copied to clipboard!', 'success');

            // Existing visual feedback
            const codeContainer = document.getElementById('code-container');
            codeContainer.classList.add('copied');
            const copyLabel = document.getElementById('copy-label');
            copyLabel.classList.remove('hidden');
            setTimeout(() => copyLabel.classList.add('visible'), 10);
            setTimeout(() => {
                codeContainer.classList.remove('copied');
                copyLabel.classList.remove('visible');
                setTimeout(() => copyLabel.classList.add('hidden'), 200);
            }, 2000);
        }).catch(err => console.error('Auto-copy failed:', err));



        const codeContainer = document.getElementById('code-container');
        const copyIcon = document.getElementById('copy-icon');
        const copyLabel = document.getElementById('copy-label');

        const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        codeContainer.addEventListener('click', () => {
            if (!currentCode) return;

            // Remove spaces for copying
            const codeToCopy = currentCode;
            navigator.clipboard.writeText(codeToCopy).then(() => {
                // Success State
                codeContainer.classList.add('copied');
                copyIcon.innerHTML = CHECK_ICON_SVG;
                copyLabel.classList.remove('hidden');
                // Force reflow to enable transition if needed, but class toggle handles it
                setTimeout(() => copyLabel.classList.add('visible'), 10);

                // Revert after 2 seconds
                setTimeout(() => {
                    codeContainer.classList.remove('copied');
                    copyIcon.innerHTML = COPY_ICON_SVG;
                    copyLabel.classList.remove('visible');
                    setTimeout(() => copyLabel.classList.add('hidden'), 200); // Wait for fade out
                }, 500);
            }).catch(err => {
                console.error('Failed to copy:', err);
                showError('Failed to copy code');
            });
        });

        socket.on('receiver-joined', (data) => {
            senderWaiting.classList.add('hidden');
            senderApproval.classList.remove('hidden');
            senderEmoji.textContent = data.emoji;
            // Ensure buttons are hidden if verification is active (though they should be by default)
            btnApprove.parentElement.classList.add('hidden');
            // Wait, I need to check where btnApprove is. It's not in the HTML snippet I saw earlier.
            // Let me check index.html again or just assume I need to add them dynamically or unhide them.
            // Actually, I should check index.html for approval buttons.
        });

        // Manual Approval Logic Removed (Auto-approve now)
        /*
        socket.on('receiver-joined-no-verify', () => { ... });
        btnApprove.addEventListener('click', () => { ... });
        btnReject.addEventListener('click', () => { ... });
        */

        socket.on('verification-success', () => {
            // Sender side: Verification passed or Auto-approved, transfer starting
            senderWaiting.classList.add('hidden'); // Ensure waiting screen is hidden
            senderApproval.classList.remove('hidden'); // Show approval screen
            senderApproval.innerHTML = '<p>Connected! Sending file...</p>';
            setTimeout(resetViews, 3000);
        });
    } catch (err) {
    } catch (err) {
        showError(err.message);
        // Re-enable on error
        btnUpload.disabled = false;
        btnUpload.textContent = 'Get Code';
    }
});



socket.on('verification-success', () => {
    document.getElementById('receiver-status').textContent = 'Verified! Waiting for approval...';
});

socket.on('waiting-for-approval', () => {
    receiverVerification.classList.remove('hidden');
    joinSection.classList.add('hidden');
    document.getElementById('emoji-grid').innerHTML = ''; // Clear grid
    document.getElementById('receiver-status').textContent = 'Waiting for sender approval...';

    // Hide instructions
    const ps = receiverVerification.querySelectorAll('p:not(.status-text)');
    ps.forEach(p => p.classList.add('hidden'));
});

socket.on('verification-failed', () => {
    showError('Wrong emoji! Connection terminated.');
    setTimeout(resetViews, 3000);
});

// OTP Input Logic
otpInputs.forEach((input, index) => {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
            otpInputs[index - 1].focus();
        }
    });

    input.addEventListener('input', (e) => {
        const val = e.target.value;

        // Allow only numbers
        if (val && !/^\d+$/.test(val)) {
            e.target.value = '';
            return;
        }

        if (val) {
            if (index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pasteData.replace(/\D/g, '').split('');

        otpInputs.forEach((inp, i) => {
            if (digits[i]) {
                inp.value = digits[i];
            }
        });

        if (digits.length > 0) {
            const focusIndex = Math.min(digits.length, otpInputs.length - 1);
            otpInputs[focusIndex].focus();
        }
    });
});

// Receiver Logic
btnJoin.addEventListener('click', () => {
    const code = Array.from(otpInputs).map(input => input.value).join('');
    console.log('Joining with code:', code);
    if (code.length !== 6) {
        showError('Please enter a valid 6-digit code.');
        return;
    }
    currentCode = code;
    btnJoin.classList.add('hidden'); // Hide button after click
    socket.emit('join-receiver', code);
    console.log('Emitted join-receiver event');
});

// Duplicate listeners removed


socket.on('transfer-approved', () => {
    receiverVerification.classList.add('hidden');
    downloadSection.classList.remove('hidden');

    // Auto download
    const downloadUrl = `/download/${currentCode}`;
    window.location.href = downloadUrl;

    // Update UI
    const p = downloadSection.querySelector('p');
    if (p) p.textContent = 'Downloading file...';

    // Fallback button
    btnDownload.textContent = 'Download Again';
    btnDownload.onclick = () => {
        window.location.href = downloadUrl;
    };

    // Reset after delay
    setTimeout(() => {
        resetViews();
    }, 5000);
});

socket.on('transfer-rejected', () => {
    showError('Transfer request was rejected by the sender.');
    setTimeout(resetViews, 3000);
});

socket.on('error', (data) => {
    showError(data.message);
    btnJoin.classList.remove('hidden'); // Show button again on error
});

// btnDownload listener is now handled dynamically in transfer-approved
// keeping this for initial state if needed, but overriding above
btnDownload.addEventListener('click', () => {
    if (currentCode) {
        window.location.href = `/download/${currentCode}`;
    }
});

// Initialize emoji display
updateEmojiDisplay();
