import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, EditorSelection } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { Plugin, editorLivePreviewField } from "obsidian";

function selectionAndRangeOverlap(
	selection: EditorSelection,
	rangeFrom: number,
	rangeTo: number
) {
	for (const range of selection.ranges) {
		if (range.from <= rangeTo && range.to >= rangeFrom) {
			console.log("in range");
			return true;
		}
	}

	console.log("outside range");
	return false;
}

export class DotsWidget extends WidgetType {
	level;
	maximum;

	constructor(level: number, maximum: number) {
		super();

		this.level = level;
		this.maximum = maximum;
	}

	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("span");


		for (let i = 0; i < this.maximum; i++) {
			if (this.level > 0) {
				div.innerText += "🔴";
				this.level--;
			}
			else {
				div.innerText += "⚫";
			}

		}

		return div;
	}
}

class DotsPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view) ?? Decoration.none;
	}

	update(update: ViewUpdate) {
		// only activate in LP and not source mode
		//@ts-ignore
		if (!update.state.field(editorLivePreviewField)) {
			this.decorations = Decoration.none;
			return;
		}

		if (update.docChanged ||
			update.viewportChanged ||
			update.selectionSet) {
			this.decorations = this.buildDecorations(update.view) ?? Decoration.none;
		}
	}

	destroy() { }

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		const selection = view.state.selection;
		const regex = new RegExp(".*?_?inline-code_?.*");

		for (let { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					const type = node.type;
					// markdown formatting symbols
					if (type.name.includes("formatting")) return;
					if (!regex.test(type.name)) return;

					// contains the position of node
					const start = node.from;
					const end = node.to;
					// don't continue if current cursor position and inline code node (including formatting
					// symbols) overlap
					if (selectionAndRangeOverlap(selection, start, end + 1)) return;

					const original = view.state.doc.sliceString(start, end).trim();

					if (/^dots:\s*([\s\S]+)\s*?/.test(original)) {
						let [, contents] = /^dots:\s*([\s\S]+)\s*?/.exec(original)!;
						let [levelDots, howManyDots] = contents.trim().split("/")

						if (!Number.isFinite(+howManyDots)) return;

						builder.add(
							start,
							end,
							Decoration.replace({
								widget: new DotsWidget(+levelDots, +howManyDots),
							})
						);

					}
				},
			});
		}

		return builder.finish();
	}
}

const pluginSpec: PluginSpec<DotsPlugin> = {
	decorations: (value: DotsPlugin) => value.decorations,
};

export const dotsPlugin = ViewPlugin.fromClass(
	DotsPlugin,
	pluginSpec
);

export default class BetterInlineFieldsPlugin extends Plugin {
	async onload() {
		this.registerEditorExtension(dotsPlugin);
	}
}