(function () {
    const FS = window.FileSender;
    const { elements: el } = FS;

    FS.sender.init();
    FS.receiver.init();

    el.btnSendMode.addEventListener('click', () => FS.ui.showView(el.senderView));
    el.btnReceiveMode.addEventListener('click', () => FS.receiver.open());
    el.btnBackGlobal.addEventListener('click', () => FS.ui.resetViews());
}());
