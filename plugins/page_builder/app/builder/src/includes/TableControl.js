class TableControl {
    constructor(label, data, callback) {
        this.label = label;
        this.headers = data.headers || [];
        this.rows = data.rows || [];
        this.callback = callback;
        this.domNode = document.createElement('div');
        this.render();
    }

    render() {
        this.domNode.innerHTML = `
            <div class="py-2 px-3">
                <label class="form-label fw-semibold">${this.label}</label>
                
                <!-- Headers Section -->
                <div class="mb-3">
                    <label class="form-label fw-semibold small">Headers</label>
                    <div data-control="headers-container" class="list-group mb-2"></div>
                    <button class="btn btn-secondary btn-sm d-flex align-items-center" type="button" data-control="add-header">
                        <span class="material-symbols-rounded me-2">add</span>
                        Add Header
                    </button>
                </div>

                <!-- Rows Section -->
                <div>
                    <label class="form-label fw-semibold small">Rows</label>
                    <div data-control="rows-container" class="list-group mb-2"></div>
                    <button class="btn btn-primary btn-sm d-flex align-items-center" type="button" data-control="add-row">
                        <span class="material-symbols-rounded me-2">add</span>
                        Add Row
                    </button>
                </div>
            </div>
        `;

        // Add Header button handler
        this.domNode.querySelector('[data-control="add-header"]').addEventListener('click', () => {
            this.headers.push({ text: 'New Header' });
            
            // Add a new empty cell to each existing row
            this.rows.forEach(row => {
                row.cells.push('');  // Directly push to the cells array
            });
            
            if (this.callback.setHeaders) {
                this.callback.setHeaders(this.headers);
            }
            if (this.callback.setRows) {
                this.callback.setRows(this.rows);  // Also update rows
            }
            this.render();
        });

        // Add Row button handler
        this.domNode.querySelector('[data-control="add-row"]').addEventListener('click', () => {
            const newRow = {
                cells: Array(this.headers.length).fill('')
            };
            this.rows.push(newRow);
            if (this.callback.setRows) {
                this.callback.setRows(this.rows);
            }
            this.render();
        });

        // Render Headers
        const headersContainer = this.domNode.querySelector('[data-control="headers-container"]');
        this.headers.forEach((header, index) => {
            const headerItem = document.createElement('div');
            headerItem.className = 'list-group-item bg-light';
            headerItem.innerHTML = `
                <div class="d-flex align-items-center">
                    <input type="text" class="form-control form-control-sm me-2" 
                           value="${header.text}" data-index="${index}" data-type="header">
                    <button class="btn btn-danger btn-sm d-flex align-items-center px-1" 
                            type="button" data-control="remove-header" data-index="${index}">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            `;
            headersContainer.appendChild(headerItem);
        });

        // Render Rows
        const rowsContainer = this.domNode.querySelector('[data-control="rows-container"]');
        this.rows.forEach((row, rowIndex) => {
            const rowItem = document.createElement('div');
            // Add rounded class to all items and border-top
            rowItem.className = 'list-group-item bg-light mb-2 border rounded';
            
            let cellsHtml = '';
            row.cells.forEach((cell, cellIndex) => {
                cellsHtml += `
                    <div class="mb-2">
                        <div class="d-flex align-items-center">
                            <input type="text" class="form-control form-control-sm" 
                                   value="${cell}" data-row="${rowIndex}" data-cell="${cellIndex}">
                        </div>
                    </div>
                `;
            });

            rowItem.innerHTML = `
                <div class="mb-2">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <label class="form-label fw-semibold mb-0">Row ${rowIndex + 1}</label>
                        <button class="btn btn-danger btn-sm d-flex align-items-center px-1" 
                                type="button" data-control="remove-row" data-index="${rowIndex}">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                    ${cellsHtml}
                </div>
            `;
            rowsContainer.appendChild(rowItem);
        });

        // Add input change handlers for cells
        this.domNode.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const type = e.target.getAttribute('data-type');
                if (type === 'header') {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    this.headers[index].text = e.target.value;
                    if (this.callback.setHeaders) {
                        this.callback.setHeaders(this.headers);}
                }
                else {
                    const rowIndex = parseInt(e.target.getAttribute('data-row'));
                    const cellIndex = parseInt(e.target.getAttribute('data-cell'));
                    this.rows[rowIndex].cells[cellIndex] = e.target.value;
                    if (this.callback.setRows) {
                        this.callback.setRows(this.rows);
                    }
                }
            });
        });

        // Add remove handlers
        this.domNode.querySelectorAll('[data-control="remove-header"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').getAttribute('data-index'));
                this.headers.splice(index, 1);
                
                // Remove corresponding cell from each row
                this.rows.forEach(row => {
                    row.cells.splice(index, 1);
                });
                
                this.render();
                if (this.callback.setHeaders) {
                    this.callback.setHeaders(this.headers);
                }
                if (this.callback.setRows) {
                    this.callback.setRows(this.rows);
                }
            });
        });

        this.domNode.querySelectorAll('[data-control="remove-row"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').getAttribute('data-index'));
                this.rows.splice(index, 1);
                this.render();
                if (this.callback.setRows) {
                    this.callback.setRows(this.rows);
                }
            });
        });
    }
}

export default TableControl;