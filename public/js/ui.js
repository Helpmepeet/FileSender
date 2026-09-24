(function () {
    const FS = window.FileSender;
    const { elements: el, state } = FS;

    FS.ui = {
        showToast(message, type = 'error') {
            el.statusMessage.textContent = message;
            el.statusMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-emerald-100', 'text-emerald-700');
            el.statusMessage.classList.add(type === 'success' ? 'bg-emerald-100' : 'bg-red-100', type === 'success' ? 'text-emerald-700' : 'text-red-700');
            setTimeout(() => el.statusMessage.classList.add('hidden'), 3000);
        },

        showError(message) {
            this.showToast(message);
        },

        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const index = Math.floor(Math.log(bytes) / Math.log(1024));
            return `${Number.parseFloat((bytes / (1024 ** index)).toFixed(2))} ${sizes[index]}`;
        },

        showView(view) {
            el.modeSelection.classList.add('hidden');
            el.senderView.classList.add('hidden');
            el.receiverView.classList.add('hidden');
            view.classList.remove('hidden');
            el.statusMessage.classList.add('hidden');
            el.btnBackGlobal.classList.remove('hidden');
        },

        resetViews() {
            clearInterval(state.expiryTimer);
            el.senderView.classList.remove('transfer-active');
            el.modeSelection.classList.remove('hidden');
            el.senderView.classList.add('hidden');
            el.receiverView.classList.add('hidden');
            el.statusMessage.classList.add('hidden');
            el.btnBackGlobal.classList.add('hidden');
            FS.sender.reset();
            FS.receiver.reset();
            state.currentCode = null;
        },

        startExpiry(expiresAt) {
            clearInterval(state.expiryTimer);
            const update = () => {
                const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
                el.transferExpiry.textContent = `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
                if (seconds !== 0) return;

                clearInterval(state.expiryTimer);
                if (!el.senderView.classList.contains('hidden')) {
                    FS.sender.showExpired();
                } else {
                    this.resetViews();
                    this.showError('Transfer expired. Ask the sender for a new code.');
                }
            };
            state.expiryTimer = setInterval(update, 1000);
            update();
        }
    };
}());
