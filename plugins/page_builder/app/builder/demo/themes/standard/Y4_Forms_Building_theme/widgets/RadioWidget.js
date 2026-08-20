class RadioWidget extends BaseWidget {
  getName() {
    return "Radio select"; // Change from 'Header' to 'Form'
  }

  getIcon() {
    return "radio_button_checked";
  }

  constructor() {
    super(); // Call the parent class constructor
    this.elements = [];

    // create a grid element
    const grid = new GridElement("SelectGrid");
        grid.setFormat('content_display', 'inline-block');
        grid.setFormat('padding_left', 20);

    const cell = new CellElement("SelectCell");

    const label = new PElement("PLabel", "Example select");

    const radio = new RadioElement("Radio", "RadioName", [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other" }
    ]);

    // append the label and radio to the cell
    cell.appendElements([label, radio]);
    // add the cell to the grid
    grid.appendCells([cell]);


    // add to the elements array
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

export default RadioWidget;
