import { api } from "./api.js";
import { ComfyDialog as _ComfyDialog, ComfyMessageDialog } from "./ui/dialog.js";
import { toggleSwitch } from "./ui/toggleSwitch.js";
import { ComfySettingsDialog } from "./ui/settings.js";

export const ComfyDialog = _ComfyDialog;

const icon_cache = new Map();

export function $icon(name) {
	const container = document.createElement("div");
	container.classList.add("icon");

	if (icon_cache.has(name)) {
		container.appendChild(icon_cache.get(name).cloneNode(true));
	} else {
		!(async () => {
			const svg = await fetch(`icons/${name}.svg`).then(r => r.text());
			container.innerHTML = svg;
			icon_cache.set(name, container.querySelector('svg'));
		})();
	}

	return container;
}

/**
 * 
 * @param { string } tag HTML Element Tag and optional classes e.g. div.class1.class2
 * @param { string | Element | Element[] | {
 * 	 parent?: Element,
 *   $?: (el: Element) => void, 
 *   dataset?: DOMStringMap,
 *   style?: CSSStyleDeclaration,
 * 	 for?: string
 * } | undefined } propsOrChildren 
 * @param { Element[] | undefined } [children]
 * @returns 
 */
export function $el(tag, propsOrChildren, children) {
	const split = tag.split(".");
	const element = document.createElement(split.shift());
	if (split.length > 0) {
		element.classList.add(...split);
	}

	if (propsOrChildren) {
		if (typeof propsOrChildren === "string") {
			propsOrChildren = { textContent: propsOrChildren };
		} else if (propsOrChildren instanceof Element) {
			propsOrChildren = [propsOrChildren];
		}
		if (Array.isArray(propsOrChildren)) {
			element.append(...propsOrChildren);
		} else {
			const {parent, $: cb, dataset, style} = propsOrChildren;
			delete propsOrChildren.parent;
			delete propsOrChildren.$;
			delete propsOrChildren.dataset;
			delete propsOrChildren.style;

			if (Object.hasOwn(propsOrChildren, "for")) {
				element.setAttribute("for", propsOrChildren.for)
			}

			if (style) {
				Object.assign(element.style, style);
			}

			if (dataset) {
				Object.assign(element.dataset, dataset);
			}

			Object.assign(element, propsOrChildren);
			if (children) {
				element.append(...(children instanceof Array ? children : [children]));
			}

			if (parent) {
				parent.append(element);
			}

			if (cb) {
				cb(element);
			}
		}
	}
	return element;
}

function dragElement(dragEl, settings) {
	var posDiffX = 0,
		posDiffY = 0,
		posStartX = 0,
		posStartY = 0,
		newPosX = 0,
		newPosY = 0;
	if (dragEl.getElementsByClassName("drag-handle")[0]) {
		// if present, the handle is where you move the DIV from:
		dragEl.getElementsByClassName("drag-handle")[0].onmousedown = dragMouseDown;
	} else {
		// otherwise, move the DIV from anywhere inside the DIV:
		dragEl.onmousedown = dragMouseDown;
	}

	// When the element resizes (e.g. view queue) ensure it is still in the windows bounds
	const resizeObserver = new ResizeObserver(() => {
		ensureInBounds();
	}).observe(dragEl);

	function ensureInBounds() {
		if (dragEl.classList.contains("comfy-menu-manual-pos")) {
			newPosX = Math.min(document.body.clientWidth - dragEl.clientWidth, Math.max(0, dragEl.offsetLeft));
			newPosY = Math.min(document.body.clientHeight - dragEl.clientHeight, Math.max(0, dragEl.offsetTop));

			positionElement();
		}
	}

	function positionElement() {
		const halfWidth = document.body.clientWidth / 2;
		const anchorRight = newPosX + dragEl.clientWidth / 2 > halfWidth;

		// set the element's new position:
		if (anchorRight) {
			dragEl.style.left = "unset";
			dragEl.style.right = document.body.clientWidth - newPosX - dragEl.clientWidth + "px";
		} else {
			dragEl.style.left = newPosX + "px";
			dragEl.style.right = "unset";
		}

		dragEl.style.top = newPosY + "px";
		dragEl.style.bottom = "unset";

		if (savePos) {
			localStorage.setItem(
				"Comfy.MenuPosition",
				JSON.stringify({
					x: dragEl.offsetLeft,
					y: dragEl.offsetTop,
				})
			);
		}
	}

	function restorePos() {
		let pos = localStorage.getItem("Comfy.MenuPosition");
		if (pos) {
			pos = JSON.parse(pos);
			newPosX = pos.x;
			newPosY = pos.y;
			positionElement();
			ensureInBounds();
		}
	}

	let savePos = undefined;
	settings.addSetting({
		id: "Comfy.MenuPosition",
		name: "Save menu position",
		type: "boolean",
		defaultValue: savePos,
		onChange(value) {
			if (savePos === undefined && value) {
				restorePos();
			}
			savePos = value;
		},
	});

	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		// get the mouse cursor position at startup:
		posStartX = e.clientX;
		posStartY = e.clientY;
		document.onmouseup = closeDragElement;
		// call a function whenever the cursor moves:
		document.onmousemove = elementDrag;
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();

		dragEl.classList.add("comfy-menu-manual-pos");

		// calculate the new cursor position:
		posDiffX = e.clientX - posStartX;
		posDiffY = e.clientY - posStartY;
		posStartX = e.clientX;
		posStartY = e.clientY;

		newPosX = Math.min(document.body.clientWidth - dragEl.clientWidth, Math.max(0, dragEl.offsetLeft + posDiffX));
		newPosY = Math.min(document.body.clientHeight - dragEl.clientHeight, Math.max(0, dragEl.offsetTop + posDiffY));

		positionElement();
	}

	window.addEventListener("resize", () => {
		ensureInBounds();
	});

	function closeDragElement() {
		// stop moving when mouse button is released:
		document.onmouseup = null;
		document.onmousemove = null;
	}
}

