class FontFamilyControl {
  constructor(label, font_family, callback) {
    this.id = "_" + Math.random().toString(36).substr(2, 9);
    this.label = label;
    this.font_family = font_family || "";
    this.callback = callback;
    this.domNode = document.createElement("div");
    this.render();
  }

  render() {
    const fontList = [
      { name: "System (inherit)", value: "inherit" },
      { name: "Arial", value: "Arial, Helvetica, sans-serif" },
      { name: "Verdana", value: "Verdana, Geneva, sans-serif" },
      { name: "Times New Roman", value: '"Times New Roman", Times, serif' },
      { name: "Georgia", value: 'Georgia, "Times New Roman", serif' },
      { name: "Courier New", value: '"Courier New", Courier, monospace' },
      { name: "Trebuchet MS", value: '"Trebuchet MS", Helvetica, sans-serif' },
      { name: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
      { name: "Impact", value: "Impact, Charcoal, sans-serif" },
      { name: "Inter", value:'"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',},
      { name: "Roboto", value: '"Roboto", Arial, sans-serif' },
    ];

    this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold d-block mb-2">${this.label}</label>
                <div id="fontSelectorContainer_${this.id}"></div>
            </div>
        `;

    const select = document.createElement("select");
    select.className = "form-select w-100";
    const startOption = new Option("Select font family", "");
    select.appendChild(startOption);

    fontList.forEach((font) => {
      const option = document.createElement("option");
      option.value = font.value;
      option.textContent = font.name;
      option.style.fontFamily = font.value;
      select.appendChild(option);
    });

    this.domNode
      .querySelector(`#fontSelectorContainer_${this.id}`)
      .appendChild(select);
    this.fontSelect = select;

    // set initial value (if matches an option)
    if (this.font_family) {
      try {
        this.fontSelect.value = this.font_family;
      } catch (e) {
        /* ignore */
      }
    }

    // change handler — support function or object with setValue
    this.fontSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      this.font_family = val;
      if (typeof this.callback === "function") {
        this.callback(val);
      } else if (
        this.callback &&
        typeof this.callback.setValue === "function"
      ) {
        this.callback.setValue(val);
      } else if (
        this.callback &&
        typeof this.callback.setFontFamily === "function"
      ) {
        this.callback.setFontFamily(val);
      } else {
        console.warn(
          "FontFamilyControl: callback is not callable",
          this.callback
        );
      }
    });
    select.value = "";
  }

  // programmatic setter (keeps UI in sync)
  setValue(newValue) {
    this.font_family = newValue || "";
    if (this.fontSelect) {
      this.fontSelect.value = this.font_family;
    }
    // notify callback like AlignControl does
    if (typeof this.callback === "function") {
      this.callback(this.font_family);
    } else if (this.callback && typeof this.callback.setValue === "function") {
      this.callback.setValue(this.font_family);
    }
  }

  getValue() {
    return this.font_family;
  }

  afterRender() {
    // optional hook if parent needs it
  }
}

export default FontFamilyControl;
