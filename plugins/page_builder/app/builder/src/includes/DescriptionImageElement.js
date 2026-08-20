import BaseElement from "./BaseElement.js";

class DescriptionImageElement extends BaseElement {
  constructor(template, items) {
    // [{image_url: '', title: '', text: '' }, ]
    super(); // Call the parent class constructor
    this.template = template;
    this.items = items;

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
    // create the DOM Node for the Element
    if (!this.domNode) {
      // New native DOM Node
      this.domNode = document.createElement("div");
      this.domNode.setAttribute("builder-element", "DescriptionImageElement");
    }

    try {
      // Debug the items value to ensure it's correctly structured
      console.log("Items for DescriptionImageElement:", this.items);

      // Make sure this.items is defined and is an array
      const itemsArray = Array.isArray(this.items) ? this.items : [];

      // render later with proper items array
      this.domNode.innerHTML = this.renderTemplate(this.template, {
        items: itemsArray,
        src: itemsArray[0]?.image_url || '',
        alt: itemsArray[0]?.title || '',
        text: itemsArray[0]?.text || '',
        styleString: this.getStyleString ? this.getStyleString(this.formats) : '',
      });
    } catch (error) {
      console.error("Error rendering DescriptionImageElement:", error);
      this.domNode.innerHTML = `<div class="error">Error rendering image: ${error.message}</div>`;
    }

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

    //
    return this.domNode;
  }

  getData() {
    console.log("DescriptionImageElement getData() - returning items:", this.items);
    return {
      name: "DescriptionImageElement",
      template: this.template,
      
      // attributes
      items: this.items || [],
      formats: this.formats
    };
  }

  static parse(data) {
    var e = new DescriptionImageElement(data.template, data.items || []);
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
}

export default DescriptionImageElement;
