 // Global variables
        let currentUser = null;
        let expenses = [];
        let editingExpenseId = null;
        let categoryChart = null;
        let trendChart = null;

        // API Base URL
        const API_BASE_URL = 'https://expensetracker-1-frlg.onrender.com/api';

        // Initialize app
        document.addEventListener('DOMContentLoaded', function() {
            setupEventListeners();
            setDefaultDate();
        });

        function setupEventListeners() {
            // Auth form
            document.getElementById('auth-form').addEventListener('submit', handleAuth);
            document.getElementById('toggle-auth').addEventListener('click', toggleAuthMode);
            
            // Logout
            document.getElementById('logout-btn').addEventListener('click', logout);
            
            // Tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
            });
            
            // Expense form
            document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
            document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
            
            // Filters
            document.getElementById('apply-filters').addEventListener('click', loadExpenses);
            
            // Budget form
            document.getElementById('budget-form').addEventListener('submit', handleBudgetSubmit);
        }

        function setDefaultDate() {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('expense-date').value = today;
        }

        // Authentication functions
        async function handleAuth(e) {
            e.preventDefault();
            
            const isLogin = document.getElementById('auth-submit').textContent === 'Login';
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const email = document.getElementById('email').value;
            
            const endpoint = isLogin ? '/login' : '/register';
            const data = isLogin ? { username, password } : { username, email, password };
            
            try {
                const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    currentUser = result.user;
                    showMainApp();
                    showAlert('success', result.message);
                } else {
                    showAlert('error', result.error);
                }
            } catch (error) {
                showAlert('error', 'Connection error. Please try again.');
                console.error('Auth error:', error);
            }
        }

        function toggleAuthMode() {
            const isLogin = document.getElementById('auth-submit').textContent === 'Login';
            
            if (isLogin) {
                document.getElementById('auth-title').textContent = 'Register for Expense Tracker';
                document.getElementById('auth-submit').textContent = 'Register';
                document.getElementById('toggle-auth').textContent = 'Switch to Login';
                document.getElementById('email-group').classList.remove('hidden');
            } else {
                document.getElementById('auth-title').textContent = 'Login to Expense Tracker';
                document.getElementById('auth-submit').textContent = 'Login';
                document.getElementById('toggle-auth').textContent = 'Switch to Register';
                document.getElementById('email-group').classList.add('hidden');
            }
            
            clearForm('auth-form');
        }

        async function logout() {
            try {
                await fetch(`${API_BASE_URL}/logout`, {
                    method: 'POST',
                    credentials: 'include'
                });
                
                currentUser = null;
                showAuthSection();
                showAlert('success', 'Logged out successfully');
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        // UI functions
        function showMainApp() {
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('welcome-text').textContent = `Welcome, ${currentUser.username}!`;
            
            loadDashboard();
        }
        fetch('http://localhost:5000/export/csv', {
  method: 'GET',
  credentials: 'include'
})
.then(response => {
  if (!response.ok) {
    return response.text().then(text => {
      throw new Error(`Export failed: ${response.status} - ${text}`);
    });
  }
  return response.blob();
})
.then(blob => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  a.click();
})
.catch(error => {
  alert(error.message);
});


        function showAuthSection() {
            document.getElementById('auth-section').classList.remove('hidden');
            document.getElementById('main-app').classList.add('hidden');
            clearForm('auth-form');
        }

        function switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`${tabName}-tab`).classList.remove('hidden');
            
            // Load tab-specific data
            switch(tabName) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'expenses':
                    loadExpenses();
                    break;
                case 'budget':
                    loadBudgets();
                    break;
            }
        }

        function showAlert(type, message) {
            const alertContainer = document.getElementById('alert-container');
            alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            
            setTimeout(() => {
                alertContainer.innerHTML = '';
            }, 5000);
        }

        function clearForm(formId) {
            document.getElementById(formId).reset();
        }

        // Dashboard functions
        async function loadDashboard() {
            try {
                const response = await fetch(`${API_BASE_URL}/analytics`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    updateDashboardStats(data);
                    updateCharts(data);
                } else {
                    console.error('Failed to load analytics');
                }
            } catch (error) {
                console.error('Dashboard error:', error);
            }
        }

        function updateDashboardStats(data) {
            document.getElementById('total-spending').textContent = `${data.total_spending.toFixed(2)}`;
            document.getElementById('month-spending').textContent = `${data.this_month_spending.toFixed(2)}`;
            
            // Load expense count
            loadExpenseCount();
        }

        async function loadExpenseCount() {
            try {
                const response = await fetch(`${API_BASE_URL}/expenses`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('expense-count').textContent = data.expenses.length;
                }
            } catch (error) {
                console.error('Error loading expense count:', error);
            }
        }

        function updateCharts(data) {
            // Category Chart
            const categoryCtx = document.getElementById('categoryChart').getContext('2d');
            
            if (categoryChart) {
                categoryChart.destroy();
            }
            
            categoryChart = new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: data.category_breakdown.map(item => item.category),
                    datasets: [{
                        data: data.category_breakdown.map(item => item.amount),
                        backgroundColor: [
                            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
            
            // Trend Chart
            const trendCtx = document.getElementById('trendChart').getContext('2d');
            
            if (trendChart) {
                trendChart.destroy();
            }
            
            trendChart = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: data.monthly_trend.map(item => item.month),
                    datasets: [{
                        label: 'Monthly Spending',
                        data: data.monthly_trend.map(item => item.amount),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return `₹${value.toFixed(2)}`;

                                }
                            }
                        }
                    }
                }
            });
        }

        // Expense functions
        async function handleExpenseSubmit(e) {
            e.preventDefault();
            
            const expenseData = {
                amount: parseFloat(document.getElementById('expense-amount').value),
                category: document.getElementById('expense-category').value,
                description: document.getElementById('expense-description').value,
                date: document.getElementById('expense-date').value
            };
            
            try {
                const url = editingExpenseId ? 
                    `${API_BASE_URL}/expenses/${editingExpenseId}` : 
                    `${API_BASE_URL}/expenses`;
                
                const method = editingExpenseId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(expenseData)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showAlert('success', result.message);
                    clearForm('expense-form');
                    cancelEdit();
                    loadExpenses();
                    setDefaultDate();
                } else {
                    showAlert('error', result.error);
                }
            } catch (error) {
                showAlert('error', 'Error saving expense');
                console.error('Expense error:', error);
            }
        }

        async function loadExpenses() {
            const filters = {
                category: document.getElementById('filter-category').value,
                start_date: document.getElementById('filter-start-date').value,
                end_date: document.getElementById('filter-end-date').value
            };
            
            const queryParams = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    queryParams.append(key, filters[key]);
                }
            });
            
            try {
                const response = await fetch(`${API_BASE_URL}/expenses?${queryParams}`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    expenses = data.expenses;
                    displayExpenses(expenses);
                } else {
                    console.error('Failed to load expenses');
                }
            } catch (error) {
                console.error('Load expenses error:', error);
            }
        }

        function displayExpenses(expenseList) {
            const container = document.getElementById('expenses-list');
            
            if (expenseList.length === 0) {
                container.innerHTML = '<p>No expenses found.</p>';
                return;
            }
            
            container.innerHTML = expenseList.map(expense => `
                <div class="expense-item">
                    <div class="expense-details">
                        <h4>${expense.category}</h4>
                        <div class="expense-meta">
                            ${expense.description || 'No description'} • ${formatDate(expense.date)}
                        </div>
                    </div>
                    <div class="expense-amount">${expense.amount.toFixed(2)}</div>
                    <div class="expense-actions">
                        <button class="btn btn-secondary" onclick="editExpense('${expense.id}')">Edit</button>
                        <button class="btn btn-danger" onclick="deleteExpense('${expense.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        function editExpense(expenseId) {
            const expense = expenses.find(exp => exp.id === expenseId);
            if (!expense) return;
            
            editingExpenseId = expenseId;
            
            document.getElementById('expense-amount').value = expense.amount;
            document.getElementById('expense-category').value = expense.category;
            document.getElementById('expense-description').value = expense.description || '';
            document.getElementById('expense-date').value = expense.date;
            
            document.getElementById('cancel-edit').style.display = 'inline-block';
            document.querySelector('#expense-form button[type="submit"]').textContent = 'Update Expense';
        }

        function cancelEdit() {
            editingExpenseId = null;
            document.getElementById('cancel-edit').style.display = 'none';
            document.querySelector('#expense-form button[type="submit"]').textContent = 'Add Expense';
            clearForm('expense-form');
            setDefaultDate();
        }

        async function deleteExpense(expenseId) {
            if (!confirm('Are you sure you want to delete this expense?')) {
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/expenses/${expenseId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showAlert('success', result.message);
                    loadExpenses();
                } else {
                    showAlert('error', result.error);
                }
            } catch (error) {
                showAlert('error', 'Error deleting expense');
                console.error('Delete error:', error);
            }
        }

        // Budget functions
        async function handleBudgetSubmit(e) {
            e.preventDefault();
            
            const budgetData = {
                category: document.getElementById('budget-category').value,
                amount: parseFloat(document.getElementById('budget-amount').value)
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/budgets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(budgetData)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showAlert('success', result.message);
                    clearForm('budget-form');
                    loadBudgets();
                } else {
                    showAlert('error', result.error);
                }
            } catch (error) {
                showAlert('error', 'Error setting budget');
                console.error('Budget error:', error);
            }
        }

        async function loadBudgets() {
            try {
                const response = await fetch(`${API_BASE_URL}/budgets`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    displayBudgets(data.budget_comparison);
                } else {
                    console.error('Failed to load budgets');
                }
            } catch (error) {
                console.error('Load budgets error:', error);
            }
        }

        function displayBudgets(budgetList) {
            const container = document.getElementById('budget-list');
            
            if (budgetList.length === 0) {
                container.innerHTML = '<p>No budgets set.</p>';
                return;
            }
            
            container.innerHTML = budgetList.map(budget => {
                const percentage = Math.min(budget.percentage, 100);
                const progressColor = percentage > 90 ? '#dc3545' : percentage > 70 ? '#ffc107' : '#28a745';
                
                return `
                    <div class="budget-item">
                        <div>
                            <h4>${budget.category}</h4>
                            <div>Budget: ${budget.budget.toFixed(2)} | Spent: ${budget.spent.toFixed(2)} | Remaining: ${budget.remaining.toFixed(2)}</div>
                            <div class="budget-progress">
                                <div class="budget-progress-bar" style="width: ${percentage}%; background-color: ${progressColor}"></div>
                            </div>
                        </div>
                        <div>${percentage.toFixed(1)}%</div>
                    </div>
                `;
            }).join('');
        }

        // Utility functions
        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
