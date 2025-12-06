export class Modal {
    constructor() {
        this.dialog = null;
        this.resolver = null;
        this.init();
    }

    init() {
        let dialog = document.getElementById('custom-modal');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'custom-modal';
            document.body.appendChild(dialog);

            dialog.addEventListener('click', (event) => {
                const rect = dialog.querySelector('article').getBoundingClientRect();
                const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
                    rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
                if (!isInDialog) {
                    this.cancel();
                }
            });
        }
        this.dialog = dialog;
    }

    static confirm(message, title = '확인') {
        return new Modal().showInternal({ type: 'confirm', message, title });
    }

    static alert(message, title = '알림') {
        return new Modal().showInternal({ type: 'alert', message, title });
    }

    static prompt(message, defaultValue = '', title = '입력') {
        return new Modal().showInternal({ type: 'prompt', message, title, defaultValue });
    }

    showInternal(options) {
        const { type, message, title, defaultValue } = options;
        this.currentType = type;
        const dialog = this.dialog;

        let inputHtml = '';
        if (type === 'prompt') {
            inputHtml = `<input type="text" id="modal-input" value="${defaultValue}" style="margin-top: 1rem;">`;
        }

        // Close Icon SVG
        const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        dialog.innerHTML = `
            <article>
                <heading>
                    <h3 id="modal-title" style="margin:0;">${title}</h3>
                    <button aria-label="Close" rel="prev" id="modal-close" style="background:none; border:none; color:inherit; padding:0; cursor:pointer; display: flex; align-items: center;">${closeIcon}</button>
                </heading>
                <p id="modal-body">${message}</p>
                ${inputHtml}
                <footer id="modal-footer"></footer>
            </article>
        `;

        dialog.querySelector('#modal-close').onclick = () => this.cancel();

        const footer = dialog.querySelector('#modal-footer');

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'secondary';
        cancelBtn.textContent = '취소';
        cancelBtn.onclick = () => this.cancel();

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '확인';
        confirmBtn.onclick = () => {
            if (type === 'prompt') {
                const val = dialog.querySelector('#modal-input').value;
                this.resolve(val);
            } else {
                this.resolve(true);
            }
        };

        if (type === 'alert') {
            confirmBtn.onclick = () => this.resolve(true);
            footer.appendChild(confirmBtn);
        } else {
            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
        }

        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            if (type === 'alert') {
                alert(message);
                return Promise.resolve(true);
            } else if (type === 'confirm') {
                return Promise.resolve(confirm(message));
            } else if (type === 'prompt') {
                return Promise.resolve(prompt(message, defaultValue));
            }
        }

        if (type === 'prompt') {
            const input = dialog.querySelector('#modal-input');
            setTimeout(() => input && input.focus(), 0);
        }

        return new Promise((resolve) => {
            this.resolver = resolve;
        });
    }

    resolve(value) {
        if (this.resolver) {
            this.resolver(value);
            this.resolver = null;
        }
        this.close();
    }

    cancel() {
        if (this.resolver) {
            this.resolver(this.currentType === 'confirm' ? false : null);
            this.resolver = null;
        }
        this.close();
    }

    close() {
        if (this.dialog) {
            this.dialog.setAttribute('closing', '');
            this.dialog.addEventListener('animationend', () => {
                this.dialog.removeAttribute('closing');
                this.dialog.close();
            }, { once: true });
        }
    }
}

window.Modal = Modal;
