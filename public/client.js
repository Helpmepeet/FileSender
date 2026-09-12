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

socket.on('verification-options', (data) => {
    console.log('Received verification options:', data);
    try {
        joinSection.classList.add('hidden');
        receiverVerification.classList.remove('hidden');
        document.getElementById('receiver-heading').classList.add('hidden');

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
    clearInterval(expiryTimer);
    senderView.classList.remove('transfer-active');
    document.getElementById('receiver-heading').classList.remove('hidden');
    document.getElementById('btn-finish-transfer').classList.add('hidden');
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
    document.getElementById('receiver-status').textContent = 'Choose an emoji'; // Reset status text

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
    btnUpload.textContent = 'Get code'; // Reset text

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
        fileCountSpan.textContent = '0 files';
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

        const fileDetails = document.createElement('div');
        fileDetails.className = 'flex items-center space-x-3 overflow-hidden';

        const fileIconContainer = document.createElement('div');
        fileIconContainer.className = 'w-8 h-8 bg-blue-50 text-blue-500 rounded flex items-center justify-center flex-shrink-0';
        const fileIcon = document.createElement('i');
        fileIcon.className = 'fas fa-file';
        fileIconContainer.appendChild(fileIcon);

        const fileInfo = document.createElement('div');
        fileInfo.className = 'min-w-0';
        const fileName = document.createElement('p');
        fileName.className = 'text-sm font-medium text-slate-700 truncate';
        fileName.textContent = file.name;
        const fileSize = document.createElement('p');
        fileSize.className = 'text-xs text-slate-400';
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.append(fileName, fileSize);

        fileDetails.append(fileIconContainer, fileInfo);

        const removeButton = document.createElement('button');
        removeButton.className = 'text-slate-300 hover:text-red-500 transition-colors p-1';
        removeButton.onclick = () => window.removeFile(index);
        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-times';
        removeButton.appendChild(removeIcon);

        div.append(fileDetails, removeButton);
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
        showError('Max total size is 100 MB');
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
    document.getElementById('receiver-status').textContent = 'Choose an emoji';

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
            showError('Select at least one file.');
            return;
        }
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        formData.append('type', 'file');
    } else {
        const textContent = textInput.value.trim();
        if (!textContent) {
            showError('Enter some text.');
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

        senderView.classList.add('transfer-active');
        document.getElementById('sender-transfer-title').textContent = 'Your code is ready';
        document.getElementById('sender-transfer-instructions').classList.remove('hidden');
        document.getElementById('sender-transfer-status').textContent = 'Waiting for receiver. Keep this page open.';
        document.getElementById('code-container').classList.remove('hidden');
        document.getElementById('btn-copy-code').classList.remove('hidden');
        document.getElementById('btn-send-again').classList.add('hidden');
        document.getElementById('transfer-emoji-row').classList.toggle('hidden', !data.securityEnabled);
        document.getElementById('transfer-emoji').textContent = data.emoji;
        startExpiry(data.expiresAt);
    } catch (err) {
        showError(err.message);
        // Re-enable on error
        btnUpload.disabled = false;
        btnUpload.textContent = 'Get code';
    }
});



socket.on('verification-success', () => {
    document.getElementById('receiver-status').textContent = 'Verified';
});

socket.on('waiting-for-approval', () => {
    receiverVerification.classList.remove('hidden');
    joinSection.classList.add('hidden');
    document.getElementById('emoji-grid').innerHTML = ''; // Clear grid
    document.getElementById('receiver-status').textContent = 'Waiting for sender...';

    // Hide instructions
    const ps = receiverVerification.querySelectorAll('p:not(.status-text)');
    ps.forEach(p => p.classList.add('hidden'));
});

socket.on('verification-failed', () => {
    document.getElementById('receiver-status').textContent = 'That emoji does not match. Try again.';
    document.querySelectorAll('#emoji-grid button').forEach(button => button.disabled = false);
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
        showError('Enter a 4-digit code.');
        return;
    }
    currentCode = code;
    btnJoin.classList.add('hidden'); // Hide button after click
    socket.emit('join-receiver', code);
    console.log('Emitted join-receiver event');
});

// Duplicate listeners removed


