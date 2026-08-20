import BaseElement from "./BaseElement.js";
class PricingTableElement extends BaseElement {
  constructor(template, cells) {
    // [{title: ..., description: ..., price: ..., duration: ..., button: ...}, ]
    super(); // Call the parent class constructor
    this.template = template;
    this.cells = cells;

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
      this.domNode.setAttribute("builder-element", "SocialIconsElement");
    }

    // render later
    const htmlContent = this.renderTemplate(this.template);
    this.domNode.innerHTML = htmlContent;

    // validate template
    if (!this.domNode.querySelector("CELLS")) {
      alert("[CELLS] tag missing from the " + this.template + " template!");
      throw new Error(
        "[CELLS] tag missing from the " + this.template + " template!"
      );
    }
    // render items
    const cellstheme = this.domNode.querySelector("CELLS").innerHTML;

    // validate items html
    if (!cellstheme.includes("[[TITLE]]")) {
      alert("[TITLE] tag missing from the " + this.template + " template!");
      throw new Error(
        "[TITLE] tag missing from the " + this.template + " template!"
      );
    }
    if (!cellstheme.includes("[[DESCRIPTION]]")) {
      alert(
        "[DESCRIPTION] tag missing from the " + this.template + " template!"
      );
      throw new Error(
        "[DESCRIPTION] tag missing from the " + this.template + " template!"
      );
    }
    if (!cellstheme.includes("[[PRICE]]")) {
      alert("[PRICE] tag missing from the " + this.template + " template!");
      throw new Error(
        "[PRICE] tag missing from the " + this.template + " template!"
      );
    }
    if (!cellstheme.includes("[[DURATION]]")) {
      alert("[DURATION] tag missing from the " + this.template + " template!");
      throw new Error(
        "[DURATION] tag missing from the " + this.template + " template!"
      );
    }
    if (!cellstheme.includes("[[BUTTON]]")) {
      alert("[BUTTON] tag missing from the " + this.template + " template!");
      throw new Error(
        "[BUTTON] tag missing from the " + this.template + " template!"
      );
    }

    // render items
    let cellsHtml = "";
    this.cells.forEach((cell) => {
      cellsHtml += cellstheme
        .replace("[[TITLE]]", cell.title)
        .replace("[[DESCRIPTION]]", cell.description)
        .replace("[[PRICE]]", cell.price)
        .replace("[[DURATION]]", cell.duration)
        .replace("[[BUTTON]]", cell.button);
    });
    this.domNode.querySelector("CELLS").outerHTML = cellsHtml;

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
    return {
      name: "PricingTableElement",
      template: this.template,

      // attributes
      cells: this.cells,
    };
  }

  static parse(data) {
    var e = new PricingTableElement(data.template, data.cells);

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
    var _this = this;

    return [
      new PricingTableControl(
        //
        "Cells/items list",

        this.cells.map((cell) => ({
          title: cell.title,
          description: cell.description,
          price: cell.price,
          duration: cell.duration,
          button: cell.button,
        })),

        {
          //
          setCells(cells) {
            _this.cells = cells.map((cell) => ({
              title: cell.title,
              description: cell.description,
              price: cell.price,
              duration: cell.duration,
              button: cell.button,
            }));

            _this.render();
          },

          addCell(cell) {
            _this.cells.push({
              title: cell.title || "",
              description: cell.description || "",
              price: cell.price || "",
              duration: cell.duration || "",
              button: cell.button || "Select",
            });

            _this.render();
          },

          // more callbacks
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

export default PricingTableElement;
