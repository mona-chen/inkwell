class TextInputWidget extends BaseWidget {
  getName() {
    return "Text input"; // Change from 'Header' to 'Form'
  }

  getIcon() {
    return "keyboard_external_input";
  }

  constructor() {
    super(); // Call the parent class constructor
    this.elements = [];

    // Create a grid element
    const grid = new GridElement("SelectGrid");
        grid.setFormat('content_display', 'inline-block');
        grid.setFormat('padding_left', 20);
    const cell = new CellElement("SelectCell");
    const label = new PElement("PLabel", "Full name");

    const textInput = new TextInputElement(
      "TextInput",
      "TextInputName",
      "John Doe",
      "Enter your name"
    );
    // Append the label and text input to the cell
    cell.appendElements([label, textInput]);

    // Add the cell to the grid
    grid.appendCells([cell]);

    // Add to the elements array
    this.elements.push(grid);


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

export default TextInputWidget;
