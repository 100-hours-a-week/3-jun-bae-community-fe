export class Modal {
    constructor() {
        this.dialog = null;
        this.resolver = null; // Renamed from confirmResolver to generic resolver
        this.init();
    }

    init() {
        let dialog = document.getElementById('custom-modal');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'custom-modal';
            // InnerHTML will be set dynamically
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

    // Returns Promise<boolean>
    static confirm(message, title = '확인') {
        return new Modal().showInternal({ type: 'confirm', message, title });
    }

    // Returns Promise<void>
    static alert(message, title = '알림') {
        return new Modal().showInternal({ type: 'alert', message, title });
    }

    // Returns Promise<string | null>
    static prompt(message, defaultValue = '', title = '입력') {
        return new Modal().showInternal({ type: 'prompt', message, title, defaultValue });
    }

    showInternal(options) {
        const { type, message, title, defaultValue } = options;
        const dialog = this.dialog;

        let inputHtml = '';
        if (type === 'prompt') {
            inputHtml = `<input type="text" id="modal-input" value="${defaultValue}" style="margin-top: 1rem;">`;
        }

        dialog.innerHTML = `
            <article>
                <header>
                    <h3 id="modal-title">${title}</h3>
                    <button aria-label="Close" rel="prev" id="modal-close"></button>
                </header>
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
            // Alert only has OK button
            confirmBtn.onclick = () => this.resolve(true);
            footer.appendChild(confirmBtn);
        } else {
            // Confirm and Prompt have Cancel/OK
            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
        }

        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            // Fallback
            if (type === 'alert') {
                alert(message);
                return Promise.resolve(true);
            } else if (type === 'confirm') {
                return Promise.resolve(confirm(message));
            } else if (type === 'prompt') {
                return Promise.resolve(prompt(message, defaultValue));
            }
        }

        // Focus input if prompt
        if (type === 'prompt') {
            const input = dialog.querySelector('#modal-input');
            if (input) input.focus();
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
            this.resolver(null); // Return null for cancel in prompt/confirm(false)
            // For confirm, usually we want false, for prompt null.
            // Let's standardize: Confirm -> false, Prompt -> null.
            // But strict boolean types might need checking.
            // My current confirm implementation returned resolve(true/false) in previous version.
            // In init version above: confirm calls resolve(true). cancel calls resolve(null)?
            // Wait, for confirm() logic:
            // if (confirmed) ...
            // usually confirm() returns boolean.
            // So I should distinguish.
        }
        // Actually, let's fix resolve/cancel logic based on type. 
        // But showInternal is generic.
        // It's cleaner to handle at caller, but I can check type if I stored it.
        // Simplified: 
        // Alert: resolve(true) on OK.
        // Confirm: resolve(true) on OK, resolve(false) on Cancel.
        // Prompt: resolve(value) on OK, resolve(null) on Cancel.

        // But I don't have type in cancel().
        // I will just return null for cancel, and handle the boolean conversion in static method wrapper?
        // Or store type in instance.
        this.close();
    }

    // Override cancel to be smarter
    cancel() {
        if (this.resolver) {
            // We can't easily know the type here unless we stored it.
            // But returning null is "falsy", so for confirm it works as false (mostly).
            // But strict check (=== false) fails.
            // Let's store type.
            this.resolver(this.currentType === 'confirm' ? false : null);
            this.resolver = null;
        }
        this.close();
    }

    showInternal(options) {
        this.currentType = options.type;
        // ... (rest as above)
        // Re-paste the whole method in the tool
        const { type, message, title, defaultValue } = options;
        const dialog = this.dialog;

        let inputHtml = '';
        if (type === 'prompt') {
            inputHtml = `<input type="text" id="modal-input" value="${defaultValue}" style="margin-top: 1rem;">`;
        }

        dialog.innerHTML = `
            <article>
                <header>
                    <h3 id="modal-title">${title}</h3>
                    <button aria-label="Close" rel="prev" id="modal-close"></button>
                </header>
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
            // Timeout to ensure render
            setTimeout(() => input && input.focus(), 0);
        }

        return new Promise((resolve) => {
            this.resolver = resolve;
        });
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
