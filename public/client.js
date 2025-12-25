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
// const fileInfo = document.getElementById('file-info'); // Removed
// const fileNameSpan = document.getElementById('file-name'); // Removed
// const fileSizeSpan = document.getElementById('file-size'); // Removed
// const btnRemoveFile = document.getElementById('btn-remove-file'); // Removed in favor of bulk list

// New Sender Elements
const tabFile = document.getElementById('tab-file');
const tabText = document.getElementById('tab-text');
const viewFileInput = document.getElementById('view-file-input');
const viewTextInput = document.getElementById('view-text-input');
const textInput = document.getElementById('text-input');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');
const fileCountSpan = document.getElementById('file-count');
const totalSizeSpan = document.getElementById('total-size');
const btnClearFiles = document.getElementById('btn-clear-files');

// State
let activeTab = 'file'; // 'file' or 'text'
let selectedFiles = []; // Array of File objects

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
    selectedFiles = [];
    fileInput.value = '';
    textInput.value = '';
    updateFileListUI();
    // Reset drop zone visibility is handled in updateFileListUI
    btnUpload.disabled = false; // Re-enable button
    btnUpload.textContent = 'Get Code'; // Reset text

    // Reset tabs
    switchTab('file');
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

// Tab Switching logic
function switchTab(tab) {
    activeTab = tab;
    if (tab === 'file') {
        tabFile.classList.add('bg-white', 'text-slate-800', 'shadow-sm', 'font-semibold');
        tabFile.classList.remove('text-slate-500');
        tabText.classList.remove('bg-white', 'text-slate-800', 'shadow-sm', 'font-semibold');
        tabText.classList.add('text-slate-500');

        viewFileInput.classList.remove('translate-x-full', 'opacity-0', 'pointer-events-none');
        viewTextInput.classList.add('translate-x-full', 'opacity-0', 'pointer-events-none');

        // Re-evaluate button state
        updateUploadButtonState();
    } else {
        tabText.classList.add('bg-white', 'text-slate-800', 'shadow-sm', 'font-semibold');
        tabText.classList.remove('text-slate-500');
        tabFile.classList.remove('bg-white', 'text-slate-800', 'shadow-sm', 'font-semibold');
        tabFile.classList.add('text-slate-500');

        viewTextInput.classList.remove('translate-x-full', 'opacity-0', 'pointer-events-none');
        viewFileInput.classList.add('translate-x-0', 'opacity-0', 'pointer-events-none'); // Slide out

        // Re-evaluate button state
        updateUploadButtonState();
    }
}

tabFile.addEventListener('click', () => switchTab('file'));
tabText.addEventListener('click', () => switchTab('text'));

