(function () {
    const FS = window.FileSender;
    const { elements: el, state, emojis } = FS;
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024;

    function updateEmojiDisplay() {
        el.selectedEmoji.textContent = emojis[state.currentEmojiIndex];
    }

    function updateSecurityState() {
        el.emojiSelector.classList.toggle('opacity-50', !el.securityToggle.checked);
        el.emojiSelector.classList.toggle('pointer-events-none', !el.securityToggle.checked);
        el.emojiSelector.classList.toggle('grayscale', !el.securityToggle.checked);
        if (el.emojiOverlay) el.emojiOverlay.classList.toggle('hidden', el.securityToggle.checked);
    }

    function updateUploadButton() {
        el.btnUpload.classList.toggle('hidden', state.activeTab === 'file' && state.selectedFiles.length === 0);
    }

    function renderFileList() {
        el.fileList.replaceChildren();
        if (state.selectedFiles.length === 0) {
            el.fileListContainer.classList.add('hidden');
            el.dropZone.classList.remove('hidden');
            el.fileCount.textContent = '0 files';
            el.totalSize.textContent = '0 MB';
            updateUploadButton();
            return;
        }

        el.dropZone.classList.add('hidden');
        el.fileListContainer.classList.remove('hidden');
        let totalSize = 0;
        state.selectedFiles.forEach((file, index) => {
            totalSize += file.size;
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100';
            const details = document.createElement('div');
            details.className = 'flex items-center space-x-3 overflow-hidden';
            details.innerHTML = '<div class="w-8 h-8 bg-blue-50 text-blue-500 rounded flex items-center justify-center flex-shrink-0"><i class="fas fa-file"></i></div>';
            const info = document.createElement('div');
            info.className = 'min-w-0';
            const name = document.createElement('p');
            name.className = 'text-sm font-medium text-slate-700 truncate';
            name.textContent = file.name;
            const size = document.createElement('p');
            size.className = 'text-xs text-slate-400';
            size.textContent = FS.ui.formatFileSize(file.size);
            info.append(name, size);
            details.append(info);
            const remove = document.createElement('button');
            remove.className = 'text-slate-300 hover:text-red-500 transition-colors p-1';
            remove.innerHTML = '<i class="fas fa-times"></i>';
            remove.addEventListener('click', () => {
                state.selectedFiles.splice(index, 1);
                renderFileList();
            });
            row.append(details, remove);
            el.fileList.append(row);
        });
        el.fileCount.textContent = `${state.selectedFiles.length} File${state.selectedFiles.length !== 1 ? 's' : ''}`;
        el.totalSize.textContent = FS.ui.formatFileSize(totalSize);
        updateUploadButton();
    }

    function switchTab(tab) {
        state.activeTab = tab;
        const isFile = tab === 'file';
        el.tabFile.classList.toggle('bg-white', isFile);
        el.tabFile.classList.toggle('text-slate-800', isFile);
        el.tabFile.classList.toggle('shadow-sm', isFile);
        el.tabFile.classList.toggle('font-semibold', isFile);
        el.tabFile.classList.toggle('text-slate-500', !isFile);
        el.tabText.classList.toggle('bg-white', !isFile);
        el.tabText.classList.toggle('text-slate-800', !isFile);
        el.tabText.classList.toggle('shadow-sm', !isFile);
        el.tabText.classList.toggle('font-semibold', !isFile);
        el.tabText.classList.toggle('text-slate-500', isFile);
        el.viewFileInput.classList.toggle('translate-x-full', !isFile);
        el.viewFileInput.classList.toggle('translate-x-0', isFile);
        el.viewFileInput.classList.toggle('opacity-0', !isFile);
        el.viewFileInput.classList.toggle('pointer-events-none', !isFile);
        el.viewTextInput.classList.toggle('translate-x-full', isFile);
        el.viewTextInput.classList.toggle('opacity-0', isFile);
        el.viewTextInput.classList.toggle('pointer-events-none', isFile);
        updateUploadButton();
    }

    function addFiles(files) {
        const newFiles = Array.from(files || []);
        const totalSize = [...state.selectedFiles, ...newFiles].reduce((sum, file) => sum + file.size, 0);
        if (totalSize > MAX_TOTAL_SIZE) return FS.ui.showError('Max total size is 100 MB');
        state.selectedFiles.push(...newFiles);
        renderFileList();
        updateEmojiDisplay();
    }

    async function uploadTransfer() {
        const formData = new FormData();
        if (state.activeTab === 'file') {
            if (state.selectedFiles.length === 0) return FS.ui.showError('Select at least one file.');
            state.selectedFiles.forEach((file) => formData.append('files', file));
            formData.append('type', 'file');
        } else {
            const text = el.textInput.value.trim();
            if (!text) return FS.ui.showError('Enter some text.');
            formData.append('text', text);
            formData.append('type', 'text');
        }

        el.btnUpload.disabled = true;
        el.btnUpload.textContent = 'Uploading...';
        formData.append('emoji', emojis[state.currentEmojiIndex]);
        formData.append('securityEnabled', el.securityToggle.checked);
        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            state.currentCode = data.code;
            el.displayCode.textContent = data.code.split('').join(' ');
            el.uploadSection.classList.add('hidden');
            el.senderWaiting.classList.remove('hidden');
            FS.socket.emit('register-sender', { code: data.code, senderToken: data.senderToken });
            el.senderView.classList.add('transfer-active');
            document.getElementById('sender-transfer-title').textContent = 'Your code is ready';
            document.getElementById('sender-transfer-instructions').classList.remove('hidden');
            document.getElementById('sender-transfer-status').textContent = 'Waiting for receiver. Keep this page open.';
            document.getElementById('code-container').classList.remove('hidden');
            document.getElementById('btn-copy-code').classList.remove('hidden');
            document.getElementById('btn-send-again').classList.add('hidden');
            document.getElementById('transfer-emoji-row').classList.toggle('hidden', !data.securityEnabled);
            document.getElementById('transfer-emoji').textContent = data.emoji;
            FS.ui.startExpiry(data.expiresAt);
        } catch (error) {
            FS.ui.showError(error.message);
            el.btnUpload.disabled = false;
            el.btnUpload.textContent = 'Get code';
        }
    }

    FS.sender = {
        init() {
            updateEmojiDisplay();
            updateSecurityState();
            switchTab('file');
            el.tabFile.addEventListener('click', () => switchTab('file'));
            el.tabText.addEventListener('click', () => switchTab('text'));
            el.dropZone.addEventListener('click', () => el.fileInput.click());
            el.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); el.dropZone.classList.add('drag-over'); });
            el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('drag-over'));
            el.dropZone.addEventListener('drop', (event) => { event.preventDefault(); el.dropZone.classList.remove('drag-over'); addFiles(event.dataTransfer.files); });
            el.fileInput.addEventListener('change', () => addFiles(el.fileInput.files));
            el.btnClearFiles.addEventListener('click', () => { state.selectedFiles = []; renderFileList(); });
            document.getElementById('btn-prev-emoji').addEventListener('click', () => { state.currentEmojiIndex = (state.currentEmojiIndex - 1 + emojis.length) % emojis.length; updateEmojiDisplay(); });
            document.getElementById('btn-next-emoji').addEventListener('click', () => { state.currentEmojiIndex = (state.currentEmojiIndex + 1) % emojis.length; updateEmojiDisplay(); });
            el.securityToggle.addEventListener('change', updateSecurityState);
            el.btnUpload.addEventListener('click', uploadTransfer);
            document.getElementById('btn-copy-code').onclick = async () => {
                try { await navigator.clipboard.writeText(state.currentCode); FS.ui.showToast('Code copied!', 'success'); }
                catch { FS.ui.showError('Could not copy. Use the code shown above.'); }
            };
            document.getElementById('btn-send-again').onclick = () => { FS.ui.resetViews(); FS.ui.showView(el.senderView); };
            FS.socket.on('receiver-joined', () => { document.getElementById('sender-transfer-status').textContent = 'Receiver connected. Match the emoji on the other device.'; });
            FS.socket.on('verification-success', ({ expiresAt } = {}) => {
                if (!el.senderView.classList.contains('hidden')) {
                    document.getElementById('sender-transfer-status').textContent = 'Receiver connected. Your files are ready to download.';
                    if (expiresAt) FS.ui.startExpiry(expiresAt);
                }
            });
            FS.socket.on('transfer-completed', () => this.showCompleted());
        },

        reset() {
            state.selectedFiles = [];
            el.fileInput.value = '';
            el.textInput.value = '';
            el.btnUpload.disabled = false;
            el.btnUpload.textContent = 'Get code';
            el.uploadSection.classList.remove('hidden');
            el.senderWaiting.classList.add('hidden');
            switchTab('file');
            renderFileList();
        },

        showExpired() {
            document.getElementById('sender-transfer-title').textContent = 'Transfer expired';
            document.getElementById('sender-transfer-instructions').classList.add('hidden');
            document.getElementById('transfer-emoji-row').classList.add('hidden');
            document.getElementById('sender-transfer-status').textContent = 'Send your files again to get a new code.';
            document.getElementById('code-container').classList.add('hidden');
            document.getElementById('btn-copy-code').classList.add('hidden');
            document.getElementById('btn-send-again').classList.remove('hidden');
        },

        showCompleted() {
            clearInterval(state.expiryTimer);
            document.getElementById('sender-transfer-title').textContent = 'Transfer finished';
            document.getElementById('sender-transfer-instructions').classList.add('hidden');
            document.getElementById('transfer-emoji-row').classList.add('hidden');
            document.getElementById('sender-transfer-status').textContent = 'The receiver finished the transfer. You can close this page.';
            el.transferExpiry.textContent = '';
            document.getElementById('code-container').classList.add('hidden');
            document.getElementById('btn-copy-code').classList.add('hidden');
            document.getElementById('btn-send-again').classList.remove('hidden');
        }
    };
}());
