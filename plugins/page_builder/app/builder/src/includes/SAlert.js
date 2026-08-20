var SAlert = {
    show: function(message) {
        // Ensure the alerts wrapper exists
        let wrapper = document.getElementById('alertsWrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'alertsWrapper';
            wrapper.innerHTML = `
                <!-- Add this modal HTML inside the <body> tag if not already present -->
                <div class="modal fade" id="SAlertModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title d-flex align-items-center text-primary" id="successModalLabel"><span class="material-symbols-rounded fs-2">lightbulb</span></h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body" id="SAlertModalBody">
                                <!-- Content will be dynamically updated -->
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(wrapper);
        }

        wrapper.querySelector('#SAlertModalBody').innerHTML = message;
        const modal = new bootstrap.Modal(document.getElementById('SAlertModal'));
        modal.show();
    }
}

export default SAlert;