socket.on('transfer-approved', async () => {
    const code = currentCode;
    try {
        const response = await fetch(`/session/${code}/metadata`);
        if (!response.ok) throw new Error('Transfer expired or unavailable. Ask for a new code.');
        const metadata = await response.json();
        if (currentCode !== code) return;
        joinSection.classList.add('hidden');
        receiverVerification.classList.add('hidden');
        document.getElementById('receiver-heading').classList.add('hidden');
        downloadSection.classList.remove('hidden');
        const heading = document.getElementById('download-heading');
        const message = document.getElementById('success-message');
        const textView = document.getElementById('text-content-view');
        const list = document.getElementById('receiver-file-list');
        const finish = document.getElementById('btn-finish-transfer');
        textView.classList.toggle('hidden', metadata.type !== 'text');
        btnDownload.classList.toggle('hidden', metadata.type === 'text');
        list.classList.add('hidden');
        list.replaceChildren();
        finish.classList.add('hidden');
        startExpiry(metadata.expiresAt);
        if (metadata.type === 'text') {
            heading.textContent = 'Your text is ready';
            message.textContent = 'Copy the text, then finish the transfer.';
            document.getElementById('received-text').value = metadata.text;
            document.getElementById('btn-copy-text').onclick = async () => {
                try {
                    await navigator.clipboard.writeText(metadata.text);
                    message.textContent = 'Text copied. You can finish the transfer.';
                    finish.classList.remove('hidden');
                } catch { showError('Could not copy. Select and copy the text manually.'); }
            };
        } else {
            const files = metadata.files;
            heading.textContent = files.length === 1 ? 'Your file is ready' : 'Your files are ready';
            message.textContent = files.length === 1 ? files[0].name : `${files.length} files ready`;
            const download = (index) => {
                const link = document.createElement('a');
                link.href = `/download/${code}${index === undefined ? '' : `?index=${index}`}`;
                link.download = '';
                document.body.appendChild(link);
                link.click();
                link.remove();
                heading.textContent = 'Download started';
                message.textContent = 'Check your Downloads folder. Finish after your downloads are saved.';
                btnDownload.textContent = files.length === 1 ? 'Download again' : 'Download all again (ZIP)';
                finish.classList.remove('hidden');
            };
            btnDownload.disabled = false;
            btnDownload.textContent = files.length === 1 ? 'Download file' : 'Download all (ZIP)';
            btnDownload.onclick = () => download();
            if (files.length > 1) {
                list.classList.remove('hidden');
                files.forEach((file, index) => {
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between gap-4 p-3';
                    const name = document.createElement('span');
                    name.className = 'text-slate-700 break-all';
                    name.textContent = file.name;
                    const button = document.createElement('button');
                    button.className = 'text-blue-600 font-semibold';
                    button.textContent = 'Download';
                    button.onclick = () => download(index);
                    row.append(name, button);
                    list.append(row);
                });
            }
        }
    } catch (err) { showError(err.message); btnJoin.classList.remove('hidden'); }
});

socket.on('transfer-rejected', () => {
    showError('Sender rejected the transfer.');
    setTimeout(resetViews, 3000);
});

socket.on('error', (data) => {
    showError(data.message);
    btnJoin.classList.remove('hidden'); // Show button again on error
});

// Initialize emoji display
updateEmojiDisplay();

// One set of handlers for every transfer, including subsequent transfers.
let expiryTimer;
function startExpiry(expiresAt) {
    clearInterval(expiryTimer);
    const update = () => {
        const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        document.getElementById('transfer-expiry').textContent = `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        if (seconds === 0) {
            clearInterval(expiryTimer);
            if (!senderView.classList.contains('hidden')) {
                document.getElementById('sender-transfer-title').textContent = 'Transfer expired';
                document.getElementById('sender-transfer-instructions').classList.add('hidden');
                document.getElementById('transfer-emoji-row').classList.add('hidden');
                document.getElementById('sender-transfer-status').textContent = 'Send your files again to get a new code.';
                document.getElementById('code-container').classList.add('hidden');
                document.getElementById('btn-copy-code').classList.add('hidden');
                document.getElementById('btn-send-again').classList.remove('hidden');
            } else {
                resetViews();
                showError('Transfer expired. Ask the sender for a new code.');
            }
        }
    };
    expiryTimer = setInterval(update, 1000);
    update();
}
document.getElementById('btn-copy-code').onclick = async () => {
    try { await navigator.clipboard.writeText(currentCode); showToast('Code copied!', 'success'); }
    catch { showError('Could not copy. Use the code shown above.'); }
};
document.getElementById('btn-send-again').onclick = () => { resetViews(); showView(senderView); };
document.getElementById('btn-finish-transfer').onclick = () => {
    socket.emit('complete-session', currentCode);
    clearInterval(expiryTimer);
    btnDownload.classList.add('hidden');
    document.getElementById('btn-finish-transfer').classList.add('hidden');
    document.getElementById('text-content-view').classList.add('hidden');
    document.getElementById('receiver-file-list').classList.add('hidden');
    document.getElementById('download-heading').textContent = 'Transfer finished';
    document.getElementById('success-message').textContent = 'You can close this page.';
};
socket.on('receiver-joined', () => {
    document.getElementById('sender-transfer-status').textContent = 'Receiver connected. Match the emoji on the other device.';
});
socket.on('verification-success', () => {
    if (senderView.classList.contains('hidden')) return;
    document.getElementById('sender-transfer-status').textContent = 'Receiver connected. Your files are ready to download.';
});
socket.on('transfer-completed', () => {
    clearInterval(expiryTimer);
    document.getElementById('sender-transfer-title').textContent = 'Transfer finished';
    document.getElementById('sender-transfer-instructions').classList.add('hidden');
    document.getElementById('transfer-emoji-row').classList.add('hidden');
    document.getElementById('sender-transfer-status').textContent = 'The receiver finished the transfer. You can close this page.';
    document.getElementById('transfer-expiry').textContent = '';
    document.getElementById('code-container').classList.add('hidden');
    document.getElementById('btn-copy-code').classList.add('hidden');
    document.getElementById('btn-send-again').classList.remove('hidden');
});
