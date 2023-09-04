import { $el } from "../ui.js";

export class ComfyDialog {
	constructor() {
		this.element = $el("div.comfy-modal", {parent: document.body}, [
			$el("div.comfy-modal-content", [$el("p", {$: (p) => (this.textElement = p)})]),
			$el("div.comfy-modal-buttons", [...this.createButtons()])
		]);
	}

	createButtons() {
		return [
			$el("button", {
				type: "button",
				textContent: "OK",
				onclick: () => this.close(),
			}),
		];
	}

	close() {
		this.element.style.display = "none";
	}

	show(html) {
		if (typeof html === "string") {
			this.textElement.innerHTML = html;
		} else {
			this.textElement.replaceChildren(html);
		}
		this.element.style.display = "flex";
	}
}

export class ComfyMessageDialog extends ComfyDialog {
	static INFO = Symbol();
	static WARNING = Symbol();
	static ERROR = Symbol();

	constructor() {
		super();
		this.element.classList.add('message-dialog');
	}

	show(type, html) {
		super.show(html);
		const icon = $icon(({
			[this.constructor.INFO]: 'info-standard',
			[this.constructor.WARNING]: 'warning-standard',
			[this.constructor.ERROR]: 'error-standard'
		})[type]);

		icon.classList.add('dialog-icon');
		this.element.querySelector('.dialog-icon')?.remove();
		this.element.querySelector('.comfy-modal-content').prepend(icon);
	}
}
