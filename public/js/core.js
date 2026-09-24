(function () {
    const byId = (id) => document.getElementById(id);
    const emojis = ['🍎', '🍌', '🍇', '🥦', '🥕', '🐶', '⚽', '🚀', '💧'];

    window.FileSender = {
        socket: io(),
        state: {
            activeTab: 'file',
            selectedFiles: [],
            currentCode: null,
            expiryTimer: null,
            currentEmojiIndex: Math.floor(Math.random() * emojis.length)
        },
        emojis,
        elements: {
            modeSelection: byId('mode-selection'),
            senderView: byId('sender-view'),
            receiverView: byId('receiver-view'),
            btnSendMode: byId('btn-send-mode'),
            btnReceiveMode: byId('btn-receive-mode'),
            btnBackGlobal: byId('btn-back-global'),
            statusMessage: byId('status-message'),
            fileInput: byId('file-input'),
            btnUpload: byId('btn-upload'),
            senderWaiting: byId('sender-waiting'),
            displayCode: byId('display-code'),
            uploadSection: byId('upload-section'),
            dropZone: byId('drop-zone'),
            tabFile: byId('tab-file'),
            tabText: byId('tab-text'),
            viewFileInput: byId('view-file-input'),
            viewTextInput: byId('view-text-input'),
            textInput: byId('text-input'),
            fileListContainer: byId('file-list-container'),
            fileList: byId('file-list'),
            fileCount: byId('file-count'),
            totalSize: byId('total-size'),
            btnClearFiles: byId('btn-clear-files'),
            selectedEmoji: byId('selected-emoji-display'),
            emojiSelector: byId('emoji-selector'),
            emojiOverlay: byId('emoji-overlay'),
            securityToggle: byId('security-toggle'),
            otpInputs: document.querySelectorAll('.otp-input'),
            btnJoin: byId('btn-join'),
            joinSection: byId('join-section'),
            receiverVerification: byId('receiver-verification'),
            receiverHeading: byId('receiver-heading'),
            receiverStatus: byId('receiver-status'),
            emojiGrid: byId('emoji-grid'),
            downloadSection: byId('download-section'),
            btnDownload: byId('btn-download'),
            downloadHeading: byId('download-heading'),
            successMessage: byId('success-message'),
            textContentView: byId('text-content-view'),
            receivedText: byId('received-text'),
            btnCopyText: byId('btn-copy-text'),
            receiverFileList: byId('receiver-file-list'),
            btnFinishTransfer: byId('btn-finish-transfer'),
            transferExpiry: byId('transfer-expiry')
        }
    };
}());
