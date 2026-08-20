class DatePickerWidget extends BaseWidget {
  getName() {
    return "Date picker"; // Change from 'Header' to 'Form'
  }

  getIcon() {
    return "calendar_month";
  }

  constructor() {
    super(); // Call the parent class constructor
    this.elements = [];

    const grid = new GridElement("SelectGrid");
            grid.setFormat('content_display', 'inline-block');
        grid.setFormat('padding_left', 20);
    const cell = new CellElement("SelectCell");
    const label = new PElement("PLabel", "Date");

    const datePicker = new TextInputElement(
      "DatePickerTextInput",
      "DateTextInput",
      "26.02.2025",
      "Enter Date"
    );

    // Append the label and date picker to the cell
    cell.appendElements([label, datePicker]);
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

export default DatePickerWidget;
