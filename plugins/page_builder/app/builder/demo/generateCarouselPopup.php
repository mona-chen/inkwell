<!-- AI Carousel Generator Modal -->
<div class="modal fade" id="GenerateCarouselPopup" tabindex="-1" aria-labelledby="generateCarouselLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header border-0 pb-2">
                <div class="d-flex align-items-center me-auto">
                    <h4 class="modal-title fw-bold mb-0 me-2" id="generateCarouselLabel">AI Carousel Generator</h4>
                    <span class="badge d-flex align-items-center rounded-pill px-2 py-1" style="font-size: 0.7rem; background-color: #e1d5f3; color: #6941C6;">
                        <span class="material-symbols-rounded me-1" style="font-size: 0.8rem;">lock</span>
                        PRO
                    </span>
                </div>
                <div class="d-flex align-items-center">
                    <button type="button" class="btn btn-link text-decoration-none me-2 p-1 d-flex align-items-center text-dark border-end pe-3 rounded-0">
                        <span class="material-symbols-rounded fs-5 me-1">help</span>
                        <span class="small">Help</span>
                    </button>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
            </div>
            <div class="modal-body pt-0">
                <p class="text-muted mb-4">Create stunning carousels in seconds with AI.</p>
                
                <!-- Input Type Tabs -->
                <ul class="nav nav-tabs mb-4" id="inputTypeTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active d-flex align-items-center" id="topic-tab" data-bs-toggle="tab" data-bs-target="#topic-pane" type="button" role="tab">
                            <span class="material-symbols-rounded me-2 fs-5">lightbulb</span>
                            Topic
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link d-flex align-items-center" id="text-tab" data-bs-toggle="tab" data-bs-target="#text-pane" type="button" role="tab">
                            <span class="material-symbols-rounded me-2 fs-5">subject</span>
                            Text
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link d-flex align-items-center" id="url-tab" data-bs-toggle="tab" data-bs-target="#url-pane" type="button" role="tab">
                            <span class="material-symbols-rounded me-2 fs-5">link</span>
                            URL
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link d-flex align-items-center" id="video-tab" data-bs-toggle="tab" data-bs-target="#video-pane" type="button" role="tab">
                            <span class="material-symbols-rounded me-2 fs-5">play_circle</span>
                            Video
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link d-flex align-items-center" id="pdf-tab" data-bs-toggle="tab" data-bs-target="#pdf-pane" type="button" role="tab">
                            <span class="material-symbols-rounded me-2 fs-5">picture_as_pdf</span>
                            PDF
                        </button>
                    </li>
                </ul>

                <!-- Tab Content -->
                <div class="tab-content" id="inputTypeContent">
                    <div class="tab-pane fade show active" id="topic-pane" role="tabpanel">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="slideCount" class="form-label">Slides</label>
                                <input type="number" class="form-control" id="slideCount" value="6" min="1" max="20">
                            </div>
                            <div class="col-md-6">
                                <label for="topicInput" class="form-label">Topic</label>
                                <input type="text" class="form-control" id="topicInput" placeholder="e.g. 'Web Design Best Practices'">
                            </div>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label for="formatSelect" class="form-label">Format</label>
                                <select class="form-select" id="formatSelect">
                                    <option value="auto" selected>Auto</option>
                                    <option value="listicle">Listicle</option>
                                    <option value="guide">Guide</option>
                                    <option value="tips">Tips</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="languageSelect" class="form-label">Output Language</label>
                                <select class="form-select" id="languageSelect">
                                    <option value="english" selected>English</option>
                                    <option value="spanish">Spanish</option>
                                    <option value="french">French</option>
                                    <option value="german">German</option>
                                </select>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="customInstructions" class="form-label">Custom Instructions (optional)</label>
                            <textarea class="form-control" id="customInstructions" rows="3" placeholder="e.g., 'Make it sound like someone talking to a friend in simple terms.'"></textarea>
                        </div>

                        <!-- Image Assist -->
                        <div class="d-flex align-items-center justify-content-between mb-4 p-3 bg-light rounded">
                            <div class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-3 text-primary fs-4">auto_awesome</span>
                                <div>
                                    <h6 class="mb-1">IMAGE ASSIST</h6>
                                    <p class="mb-0 text-muted small">Automatically add AI-picked images.</p>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="imageAssistToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Other tab panes (Text, URL, Video, PDF) -->
                    <div class="tab-pane fade" id="text-pane" role="tabpanel">
                        <div class="mb-3">
                            <label for="textInput" class="form-label fw-bold">Text</label>
                            <textarea class="form-control bg-light border-0" id="textInput" rows="6" placeholder="aiCarousels effortlessly transforms your content, including articles, social media posts, and ideas, into captivating carousels, no fancy design skills required! This allows you to repurpose your existing content with ease, saving you valuable time and expanding your reach.