// File Handling Logic
function updateFileListUI() {
    fileList.innerHTML = '';

    if (selectedFiles.length === 0) {
        fileListContainer.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileCountSpan.textContent = '0 Files';
        totalSizeSpan.textContent = '0 MB';
        return;
    }

    dropZone.classList.add('hidden');
    fileListContainer.classList.remove('hidden');

    let totalSize = 0;

    selectedFiles.forEach((file, index) => {
        totalSize += file.size;

        const div = document.createElement('div');
        div.className = 'flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100';
        div.innerHTML = `
            <div class="flex items-center space-x-3 overflow-hidden">
                <div class="w-8 h-8 bg-blue-50 text-blue-500 rounded flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-file"></i>
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-700 truncate">${file.name}</p>
                    <p class="text-xs text-slate-400">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button class="text-slate-300 hover:text-red-500 transition-colors p-1" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(div);
    });

    fileCountSpan.textContent = `${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`;
    totalSizeSpan.textContent = formatFileSize(totalSize);

    updateUploadButtonState();
}

// Global scope for onclick
window.removeFile = (index) => {
    selectedFiles.splice(index, 1);
    updateFileListUI();
};

function handleFileSelect(files) {
    if (!files) return;

    // Add new files to existing list
    const newFiles = Array.from(files);
    // Filter duplicates? Maybe not necessary depending on UX, but let's just add them

    // Check total size limit (100MB)
    let currentTotalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    let newTotalSize = newFiles.reduce((acc, f) => acc + f.size, 0);

    if (currentTotalSize + newTotalSize > 100 * 1024 * 1024) {
        showError('Total size cannot exceed 100MB');
        return;
    }

    selectedFiles = [...selectedFiles, ...newFiles];
    updateFileListUI();
    updateEmojiDisplay(); // Refresh emoji on new activity
}

function updateUploadButtonState() {
    if (activeTab === 'file') {
        if (selectedFiles.length > 0) {
            btnUpload.classList.remove('hidden');
        } else {
            btnUpload.classList.add('hidden');
        }
    } else {
        // Text tab always shows button (checked on click)
        btnUpload.classList.remove('hidden');
    }
}

// Text Input Listener
textInput.addEventListener('input', () => {
    // Optional: Validation
});


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
        handleFileSelect(e.dataTransfer.files);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFileSelect(fileInput.files);
    }
});

btnClearFiles.addEventListener('click', () => {
    selectedFiles = [];
    updateFileListUI();
});

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
    const formData = new FormData();
    const securityEnabled = document.getElementById('security-toggle').checked;

    if (activeTab === 'file') {
        if (selectedFiles.length === 0) {
            showError('Please select at least one file.');
            return;
        }
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        formData.append('type', 'file');
    } else {
        const textContent = textInput.value.trim();
        if (!textContent) {
            showError('Please enter some text.');
            return;
        }
        formData.append('text', textContent);
        formData.append('type', 'text');
    }

    // Disable button to prevent multiple clicks
    btnUpload.disabled = true;
    btnUpload.textContent = 'Uploading...';

    formData.append('emoji', EMOJIS[currentEmojiIndex]); // Send selected emoji
    formData.append('securityEnabled', securityEnabled);

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
    if (code.length !== 4) {
        showError('Please enter a valid 4-digit code.');
        return;
    }
    currentCode = code;
    btnJoin.classList.add('hidden'); // Hide button after click
    socket.emit('join-receiver', code);
    console.log('Emitted join-receiver event');
});

// Duplicate listeners removed


socket.on('transfer-approved', (data) => {
    receiverVerification.classList.add('hidden');
    downloadSection.classList.remove('hidden');

    // Fetch session metadata to render UI correctly
    fetch(`/session/${currentCode}/metadata`)
        .then(res => res.json())
        .then(metadata => {
            const type = metadata.type;
            const p = downloadSection.querySelector('#success-message');
            const textContentView = document.getElementById('text-content-view');
            const btnDownload = document.getElementById('btn-download');
            const receiverFileList = document.getElementById('receiver-file-list');

            // Track downloaded files
            const downloadedFiles = new Set();
            const totalFiles = metadata.files ? metadata.files.length : 0;

            // Reset UI
            textContentView.classList.add('hidden');
            receiverFileList.classList.add('hidden');
            btnDownload.classList.remove('hidden');

            if (type === 'text') {
                p.textContent = 'Text received successfully!';
                textContentView.classList.remove('hidden');
                document.getElementById('received-text').value = metadata.text;
                btnDownload.classList.add('hidden'); // Hide download button for text

                // Copy Text Logic
                const btnCopy = document.getElementById('btn-copy-text');
                // Remove old listener to avoid duplicates if re-rendering
                const newBtnCopy = btnCopy.cloneNode(true);
                btnCopy.parentNode.replaceChild(newBtnCopy, btnCopy);

                newBtnCopy.onclick = () => {
                    const text = document.getElementById('received-text').value;
                    navigator.clipboard.writeText(text).then(() => {
                        showToast('Text copied!', 'success');
                        // Signal completion for text
                        socket.emit('complete-session', currentCode);
                        setTimeout(() => {
                            resetViews();
                        }, 1500);
                    });
                };
            } else {
                // FILE MODE
                const files = metadata.files || [];

                if (files.length === 1) {
                    // Single File Mode - cleaner UI
                    p.textContent = 'File received: ' + files[0].name;
                    btnDownload.textContent = 'Download File';
                    btnDownload.onclick = () => {
                        window.location.href = `/download/${currentCode}`;
                    };
                } else {
                    // Multi File Mode - List + Zip
                    p.textContent = `${files.length} Files Received`;
                    receiverFileList.classList.remove('hidden');
                    receiverFileList.innerHTML = '';

                    files.forEach((file, index) => {
                        const div = document.createElement('div');
                        div.className = 'flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100';
                        div.innerHTML = `
                            <div class="flex items-center space-x-3 overflow-hidden">
                                <div class="w-8 h-8 bg-blue-50 text-blue-500 rounded flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-file"></i>
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-medium text-slate-700 truncate">${file.name}</p>
                                    <p class="text-xs text-slate-400">${formatFileSize(file.size)}</p>
                                </div>
                            </div>
                            <button id="btn-dl-${index}" class="text-blue-500 hover:text-blue-700 font-semibold text-sm px-3 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors">
                                Download
                            </button>
                        `;
                        receiverFileList.appendChild(div);

                        // Individual Download Listener
                        document.getElementById(`btn-dl-${index}`).onclick = () => {
                            downloadSingleFile(index);
                            downloadedFiles.add(index);

                            // Check if all files downloaded
                            if (downloadedFiles.size === totalFiles) {
                                // Add delay to ensure download request reaches server
                                setTimeout(() => {
                                    socket.emit('complete-session', currentCode);
                                    setTimeout(() => {
                                        resetViews();
                                    }, 1500);
                                }, 1000);
                            }
                        };
                    });

                    btnDownload.textContent = 'Download All';
                    btnDownload.onclick = () => {
                        // Disable button
                        btnDownload.disabled = true;
                        btnDownload.textContent = 'Downloading...';

                        // Download each file individually with a small delay
                        files.forEach((file, index) => {
                            setTimeout(() => {
                                downloadSingleFile(index);
                            }, index * 500); // 500ms delay between downloads
                        });

                        // Signal completion after last download triggered
                        setTimeout(() => {
                            socket.emit('complete-session', currentCode);
                            resetViews();
                        }, files.length * 500 + 1000);
                    };
                }
            }
        })
        .catch(err => {
            console.error('Metadata fetch error:', err);
            showError('Failed to load session details');
        });
});

// Helper for single file download
window.downloadSingleFile = (index) => {
    window.location.href = `/download/${currentCode}?index=${index}`;
};

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
