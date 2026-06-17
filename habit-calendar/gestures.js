/**
 * Gesture Manager - Handles touch gestures and interactions
 */

class GestureManager {
    constructor() {
        this.isDraggingDivider = false;
        this.startY = 0;
        this.startSplitPosition = 0;

        this.isSwiping = false;
        this.swipeStartX = 0;
        this.swipeStartY = 0;
        this.swipeThreshold = 50;

        this.isPinching = false;
        this.initialDistance = 0;

        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        this.initializeDividerDrag();
        this.initializeCalendarGestures();
    }

    /**
     * Initialize divider dragging
     */
    initializeDividerDrag() {
        const divider = document.getElementById('split-divider');
        const handle = document.getElementById('divider-handle');

        const startDrag = (e) => {
            this.isDraggingDivider = true;
            this.startY = this.getClientY(e);

            const taskSection = document.getElementById('task-list-section');
            const flexValue = window.getComputedStyle(taskSection).flex;
            this.startSplitPosition = parseFloat(flexValue) || 25;

            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        };

        const doDrag = (e) => {
            if (!this.isDraggingDivider) return;

            const currentY = this.getClientY(e);
            const deltaY = this.startY - currentY;
            const container = document.getElementById('content-container');
            const containerHeight = container.clientHeight;

            // Calculate new split position as percentage
            const deltaPercent = (deltaY / containerHeight) * 100;
            let newSplit = this.startSplitPosition + deltaPercent;

            // Clamp between 10% and 60%
            newSplit = Math.max(10, Math.min(60, newSplit));

            // Apply new split
            document.documentElement.style.setProperty('--split-position', `${newSplit}%`);

            e.preventDefault();
        };

        const endDrag = () => {
            if (this.isDraggingDivider) {
                this.isDraggingDivider = false;
                document.body.style.cursor = '';
            }
        };

        // Mouse events
        divider.addEventListener('mousedown', startDrag);
        handle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', endDrag);

        // Touch events
        divider.addEventListener('touchstart', startDrag, { passive: false });
        handle.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', doDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    /**
     * Initialize calendar gestures (swipe, pinch-zoom)
     */
    initializeCalendarGestures() {
        const calendarSection = document.getElementById('calendar-section');

        // Touch start
        calendarSection.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                // Single touch - swipe
                this.isSwiping = true;
                this.swipeStartX = e.touches[0].clientX;
                this.swipeStartY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Two touches - pinch zoom
                this.isPinching = true;
                this.isSwiping = false;
                this.initialDistance = this.getDistance(e.touches[0], e.touches[1]);
            }
        }, { passive: true });

        // Touch move
        calendarSection.addEventListener('touchmove', (e) => {
            if (this.isPinching && e.touches.length === 2) {
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const delta = (currentDistance - this.initialDistance) / 200;

                calendar.applyZoom(delta);
                this.initialDistance = currentDistance;
            }
        }, { passive: true });

        // Touch end
        calendarSection.addEventListener('touchend', (e) => {
            if (this.isSwiping && e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const deltaX = touch.clientX - this.swipeStartX;
                const deltaY = touch.clientY - this.swipeStartY;

                // Horizontal swipe (change month)
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.swipeThreshold) {
                    if (deltaX > 0) {
                        // Swipe right - previous month
                        calendar.changeMonth(-1);
                    } else {
                        // Swipe left - next month
                        calendar.changeMonth(1);
                    }
                }

                // Vertical swipe handled by scroll
            }

            this.isSwiping = false;
            this.isPinching = false;
        }, { passive: true });

        // Mouse wheel zoom (for desktop)
        calendarSection.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                calendar.applyZoom(delta);
            }
        }, { passive: false });
    }

    /**
     * Get client Y from mouse or touch event
     */
    getClientY(e) {
        return e.touches ? e.touches[0].clientY : e.clientY;
    }

    /**
     * Get distance between two touch points
     */
    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Detect swipe direction
     */
    detectSwipeDirection(startX, startY, endX, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'down' : 'up';
        }
    }
}

// Create global instance
const gestures = new GestureManager();
