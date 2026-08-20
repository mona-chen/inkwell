class RichTextControl {
    constructor(label, value, callback) {
        this.id = '_' + Math.random().toString(36).substr(2, 9);
        // Initialize properties
        this.label = label; // Label for the text control
        this.value = value; // Initial value of the text input
        this.callback = callback; // Callback function to handle input changes

        // Create the main container element
        this.domNode = document.createElement('div');

        //
        this.render(); // Call the render method to create the UI
    }

    render() {
        var aiButton = '';

        // If AI handler is available, render the AI button
        if (builder.aiHandler) {
            aiButton = `
                <div class="text-end position-relative">
                    <div class="dropdown mt-2 d-inline-block" style="z-index: 12;
position: absolute;
right: 5px;
top: -47px;">
                        <button class="btn ai-btn dropdown-toggle d-flex align-items-center" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <span class="smenu-item-icon ai-icon rounded-2 p-0 mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.4em" height="1.6em" viewBox="0 0 256 256">
                                <defs>
                                <linearGradient id="ai-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#4f46e5" />
                                    <stop offset="100%" stop-color="#a855f7" />
                                </linearGradient>
                                </defs>
                                <path fill="url(#ai-gradient)" d="M208 144a15.78 15.78 0 0 1-10.42 14.94L146 178l-19 51.62a15.92 15.92 0 0 1-29.88 0L78 178l-51.62-19a15.92 15.92 0 0 1 0-29.88L78 110l19-51.62a15.92 15.92 0 0 1 29.88 0L146 110l51.62 19A15.78 15.78 0 0 1 208 144m-56-96h16v16a8 8 0 0 0 16 0V48h16a8 8 0 0 0 0-16h-16V16a8 8 0 0 0-16 0v16h-16a8 8 0 0 0 0 16m88 32h-8v-8a8 8 0 0 0-16 0v8h-8a8 8 0 0 0 0 16h8v8a8 8 0 0 0 16 0v-8h8a8 8 0 0 0 0-16"/>
                            </svg>
                            </span>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a data-control="ai" data-text="Optimize content" class="dropdown-item" href="#">Optimize content</a></li>
                            <li><a data-control="ai" data-text="Rewrite formally" class="dropdown-item" href="#">Rewrite formally</a></li>
                            <li><a data-control="ai" data-text="Rewrite more casually" class="dropdown-item" href="#">Rewrite more casually</a></li>
                        </ul>
                    </div>
                </div>
            `;
        }

        this.domNode.innerHTML = `
            <div class="py-2 px-3 position-relative">
                <div data-control="ai-effects"></div>
                <label class="form-label fw-semibold">`+ this.label + `</label>
                <textarea name="text" id="`+ this.id + `" class="form-control"></textarea>

                `+aiButton+`
            </div>
        `;

        // set current value
        this.getTextInput().value = this.value;

        // Add an event listener to handle input changes
        this.getTextInput().addEventListener('keyup', (e) => {
            this.callback.setText(this.getText()); // Trigger the callback with the new value
        });

        // If AI handler is available, add event listeners to AI buttons
        if (builder.aiHandler) {
            //
            this.domNode.querySelectorAll('[data-control="ai"]').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const requestText = item.getAttribute('data-text');
                    var originalText = this.getText();

                    var aiButton = this.domNode.querySelector('.ai-btn'); // Save original text
                    var oButtonText = aiButton.innerHTML; // Save original button text


                    this.domNode.querySelector('[data-control="ai-effects"]').innerHTML = `
                        <span class="ai-sparkles">
                            <span class="star star-lg"></span>
                            <span class="star star-sm delay-1"></span>
                            <span class="star star-md delay-2"></span>
                        </span>`;
                    aiButton.innerHTML = `Thinking...`;
                    aiButton.classList.add('loading');

                    // Call the AI service to rewrite the text
                    this.askAI(originalText, requestText).then(rewrittenText => {
                        this.getTextInput().value = rewrittenText;
                        console.log(tinymce.get(this.id));
                        tinymce.get(this.id).setContent(rewrittenText);

                        this.callback.setText(rewrittenText); // Trigger the callback with the new value


                        aiButton.innerHTML = oButtonText; // Restore original button text
                        aiButton.classList.remove('loading');
                        this.domNode.querySelector('[data-control="ai-effects"]').innerHTML = '';
                        
                        // highlight the whole .tox-tinymce to add effects that is done
                        const tinymceEditor = this.domNode.querySelector('.tox-tinymce');
                        if (tinymceEditor) {
                            tinymceEditor.classList.add('ai-highlight');
                            setTimeout(() => {
                                tinymceEditor.classList.remove('ai-highlight');
                            }, 1200);
                        }
                    });
                });
            });
        }
    }

    askAI(originalText, request = 'Rewrite formally') {
        // Call your backend ai.php endpoint instead of OpenAI directly
        return fetch(builder.aiHandler, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: originalText,
                request: request
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                SAlert.show(data.error.message || 'An error occurred while processing your request.' + JSON.stringify(data));
                return originalText;
            }

            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                return data.choices[0].message.content.trim();
            }
            return originalText;
        })
        .catch(() => {
            alert('Failed to connect to AI service. Please try again later.');
            return originalText;
        });
    }

    afterRender() {
        var _this = this;

        //
        tinymce.init({
            license_key: 'gpl',
            selector: '#' + this.id,
            height: 200, // height in pixels
            inline: false, // use inline mode
            forced_root_block: ' ',
            enter_compatibility: false,     // Disable default Enter block compatibility
            newline_behavior: 'linebreak',
            valid_elements: 'br,strong/b,em/i,span[*],u',  // Adjust to your needs
            extended_valid_elements: 'br,span[*]',
            paste_as_text: true,                 // Avoids pasted blocks
            valid_elements: '*[*]',          // Allow all elements
            br_newline_selector: 'br',     // Tells TinyMCE to treat <br> as a newline
            statusbar: false,
            menubar: false, // hide the menu bar
            toolbar: 'bold italic underline fontsizeselect forecolor backcolor',
            plugins: 'lists', // optional for color support
            branding: false, // hide "Powered by TinyMCE"
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt', // define font sizes
            setup: function (editor) {
                // Listen for keyup event in the editor
                editor.on('keyup change', function () {
                    // Get the content
                    var content = editor.getContent();

                    const container = document.createElement('div');
                    container.innerHTML = content;

                    // Replace <div> with <br> and preserve inner content
                    container.querySelectorAll('div').forEach(div => {
                        const br = document.createElement('br');
                        div.replaceWith(...div.childNodes, br);
                    });

                    content = container.innerHTML;

                    // Sync back to original textarea
                    const textarea = document.getElementById(this.id);
                    textarea.value = content;

                    // Optional: You can log or process the value here
                    console.log('Updated textarea value:', textarea.value);

                    //
                    _this.callback.setText(_this.getText());
                });
            }
        });
    }

    getTextInput() {
        return this.domNode.querySelector('[name="text"]');
    }

    getText() {
        return this.getTextInput().value;
    }


}

export default RichTextControl;