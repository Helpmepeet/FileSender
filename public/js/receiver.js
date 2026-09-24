(function () {
    const FS = window.FileSender;
    const { elements: el, state } = FS;

    function resetOtpInputs() {
        el.otpInputs.forEach((input) => { input.value = ''; });
        el.otpInputs[0].focus();
    }

    function showVerification(options) {
        try {
            if (!Array.isArray(options)) throw new Error('Invalid options received');
            el.joinSection.classList.add('hidden');
            el.receiverVerification.classList.remove('hidden');
            el.receiverHeading.classList.add('hidden');
            el.receiverVerification.querySelectorAll('p:not(.status-text)').forEach((paragraph) => paragraph.classList.remove('hidden'));
            el.emojiGrid.replaceChildren();
            options.forEach((emoji) => {
                const button = document.createElement('button');
                button.className = 'emoji-btn';
                button.textContent = emoji;
                button.addEventListener('click', () => {
                    FS.socket.emit('verify-emoji', { code: state.currentCode, emoji });
                    el.receiverStatus.textContent = 'Verifying...';
                    el.emojiGrid.querySelectorAll('button').forEach((choice) => { choice.disabled = true; });
                });
                el.emojiGrid.append(button);
            });
        } catch (error) {
            console.error('Error in verification-options:', error);
            FS.ui.showError(`Error loading verification options: ${error.message}`);
        }
    }

    async function showApprovedTransfer({ redeemToken } = {}) {
        const code = state.currentCode;
        try {
            const approval = await fetch(`/api/transfers/${code}/redeem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redeemToken })
            });
            if (!approval.ok) throw new Error('Could not confirm the transfer. Ask for a new code.');
            const response = await fetch(`/session/${code}/metadata`);
            if (!response.ok) throw new Error('Transfer expired or unavailable. Ask for a new code.');
            const metadata = await response.json();
            if (state.currentCode !== code) return;

            el.joinSection.classList.add('hidden');
            el.receiverVerification.classList.add('hidden');
            el.receiverHeading.classList.add('hidden');
            el.downloadSection.classList.remove('hidden');
            el.textContentView.classList.toggle('hidden', metadata.type !== 'text');
            el.btnDownload.classList.toggle('hidden', metadata.type === 'text');
            el.receiverFileList.classList.add('hidden');
            el.receiverFileList.replaceChildren();
            el.btnFinishTransfer.classList.add('hidden');
            FS.ui.startExpiry(metadata.expiresAt);

            if (metadata.type === 'text') {
                showTextTransfer(metadata);
            } else {
                showFileTransfer(code, metadata.files);
            }
        } catch (error) {
            FS.ui.showError(error.message);
            el.btnJoin.classList.remove('hidden');
        }
    }

    function showTextTransfer(metadata) {
        el.downloadHeading.textContent = 'Your text is ready';
        el.successMessage.textContent = 'Copy the text, then finish the transfer.';
        el.receivedText.value = metadata.text;
        el.btnCopyText.onclick = async () => {
            try {
                await navigator.clipboard.writeText(metadata.text);
                el.successMessage.textContent = 'Text copied. You can finish the transfer.';
                el.btnFinishTransfer.classList.remove('hidden');
            } catch {
                FS.ui.showError('Could not copy. Select and copy the text manually.');
            }
        };
    }

    function showFileTransfer(code, files) {
        el.downloadHeading.textContent = files.length === 1 ? 'Your file is ready' : 'Your files are ready';
        el.successMessage.textContent = files.length === 1 ? files[0].name : `${files.length} files ready`;
        const download = (index) => {
            const link = document.createElement('a');
            link.href = `/download/${code}${index === undefined ? '' : `?index=${index}`}`;
            link.download = '';
            document.body.append(link);
            link.click();
            link.remove();
            el.downloadHeading.textContent = 'Download started';
            el.successMessage.textContent = 'Check your Downloads folder. Finish after your downloads are saved.';
            el.btnDownload.textContent = files.length === 1 ? 'Download again' : 'Download all again (ZIP)';
            el.btnFinishTransfer.classList.remove('hidden');
        };

        el.btnDownload.disabled = false;
        el.btnDownload.textContent = files.length === 1 ? 'Download file' : 'Download all (ZIP)';
        el.btnDownload.onclick = () => download();
        if (files.length > 1) {
            el.receiverFileList.classList.remove('hidden');
            files.forEach((file, index) => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between gap-4 p-3';
                const name = document.createElement('span');
                name.className = 'text-slate-700 break-all';
                name.textContent = file.name;
                const button = document.createElement('button');
                button.className = 'text-blue-600 font-semibold';
                button.textContent = 'Download';
                button.addEventListener('click', () => download(index));
                row.append(name, button);
                el.receiverFileList.append(row);
            });
        }
    }

    function joinTransfer() {
        const code = Array.from(el.otpInputs).map((input) => input.value).join('');
        if (code.length !== 4) return FS.ui.showError('Enter a 4-digit code.');
        state.currentCode = code;
        el.btnJoin.classList.add('hidden');
        FS.socket.emit('join-receiver', code);
    }

    FS.receiver = {
        init() {
            el.otpInputs.forEach((input, index) => {
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Backspace' && !input.value && index > 0) el.otpInputs[index - 1].focus();
                });
                input.addEventListener('input', (event) => {
                    if (event.target.value && !/^\d+$/.test(event.target.value)) event.target.value = '';
                    if (event.target.value && index < el.otpInputs.length - 1) el.otpInputs[index + 1].focus();
                });
                input.addEventListener('paste', (event) => {
                    event.preventDefault();
                    const digits = (event.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').split('');
                    el.otpInputs.forEach((otp, otpIndex) => { if (digits[otpIndex]) otp.value = digits[otpIndex]; });
                    if (digits.length) el.otpInputs[Math.min(digits.length, el.otpInputs.length - 1)].focus();
                });
            });
            el.btnJoin.addEventListener('click', joinTransfer);
            el.btnFinishTransfer.onclick = () => {
                FS.socket.emit('complete-session', state.currentCode);
                clearInterval(state.expiryTimer);
                el.btnDownload.classList.add('hidden');
                el.btnFinishTransfer.classList.add('hidden');
                el.textContentView.classList.add('hidden');
                el.receiverFileList.classList.add('hidden');
                el.downloadHeading.textContent = 'Transfer finished';
                el.successMessage.textContent = 'You can close this page.';
            };
            FS.socket.on('verification-options', ({ options }) => showVerification(options));
            FS.socket.on('verification-success', () => {
                if (!el.receiverView.classList.contains('hidden')) el.receiverStatus.textContent = 'Verified';
            });
            FS.socket.on('verification-failed', () => {
                el.receiverStatus.textContent = 'That emoji does not match. Try again.';
                el.emojiGrid.querySelectorAll('button').forEach((button) => { button.disabled = false; });
            });
            FS.socket.on('transfer-approved', showApprovedTransfer);
            FS.socket.on('error', (data) => {
                FS.ui.showError(data.message);
                if (!el.receiverView.classList.contains('hidden')) FS.receiver.reset();
            });
        },

        open() {
            this.reset();
            FS.ui.showView(el.receiverView);
            [100, 300, 500].forEach((delay) => setTimeout(() => {
                if (!el.otpInputs[0].disabled) el.otpInputs[0].focus();
            }, delay));
        },

        reset() {
            el.receiverHeading.classList.remove('hidden');
            resetOtpInputs();
            el.joinSection.classList.remove('hidden');
            el.btnJoin.classList.remove('hidden');
            el.receiverVerification.classList.add('hidden');
            el.downloadSection.classList.add('hidden');
            el.receiverStatus.textContent = 'Choose an emoji';
        }
    };
}());
