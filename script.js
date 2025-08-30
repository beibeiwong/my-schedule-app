class ScheduleLogger {
    constructor() {
        this.activities = JSON.parse(localStorage.getItem('personalSchedule')) || [];
        this.categories = JSON.parse(localStorage.getItem('scheduleCategories')) || this.getDefaultCategories();
        this.holidays = JSON.parse(localStorage.getItem('hkHolidays')) || {};
        this.appTitle = localStorage.getItem('appTitle') || 'My Personal Schedule';
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
            modal.style.display = 'none';
            form.reset();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                form.reset();
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

        // Title editing
        this.bindTitleEvents();
    }

    addActivity() {
        const form = document.getElementById('activity-form');
        const isRecurring = document.getElementById('is-recurring').checked;
        
        const baseActivity = {
            title: document.getElementById('activity-title').value,
            category: document.getElementById('activity-category').value,
            datetime: document.getElementById('activity-datetime').value,
            duration: document.getElementById('activity-duration').value || null,
            notes: document.getElementById('activity-notes').value || '',
            createdAt: new Date().toISOString()
        };

        if (isRecurring) {
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
        
        // Close modal and reset form
        document.getElementById('activity-modal').style.display = 'none';
        form.reset();
        document.getElementById('recurring-options').style.display = 'none';
    }

    createRecurringActivities(baseActivity, frequency, count, recurringId) {
        const startDate = new Date(baseActivity.datetime);
        
        for (let i = 0; i < count; i++) {
            const activityDate = new Date(startDate);
            
            switch (frequency) {
                case 'daily':
                    activityDate.setDate(startDate.getDate() + i);
                    break;
                case 'weekly':
                    activityDate.setDate(startDate.getDate() + (i * 7));
                    break;
                case 'monthly':
                    activityDate.setMonth(startDate.getMonth() + i);
                    break;
            }
            
            const activity = {
                ...baseActivity,
                id: Date.now() + i,
                datetime: activityDate.toISOString().slice(0, 16),
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
        const date = new Date(datetime);
        const options = {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    formatDuration(minutes) {
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }
        return `${mins}m`;
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
        
        // Sort by datetime (newest first)
        filteredActivities.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

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
            <div class="activity-card ${activity.isRecurring ? 'recurring' : ''}">
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
                <div class="activity-actions">
                    ${activity.isRecurring ? `
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
                        ${holiday ? '<span class="holiday-indicator">🏮</span>' : ''}
                    </div>
                    ${holiday ? `<div class="holiday-name" title="${holiday.localName}">${holiday.name}</div>` : ''}
                    <div class="day-activities">
                        ${dayActivities.slice(0, holiday ? 2 : 3).map(activity => `
                            <div class="calendar-activity ${activity.category}" title="${activity.title} - ${this.formatTime(activity.datetime)}">
                                ${activity.title}
                            </div>
                        `).join('')}
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
            const activityDate = this.getDateString(new Date(activity.datetime));
            return activityDate === dateStr;
        }).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    }

    formatTime(datetime) {
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
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
            // Using a public holidays API for Hong Kong
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/HK`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const holidays = await response.json();
            this.holidays[year] = holidays.map(holiday => ({
                date: holiday.date,
                name: holiday.name,
                localName: holiday.localName
            }));
        } catch (error) {
            // Fallback to hardcoded holidays if API fails
            this.holidays[year] = this.getHardcodedHolidays(year);
        }
    }

    getHardcodedHolidays(year) {
        // Common Hong Kong holidays (dates may vary year to year)
        const holidays = [
            { date: `${year}-01-01`, name: "New Year's Day", localName: "元旦" },
            { date: `${year}-04-04`, name: "Ching Ming Festival", localName: "清明節" },
            { date: `${year}-04-29`, name: "Good Friday", localName: "耶穌受難節" },
            { date: `${year}-05-01`, name: "Labour Day", localName: "勞動節" },
            { date: `${year}-05-08`, name: "Buddha's Birthday", localName: "佛誕" },
            { date: `${year}-06-22`, name: "Dragon Boat Festival", localName: "端午節" },
            { date: `${year}-07-01`, name: "HKSAR Establishment Day", localName: "香港特別行政區成立紀念日" },
            { date: `${year}-09-29`, name: "Mid-Autumn Festival", localName: "中秋節" },
            { date: `${year}-10-01`, name: "National Day", localName: "國慶日" },
            { date: `${year}-10-23`, name: "Chung Yeung Festival", localName: "重陽節" },
            { date: `${year}-12-25`, name: "Christmas Day", localName: "聖誕節" },
            { date: `${year}-12-26`, name: "Boxing Day", localName: "節禮日" }
        ];
        
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
        }
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
        }
    }

    showSyncSetup() {
        const token = prompt(`To sync across devices, create a GitHub Personal Access Token:

1. Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with 'gist' permission
3. Copy and paste the token below:

Your data will be stored in a private GitHub Gist.`);
        
        if (token && token.trim()) {
            this.syncToken = token.trim();
            localStorage.setItem('syncToken', this.syncToken);
            this.syncEnabled = true;
            
            // Replace setup button with sync button
            document.getElementById('setup-sync-btn').remove();
            this.addSyncButton();
            
            // Ask user what to do
            const choice = confirm(`Sync setup complete! 

Click OK to UPLOAD your current data to cloud
Click Cancel to DOWNLOAD existing data from cloud

(If this is your first device, click OK)`);
            
            if (choice) {
                // Upload current data
                this.syncData();
            } else {
                // Try to download existing data
                this.loadFromCloud();
            }
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
            
        } catch (error) {
            console.error('Sync failed:', error);
            if (syncBtn) syncBtn.innerHTML = '❌ Sync Failed';
            setTimeout(() => {
                if (syncBtn) syncBtn.innerHTML = '☁️ Sync';
            }, 3000);
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
            
            // Always load cloud data when manually requested
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
            
            if (loadBtn) loadBtn.innerHTML = '✅ Downloaded';
            setTimeout(() => {
                if (loadBtn) loadBtn.innerHTML = '⬇️ Download';
            }, 2000);
            
            const activityCount = this.activities.length;
            alert(`✅ Downloaded ${activityCount} activities from cloud!`);
            
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            if (loadBtn) loadBtn.innerHTML = '❌ Failed';
            setTimeout(() => {
                if (loadBtn) loadBtn.innerHTML = '⬇️ Download';
            }, 3000);
            alert('❌ Failed to download from cloud. Check your internet connection.');
        }
    }
}

// Initialize the app
const scheduleLogger = new ScheduleLogger();