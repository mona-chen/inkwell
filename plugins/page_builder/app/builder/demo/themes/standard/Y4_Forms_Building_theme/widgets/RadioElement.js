class RadioElement extends BaseElement {
  constructor(template, inputName, items) {
    super();
    this.template = template;
    this.inputName = inputName;
    this.items = items;
    this.domNode = null;
  }

  render() {
    if (!this.domNode) {
      this.domNode = document.createElement("div");
      this.domNode.setAttribute("builder-element", "RadioElement");
    }

    // render radio group
    const htmlContent = this.renderTemplate(this.template, {
      items: this.items,
    });
    this.domNode.innerHTML = htmlContent;

    // Don't forget to return the DOM node
    return this.domNode;
  }

  getData() {
    return {
      name: "RadioElement",
      template: this.template,
      inputName: this.inputName,
      items: this.items,
    };
  }

  getControls() {
    return [
      new SelectControl(
        "Radio Options",
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
          },
        },
        this.inputName
      ),
    ];
  }

  static parse(data) {
    return new RadioElement(data.template, data.name, data.items);
  }
}

export default RadioElement;
