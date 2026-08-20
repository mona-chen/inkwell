class ListControl {
    constructor(label, items, callback) {
        // Initialize properties
        this.label = label; // Label for the text control
        this.items = items; // Initial value of the text input
        this.callback = callback; // Callback function to handle input changes

        // Create the main container element
        this.domNode = document.createElement('div');

        // // Add an event listener to handle input changes
        // this.getTextInput().addEventListener('keyup', (e) => {
        //     this.callback.setText(this.getText()); // Trigger the callback with the new value
        // });

        // render
        this.render();
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-3">🎨 Here we can upload your theme to the themes builder for reviewing, testing, and export. 🚀</div>
                <h4 class="form-label fw-semibold">${this.label}</h4>
                <p>You can add/edit/delete list items belows...</p>
                <div data-control="slist-container" class="list-group"></div>
                <div class="d-flex justify-content-end align-items-center">
                    <button class="btn btn-primary btn-sm mt-3 d-flex align-items-center" type="button" data-control="add-item">
                        <span class="material-symbols-rounded me-2">add</span>
                        Add Item
                    </button>
                </div>
            </div>
        `;

        const listContainer = this.getListContainer();

        // Add event listener for the "Add Item" button
        this.domNode.querySelector('[data-control="add-item"]').addEventListener('click', () => {
            this.items.push({ icon: null, label: '', url: '', description: '' });
            this.render();
            if (this.callback) {
                this.callback.setItems(this.items); // Trigger the callback with updated items
            }
        });

        // Render each item
        this.items.forEach((item, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'position-relative';

            listItem.innerHTML = `
                <div class="flex-grow-1">
                    <div class="mb-2">
                        <label class="form-label small mb-1 me-2" style="flex: 1;">Label #${index + 1}</label>
                        <input type="text" class="form-control form-control-sm" value="${item.label}" data-index="${index}" data-field="label" style="flex: 2;">
                    </div>
                    ${item.url !== undefined ? `
                    <div class="">
                        <label class="form-label small mb-1 me-2" style="flex: 1;">URL</label>
                        <input type="text" class="form-control form-control-sm" value="${item.url}" data-index="${index}" data-field="url" style="flex: 2;">
                    </div>
                    ` : ''}
                </div>
                <div class="mt-2 pt-2 d-flex justify-content-end align-items-center d-none">
                    <button class="btn btn-danger d-flex align-items-center btn-sm px-1" type="button" data-control="remove-item" data-index="${index}">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
                <div class="position-absolute top-0 end-0 ms-2 mb-2 d-flex align-items-center">
                    <span class="d-flex align-items-center" type="button">
                        <span class="material-symbols-rounded">delete</span>
                    </span>
                    <span class="fw-semibold text-muted opacity-25 d-none" style="z-index: 0; pointer-events: none;font-size: 16px;">#${index + 1}</span>
                </div>

                ${index == 0 ? `
                    <div class="alert alert-light fst-italic rounded-2 bg-light border-0 mb-3 mt-2">
                        📍 This is the first menu item appearing on the far left of your menu bar 🧭✨
                    </div>
                ` : ''}

                <br>
            `;

            // Add event listeners for input changes
            listItem.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const field = e.target.getAttribute('data-field');
                    const itemIndex = e.target.getAttribute('data-index');
                    this.items[itemIndex][field] = e.target.value; // Update the item
                    if (this.callback) {
                        this.callback.setItems(this.items); // Trigger the callback with updated items
                    }
                });
            });

            // Add event listener for the "Remove Item" button
            listItem.querySelector('[data-control="remove-item"]').addEventListener('click', (e) => {
                const itemIndex = e.target.closest('[data-control="remove-item"]').getAttribute('data-index');
                this.items.splice(itemIndex, 1); // Remove the item
                this.render();
                if (this.callback) {
                    this.callback.setItems(this.items); // Trigger the callback with updated items
                }
            });

            listContainer.appendChild(listItem);
        });
    }

    getListContainer() {
        return this.domNode.querySelector('[data-control="slist-container"]');
    }

    
}

export default ListControl;