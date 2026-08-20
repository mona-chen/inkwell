class SelectElement extends BaseElement {
  constructor(template, inputName, items) {
    super();
    this.template = template;
    this.items = items;
    this.inputName = inputName;
    this.domNode = null;
  }

  render() {
    if (!this.domNode) {
      this.domNode = document.createElement("div");
      this.domNode.setAttribute("builder-element", "SelectElement");
    }

    // render select
    const htmlContent = this.renderTemplate(this.template, {
      items: this.items,
    });
    this.domNode.innerHTML = htmlContent;

    return this.domNode;
  }

  getData() {
    return {
        name: "SelectElement",
        template: this.template,
        inputName: this.inputName,
        items: this.items,
    };
  }

  getControls() {
    return [
      new SelectControl(
        "Select item list",
        this.items.map((item) => ({
          label: item.label,
          value: item.value,
        })),
        {
          setItems: (items) => {
            this.items = items.map((item) => ({
              label: item.label,
              value: item.value,
            }));
            this.render();
          },
          setName: (name) => {
            this.inputName = name;
            this.render();
          }
        },
        this.inputName // Pass the current inputName as the fourth parameter
      ),
    ];
  }

  static parse(data) {
    return new SelectElement(data.template, data.name, data.items);
  }
}

export default SelectElement;
