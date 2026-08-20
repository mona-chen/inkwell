class PricingTableWidget extends BaseWidget {
  getName() {
    return "Pricing table";
  }

  getIcon() {
    return "attach_money";
  }

  constructor() {
    super(); // Call the parent class constructor
    this.elements = [];

    const table = new PricingTableElement("PricingCards", [
      {
        title: "Free",
        description: "All the basics for businesses or individual to get started with email marketing campaign",
        price: "$0",
        duration: "1 month",
        button: "Select",
      },
      {
        title: "Essentials",
        description: "Must-have features for marketing agency & individual to engage in email marketing",
        price: "$28",
        duration: "1 month",
        button: "Select",
      },
      {
        title: "Premium",
        description: "Advanced features for professionals who need unlimited marketing capability",
        price: "$50",
        duration: "1 month",
        button: "Select",
      },
    ]);

    this.elements.push(table);
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

export default PricingTableWidget;
