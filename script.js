class ScheduleLogger {
    constructor() {
        this.activities = JSON.parse(localStorage.getItem('personalSchedule')) || [];
        this.categories = JSON.parse(localStorage.getItem('scheduleCategories')) || this.getDefaultCategories();
        this.holidays = JSON.parse(localStorage.getItem('hkHolidays')) || {};
        this.appTitle = localStorage.getItem('appTitle') || 'My Personal Schedule';
        this.currentTheme = localStorage.getItem('appTheme') || 'default';
        this.currentFilter = 'all';
        this.currentView = 'list';
        this.currentDate = new Date();
        
        // Cloud sync properties
        this.syncToken = localStorage.getItem('syncToken') || null;
        this.lastSync = localStorage.getItem('lastSync') || null;
        this.syncEnabled = !!this.syncToken;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        this.loadAppTitle();
        this.renderCategories();
        this.loadHolidays();
        this.setupCloudSync();
        this.applyTheme(this.currentTheme);
        
        // Auto-load from cloud if sync is enabled
        if (this.syncEnabled) {
            await this.loadFromCloud();
        }
        
        this.renderCurrentView();
    }

    getDefaultCategories() {
        return [
            { id: 'fitness', name: 'Fitness & Yoga', color: '#28a745' },
            { id: 'meals', name: 'Meals', color: '#ffc107' },
            { id: 'study', name: 'Study', color: '#17a2b8' },
            { id: 'exam', name: 'Exams', color: '#dc3545' },
            { id: 'travel', name: 'Travel', color: '#6f42c1' }
        ];
    }

    bindEvents() {
        // Modal controls
        const modal = document.getElementById('activity-modal');
        const addBtn = document.getElementById('add-activity-btn');
        const closeBtn = document.querySelector('.close');
        const form = document.getElementById('activity-form');

        addBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });

        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addActivity();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.category;
                this.renderCurrentView();
            });
        });

        // View toggle buttons
        document.getElementById('list-view-btn').addEventListener('click', () => {
            this.switchView('list');
        });

        document.getElementById('calendar-view-btn').addEventListener('click', () => {
            this.switchView('calendar');
        });

        // Calendar navigation
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Recurring activity controls
        document.getElementById('is-recurring').addEventListener('change', (e) => {
            const options = document.getElementById('recurring-options');
            options.style.display = e.target.checked ? 'block' : 'none';
            this.updateRecurringPreview();
        });

        document.getElementById('recurring-frequency').addEventListener('change', () => {
            this.updateRecurringUnit();
            this.updateRecurringPreview();
        });

        document.getElementById('recurring-count').addEventListener('input', () => {
            this.updateRecurringPreview();
        });

        document.getElementById('activity-datetime').addEventListener('change', () => {
            this.updateRecurringPreview();
        });

        // Category management
        document.getElementById('manage-categories-btn').addEventListener('click', () => {
            this.openCategoryModal();
        });

        document.getElementById('category-close').addEventListener('click', () => {
            document.getElementById('category-modal').style.display = 'none';
        });

        document.getElementById('add-category').addEventListener('click', () => {
            this.addCategory();
        });

        window.addEventListener('click', (e) => {
            const categoryModal = document.getElementById('category-modal');
            if (e.target === categoryModal) {
                categoryModal.style.display = 'none';
            }
        });

        // Theme management
        document.getElementById('theme-selector-btn').addEventListener('click', () => {
            this.openThemeModal();
        });

        document.getElementById('theme-close').addEventListener('click', () => {
            document.getElementById('theme-modal').style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            const themeModal = document.getElementById('theme-modal');
            if (e.target === themeModal) {
                themeModal.style.display = 'none';
            }
        });

        // Title editing
        this.bindTitleEvents();
    }

    addActivity() {
        const form = document.getElementById('activity-form');
        const isRecurring = document.getElementById('is-recurring').checked;
        
        const baseActivity = {
            title: document.getElementById('activity-title').value,
            category: document.getElementById('activity-category').value,
            datetime: this.normalizeDateTime(document.getElementById('activity-datetime').value),
            duration: this.calculateDurationInMinutes(),
            notes: document.getElementById('activity-notes').value || '',
            createdAt: new Date().toISOString()
        };

        // Check if we're editing an existing activity
        if (this.editingActivityId) {
            this.updateActivity(baseActivity);
        } else if (isRecurring) {
            const frequency = document.getElementById('recurring-frequency').value;
            const count = parseInt(document.getElementById('recurring-count').value) || 1;
            const recurringId = Date.now();
            
            this.createRecurringActivities(baseActivity, frequency, count, recurringId);
        } else {
            const activity = {
                ...baseActivity,
                id: Date.now()
            };
            this.activities.push(activity);
        }

        this.saveToStorage();
        this.renderCurrentView();
        this.closeModal();
    }

    updateActivity(updatedData) {
        if (this.editingSeriesId) {
            // Update entire series
            const seriesActivities = this.activities.filter(activity => activity.recurringId === this.editingSeriesId);
            const originalActivity = this.activities.find(a => a.id === this.editingActivityId);
            
            if (originalActivity && seriesActivities.length > 0) {
                const startDate = new Date(updatedData.datetime);
                
                seriesActivities.forEach((activity, index) => {
                    const activityDate = new Date(startDate);
                    
                    // Calculate new date based on original frequency
                    switch (originalActivity.recurringFrequency) {
                        case 'daily':
                            activityDate.setDate(startDate.getDate() + index);
                            break;
                        case 'weekly':
                            activityDate.setDate(startDate.getDate() + (index * 7));
                            break;
                        case 'monthly':
                            activityDate.setMonth(startDate.getMonth() + index);
                            break;
                    }
                    
                    // Update activity
                    const activityIndex = this.activities.findIndex(a => a.id === activity.id);
                    if (activityIndex !== -1) {
                        this.activities[activityIndex] = {
                            ...this.activities[activityIndex],
                            title: updatedData.title,
                            category: updatedData.category,
                            datetime: activityDate.toISOString(),
                            duration: updatedData.duration,
                            notes: updatedData.notes
                        };
                    }
                });
            }
        } else {
            // Update single activity
            const activityIndex = this.activities.findIndex(a => a.id === this.editingActivityId);
            if (activityIndex !== -1) {
                this.activities[activityIndex] = {
                    ...this.activities[activityIndex],
                    ...updatedData
                };
            }
        }
        
        // Clear editing state
        this.editingActivityId = null;
        this.editingSeriesId = null;
    }

    closeModal() {
        const form = document.getElementById('activity-form');
        
        // Close modal and reset form
        document.getElementById('activity-modal').style.display = 'none';
        form.reset();
        document.getElementById('duration-unit').value = 'minutes';
        document.getElementById('recurring-options').style.display = 'none';
        
        // Reset modal title and button text
        document.querySelector('#activity-modal h2').textContent = 'Add New Activity';
        document.querySelector('#activity-form button[type="submit"]').textContent = 'Save Activity';
        
        // Clear editing state
        this.editingActivityId = null;
        this.editingSeriesId = null;
    }

    createRecurringActivities(baseActivity, frequency, count, recurringId) {
        // Parse the base datetime as HKT
        const baseDateTime = baseActivity.datetime;
        const baseDate = new Date(baseDateTime);
        
        for (let i = 0; i < count; i++) {
            // Create new date in HKT for each occurrence
            const [datePart, timePart] = baseDateTime.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute] = timePart.split(':').map(Number);
            
            // Start with the base HKT date/time
            const hktDate = new Date(year, month - 1, day, hour, minute);
            
            // Add the appropriate interval
            switch (frequency) {
                case 'daily':
                    hktDate.setDate(hktDate.getDate() + i);
                    break;
                case 'weekly':
                    hktDate.setDate(hktDate.getDate() + (i * 7));
                    break;
                case 'monthly':
                    hktDate.setMonth(hktDate.getMonth() + i);
                    break;
            }
            
            // Convert to UTC for storage
            const utcDate = new Date(hktDate.getTime() - (8 * 60 * 60 * 1000));
            
            const activity = {
                ...baseActivity,
                id: Date.now() + i,
                datetime: utcDate.toISOString(),
                isRecurring: true,
                recurringId: recurringId,
                recurringIndex: i + 1,
                recurringTotal: count,
                recurringFrequency: frequency
            };
            
            this.activities.push(activity);
        }
    }

    updateRecurringUnit() {
        const frequency = document.getElementById('recurring-frequency').value;
        const unitElement = document.getElementById('recurring-unit');
        
        switch (frequency) {
            case 'daily':
                unitElement.textContent = 'days';
                break;
            case 'weekly':
                unitElement.textContent = 'weeks';
                break;
            case 'monthly':
                unitElement.textContent = 'months';
                break;
        }
    }

    updateRecurringPreview() {
        const isRecurring = document.getElementById('is-recurring').checked;
        const preview = document.getElementById('recurring-preview');
        
        if (!isRecurring) {
            preview.innerHTML = '';
            return;
        }
        
        const datetime = document.getElementById('activity-datetime').value;
        const frequency = document.getElementById('recurring-frequency').value;
        const count = parseInt(document.getElementById('recurring-count').value) || 1;
        
        if (!datetime) {
            preview.innerHTML = '<em>Please select a date and time first</em>';
            return;
        }
        
        const startDate = new Date(datetime);
        const dates = [];
        
        for (let i = 0; i < Math.min(count, 5); i++) {
            const date = new Date(startDate);
            
            switch (frequency) {
                case 'daily':
                    date.setDate(startDate.getDate() + i);
                    break;
                case 'weekly':
                    date.setDate(startDate.getDate() + (i * 7));
                    break;
                case 'monthly':
                    date.setMonth(startDate.getMonth() + i);
                    break;
            }
            
            dates.push(date);
        }
        
        let previewHTML = `<strong>Will create ${count} activities:</strong><br>`;
        dates.forEach((date, index) => {
            previewHTML += `${index + 1}. ${this.formatDateTime(date.toISOString())}<br>`;
        });
        
        if (count > 5) {
            previewHTML += `... and ${count - 5} more`;
        }
        
        preview.innerHTML = previewHTML;
    }

    deleteActivity(id) {
        if (confirm('Are you sure you want to delete this activity?')) {
            this.activities = this.activities.filter(activity => activity.id !== id);
            this.saveToStorage();
            this.renderCurrentView();
        }
    }

    deleteRecurringSeries(recurringId) {
        const seriesActivities = this.activities.filter(activity => activity.recurringId === recurringId);
        const seriesTitle = seriesActivities[0]?.title || 'this series';
        
        if (confirm(`Are you sure you want to delete all ${seriesActivities.length} activities in the "${seriesTitle}" series?`)) {
            this.activities = this.activities.filter(activity => activity.recurringId !== recurringId);
            this.saveToStorage();
            this.renderCurrentView();
        }
    }

    editActivity(id) {
        const activity = this.activities.find(a => a.id === id);
        if (!activity) return;

        // Populate the form with existing data
        document.getElementById('activity-title').value = activity.title;
        document.getElementById('activity-category').value = activity.category;
        
        // Convert ISO datetime back to datetime-local format for the input
        const date = new Date(activity.datetime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        document.getElementById('activity-datetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;
        
        // Set duration
        if (activity.duration) {
            if (activity.duration >= 1440) {
                document.getElementById('activity-duration').value = Math.round(activity.duration / 1440);
                document.getElementById('duration-unit').value = 'days';
            } else if (activity.duration >= 60) {
                document.getElementById('activity-duration').value = Math.round(activity.duration / 60);
                document.getElementById('duration-unit').value = 'hours';
            } else {
                document.getElementById('activity-duration').value = activity.duration;
                document.getElementById('duration-unit').value = 'minutes';
            }
        } else {
            document.getElementById('activity-duration').value = '';
        }
        
        document.getElementById('activity-notes').value = activity.notes || '';
        
        // Hide recurring options for individual edits
        document.getElementById('is-recurring').checked = false;
        document.getElementById('recurring-options').style.display = 'none';
        
        // Store the ID for updating
        this.editingActivityId = id;
        
        // Change form title and button text
        document.querySelector('#activity-modal h2').textContent = 'Edit Activity';
        document.querySelector('#activity-form button[type="submit"]').textContent = 'Update Activity';
        
        // Show modal
        document.getElementById('activity-modal').style.display = 'block';
    }

    editRecurringSeries(recurringId) {
        const seriesActivities = this.activities.filter(activity => activity.recurringId === recurringId);
        if (seriesActivities.length === 0) return;

        const firstActivity = seriesActivities[0];
        const choice = confirm(`Edit entire series of ${seriesActivities.length} activities?\n\nOK = Edit entire series\nCancel = Edit just this occurrence`);
        
        if (choice) {
            // Edit entire series
            this.editActivity(firstActivity.id);
            this.editingSeriesId = recurringId;
            document.querySelector('#activity-modal h2').textContent = `Edit Series (${seriesActivities.length} activities)`;
        } else {
            // Edit just this occurrence
            this.editActivity(firstActivity.id);
        }
    }

    saveToStorage() {
        localStorage.setItem('personalSchedule', JSON.stringify(this.activities));
        localStorage.setItem('scheduleCategories', JSON.stringify(this.categories));
        
        // Auto-sync if enabled
        if (this.syncEnabled) {
            setTimeout(() => this.syncData(), 1000);
        }
    }

    loadAppTitle() {
        const titleElement = document.getElementById('app-title');
        titleElement.textContent = this.appTitle;
        document.title = this.appTitle;
    }

    saveAppTitle() {
        localStorage.setItem('appTitle', this.appTitle);
        document.title = this.appTitle;
    }

    bindTitleEvents() {
        const titleElement = document.getElementById('app-title');
        const editHint = document.querySelector('.edit-hint');
        let originalTitle = this.appTitle;

        // Show/hide edit hint
        titleElement.addEventListener('mouseenter', () => {
            editHint.style.opacity = '1';
        });

        titleElement.addEventListener('mouseleave', () => {
            if (!titleElement.matches(':focus')) {
                editHint.style.opacity = '0';
            }
        });

        // Handle focus
        titleElement.addEventListener('focus', () => {
            editHint.style.opacity = '0';
            originalTitle = titleElement.textContent;
            titleElement.classList.add('editing');
            
            // Select all text when focused
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(titleElement);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }, 10);
        });

        // Handle blur (save changes)
        titleElement.addEventListener('blur', () => {
            titleElement.classList.remove('editing');
            editHint.style.opacity = '0';
            
            const newTitle = titleElement.textContent.trim();
            if (newTitle && newTitle !== originalTitle) {
                this.appTitle = newTitle;
                this.saveAppTitle();
            } else if (!newTitle) {
                // Restore original title if empty
                titleElement.textContent = originalTitle;
            }
        });

        // Handle Enter key (save and blur)
        titleElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleElement.blur();
            }
            // Handle Escape key (cancel changes)
            if (e.key === 'Escape') {
                titleElement.textContent = originalTitle;
                titleElement.blur();
            }
        });

        // Prevent line breaks
        titleElement.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            const cleanText = text.replace(/\n/g, ' ').trim();
            document.execCommand('insertText', false, cleanText);
        });
    }

    openCategoryModal() {
        document.getElementById('category-modal').style.display = 'block';
        this.renderCategoryManagement();
    }

    addCategory() {
        const nameInput = document.getElementById('new-category-name');
        const colorInput = document.getElementById('new-category-color');
        
        const name = nameInput.value.trim();
        const color = colorInput.value;
        
        if (!name) {
            alert('Please enter a category name');
            return;
        }
        
        // Check if category already exists
        if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            alert('A category with this name already exists');
            return;
        }
        
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        const newCategory = {
            id: id,
            name: name,
            color: color
        };
        
        this.categories.push(newCategory);
        this.saveToStorage();
        this.renderCategories();
        this.renderCategoryManagement();
        
        // Clear inputs
        nameInput.value = '';
        colorInput.value = '#667eea';
    }

    deleteCategory(categoryId) {
        const category = this.categories.find(cat => cat.id === categoryId);
        const activitiesCount = this.activities.filter(activity => activity.category === categoryId).length;
        
        if (activitiesCount > 0) {
            if (!confirm(`This category has ${activitiesCount} activities. Deleting it will also delete all these activities. Are you sure?`)) {
                return;
            }
            // Remove activities with this category
            this.activities = this.activities.filter(activity => activity.category !== categoryId);
        }
        
        this.categories = this.categories.filter(cat => cat.id !== categoryId);
        this.saveToStorage();
        this.renderCategories();
        this.renderCategoryManagement();
        this.renderCurrentView();
        
        // Reset filter if current filter was deleted
        if (this.currentFilter === categoryId) {
            this.currentFilter = 'all';
        }
    }

    renderCategories() {
        // Render filter buttons
        const filtersContainer = document.getElementById('category-filters');
        let filtersHTML = '<button class="filter-btn active" data-category="all">All</button>';
        
        this.categories.forEach(category => {
            filtersHTML += `<button class="filter-btn" data-category="${category.id}">${category.name}</button>`;
        });
        
        filtersContainer.innerHTML = filtersHTML;
        
        // Re-bind filter events
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.category;
                this.renderCurrentView();
            });
        });
        
        // Render category dropdown in form
        const categorySelect = document.getElementById('activity-category');
        let optionsHTML = '<option value="">Select category</option>';
        
        this.categories.forEach(category => {
            optionsHTML += `<option value="${category.id}">${category.name}</option>`;
        });
        
        categorySelect.innerHTML = optionsHTML;
        
        // Update CSS for dynamic categories
        this.updateCategoryStyles();
    }

    renderCategoryManagement() {
        const container = document.getElementById('categories-list');
        
        if (this.categories.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; text-align: center;">No categories yet</p>';
            return;
        }
        
        container.innerHTML = this.categories.map(category => {
            const activitiesCount = this.activities.filter(activity => activity.category === category.id).length;
            
            return `
                <div class="category-item">
                    <div class="category-info">
                        <div class="category-color-preview" style="background-color: ${category.color}"></div>
                        <span class="category-name">${category.name}</span>
                        <span class="category-usage">(${activitiesCount} activities)</span>
                    </div>
                    <div class="category-actions">
                        <button class="btn-icon delete" onclick="scheduleLogger.deleteCategory('${category.id}')" title="Delete category">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateCategoryStyles() {
        // Remove existing dynamic styles
        const existingStyle = document.getElementById('dynamic-category-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Create new dynamic styles
        let css = '';
        this.categories.forEach(category => {
            const lightColor = this.lightenColor(category.color, 0.9);
            const darkColor = this.darkenColor(category.color, 0.3);
            
            css += `
                .category-${category.id} { 
                    background: ${lightColor} !important; 
                    color: ${darkColor} !important; 
                }
                .calendar-activity.${category.id} { 
                    background: ${category.color} !important; 
                    color: white !important; 
                }
            `;
        });
        
        const style = document.createElement('style');
        style.id = 'dynamic-category-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    lightenColor(color, amount) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(255 * amount);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    darkenColor(color, amount) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(255 * amount);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
            (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
            (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }

    formatDateTime(datetime) {
        const date = this.parseActivityDate(datetime);
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Hong_Kong'
        });
    }

    calculateDurationInMinutes() {
        const durationValue = document.getElementById('activity-duration').value;
        const durationUnit = document.getElementById('duration-unit').value;
        
        if (!durationValue) return null;
        
        const value = parseInt(durationValue);
        
        switch (durationUnit) {
            case 'hours':
                return value * 60;
            case 'days':
                return value * 24 * 60;
            case 'minutes':
            default:
                return value;
        }
    }

    formatDuration(minutes) {
        if (!minutes) return '';
        
        const days = Math.floor(minutes / (24 * 60));
        const hours = Math.floor((minutes % (24 * 60)) / 60);
        const mins = minutes % 60;
        
        let result = [];
        
        if (days > 0) {
            result.push(`${days}d`);
        }
        if (hours > 0) {
            result.push(`${hours}h`);
        }
        if (mins > 0 || result.length === 0) {
            result.push(`${mins}m`);
        }
        
        return result.join(' ');
    }

    getFilteredActivities() {
        if (this.currentFilter === 'all') {
            return this.activities;
        }
        return this.activities.filter(activity => activity.category === this.currentFilter);
    }

    switchView(view) {
        this.currentView = view;
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}-view-btn`).classList.add('active');
        
        // Update view content
        document.querySelectorAll('.view-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        this.renderCurrentView();
    }

    renderCurrentView() {
        if (this.currentView === 'list') {
            this.renderActivities();
        } else {
            this.renderCalendar();
        }
    }

    renderActivities() {
        const container = document.getElementById('activities-list');
        const filteredActivities = this.getFilteredActivities();
        
        // Sort by datetime (newest first) with safe parsing
        filteredActivities.sort((a, b) => {
            const dateA = this.parseActivityDate(a.datetime);
            const dateB = this.parseActivityDate(b.datetime);
            return dateB - dateA;
        });

        if (filteredActivities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No activities yet</h3>
                    <p>Start by adding your first activity!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredActivities.map(activity => `
            <div class="activity-card ${activity.isRecurring ? 'recurring' : ''}" onclick="scheduleLogger.editActivity(${activity.id})">
                <div class="activity-header">
                    <div class="activity-title">
                        ${activity.title}
                        ${activity.isRecurring ? `<span class="recurring-indicator">${activity.recurringIndex}/${activity.recurringTotal}</span>` : ''}
                    </div>
                    <div class="activity-category category-${activity.category}">
                        ${this.getCategoryName(activity.category)}
                    </div>
                </div>
                <div class="activity-datetime">
                    📅 ${this.formatDateTime(activity.datetime)}
                </div>
                ${activity.duration ? `
                    <div class="activity-duration">
                        ⏱️ ${this.formatDuration(parseInt(activity.duration))}
                    </div>
                ` : ''}
                ${activity.notes ? `
                    <div class="activity-notes">
                        💭 ${activity.notes}
                    </div>
                ` : ''}
                <div class="activity-actions" onclick="event.stopPropagation()">
                    <button class="btn-small btn-edit" onclick="scheduleLogger.editActivity(${activity.id})">
                        Edit
                    </button>
                    ${activity.isRecurring ? `
                        <button class="btn-small btn-edit-series" onclick="scheduleLogger.editRecurringSeries(${activity.recurringId})">
                            Edit Series
                        </button>
                        <button class="btn-small" onclick="scheduleLogger.deleteRecurringSeries(${activity.recurringId})">
                            Delete Series
                        </button>
                    ` : ''}
                    <button class="btn-small btn-delete" onclick="scheduleLogger.deleteActivity(${activity.id})">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderCalendar() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Update month header with inspirational quote
        const currentMonth = this.currentDate.getMonth();
        const quote = this.getMonthlyQuote(currentMonth);
        
        document.getElementById('current-month').innerHTML = `
            <div class="month-title">${monthNames[currentMonth]} ${this.currentDate.getFullYear()}</div>
            <div class="monthly-quote">"${quote.text}" <span class="quote-author">— ${quote.author}</span></div>
        `;
        
        const grid = document.getElementById('calendar-grid');
        
        // Create day headers
        let gridHTML = dayNames.map(day => 
            `<div class="calendar-day-header">${day}</div>`
        ).join('');
        
        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        // Generate calendar days
        const today = new Date();
        const currentMonthNum = this.currentDate.getMonth();
        
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = date.getMonth() === currentMonthNum;
            const isToday = this.getDateString(date) === this.getDateString(today);
            const dayActivities = this.getActivitiesForDate(date);
            const holiday = this.getHolidayForDate(date);
            
            let dayClass = 'calendar-day';
            if (!isCurrentMonth) dayClass += ' other-month';
            if (isToday) dayClass += ' today';
            if (holiday) dayClass += ' holiday';
            
            gridHTML += `
                <div class="${dayClass}" data-date="${this.getDateString(date)}">
                    <div class="day-number">
                        ${date.getDate()}
                    </div>
                    ${holiday ? `<div class="holiday-name" title="${holiday.localName}">${holiday.name}</div>` : ''}
                    <div class="day-activities">
                        ${dayActivities.slice(0, holiday ? 2 : 3).map(activity => {
                            const isMultiDay = activity.duration && activity.duration >= 1440;
                            const multiDayIndicator = isMultiDay ? '📅 ' : '';
                            return `
                            <div class="calendar-activity ${activity.category} ${isMultiDay ? 'multi-day' : ''}" title="${activity.title} - ${this.formatTime(activity.datetime)}${isMultiDay ? ' (Multi-day)' : ''}">
                                ${multiDayIndicator}${activity.title}
                            </div>`;
                        }).join('')}
                        ${dayActivities.length > (holiday ? 2 : 3) ? `
                            <div class="activity-count">+${dayActivities.length - (holiday ? 2 : 3)}</div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        grid.innerHTML = gridHTML;
    }

    getActivitiesForDate(date) {
        const dateStr = this.getDateString(date);
        const filteredActivities = this.getFilteredActivities();
        
        return filteredActivities.filter(activity => {
            // Use helper function for consistent date parsing
            const activityStartDate = this.parseActivityDate(activity.datetime);
            
            // Validate the parsed date
            if (isNaN(activityStartDate.getTime())) {
                console.warn('Invalid activity date:', activity.datetime);
                return false;
            }
            
            // Check if activity spans multiple days
            if (activity.duration && activity.duration >= 1440) { // 1440 minutes = 1 day
                const durationInDays = Math.ceil(activity.duration / 1440);
                
                // Check if the current date falls within the activity's date range
                for (let i = 0; i < durationInDays; i++) {
                    const checkDate = new Date(activityStartDate);
                    checkDate.setDate(activityStartDate.getDate() + i);
                    if (this.getDateString(checkDate) === dateStr) {
                        return true;
                    }
                }
                return false;
            } else {
                // Single day activity - check if it matches the date
                return this.getDateString(activityStartDate) === dateStr;
            }
        }).sort((a, b) => {
            // Safe sorting with date validation
            const dateA = this.parseActivityDate(a.datetime);
            const dateB = this.parseActivityDate(b.datetime);
            return dateA - dateB;
        });
    }

    formatTime(datetime) {
        const date = this.parseActivityDate(datetime);
        
        if (isNaN(date.getTime())) {
            return 'Invalid Time';
        }
        
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Hong_Kong'
        });
    }

    // Normalize datetime-local input to Hong Kong HKT timezone
    normalizeDateTime(datetimeLocal) {
        if (typeof datetimeLocal === 'string' && datetimeLocal.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            // Parse as Hong Kong time (HKT = UTC+8)
            const [datePart, timePart] = datetimeLocal.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute] = timePart.split(':').map(Number);
            
            // Create date in HKT (UTC+8)
            const hktDate = new Date(year, month - 1, day, hour, minute);
            
            // Convert to UTC by subtracting 8 hours, then return as ISO string
            const utcDate = new Date(hktDate.getTime() - (8 * 60 * 60 * 1000));
            return utcDate.toISOString();
        }
        return datetimeLocal;
    }

    // Helper function for safe date parsing with HKT timezone handling
    parseActivityDate(datetime) {
        const date = new Date(datetime);
        // Convert UTC to HKT by adding 8 hours for display
        return new Date(date.getTime() + (8 * 60 * 60 * 1000));
    }

    getCategoryName(categoryId) {
        const category = this.categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    }

    // Helper function to get date string for comparison
    getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async loadHolidays() {
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        
        // Check if we already have holidays for current and next year
        if (this.holidays[currentYear] && this.holidays[nextYear]) {
            return;
        }
        
        try {
            // Load holidays for current and next year
            await Promise.all([
                this.fetchHolidaysForYear(currentYear),
                this.fetchHolidaysForYear(nextYear)
            ]);
            
            localStorage.setItem('hkHolidays', JSON.stringify(this.holidays));
        } catch (error) {
            console.warn('Could not load Hong Kong holidays:', error);
        }
    }

    async fetchHolidaysForYear(year) {
        if (this.holidays[year]) return;
        
        try {
            console.log(`🌐 Fetching Hong Kong holidays for ${year} from API...`);
            // Using a public holidays API for Hong Kong
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/HK`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const holidays = await response.json();
            this.holidays[year] = holidays.map(holiday => ({
                date: holiday.date,
                name: holiday.name,
                localName: holiday.localName || holiday.name
            }));
            
            console.log(`✅ Loaded ${this.holidays[year].length} holidays from API for ${year}`);
        } catch (error) {
            console.warn(`⚠️ API failed for ${year}, using hardcoded holidays:`, error.message);
            // Fallback to hardcoded holidays if API fails
            this.holidays[year] = this.getHardcodedHolidays(year);
        }
    }

    getHardcodedHolidays(year) {
        // Hong Kong holidays with correct dates for 2025
        let holidays = [];
        
        if (year === 2025) {
            holidays = [
                { date: "2025-01-01", name: "New Year's Day", localName: "元旦" },
                { date: "2025-01-29", name: "Lunar New Year's Day", localName: "農曆新年初一" },
                { date: "2025-01-30", name: "The second day of Lunar New Year", localName: "農曆新年初二" },
                { date: "2025-01-31", name: "The third day of Lunar New Year", localName: "農曆新年初三" },
                { date: "2025-04-04", name: "Ching Ming Festival", localName: "清明節" },
                { date: "2025-04-18", name: "Good Friday", localName: "耶穌受難節" },
                { date: "2025-04-21", name: "Easter Monday", localName: "復活節星期一" },
                { date: "2025-05-01", name: "Labour Day", localName: "勞動節" },
                { date: "2025-05-05", name: "Buddha's Birthday", localName: "佛誕" },
                { date: "2025-05-29", name: "Dragon Boat Festival", localName: "端午節" },
                { date: "2025-07-01", name: "HKSAR Establishment Day", localName: "香港特別行政區成立紀念日" },
                { date: "2025-10-06", name: "Mid-Autumn Festival", localName: "中秋節" },
                { date: "2025-10-01", name: "National Day", localName: "國慶日" },
                { date: "2025-10-29", name: "Chung Yeung Festival", localName: "重陽節" },
                { date: "2025-12-25", name: "Christmas Day", localName: "聖誕節" },
                { date: "2025-12-26", name: "Boxing Day", localName: "節禮日" }
            ];
        } else {
            // Generic holidays for other years
            holidays = [
                { date: `${year}-01-01`, name: "New Year's Day", localName: "元旦" },
                { date: `${year}-04-04`, name: "Ching Ming Festival", localName: "清明節" },
                { date: `${year}-05-01`, name: "Labour Day", localName: "勞動節" },
                { date: `${year}-07-01`, name: "HKSAR Establishment Day", localName: "香港特別行政區成立紀念日" },
                { date: `${year}-10-01`, name: "National Day", localName: "國慶日" },
                { date: `${year}-12-25`, name: "Christmas Day", localName: "聖誕節" },
                { date: `${year}-12-26`, name: "Boxing Day", localName: "節禮日" }
            ];
        }
        
        console.log(`📅 Loaded ${holidays.length} Hong Kong holidays for ${year}`);
        return holidays;
    }

    getHolidayForDate(date) {
        const dateStr = this.getDateString(date);
        const year = date.getFullYear();
        
        if (!this.holidays[year]) return null;
        
        return this.holidays[year].find(holiday => holiday.date === dateStr);
    }

    isHoliday(date) {
        return this.getHolidayForDate(date) !== null;
    }

    getMonthlyQuote(month) {
        const quotes = [
            { text: "New year, new beginnings. Every day is a chance to start fresh and pursue your dreams.", author: "Unknown" },
            { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
            { text: "In every walk with nature, one receives far more than they seek.", author: "John Muir" },
            { text: "April showers bring May flowers. Every challenge brings growth and new opportunities.", author: "Traditional Saying" },
            { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
            { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
            { text: "Summer afternoon—summer afternoon; to me those have always been the two most beautiful words.", author: "Henry James" },
            { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
            { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
            { text: "Life starts all over again when it gets crisp in the fall.", author: "F. Scott Fitzgerald" },
            { text: "Gratitude turns what we have into enough, and more. It turns denial into acceptance.", author: "Melody Beattie" },
            { text: "The best way to make your dreams come true is to wake up and take action.", author: "Paul Valéry" }
        ];
        
        return quotes[month] || quotes[0];
    }

    // Cloud Sync Methods
    setupCloudSync() {
        if (this.syncEnabled) {
            this.addSyncButton();
            this.updateSyncStatus();
            // Auto-sync every 5 minutes if enabled
            setInterval(() => this.syncData(), 5 * 60 * 1000);
        } else {
            this.addSetupSyncButton();
            this.updateSyncStatus();
        }
    }

    updateSyncStatus() {
        const statusDiv = document.getElementById('sync-status');
        if (!statusDiv) return;
        
        if (this.syncEnabled) {
            const gistId = localStorage.getItem('gistId');
            const lastSync = this.lastSync ? new Date(this.lastSync).toLocaleString() : 'Never';
            statusDiv.innerHTML = `Sync: ${gistId ? 'Connected' : 'Setup'} | Last: ${lastSync} | Activities: ${this.activities.length}`;
        } else {
            statusDiv.innerHTML = 'Sync: Not enabled | Activities: ' + this.activities.length;
        }
    }

    addSetupSyncButton() {
        const headerActions = document.querySelector('.header-actions');
        if (!document.getElementById('setup-sync-btn')) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'setup-sync-btn';
            syncBtn.className = 'btn-secondary';
            syncBtn.innerHTML = '☁️ Setup Sync';
            syncBtn.onclick = () => this.showSyncSetup();
            headerActions.insertBefore(syncBtn, headerActions.firstChild);
            
            // Connect to existing gist button
            const connectBtn = document.createElement('button');
            connectBtn.id = 'connect-gist-btn';
            connectBtn.className = 'btn-secondary';
            connectBtn.innerHTML = '🔗 Connect Existing';
            connectBtn.title = 'Connect to existing gist';
            connectBtn.onclick = () => this.connectToExistingGist();
            headerActions.insertBefore(connectBtn, headerActions.firstChild);
        }
    }

    async connectToExistingGist() {
        const token = prompt('Enter your GitHub token:');
        if (!token) return;
        
        const gistId = prompt(`Enter your Gist ID:

You can find this by:
1. Going to your other device
2. Clicking the 🔍 debug button
3. Copying the Gist ID

Or visit gist.github.com and find "Schedule App Data"`);
        
        if (!gistId) return;
        
        // Validate token and gist
        const isValid = await this.validateToken(token.trim());
        if (!isValid) {
            alert('❌ Invalid token!');
            return;
        }
        
        try {
            // Test if gist exists and is accessible
            const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
                headers: {
                    'Authorization': `token ${token.trim()}`
                }
            });
            
            if (!response.ok) {
                alert('❌ Cannot access gist. Check the Gist ID and token permissions.');
                return;
            }
            
            // Save token and gist ID
            this.syncToken = token.trim();
            localStorage.setItem('syncToken', this.syncToken);
            localStorage.setItem('gistId', gistId.trim());
            this.syncEnabled = true;
            
            // Remove setup buttons and add sync buttons
            document.getElementById('setup-sync-btn').remove();
            document.getElementById('connect-gist-btn').remove();
            this.addSyncButton();
            
            // Download data
            await this.loadFromCloud();
            
        } catch (error) {
            alert('❌ Failed to connect to gist: ' + error.message);
        }
    }

    showDebugInfo() {
        const info = {
            syncEnabled: this.syncEnabled,
            hasToken: !!this.syncToken,
            gistId: localStorage.getItem('gistId'),
            lastSync: this.lastSync,
            activitiesCount: this.activities.length,
            categoriesCount: this.categories.length,
            holidaysLoaded: Object.keys(this.holidays).length
        };
        
        console.log('🔍 Debug Info:', info);
        console.log('🏮 Holidays:', this.holidays);
        
        let debugMsg = '🔍 Debug Info:\n\n';
        debugMsg += `Sync Enabled: ${info.syncEnabled}\n`;
        debugMsg += `Has Token: ${info.hasToken}\n`;
        debugMsg += `Activities: ${info.activitiesCount}\n`;
        debugMsg += `Categories: ${info.categoriesCount}\n`;
        debugMsg += `Holidays Loaded: ${info.holidaysLoaded} years\n`;
        debugMsg += `Last Sync: ${info.lastSync || 'Never'}\n\n`;
        
        if (info.gistId) {
            debugMsg += `📋 GIST ID (copy this for other devices):\n${info.gistId}\n\n`;
            debugMsg += `🔗 View your data:\nhttps://gist.github.com/${info.gistId}`;
        } else {
            debugMsg += 'No Gist ID - data not uploaded yet';
        }
        
        alert(debugMsg);
        
        // Also copy gist ID to clipboard if available
        if (info.gistId && navigator.clipboard) {
            navigator.clipboard.writeText(info.gistId).then(() => {
                console.log('Gist ID copied to clipboard');
            });
        }
    }

    async refreshHolidays() {
        const currentYear = new Date().getFullYear();
        
        // Clear existing holidays
        this.holidays = {};
        localStorage.removeItem('hkHolidays');
        
        // Reload holidays
        await this.loadHolidays();
        
        // Refresh calendar if in calendar view
        if (this.currentView === 'calendar') {
            this.renderCalendar();
        }
        
        const holidayCount = Object.values(this.holidays).reduce((total, yearHolidays) => total + yearHolidays.length, 0);
        alert(`🏮 Refreshed holidays!\n\nLoaded ${holidayCount} holidays for ${Object.keys(this.holidays).join(', ')}`);
    }

    addSyncButton() {
        const headerActions = document.querySelector('.header-actions');
        if (!document.getElementById('sync-btn')) {
            // Upload button
            const syncBtn = document.createElement('button');
            syncBtn.id = 'sync-btn';
            syncBtn.className = 'btn-secondary';
            syncBtn.innerHTML = '☁️ Upload';
            syncBtn.onclick = () => this.syncData();
            headerActions.insertBefore(syncBtn, headerActions.firstChild);
            
            // Download button
            const loadBtn = document.createElement('button');
            loadBtn.id = 'load-btn';
            loadBtn.className = 'btn-secondary';
            loadBtn.innerHTML = '⬇️ Download';
            loadBtn.onclick = () => this.loadFromCloud();
            headerActions.insertBefore(loadBtn, headerActions.firstChild);
            
            // Debug button
            const debugBtn = document.createElement('button');
            debugBtn.id = 'debug-btn';
            debugBtn.className = 'btn-secondary';
            debugBtn.innerHTML = '🔍';
            debugBtn.title = 'Debug sync info';
            debugBtn.onclick = () => this.showDebugInfo();
            headerActions.insertBefore(debugBtn, headerActions.firstChild);
            

        }
    }

    async showSyncSetup() {
        const token = prompt(`To sync across devices, create a GitHub Personal Access Token:

1. Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with 'gist' permission
3. Copy and paste the token below:

Your data will be stored in a private GitHub Gist.`);
        
        if (token && token.trim()) {
            // Test the token first
            const isValid = await this.validateToken(token.trim());
            if (!isValid) {
                alert('❌ Invalid token! Please check:\n\n1. Token has "gist" permission\n2. Token is not expired\n3. Token is copied correctly');
                return;
            }
            
            this.syncToken = token.trim();
            localStorage.setItem('syncToken', this.syncToken);
            this.syncEnabled = true;
            
            // Look for existing Schedule App gist
            const existingGist = await this.findExistingGist();
            
            // Replace setup button with sync button
            document.getElementById('setup-sync-btn').remove();
            this.addSyncButton();
            
            if (existingGist) {
                // Found existing gist
                localStorage.setItem('gistId', existingGist.id);
                const choice = confirm(`✅ Found existing sync data! 

Click OK to DOWNLOAD existing data (${existingGist.activityCount} activities)
Click Cancel to UPLOAD your current data (${this.activities.length} activities)

⚠️ Uploading will overwrite cloud data!`);
                
                if (choice) {
                    // Download existing data
                    await this.loadFromCloud();
                } else {
                    // Upload current data (overwrite)
                    await this.syncData();
                }
            } else {
                // No existing gist found
                const choice = confirm(`✅ Token validated! 

Click OK to UPLOAD your current data to cloud (${this.activities.length} activities)
Click Cancel if you have existing data on another device

(If this is your first device, click OK)`);
                
                if (choice) {
                    // Upload current data
                    await this.syncData();
                } else {
                    alert('💡 To connect to existing data:\n\n1. Go to your other device\n2. Click 🔍 debug button\n3. Copy the Gist ID\n4. Use "Connect to Existing Gist" option');
                }
            }
        }
    }

    async findExistingGist() {
        try {
            const response = await fetch('https://api.github.com/gists', {
                headers: {
                    'Authorization': `token ${this.syncToken}`
                }
            });
            
            if (!response.ok) return null;
            
            const gists = await response.json();
            
            // Look for Schedule App Data gist
            for (const gist of gists) {
                if (gist.description === 'Schedule App Data' && gist.files['schedule-data.json']) {
                    // Get activity count from the gist
                    try {
                        const content = gist.files['schedule-data.json'].content;
                        const data = JSON.parse(content);
                        return {
                            id: gist.id,
                            activityCount: data.activities ? data.activities.length : 0
                        };
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error finding existing gist:', error);
            return null;
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async syncData() {
        if (!this.syncEnabled) return;
        
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) syncBtn.innerHTML = '⏳ Syncing...';
        
        try {
            const data = {
                activities: this.activities,
                categories: this.categories,
                appTitle: this.appTitle,
                lastModified: new Date().toISOString()
            };
            
            const gistId = localStorage.getItem('gistId');
            
            if (gistId) {
                // Update existing gist
                await this.updateGist(gistId, data);
            } else {
                // Create new gist
                const newGistId = await this.createGist(data);
                localStorage.setItem('gistId', newGistId);
            }
            
            this.lastSync = new Date().toISOString();
            localStorage.setItem('lastSync', this.lastSync);
            this.updateSyncStatus();
            
            if (syncBtn) syncBtn.innerHTML = '✅ Uploaded';
            setTimeout(() => {
                if (syncBtn) syncBtn.innerHTML = '☁️ Upload';
            }, 2000);
            
            // Show success message with gist URL
            const gistUrl = `https://gist.github.com/${localStorage.getItem('gistId')}`;
            console.log('✅ Upload successful! View at:', gistUrl);
            alert(`✅ Uploaded ${this.activities.length} activities!\n\nView your data at:\n${gistUrl}`);
            
        } catch (error) {
            console.error('❌ Sync failed:', error);
            if (syncBtn) syncBtn.innerHTML = '❌ Failed';
            setTimeout(() => {
                if (syncBtn) syncBtn.innerHTML = '☁️ Upload';
            }, 3000);
            
            let errorMsg = '❌ Upload failed!\n\n';
            if (error.message.includes('401')) {
                errorMsg += 'Token expired or invalid. Please setup sync again.';
            } else if (error.message.includes('403')) {
                errorMsg += 'Token missing "gist" permission. Create new token.';
            } else if (error.message.includes('network')) {
                errorMsg += 'Network error. Check internet connection.';
            } else {
                errorMsg += `Error: ${error.message}\n\nCheck browser console (F12) for details.`;
            }
            
            alert(errorMsg);
        }
    }

    async createGist(data) {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${this.syncToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Schedule App Data',
                public: false,
                files: {
                    'schedule-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) throw new Error('Failed to create gist');
        const gist = await response.json();
        return gist.id;
    }

    async updateGist(gistId, data) {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${this.syncToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'schedule-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) throw new Error('Failed to update gist');
    }

    async loadFromCloud() {
        if (!this.syncEnabled) {
            alert('Sync not enabled. Click "☁️ Setup Sync" first.');
            return;
        }
        
        const loadBtn = document.getElementById('load-btn');
        if (loadBtn) loadBtn.innerHTML = '⏳ Loading...';
        
        const gistId = localStorage.getItem('gistId');
        if (!gistId) {
            if (loadBtn) loadBtn.innerHTML = '⬇️ Download';
            alert('No cloud data found. Upload data first using "☁️ Upload" button.');
            return;
        }
        
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${this.syncToken}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to load from cloud');
            
            const gist = await response.json();
            const content = gist.files['schedule-data.json'].content;
            const data = JSON.parse(content);
            
            // Compare current data with cloud data
            const currentActivities = JSON.stringify(this.activities);
            const currentCategories = JSON.stringify(this.categories);
            const currentAppTitle = this.appTitle;
            
            const cloudActivities = JSON.stringify(data.activities || []);
            const cloudCategories = JSON.stringify(data.categories || this.getDefaultCategories());
            const cloudAppTitle = data.appTitle || 'My Personal Schedule';
            
            // Check if data has actually changed
            const hasChanges = currentActivities !== cloudActivities || 
                             currentCategories !== cloudCategories || 
                             currentAppTitle !== cloudAppTitle;
            
            // Load cloud data when manually requested
            this.activities = data.activities || [];
            this.categories = data.categories || this.getDefaultCategories();
            this.appTitle = data.appTitle || 'My Personal Schedule';
            
            // Save to local storage
            localStorage.setItem('personalSchedule', JSON.stringify(this.activities));
            localStorage.setItem('scheduleCategories', JSON.stringify(this.categories));
            localStorage.setItem('appTitle', this.appTitle);
            localStorage.setItem('lastSync', data.lastModified);
            this.lastSync = data.lastModified;
            
            // Refresh UI
            this.loadAppTitle();
            this.renderCategories();
            this.renderCurrentView();
            this.updateSyncStatus();
            
            if (loadBtn) {
                if (hasChanges) {
                    loadBtn.innerHTML = '✅ Downloaded';
                    setTimeout(() => {
                        if (loadBtn) loadBtn.innerHTML = '⬇️ Download';
                    }, 2000);
                } else {
                    loadBtn.innerHTML = '✅ Up to date';
                    setTimeout(() => {
                        if (loadBtn) loadBtn.innerHTML = '⬇️ Download';
                    }, 2000);
                }
            }
            
            // Only show notification if there were actual changes
            if (hasChanges) {
                const activityCount = this.activities.length;
                alert(`✅ Downloaded ${activityCount} activities from cloud!`);
            } else {
                // Optional: Show a subtle indication that data is already up to date
                console.log('✅ Data is already up to date with cloud');
            }
            
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            if (loadBtn) loadBtn.innerHTML = '❌ Failed';
            setTimeout(() => {
                if (loadBtn) loadBtn.innerHTML = '⬇️ Download';
            }, 3000);
            alert('❌ Failed to download from cloud. Check your internet connection.');
        }
    }

    // Theme Management Methods
    openThemeModal() {
        document.getElementById('theme-modal').style.display = 'block';
        this.renderThemeOptions();
    }

    renderThemeOptions() {
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === this.currentTheme) {
                option.classList.add('active');
            }
            
            option.addEventListener('click', () => {
                this.selectTheme(option.dataset.theme);
            });
        });
    }

    selectTheme(themeName) {
        this.currentTheme = themeName;
        localStorage.setItem('appTheme', themeName);
        this.applyTheme(themeName);
        
        // Update active state
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');
        
        // Close modal after a brief delay
        setTimeout(() => {
            document.getElementById('theme-modal').style.display = 'none';
        }, 500);
    }

    applyTheme(themeName) {
        // Remove existing theme classes
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        
        // Add new theme class
        document.body.classList.add(`theme-${themeName}`);
    }
}

// Initialize the app
const scheduleLogger = new ScheduleLogger();