import PageElement from './PageElement.js';
import UIManager from './UIManager.js';
import SettingsTabManager from './SettingsTabManager.js';

class Builder {
    constructor(options) {
        // reuired options
        this.mainContainer = window.document.querySelector(options.mainContainer);
        this.settingsContainer = window.document.querySelector(options.settingsContainer);
        this.widgetsContainer = window.document.querySelector(options.widgetsContainer);
        this.assetUploadHandler = options.assetUploadHandler;
        this.aiHandler = options.aiHandler || null;

        // CAROUSEL options
        this.carousel = options.carousel ?? false;
        this.carouselSettingsContainer = window.document.querySelector(options.carouselSettingsContainer) || null;
        this.carouselElementControlsContainer = window.document.querySelector(options.carouselElementControlsContainer) || null;

        //
        this.themeUrl = null;

        //
        this.themConfigs = null;
        this.templates = {};

        // helpers
        this.iframe = null;

        // PageElement
        if (this.carousel) {
            // If carousel is enabled, use CarouselPageElement
            this.pageElement = new CarouselPageElement(this);
        } else {
            // If carousel is not enabled, use regular PageElement
            this.pageElement = new PageElement(this);
        }

        // Initialize parameters
        this.mode = 'preview';
        this.selectedElement = null;

        // Initialize UI Manager
        this.uiManager = new UIManager(this);

        //
        this.carousel = options.carousel ?? false;
    }

    async load(data, themeUrl, callback) {
        // Load theme configs
        await this.loadThemeConfigs(themeUrl);

        // Load templates
        await this.loadTemplates(themeUrl);

        // widgets box
        console.log(this.widgetsContainer);
        this.widgetsBox = new WidgetsBox(this.widgetsContainer);

        // load widgets js code
        await this.loadWidgetsJs(themeUrl);

        // init iframe
        await this.initIframe();

        // render page
        await this.render();

        // Just for debugging purposes, load the CSS
        await this.loadDebugCss();

        // apply mode: normal or for debugging
        this.applyMode();

        //  initialize UI manager: for drag and drop, hovering, etc. @todo: clean it up later
        this.uiManager.init();

        // 
        this.parse(data);

        // render
        this.render();

        //
        if (this.carousel) {
            this.mainContainer.classList.add('builder-carousel');
        }
            
        // callback after initialization
        if (callback) {
            callback();
        }

        if (this.carousel) {
            // render carousel controls whene loaded
            this.renderCarouselControls();
        }
    }

    async loadThemeConfigs(themeUrl) {
        const themeConfigPath = themeUrl + '/index.json';

        const response = await fetch(themeConfigPath);
        if (!response.ok) {
            alert(`Failed to load theme configs from ${themeConfigPath}`);
            throw new Error(`Failed to load theme configs from ${themeConfigPath}`);
        }
        this.themConfigs = await response.json();

        // set theme url
        this.themeUrl = themeUrl;
    }

    async loadTemplates(themeUrl) {
        await Promise.all(
            this.themConfigs.templates.map(async (templateName) => {
                const html = await this.loadHTML(`${themeUrl}/${templateName}.template.html`);
                this.templates[templateName] = html;
            })
        );
    }

    getTemplate(templateName) {
        if (!this.templates[templateName]) {
            alert(`Template "${templateName}" not found`);
            throw new Error(`Template "${templateName}" not found`);
        }
        return this.templates[templateName];
    }

    async loadHTML(filePath) {
        const response = await fetch(filePath);
        if (!response.ok) {
            alert(`Failed to load HTML template from ${filePath}`);
            throw new Error(`Failed to load HTML template from ${filePath}`);
        }
        return await response.text();
    }

