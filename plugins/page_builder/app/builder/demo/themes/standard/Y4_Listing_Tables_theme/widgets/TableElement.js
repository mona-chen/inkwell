class TableElement extends BaseElement {
    constructor(template, headers = [], rows = []) {
        super();
        this.template = template;
        this.headers = headers;
        this.rows = rows;
        this.domNode = null;
    }

    render() {
        if (!this.domNode) {
            this.domNode = document.createElement('div');
            this.domNode.setAttribute('builder-element', 'TableElement');
        }

        // render table
        const htmlContent = this.renderTemplate(this.template, {
            headers: this.headers,
            rows: this.rows,
        });
        this.domNode.innerHTML = htmlContent;

        return this.domNode;
    }

    getData() {
        return {
            name: 'TableElement',
            template: this.template,
            headers: this.headers,
            rows: this.rows
        };
    }

    getControls() {
        return [
            new TableControl('Table Data', {
                headers: this.headers,
                rows: this.rows
            }, {
                setHeaders: (headers) => {
                    this.headers = headers;
                    // Update rows to match header count
                    this.rows = this.rows.map(row => ({
                        cells: row.cells.slice(0, headers.length).concat(
                            Array(Math.max(0, headers.length - row.cells.length)).fill('')
                        )
                    }));
                    this.render();
                },
                setRows: (rows) => {
                    this.rows = rows;
                    this.render();
                }
            })
        ];
    }

    static parse(data) {
        return new TableElement(data.template, data.headers, data.rows);
    }
}

export default TableElement;
