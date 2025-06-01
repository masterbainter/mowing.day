// At the top of your script.js for GitHub Pages
// !!! IMPORTANT: Double-check that this is your correct Cloud Run Service URL !!!
const API_BASE_URL = 'https://madison-mowing-api-1044511496334.us-central1.run.app'; 

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Acquisition (no changes)
    const servicesListEl = document.getElementById('services-list');
    const errorLogEl = document.getElementById('error-log');
    const successLogEl = document.getElementById('success-log'); // Ensure this element exists in your HTML if you use it
    const serviceSelectionStep = document.getElementById('service-selection');
    const availabilitySelectionStep = document.getElementById('availability-selection');
    const bookingFormContainerStep = document.getElementById('booking-form-container');
    const selectedServiceNameEl = document.getElementById('selected-service-name');
    const bookingDateInput = document.getElementById('booking-date');
    const fetchAvailabilityButton = document.getElementById('fetch-availability-button');
    const timeSlotsContainerEl = document.getElementById('time-slots-container');
    const bookingForm = document.getElementById('booking-form');
    const bookingSummaryServiceEl = document.getElementById('booking-summary-service');
    const bookingSummaryTimeEl = document.getElementById('booking-summary-time');
    const bookingSummaryDateEl = document.getElementById('booking-summary-date');
    const backToAvailabilityButton = document.getElementById('back-to-availability');

    // State variables (no changes)
    let currentServices = [];
    let selectedService = null;
    let selectedDate = null;
    let selectedTimeSlot = null;

    // Utility Functions (no changes)
    function showError(message) {
        if (errorLogEl) {
            errorLogEl.textContent = message;
            errorLogEl.classList.remove('hidden');
        }
        if (successLogEl) successLogEl.classList.add('hidden');
    }
    function clearLogs() {
        if (errorLogEl) { errorLogEl.classList.add('hidden'); errorLogEl.textContent = ''; }
        if (successLogEl) { successLogEl.classList.add('hidden'); successLogEl.textContent = ''; }
    }
    function navigateToStep(stepToShow) {
        if (serviceSelectionStep) serviceSelectionStep.classList.add('hidden');
        if (availabilitySelectionStep) availabilitySelectionStep.classList.add('hidden');
        if (bookingFormContainerStep) bookingFormContainerStep.classList.add('hidden');
        if (stepToShow) stepToShow.classList.remove('hidden');
        clearLogs();
    }
    function parseIsoDurationToMillis(isoDuration) {
        if (!isoDuration || !isoDuration.startsWith('PT')) return 0;
        const duration = isoDuration.substring(2);
        let hours = 0, minutes = 0, seconds = 0;
        let tempDuration = duration;
        if (tempDuration.includes('H')) { const parts = tempDuration.split('H'); hours = parseInt(parts[0], 10); tempDuration = parts[1] || ""; }
        if (tempDuration.includes('M')) { const parts = tempDuration.split('M'); minutes = parseInt(parts[0], 10); tempDuration = parts[1] || ""; }
        if (tempDuration.includes('S')) { const parts = tempDuration.split('S'); seconds = parseInt(parts[0], 10); }
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    // Main Functions
    async function fetchServices() {
        servicesListEl.innerHTML = '<li>Loading services...</li>';
        try {
            // --- UPDATED ---
            const response = await fetch(`${API_BASE_URL}/api/services`);
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Server responded with ${response.status}`); }
            currentServices = await response.json();
            renderServices();
        } catch (error) {
            console.error('Failed to fetch services:', error);
            showError(`Error fetching services: ${error.message}`);
            servicesListEl.innerHTML = '<li>Could not load services.</li>';
        }
    }
    function renderServices() {
        servicesListEl.innerHTML = '';
        if (currentServices.length === 0) { servicesListEl.innerHTML = '<li>No services found.</li>'; return; }
        currentServices.forEach(service => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = service.displayName;
            button.onclick = () => handleServiceSelection(service);
            li.appendChild(button);
            servicesListEl.appendChild(li);
        });
    }
    function handleServiceSelection(service) {
        selectedService = service;
        if (selectedServiceNameEl) selectedServiceNameEl.textContent = service.displayName;
        navigateToStep(availabilitySelectionStep);
        if (bookingDateInput) bookingDateInput.value = '';
        if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>Please select a date to see available times.</p>';
    }

    if (fetchAvailabilityButton) {
        fetchAvailabilityButton.addEventListener('click', async () => {
            selectedDate = bookingDateInput.value;
            if (!selectedService || !selectedDate) { showError("Please select a service and a date."); return; }
            if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>Fetching available times...</p>';
            clearLogs();
            try {
                // --- UPDATED ---
                const response = await fetch(`${API_BASE_URL}/api/availability`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serviceId: selectedService.id, date: selectedDate })
                });
                if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Server responded with ${response.status}`);}
                const availabilityData = await response.json();
                renderAvailabilitySlots(availabilityData);
            } catch (error) {
                console.error('Failed to fetch availability:', error);
                showError(`Error fetching availability: ${error.message}`);
                if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>Could not load available times. Please try another date.</p>';
            }
        });
    }

    function renderAvailabilitySlots(availabilityData) {
        if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '';
        if (!selectedService) {
            if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>Error: Service not selected for slot generation.</p>';
            return;
        }
        if (!availabilityData || availabilityData.length === 0) {
            if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>No available time slots for this date. Please try another date.</p>';
            return;
        }
        const serviceDurationMillis = parseIsoDurationToMillis(selectedService.defaultDuration);
        if (serviceDurationMillis === 0) {
            if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>Service duration is not configured correctly or is zero.</p>';
            return;
        }
        const allGeneratedSlots = [];
        availabilityData.forEach((viewItem) => {
            if (viewItem.availabilityItems && viewItem.availabilityItems.length > 0) {
                viewItem.availabilityItems.forEach((block) => {
                    if (block.status && (block.status.toLowerCase() === 'free' || block.status.toLowerCase() === 'available')) {
                        let currentSlotStart = new Date(block.startDateTime.dateTime);
                        const blockEnd = new Date(block.endDateTime.dateTime);
                        while (currentSlotStart.getTime() + serviceDurationMillis <= blockEnd.getTime()) {
                            const slotEnd = new Date(currentSlotStart.getTime() + serviceDurationMillis);
                            allGeneratedSlots.push({
                                start: new Date(currentSlotStart.getTime()),
                                end: slotEnd,
                                staffMemberId: viewItem.staffId
                            });
                            currentSlotStart = new Date(slotEnd.getTime());
                        }
                    }
                });
            }
        });

        if (allGeneratedSlots.length === 0) {
            if (timeSlotsContainerEl) timeSlotsContainerEl.innerHTML = '<p>No available time slots for this date (after processing). Please try another date.</p>';
            return;
        }
        allGeneratedSlots.forEach(slotData => {
            const slotButton = document.createElement('button');
            slotButton.classList.add('time-slot-button'); // Added class for potential styling
            const options = { hour: 'numeric', minute: 'numeric', hour12: true };
            slotButton.textContent = slotData.start.toLocaleTimeString([], options);
            slotButton.onclick = () => {
                selectedTimeSlot = {
                    startDateTime: slotData.start.toISOString(),
                    endDateTime: slotData.end.toISOString(),
                    staffMemberId: slotData.staffMemberId 
                };
                handleTimeSlotSelection();
            };
            if (timeSlotsContainerEl) timeSlotsContainerEl.appendChild(slotButton);
        });
    }

    function handleTimeSlotSelection() {
        if (!selectedService || !selectedDate || !selectedTimeSlot) { showError("Error in selection process."); return; }
        if (bookingSummaryServiceEl) bookingSummaryServiceEl.textContent = selectedService.displayName;
        if (bookingSummaryDateEl) bookingSummaryDateEl.textContent = new Date(selectedDate + 'T00:00:00').toLocaleDateString();
        if (bookingSummaryTimeEl) bookingSummaryTimeEl.textContent = new Date(selectedTimeSlot.startDateTime).toLocaleTimeString([], { hour: 'numeric', minute: 'numeric', hour12: true });
        navigateToStep(bookingFormContainerStep);
    }

    if (bookingForm) {
        bookingForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const confirmButton = document.getElementById('confirm-booking-button');
            confirmButton.disabled = true;
            confirmButton.textContent = 'Booking...';
            try {
                const bookingData = {
                    serviceId: selectedService.id,
                    startDateTime: selectedTimeSlot.startDateTime,
                    endDateTime: selectedTimeSlot.endDateTime,
                    staffMemberId: selectedTimeSlot.staffMemberId,
                    customerName: document.getElementById('customer-name').value,
                    customerEmail: document.getElementById('customer-email').value,
                    customerPhone: document.getElementById('customer-phone').value || ""
                };
                // --- UPDATED ---
                const response = await fetch(`${API_BASE_URL}/api/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingData)
                });
                if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Server responded with ${response.status}`);}
                const result = await response.json();
                alert(`Booking confirmed! Your booking ID is ${result.bookingDetails.id}`);
                navigateToStep(serviceSelectionStep);
                fetchServices(); // Refresh services, or navigate to a different "thank you" state
            } catch (error) {
                showError(`Booking failed: ${error.message}`);
            } finally {
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirm Booking';
            }
        });
    }

    if (backToAvailabilityButton) {
        backToAvailabilityButton.addEventListener('click', () => {
            navigateToStep(availabilitySelectionStep);
        });
    }

    // --- Initial Load ---
    navigateToStep(serviceSelectionStep);
    fetchServices();
});