    async loadWidgetsJs(themeUrl) {
        const themeWidgetsJsPath = `${themeUrl}/widgets/index.js`;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = themeWidgetsJsPath;
            script.type = 'module';

            script.onload = () => {
                console.log('Script loaded:', themeWidgetsJsPath);
                resolve();
            };

            script.onerror = () => {
                alert(`Failed to load widgets from ${themeWidgetsJsPath}`);
                reject(new Error(`Failed to load script: ${themeWidgetsJsPath}`));
            };

            document.head.appendChild(script);
        });
    }

    async initIframe() {
        // Create an iframe and append it to the body
        this.iframe = document.createElement('iframe');
        this.iframe.style.width = '100%';
        this.iframe.style.border = 'none';
        this.iframe.style.backgroundColor = '#FFFFFF';
        this.mainContainer.appendChild(this.iframe);

        // Access the iframe document
        this.iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
    }

    async render() {
        // Load and inject the PageElement theme
        this.pageElement.render();

        // 
        this.uiManager.addElement(this.pageElement);
    }

    async loadCSS(cssPath) {
        const response = await fetch(cssPath);
        if (!response.ok) {
            throw new Error(`Failed to load CSS from ${cssPath}`);
        }
        return await response.text();
    }

    insertElements(elements) {
        this.pageElement.appendElements(elements);
        this.pageElement.render();
    }

    clear() {
        // clear page
        this.pageElement.clear();
    }

    parse(data) {
        if (this.themConfigs.name !== data.theme) {
            alert("Theme mismatch: expected " + this.themConfigs.name + ", but got " + data.theme + " from parsing data");
            console.error("Theme mismatch: expected " + this.themConfigs.name + ", but got " + data.theme + " from parsing data: " + JSON.stringify(data));
            throw new Error("Theme mismatch: expected " + this.themConfigs.name + ", but got " + data.theme + " from parsing data");
        }

        this.pageElement.parse(data);
    }

    getData() {
        return { ...{
            theme: this.themConfigs.name,
        }, ...this.pageElement.getData() };
    }

    getHtml() {
        // Only return the content inside <html> (not including the <html> tag itself)
        const htmlDoc = this.iframe.contentDocument.documentElement;
        // Remove builder-helper elements
        htmlDoc.querySelectorAll('[data-control="builder-helper"]').forEach(el => el.remove());

        // remove all contenteditable attributes
        htmlDoc.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

        // Return only the inner HTML of <html>
        return htmlDoc.outerHTML;
    }

    getSelectedElement() {
        return this.selectedElement;
    }
    
    setSelectedElement(element) {
        this.selectedElement = element;
    }

    selectElement(element) {
        // unselect
        this.unselect();

        // set element
        this.setSelectedElement(element);

        if (this.carousel) {
            // render settings box
            this.renderCarouselElementControls(element);
        } else {
            // render settings box
            this.renderElementControls(element);
        }

        // Add selected class
        element.addSelectedHighlight();

        // @todo depenency: open settings tab
        window.sidebarTabManager.openTab(document.querySelector('[data-tab="controls"]'));
        if (window.smenu) {
            window.smenu.openTab(document.querySelector('[data-smenu="design"]'));
        }
    }

    unselect() {
        if (!this.getSelectedElement()) {
            return; // no selected > do nothing
        }

        // remove selected effect
        this.getSelectedElement().removeSelectedHighlight();

        // @todo depenency: open widgets tab
        window.sidebarTabManager.openTab(document.querySelector('[data-tab="widgets"]'));
        if (window.smenu) {
            window.smenu.openTab(document.querySelector('[data-smenu="design"]'));
        }
    }

    getMode() {
        return this.mode;
    }

    setMode(mode) {
        this.mode = mode;
        this.applyMode();
    }

    applyMode() {
        if (this.getMode() === 'design') {
            this.iframe.contentDocument.body.classList.add('builder-mode-design');
        } else {
            this.iframe.contentDocument.body.classList.remove('builder-mode-design');
        }
    }

    removeElement(element) {
        // unselect if the element is selected
        if (this.getSelectedElement() == element) {
            this.unselect();
        }

        // do remove
        this.pageElement.removeElement(element);
    }

    duplicateElement(element) {
        // do remove
        this.pageElement.duplicateElement(element);
    }
    
    renderElementControls(element) {
        const container = this.settingsContainer;

        // 
        container.innerHTML = `
            <div class="settings-container styles-box shadow-sm rounded-0 bg-white">
                <div class="settings-header d-flex align-items-center py-2 px-3 mb-2">
                    <h6 class="text-start me-auto mb-0 fw-bold">
                        ` + element.getClassName() + `
                    </h6>
                    <div data-control="actions" class="d-flex btn-group">
                    </div>
                </div>
                    
                <div data-control="settings-controls-container">
                </div>
            </div>
        `;

        //
        const controls = element.getControls();

        // settings header
        const head = document.createElement('div');
        head.className = 'settings-header mx-3';
        head.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <span class="fw-semibold small">CONFIGURATIONS</span>
                <span class="d-block mx-3 w-100" style="height:1px;background-color:rgb(206, 212, 218);"></span>
                <span class="d-flex align-items-center"><span class="material-symbols-rounded">keyboard_arrow_down</span></span>
            </div>
        `;
        container.querySelector('[data-control="settings-controls-container"]').appendChild(head);

        // render element controls
        controls.forEach((control) => {
            const controlObj = control.domNode;
            container.querySelector('[data-control="settings-controls-container"]').appendChild(controlObj);

            //
            if (control.afterRender) {
                control.afterRender();
            }
        });

        // render head actions
        element.getActions().forEach(action => {
            var actionButton = document.createElement('button');
            actionButton.setAttribute('class', 'element-action-item btn btn-light p-1 d-flex align-items-center');
            actionButton.setAttribute('title', action.label);
            actionButton.innerHTML = `
                <span class="material-symbols-rounded">`+action.icon+`</span>
            `;

            container.querySelector('[data-control="actions"]').appendChild(actionButton);

            // events
            actionButton.addEventListener('click', () => {
                action.run();
            });
        });
    }

    loadDebugCss() {
        const cssContent = `
            [builder-element] {
                cursor: pointer;
                position: relative;
            }

            [builder-element]::before {
                font-size: 10px!important;
            }

            [builder-element="PageElement"] {
                min-height: 50px;
            }

            .builder-mode-design [builder-element="PageElement"] {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 30px;
                background-color: #f0f0f0;
                position: relative;
            }

            .builder-mode-design [builder-element]::before {
                font-family: monospace;
                font-size: 90%;
                position: absolute;
                top: 0;
                right: 0;
                font-weight: bold;
                color: #333;
                border: solid 1px #ddd;
                padding: 2px 5px;
                border-top: none;
                border-right: none;

                pointer-events: none;
            }

            .builder-mode-design [builder-element="PageElement"]::before {
                content: "PageElement";
                pointer-events: none;
            }

            .builder-mode-design [builder-element="BlockElement"] {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 15px;
                background-color: #e0e0e0;
                border: 1px solid #ccc;
                margin-bottom: 10px;
                position: relative;
            }

            .builder-mode-design [builder-element="BlockElement"]::before {
                content: "BlockElement";
                border-color: #ccc;

                pointer-events: none;
            }

            .builder-mode-design [builder-element="H1Element"] {
                padding: 10px;
                background-color: #cfdce4;
                border: 1px solid #bbb;
                position: relative;
            }

            .builder-mode-design [builder-element="H1Element"]::before {
                content: "H1Element";
                border-color: #bbb;
                font-size: initial;

                pointer-events: none;
            }

            .builder-mode-design [builder-element="PElement"] {
                padding: 10px;
                background-color: #cfdce4;
                border: 1px solid #bbb;
                position: relative;
            }

            .builder-mode-design [builder-element="PElement"]::before {
                content: "PElement";
                border-color: #bbb;

                pointer-events: none;
            }

            .builder-mode-design [builder-element="MenuElement"] {
                padding: 10px;
                background-color: #cfdce4;
                border: 1px solid #bbb;
                position: relative;
            }

            .builder-mode-design [builder-element="MenuElement"]::before {
                content: "MenuElement";
                border-color: #bbb;

                pointer-events: none;
            }
            .builder-mode-design [builder-element="GridElement"] {
                gap: 10px;
                padding: 10px;
                background-color: #ccc;
                border: 1px solid #aaa;
                margin: 10px 0;
                position: relative;
            }

            .builder-mode-design [builder-element="GridElement"]::before {
                content: "GridElement";
                border-color: #bbb;

                pointer-events: none;
            }

            .builder-mode-design [builder-element="CellElement"] {
                padding: 10px;
                background-color: #e0e0e0;
                border: 1px solid #aaa;
                margin: 10px 0;
                position: relative;
            }

            .builder-mode-design [builder-element="CellElement"]::before {
                content: "CellElement";
                border-color: #ccc;

                pointer-events: none;
            }

            [builder-element="BlockElement"] {
                position: relative;
            }

            /* inside iframe's document */
            ::-webkit-scrollbar {
                width: 7px;
                height: 7px;
            }

            ::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
            }

            ::-webkit-scrollbar-track {
                background: transparent;
            }

            [contenteditable] {
                outline: none!important;
            }

            [contenteditable]:focus, [contenteditable]::focus-visible {
                outline: none!important;
            }

            input, select {
                pointer-events: none;
            }

            [builder-element="CarouselSlideElement"],  [builder-element="CarouselSlideElement"]
            {
                width: 600px;
                height: 100%;
                border-right: 1px solid #ddd;
            }

            [builder-element="CarouselPageElement"] {
                display: flex;
            }
        `;
        const style = this.iframeDoc.createElement('style');
        style.textContent = cssContent;
        style.setAttribute('data-control', 'builder-helper');
        this.iframeDoc.head.appendChild(style);
    }

    renderTemplate(template, options={}) {
        var html = this.getTemplate(template);

        // EJS render
        html = ejs.render(html, options);

        // Replace src="..."
        html = html.replace(/src=["']([^"']+)["']/gi, (match, url) => {
            return `src="${this.getFullUrl(url)}"`;
        });

        // Replace href="..."
        html = html.replace(/href=["']([^"']+)["']/gi, (match, url) => {
            return `href="${this.getFullUrl(url)}"`;
        });

        // Replace background:url(...)
        html = html.replace(/background\s*:\s*url\((['"]?)([^"')]+)\1\)/gi, (match, quote, url) => {
            // If no quote was found, default to double quotes
            const finalQuote = quote || '"';
            return `background:url(${finalQuote}${this.getFullUrl(url)}${finalQuote})`;
        })

        // Replace background-image:url(...)
        html = html.replace(/background-image\s*:\s*url\((['"]?)([^"')]+)\1\)/gi, (match, quote, url) => {
            // If no quote was found, default to double quotes
            const finalQuote = quote || '"';
            return `background-image:url(${finalQuote}${this.getFullUrl(url)}${finalQuote})`;
        })

        return html;
    }

    getFullUrl(url)
    {
        if (
            !/^https?:\/\//i.test(url) &&
            !url.startsWith('/') &&
            !url.startsWith('[[') &&
            !url.startsWith('[') &&
            !url.startsWith('{') &&
            !url.startsWith('data:image')
        ) {
            return this.themeUrl + '/' + url;
        } else {
            return url;
        }
    }

    renderCarouselControls() {
        const container = this.carouselSettingsContainer;
        var element = this.pageElement;

        // 
        container.innerHTML = `
            <div data-control="settings-controls-container">
            </div>
        `;

        // Get element controls
        const controls = element.getControls();

        // render element controls
        controls.forEach((control) => {
            const controlObj = control.domNode;
            container.querySelector('[data-control="settings-controls-container"]').appendChild(controlObj);

            // 
            if (control.afterRender) {
                control.afterRender();
            }
        });

        // render head actions
        element.getActions().forEach(action => {
            var actionButton = document.createElement('button');
            actionButton.setAttribute('class', 'element-action-item btn btn-light p-1 d-flex align-items-center');
            actionButton.setAttribute('title', action.label);
            actionButton.innerHTML = `
                <span class="material-symbols-rounded">`+action.icon+`</span>
            `;

            container.querySelector('[data-control="actions"]').appendChild(actionButton);

            // events
            actionButton.addEventListener('click', () => {
                action.run();
            });
        });
    }

    renderCarouselElementControls(element) {
        const container = this.carouselElementControlsContainer;

        // 
        container.innerHTML = `
            <div data-control="carousel-element-controls-container">
            </div>
        `;

        // Get element controls
        const controls = element.getControls();

        // render element controls
        controls.forEach((control) => {
            const controlObj = control.domNode;
            container.querySelector('[data-control="carousel-element-controls-container"]').appendChild(controlObj);

            // 
            if (control.afterRender) {
                control.afterRender();
            }
        });

        // // render head actions
        // element.getActions().forEach(action => {
        //     var actionButton = document.createElement('button');
        //     actionButton.setAttribute('class', 'element-action-item btn btn-light p-1 d-flex align-items-center');
        //     actionButton.setAttribute('title', action.label);
        //     actionButton.innerHTML = `
        //         <span class="material-symbols-rounded">`+action.icon+`</span>
        //     `;

        //     container.querySelector('[data-control="actions"]').appendChild(actionButton);

        //     // events
        //     actionButton.addEventListener('click', () => {
        //         action.run();
        //     });
        // });
    }
}

export default Builder;