If you want your content to really stand out, the Text option not only converts it but also makes it better!"></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label for="textCustomInstructions" class="form-label fw-bold">Custom Instructions (optional)</label>
                            <textarea class="form-control bg-light border-0" id="textCustomInstructions" rows="2" placeholder="e.g., 'Make it sound like someone talking to a friend in simple terms.'"></textarea>
                        </div>
                        
                        <div class="mb-4">
                            <label for="textLanguageSelect" class="form-label fw-bold">Output Language</label>
                            <select class="form-select bg-light border-0" id="textLanguageSelect">
                                <option value="english" selected>English</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="german">German</option>
                            </select>
                        </div>

                        <!-- Image Assist for Text -->
                        <div class="d-flex align-items-center justify-content-between mb-4 p-3 bg-light rounded">
                            <div class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-3 text-primary fs-4">auto_awesome</span>
                                <div>
                                    <h6 class="mb-1">IMAGE ASSIST</h6>
                                    <p class="mb-0 text-muted small">Automatically add AI-picked images.</p>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="textImageAssistToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="tab-pane fade" id="url-pane" role="tabpanel">
                        <div class="mb-3">
                            <label for="urlInput" class="form-label fw-bold">URL</label>
                            <input type="url" class="form-control bg-light border-0" id="urlInput" placeholder="https://www.aiCarousels.com">
                        </div>
                        
                        <div class="mb-3">
                            <label for="urlCustomInstructions" class="form-label fw-bold">Custom Instructions (optional)</label>
                            <textarea class="form-control bg-light border-0" id="urlCustomInstructions" rows="2" placeholder="e.g., 'Make it sound like someone talking to a friend in simple terms.'"></textarea>
                        </div>
                        
                        <div class="mb-4">
                            <label for="urlLanguageSelect" class="form-label fw-bold">Output Language</label>
                            <select class="form-select bg-light border-0" id="urlLanguageSelect">
                                <option value="english" selected>English</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="german">German</option>
                            </select>
                        </div>

                        <!-- Image Assist for URL -->
                        <div class="d-flex align-items-center justify-content-between mb-4 p-3 bg-light rounded">
                            <div class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-3 text-primary fs-4">auto_awesome</span>
                                <div>
                                    <h6 class="mb-1">IMAGE ASSIST</h6>
                                    <p class="mb-0 text-muted small">Automatically add AI-picked images.</p>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="urlImageAssistToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="tab-pane fade" id="video-pane" role="tabpanel">
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <label for="videoInput" class="form-label fw-bold">YouTube Video URL</label>
                                <a href="#" class="text-primary text-decoration-none small">Watch Video</a>
                            </div>
                            <input type="url" class="form-control bg-light border-0" id="videoInput" placeholder="https://www.youtube.com/watch?v=RS7lzU2VJlQ">
                        </div>
                        
                        <div class="mb-3">
                            <label for="videoCustomInstructions" class="form-label fw-bold">Custom Instructions (optional)</label>
                            <textarea class="form-control bg-light border-0" id="videoCustomInstructions" rows="2" placeholder="e.g., 'Make it sound like someone talking to a friend in simple terms.'"></textarea>
                        </div>
                        
                        <div class="mb-4">
                            <label for="videoLanguageSelect" class="form-label fw-bold">Output Language</label>
                            <select class="form-select bg-light border-0" id="videoLanguageSelect">
                                <option value="english" selected>English</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="german">German</option>
                            </select>
                        </div>

                        <!-- Image Assist for Video -->
                        <div class="d-flex align-items-center justify-content-between mb-4 p-3 bg-light rounded">
                            <div class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-3 text-primary fs-4">auto_awesome</span>
                                <div>
                                    <h6 class="mb-1">IMAGE ASSIST</h6>
                                    <p class="mb-0 text-muted small">Automatically add AI-picked images.</p>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="videoImageAssistToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="tab-pane fade" id="pdf-pane" role="tabpanel">
                        <!-- PDF Upload Area -->
                        <div class="mb-3">
                            <div class="border border-dashed rounded p-5 text-center" style="border-color: #8B5CF6 !important; border-width: 1px !important; background-color: #faf9ff;border-style:dashed!important;">
                                <p class="text-muted mb-3">Click to upload<span class="text-primary">or</span> drag and drop your PDF here</p>
                                <input type="file" class="d-none" id="pdfUpload" accept=".pdf">
                                <label for="pdfUpload" class="btn btn-outline-primary">Choose File</label>
                            </div>
                            
                            <!-- Upload Success Message -->
                            <div class="d-flex align-items-center mt-3">
                                <span class="material-symbols-rounded text-muted me-2 border rounded-circle p-1" style="font-size: 1.2rem; border-color: #6b7280 !important;">info</span>
                                <span class="small">Uploaded successfully:<span class="text-primary">bitcoin.pdf</span></span>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="pdfCustomInstructions" class="form-label fw-bold">Custom Instructions (optional)</label>
                            <textarea class="form-control bg-light border-0" id="pdfCustomInstructions" rows="2" placeholder="e.g., 'Make it sound like someone talking to a friend in simple terms.'"></textarea>
                        </div>
                        
                        <div class="mb-4">
                            <label for="pdfLanguageSelect" class="form-label fw-bold">Output Language</label>
                            <select class="form-select bg-light border-0" id="pdfLanguageSelect">
                                <option value="english" selected>English</option>
                                <option value="spanish">Spanish</option>
                                <option value="french">French</option>
                                <option value="german">German</option>
                            </select>
                        </div>

                        <!-- Image Assist for PDF -->
                        <div class="d-flex align-items-center justify-content-between mb-4 p-3 bg-light rounded">
                            <div class="d-flex align-items-center">
                                <span class="material-symbols-rounded me-3 text-primary fs-4">auto_awesome</span>
                                <div>
                                    <h6 class="mb-1">IMAGE ASSIST</h6>
                                    <p class="mb-0 text-muted small">Automatically add AI-picked images.</p>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="pdfImageAssistToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-0 pt-0">
                <div class="d-flex justify-content-between w-100">
                    <button type="button" class="btn btn-outline-primary d-flex align-items-center" id="generateButton">
                        <span class="material-symbols-rounded me-2">auto_awesome</span>
                        <span id="generateButtonText">Try Generate from Topic</span>
                    </button>
                    <button type="button" class="btn btn-primary d-flex align-items-center">
                        <span class="material-symbols-rounded me-2">lock</span>
                        Sign Up to Unlock
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Update generate button text based on active tab
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('#inputTypeTabs button[data-bs-toggle="tab"]');
    const generateButtonText = document.getElementById('generateButtonText');
    
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function(event) {
            const activeTabId = event.target.getAttribute('data-bs-target');
            let buttonText = 'Try Generate from Topic';
            
            switch(activeTabId) {
                case '#topic-pane':
                    buttonText = 'Try Generate from Topic';
                    break;
                case '#text-pane':
                    buttonText = 'Try Generate from Text';
                    break;
                case '#url-pane':
                    buttonText = 'Try Generate from Website';
                    break;
                case '#video-pane':
                    buttonText = 'Try Generate from YouTube';
                    break;
                case '#pdf-pane':
                    buttonText = 'Try Generate from PDF';
                    break;
            }
            
            generateButtonText.textContent = buttonText;
        });
    });
});
</script>