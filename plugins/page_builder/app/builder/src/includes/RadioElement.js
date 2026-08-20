import BaseElement from "./BaseElement.js";
class RadioElement extends BaseElement {
  constructor(template, inputName, items) {
    super();
    this.template = template;
    this.inputName = inputName;
    this.items = items;
    this.domNode = null;
    this.formats = {
      background_color: null,
      background_image: null,
      background_position: "center",
      background_size: "100%",
      background_repeat: "no-repeat",
      padding_top: 0,
      padding_right: 0,
      padding_bottom: 0,
      padding_left: 0,
      // size settings
      width: "560",
      height: "315",
    };
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

    // Apply background image if it exists
    const bgImageValue = this.getFormat("background_image");
    if (bgImageValue && bgImageValue.toString().trim() !== "") {
      let bgImage = bgImageValue
        .toString()
        .replace(/\s*!important\s*/, "")
        .trim();
      bgImage = this.getFullUrl(bgImage);
      this.domNode.style.backgroundImage = `url('${bgImage}')`;

      // Set background position
      const position = this.getFormat("background_position", "center");
      this.domNode.style.backgroundPosition = position;

      // Set background size
      let size = this.getFormat("background_size", "100")
        .toString()
        .replace(/\s*!important\s*/, "")
        .trim();
      if (!isNaN(parseFloat(size)) && isFinite(size)) {
        size = parseFloat(size) + "%";
      }
      this.domNode.style.backgroundSize = size;

      // Set background repeat
      const repeat = this.getFormat(
        "background_repeat",
        "no-repeat"
      ).toString();
      this.domNode.style.backgroundRepeat = repeat;
    } else {
      // Explicitly clear background image and related styles
      this.domNode.style.backgroundImage = "";
      this.domNode.style.backgroundPosition = "";
      this.domNode.style.backgroundSize = "";
      this.domNode.style.backgroundRepeat = "";
    }

    // Apply background color
    const bgColor = this.getFormat("background_color");
    if (bgColor) {
      this.domNode.style.backgroundColor = bgColor;
    }

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

  static parse(data) {
    var e = new RadioElement(data.template, data.inputName, data.items);

    // formats
    if (data.formats) {
      e.setFormat("background_color", data.formats.background_color);
      e.setFormat("background_image", data.formats.background_image);
      e.setFormat("background_position", data.formats.background_position);
      e.setFormat("background_size", data.formats.background_size);
      e.setFormat("background_repeat", data.formats.background_repeat);
      e.setFormat("font_family", data.formats.font_family);
      e.setFormat("font_style", data.formats.font_style);
      e.setFormat("font_weight", data.formats.font_weight);
      e.setFormat("font_size", data.formats.font_size);
      e.setFormat("background_color", data.formats.background_color);
    }
    return e;
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
      new BackgroundControl(
        // label
        "Background Settings",
        // values
        {
          color: this.getFormat("background_color", "#ffffff"),
          image: this.getFormat("background_image", ""),
          position: this.getFormat("background_position", "center"),
          size: this.getFormat("background_size", "100")
            .toString()
            .replace("%", ""),
          toRepeat:
            this.getFormat("background_repeat", "no-repeat") === "repeat",
        },
        // callback
        {
          setBackground: (values) => {
            this.setFormat("background_color", values.color);
            this.setFormat("background_image", values.image);
            this.setFormat("background_position", values.position);
            this.setFormat("background_size", parseInt(values.size, 10) || 100);
            this.setFormat(
              "background_repeat",
              values.toRepeat ? "repeat" : "no-repeat"
            );
            this.render();
          },
        }
      ),
    ];
  }

  static parse(data) {
    return new RadioElement(data.template, data.name, data.items);
  }
}

export default RadioElement;