class ComfyList {
	#type;
	#text;
	#reverse;

	constructor(text, type, reverse) {
		this.#text = text;
		this.#type = type || text.toLowerCase();
		this.#reverse = reverse || false;
		this.element = $el("div.comfy-list");
		this.element.style.display = "none";
	}

	get visible() {
		return this.element.style.display !== "none";
	}

	async load() {
		const items = await api.getItems(this.#type);
		this.element.replaceChildren(
			...Object.keys(items).flatMap((section) => [
				$el("h4", {
					textContent: section,
				}),
				$el("div.comfy-list-items", [
					...(this.#reverse ? items[section].reverse() : items[section]).map((item) => {
						// Allow items to specify a custom remove action (e.g. for interrupt current prompt)
						const removeAction = item.remove || {
							name: "Delete",
							cb: () => api.deleteItem(this.#type, item.prompt[1]),
						};
						return $el("div", {textContent: item.prompt[0] + ": "}, [
							$el("button", {
								textContent: "Load",
								onclick: async () => {
									await app.loadGraphData(item.prompt[3].extra_pnginfo.workflow);
									if (item.outputs) {
										app.nodeOutputs = item.outputs;
									}
								},
							}),
							$el("button", {
								textContent: removeAction.name,
								onclick: async () => {
									await removeAction.cb();
									await this.update();
								},
							}),
						]);
					}),
				]),
			]),
			$el("div.comfy-list-actions", [
				$el("button", {
					textContent: "Clear " + this.#text,
					onclick: async () => {
						await api.clearItems(this.#type);
						await this.load();
					},
				}),
				$el("button", {textContent: "Refresh", onclick: () => this.load()}),
			])
		);
	}

	async update() {
		if (this.visible) {
			await this.load();
		}
	}

	async show() {
		this.element.style.display = "block";

		await this.load();
	}

	hide() {
		this.element.style.display = "none";
	}

	toggle() {
		if (this.visible) {
			this.hide();
			return false;
		} else {
			this.show();
			return true;
		}
	}
}

export class ComfyUI {
	constructor(app) {
		this.app = app;
		this.dialog = new ComfyDialog();
		this.settings = new ComfySettingsDialog(app);
		this.message = new ComfyMessageDialog();

		this.batchCount = 1;
		this.lastQueueSize = 0;
		this.queue = new ComfyList("Queue");
		this.history = new ComfyList("History", "history", true);

		api.addEventListener("status", () => {
			this.queue.update();
			this.history.update();
		});

		const confirmClear = this.settings.addSetting({
			id: "Comfy.ConfirmClear",
			name: "Require confirmation when clearing workflow",
			type: "boolean",
			defaultValue: true,
		});

		const promptFilename = this.settings.addSetting({
			id: "Comfy.PromptFilename",
			name: "Prompt for filename when saving workflow",
			type: "boolean",
			defaultValue: true,
		});

		/**
		 * file format for preview
		 *
		 * format;quality
		 *
		 * ex)
		 * webp;50 -> webp, quality 50
		 * jpeg;80 -> rgb, jpeg, quality 80
		 *
		 * @type {string}
		 */
		const previewImage = this.settings.addSetting({
			id: "Comfy.PreviewFormat",
			name: "Convert preview images to format",
			tooltip: "When displaying a preview in the image widget, convert it to a lightweight image, e.g. 'webp', 'jpeg', 'webp;50', etc.",
			type: "text",
			defaultValue: "",
		});

		this.settings.addSetting({
			id: "Comfy.DisableSliders",
			name: "Disable sliders",
			type: "boolean",
			defaultValue: false,
		});

		this.settings.addSetting({
			id: "Comfy.DisableFloatRounding",
			name: "Disable rounding floats (requires page reload).",
			type: "boolean",
			defaultValue: false,
		});

		this.settings.addSetting({
			id: "Comfy.FloatRoundingPrecision",
			name: "Decimal places [0 = auto] (requires page reload).",
			type: "slider",
			attrs: {
				min: 0,
				max: 6,
				step: 1,
			},
			defaultValue: 0,
		});

		const fileInput = $el("input", {
			id: "comfy-file-input",
			type: "file",
			accept: ".json,image/png,.latent,.safetensors,image/webp",
			style: {display: "none"},
			parent: document.body,
			onchange: () => {
				app.handleFile(fileInput.files[0]);
			},
		});

		const autoQueueModeEl = toggleSwitch(
			"autoQueueMode",
			[
				{ text: "instant", tooltip: "A new prompt will be queued as soon as the queue reaches 0" },
				{ text: "change", tooltip: "A new prompt will be queued when the queue is at 0 and the graph is/has changed" },
			],
			{
				onChange: (value) => {
					this.autoQueueMode = value.item.value;
				},
			}
		);
		autoQueueModeEl.style.display = "none";

		api.addEventListener("graphChanged", () => {
			if (this.autoQueueMode === "change" && this.autoQueueEnabled === true) {
				if (this.lastQueueSize === 0) {
					this.graphHasChanged = false;
					app.queuePrompt(0, this.batchCount);
				} else {
					this.graphHasChanged = true;
				}
			}
		});

		this.menuContainer = $el("div.comfy-menu", {parent: document.body}, [
			$el("div.comfy-queue-btn", [
				$el("button", {
					id: "queue-button",
					dataset: { tooltip: "Add prompt(s) to end of queue" },
					onclick: () => app.queuePrompt(0, this.batchCount),
				}, [$icon("play")]),
				$el("span.queue-size", {$: (q) => (this.queueSize = q)}),
			]),
			$el("div.comfy-queue-btn", [
				$el("button", {
					id: "queue-front-button",
					dataset: { tooltip: "Add prompt(s) to start of queue" },
					onclick: () => app.queuePrompt(-1, this.batchCount)
				}, [$icon("arrow")]),
			]),
			$el("div.comfy-queue-btn", [
				$el("button", {
					id: "queue-stop-last",
					dataset: { tooltip: "Cancel active prompt" },
					onclick: () => api.interrupt()
				}, [$icon("stop")])
			]),
			$el("div", {
				id: "batchCountInputNumber",
				dataset: { tooltip: "Number of batches for this prompt" }
			}, [
				$el("input", {
					type: "number",
					value: this.batchCount,
					min: "1",
					oninput: (i) => {
						this.batchCount = i.target.value;
					},
				}),
			]),
			$el("div.auto-queue", {
				dataset: { tooltip: "Automatically queue prompt when the queue size hits 0" },
			}, [
				$el("label",{
					for:"autoQueueCheckbox",
					innerHTML: "Auto"
				}),
				$el("input", {
					id: "autoQueueCheckbox",
					type: "checkbox",
					checked: false,
					onchange: (e) => {
						this.autoQueueEnabled = e.target.checked;
						autoQueueModeEl.style.display = this.autoQueueEnabled ? "" : "none";
					}
				}),
			]),
			autoQueueModeEl,
			$el("button", {
				id: "comfy-save-button",
				dataset: { tooltip: "Save the current workflow" },
				onclick: () => {
					let filename = "workflow.json";
					if (promptFilename.value) {
						filename = prompt("Save workflow as:", filename);
						if (!filename) return;
						if (!filename.toLowerCase().endsWith(".json")) {
							filename += ".json";
						}
					}
					app.graphToPrompt().then(p=>{
						const json = JSON.stringify(p.workflow, null, 2); // convert the data to a JSON string
						const blob = new Blob([json], {type: "application/json"});
						const url = URL.createObjectURL(blob);
						const a = $el("a", {
							href: url,
							download: filename,
							style: {display: "none"},
							parent: document.body,
						});
						a.click();
						setTimeout(function () {
							a.remove();
							window.URL.revokeObjectURL(url);
						}, 0);
					});
				},
			}, [$icon("floppy"), "Save"]),
			$el("button", {
				id: "comfy-dev-save-api-button",
				className: "comfy-dev-hidden",
				style: {display: "none"},
				dataset: { tooltip: "Save the current workflow in the format the API uses"},
				onclick: () => {
					let filename = "workflow_api.json";
					if (promptFilename.value) {
						filename = prompt("Save workflow (API) as:", filename);
						if (!filename) return;
						if (!filename.toLowerCase().endsWith(".json")) {
							filename += ".json";
						}
					}
					app.graphToPrompt().then(p=>{
						const json = JSON.stringify(p.output, null, 2); // convert the data to a JSON string
						const blob = new Blob([json], {type: "application/json"});
						const url = URL.createObjectURL(blob);
						const a = $el("a", {
							href: url,
							download: filename,
							style: {display: "none"},
							parent: document.body,
						});
						a.click();
						setTimeout(function () {
							a.remove();
							window.URL.revokeObjectURL(url);
						}, 0);
					});
				},
			}, [$icon("floppy"), "Save (API Format)"]),
			$el("button", {
				id: "comfy-load-button",
				dataset: { tooltip: "Import a workflow file" },
				onclick: () => fileInput.click()
			}, [$icon("import"), "Load"]),
			$el("button", {
				id: "comfy-refresh-button",
				dataset: { tooltip: "Refresh all node combo lists" },
				onclick: () => app.refreshComboInNodes()
			}, [$icon("refresh"), "Refresh"]),
			$el("button", {
				id: "comfy-clipspace-button",
				dataset: { tooltip: "Open Clipspace editor" },
				onclick: () => app.openClipspace()
			}, [$icon("clipboard"), "Clipspace"]),
			$el("button", {
				id: "comfy-clear-button",
				dataset: { tooltip: "Delete all nodes in current workspace" },
				onclick: () => {
					if (!confirmClear.value || confirm("Clear workflow?")) {
						app.clean();
						app.graph.clear();
					}
				}
			}, [$icon("trash"), "Clear"]),
			$el("button", {
				id: "comfy-load-default-button",
				dataset: { tooltip: "Load the default workflow" },
				onclick: async () => {
					if (!confirmClear.value || confirm("Load default workflow?")) {
						await app.loadGraphData()
					}
				}
			}, [$icon("file"), "Load Default"]),

			$el("div.spinner", [
				$el("span.spinner-node-name", {
					$: (b) => (this.spinnerNodeName = b),
				}),
				$el("span.spinner-node-progress", {
					$: (b) => (this.spinnerNodeProgress = b),
				}),
			]),

			$el("div.extra-buttons", [
				$el("button.comfy-settings-btn", {
					dataset: { tooltip: "Configure ComfyUI" },
					onclick: () => this.settings.show()
				}, [$icon("cog"), "Settings"]),
				$el("button.comfy-logs-btn", {
					className: "comfy-dev-hidden",
					dataset: { tooltip: "View ComfyUI debugging logs" },
					style: {display: "none"},
					onclick: () => app.logging.dialog.show()
				}, [$icon("help-info"), "Logs"]),
				$el("button", {
					$: (b) => (this.queue.button = b),
					dataset: { tooltip: "View queue" },
					id: "comfy-view-queue-button",
					onclick: () => {
						this.history.hide();
						this.queue.toggle();
					},
				}, [$icon("file-group"), "Queue"]),
				$el("button", {
					$: (b) => (this.history.button = b),
					dataset: { tooltip: "View prompt history" },
					id: "comfy-view-history-button",
					onclick: () => {
						this.queue.hide();
						this.history.toggle();
					},
				}, [$icon("history"), "History"]),
			])
		]);

		this.queue.element.classList.add("menu-list");
		this.history.element.classList.add("menu-list");

		document.body.appendChild(this.queue.element);
		document.body.appendChild(this.history.element);

		const devMode = this.settings.addSetting({
			id: "Comfy.DevMode",
			name: "Enable dev mode options",
			type: "boolean",
			defaultValue: false,
			onChange: function(value) {
				for(const el of document.querySelectorAll(".comfy-dev-hidden")) {
					el.style.display = value ? "" : "none";
				}
			},
		});

		// dragElement(this.menuContainer, this.settings);

		this.setStatus({exec_info: {queue_remaining: "-"}});
	}

	setStatus(status) {
		this.queueSize.textContent = (status ? status.exec_info.queue_remaining : "ERR");
		if (status) {
			if (status.exec_info.queue_remaining > 0) {
				this.spinnerNodeName.textContent = '';
				this.spinnerNodeProgress.textContent = '';
				document.body.classList.add('processing');
			} else {
				document.body.classList.remove('processing');
			}

			if (
				this.lastQueueSize != 0 &&
				status.exec_info.queue_remaining == 0 &&
				this.autoQueueEnabled &&
				(this.autoQueueMode === "instant" || this.graphHasChanged) &&
				!app.lastExecutionError
			) {
				app.queuePrompt(0, this.batchCount);
				status.exec_info.queue_remaining += this.batchCount;
				this.graphHasChanged = false;
			}
			this.lastQueueSize = status.exec_info.queue_remaining;
		}
	}
}
