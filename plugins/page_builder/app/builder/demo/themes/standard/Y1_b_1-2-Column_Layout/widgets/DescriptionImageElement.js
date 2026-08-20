class DescriptionImageElement extends BaseElement {
  constructor(template, items) {
    // [{image_url: '', title: '', text: '' }, ]
    super(); // Call the parent class constructor
    this.template = template;
    this.items = items;
  }

  render() {
    // create the DOM Node for the Element
    if (!this.domNode) {
      // New native DOM Node
      this.domNode = document.createElement("div");
      this.domNode.setAttribute("builder-element", "DescriptionImageElement");
    }

    // render later
    this.domNode.innerHTML = this.renderTemplate(this.template, {
      items: this.items,
    });

    //
    return this.domNode;
  }

  getData() {
    return {
      name: "DescriptionImageElement",
      template: this.template,

      // attributes
      items: this.items,
    };
  }

  static parse(data) {
    return new DescriptionImageElement(data.template, data.items); //
  }

  getControls() {
    const _this = this;

    return [
        new DescriptionImageControl(
            "Images/Items List",
            this.items.map((item) => ({
                image_url: _this.getFullUrl(item.image_url),
                title: item.title,
                text: item.text,
            })),
            {
                setItems(items) {
                    _this.items = items.map((item) => ({
                        // Use _this.getFullUrl instead of this.getFullUrl
                        image_url: item.image_url,
                        title: item.title,
                        text: item.text,
                    }));
                    _this.render();
                },
            }
        ),
    ];
  }
}

export default DescriptionImageElement;
