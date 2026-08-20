class TextAreaWidget extends BaseWidget {
  getName() {
    return "Text area"; // Change from 'Header' to 'Form'
  }

  getIcon() {
    return "edit_note";
  }

  constructor() {
    super(); // Call the parent class constructor
    this.elements = [];

    const grid = new GridElement("SelectGrid");
            grid.setFormat('content_display', 'inline-block');
        grid.setFormat('padding_left', 20);
    const cell = new CellElement("SelectCell");
    const label = new PElement("PLabel", "Example text area");

    const textArea = new TextInputElement(
      "TextAreaInput",
      "TextInputName",
      "",
      ""
    );

    // Append the label and text area to the cell
    cell.appendElements([label, textArea]);
    // Add the cell to the grid
    grid.appendCells([cell]);
    // Add to the elements array
    this.elements.push(textArea);
  }

  getElements() {
    // Return the elements
    return this.elements;
  }

  renderElements() {
    // Clone all elements and return the cloned ones
    return this.elements.map((element) => {
      const data = element.getData();
      return ElementFactory.createElement(data);
    });
  }
}

export default TextAreaWidget;
