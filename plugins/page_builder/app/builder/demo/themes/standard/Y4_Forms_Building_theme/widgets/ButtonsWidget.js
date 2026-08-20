class ButtonsWidget extends BaseWidget {
  getName() {
    return "Buttons"; // Change from 'Header' to 'Form'
  }

  getIcon() {
    return "keyboard_return";
  }

  constructor() {
    super(); // Call the parent class constructor
    this.elements = [];

    const grid = new GridElement("ButtonsGrid");
            grid.setFormat('content_display', 'inline-block');
        grid.setFormat('padding_left', 20);
    const cell = new CellElement("ButtonsCell");
    
    const submitButton = new ButtonElement("SubmitButton", "Submit");
    const cancelButton = new ButtonElement("CancelButton", "Cancel");
    
    cell.appendElements([submitButton, cancelButton]);
    grid.appendCells([cell]);
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

export default ButtonsWidget;
