import { db } from './firebase-config.js';
import { 
    ref, 
    set, 
    push, 
    onValue, 
    query, 
    orderByChild,
    get,
    child,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- DOM Elements ---
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmit = document.getElementById('auth-submit');
const authError = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const logoutBtn = document.getElementById('logout-btn');
const userEmailDisplay = document.getElementById('user-email');

// Stats Elements
const currentBalanceEl = document.getElementById('current-balance');
const lastMonthBalanceEl = document.getElementById('last-month-balance');
const monthlyExpensesEl = document.getElementById('monthly-expenses');
const thisMonthBalanceEl = document.getElementById('this-month-balance');
const monthlySalaryDisplay = document.getElementById('monthly-salary-display');

// Transaction Form Elements
const transactionForm = document.getElementById('transaction-form');
const txTabs = document.querySelectorAll('.tx-tab');
const txTypeInput = document.getElementById('tx-type');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txWhereInput = document.getElementById('tx-where');

// Table Elements
const transactionsBody = document.getElementById('transactions-body');
const filterMonth = document.getElementById('filter-month');

// Modal Elements
const salaryModal = document.getElementById('salary-modal');
const editSalaryBtn = document.getElementById('edit-salary-btn');
const closeSalaryModal = document.getElementById('close-salary-modal');
const salaryForm = document.getElementById('salary-form');
const salaryInput = document.getElementById('salary-input');
const salaryMonthInput = document.getElementById('salary-month-input');

const txModal = document.getElementById('tx-modal');
const closeTxModal = document.getElementById('close-tx-modal');
const txViewMode = document.getElementById('tx-view-mode');
const txEditMode = document.getElementById('tx-edit-mode');
const txViewAmount = document.getElementById('tx-view-amount');
const txViewDate = document.getElementById('tx-view-date');
const txViewType = document.getElementById('tx-view-type');
const txViewWhere = document.getElementById('tx-view-where');
const btnEditTx = document.getElementById('btn-edit-tx');
const btnDeleteTx = document.getElementById('btn-delete-tx');
const btnCancelEditTx = document.getElementById('btn-cancel-edit-tx');
const txEditForm = document.getElementById('tx-edit-form');
const editTxId = document.getElementById('edit-tx-id');
const editTxType = document.getElementById('edit-tx-type');
const editTxAmount = document.getElementById('edit-tx-amount');
const editTxDate = document.getElementById('edit-tx-date');
const editTxWhere = document.getElementById('edit-tx-where');

// --- Global State ---
let currentUser = null;
let isLoginMode = true;
let transactions = [];
let monthlySalaries = {}; // { "YYYY-MM": amount }
let dbListeners = [];

// --- Utilities ---
function formatDate(dateStr) {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleString('default', { month: 'short' });
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const year = dateObj.getFullYear();
    return `${day}-${capitalizedMonth}-${year}`;
}

function formatAmount(amount) {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
}

// --- Initialization ---
function init() {
    // Set up Flatpickr Datepickers
    flatpickr("#tx-date", {
        altInput: true,
        altFormat: "d-M-Y",
        dateFormat: "Y-m-d",
        defaultDate: "today"
    });
    flatpickr("#edit-tx-date", {
        altInput: true,
        altFormat: "d-M-Y",
        dateFormat: "Y-m-d"
    });
    flatpickr("#salary-month-input", {
        plugins: [
            new monthSelectPlugin({
                shorthand: true,
                dateFormat: "Y-m",
                altFormat: "M Y",
                theme: "dark"
            })
        ],
        altInput: true,
        onChange: function(selectedDates, dateStr) {
            salaryInput.value = monthlySalaries[dateStr] || '';
        }
    });
    
    // Check if user is saved in session storage
    const savedUser = sessionStorage.getItem('expenseProUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        handleLoginSuccess();
    } else {
        showAuthView();
    }
}

// --- Auth Utilities ---
async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Firebase keys cannot contain '.', '#', '$', '[', or ']'
function sanitizeEmail(email) {
    return email.replace(/\./g, ',');
}

// --- Auth UI Logic ---
tabLogin.addEventListener('click', () => {
    isLoginMode = true;
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    authSubmit.innerText = 'Login';
    hideError();
});

tabSignup.addEventListener('click', () => {
    isLoginMode = false;
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    authSubmit.innerText = 'Sign Up';
    hideError();
});

function showError(msg) {
    authError.innerText = msg;
    authError.style.display = 'block';
}

function hideError() {
    authError.style.display = 'none';
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim().toLowerCase();
    const password = authPassword.value;
    
    if(!email || !password) {
        showError("Please enter email and password");
        return;
    }

    // Combine email and password to create an unguessable unique key
    // This acts as both the "authentication" and the "database path"
    const secretKey = await hashPassword(email + ":" + password);
    const dbRef = ref(db);
    
    try {
        if (isLoginMode) {
            // LOGIN
            const snapshot = await get(child(dbRef, `users/${secretKey}/profile`));
            if (snapshot.exists()) {
                currentUser = { uid: secretKey, email };
                sessionStorage.setItem('expenseProUser', JSON.stringify(currentUser));
                handleLoginSuccess();
            } else {
                showError("Invalid email or password");
            }
        } else {
            // SIGN UP
            const snapshot = await get(child(dbRef, `users/${secretKey}/profile`));
            if (snapshot.exists()) {
                showError("An account with this exact email and password already exists");
            } else {
                // We create the profile node to verify existence
                await set(ref(db, `users/${secretKey}/profile`), {
                    email: email,
                    monthlySalary: 0
                });
                currentUser = { uid: secretKey, email };
                sessionStorage.setItem('expenseProUser', JSON.stringify(currentUser));
                handleLoginSuccess();
            }
        }
    } catch (error) {
        showError("Database error: " + error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('expenseProUser');
    currentUser = null;
    showAuthView();
});

function handleLoginSuccess() {
    userEmailDisplay.innerText = currentUser.email;
    showDashboard();
    loadUserData();
}

function showDashboard() {
    authView.classList.remove('active');
    dashboardView.classList.add('active');
}

function showAuthView() {
    dashboardView.classList.remove('active');
    authView.classList.add('active');
    authForm.reset();
}

// --- Transaction Tabs Logic ---
txTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        txTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const type = tab.getAttribute('data-type');
        txTypeInput.value = type;
        
        if(type === 'income') {
            txWhereInput.placeholder = "Source of income (e.g. Salary)";
        } else if(type === 'zakat') {
            txWhereInput.placeholder = "Description (e.g. Donation to charity)";
        } else {
            txWhereInput.placeholder = "Where did you spend? (e.g. Groceries)";
        }
    });
});

// --- Add Transaction ---
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const txData = {
        type: txTypeInput.value,
        amount: parseFloat(txAmountInput.value),
        date: txDateInput.value,
        where: txWhereInput.value.trim(),
        timestamp: Date.now()
    };

    try {
        const txRef = ref(db, `users/${currentUser.uid}/transactions`);
        await push(txRef, txData);
        transactionForm.reset();
        txDateInput._flatpickr.setDate("today");
        txTabs[0].click(); // Reset to expense tab
    } catch (error) {
        alert("Error adding transaction: " + error.message);
    }
});

// --- Salary Modal Logic ---
editSalaryBtn.addEventListener('click', () => {
    const filterVal = filterMonth.value;
    let targetMonth;
    
    if (filterVal !== 'all') {
        targetMonth = filterVal;
    } else {
        const now = new Date();
        targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    document.querySelector("#salary-month-input")._flatpickr.setDate(targetMonth, true); // true triggers onChange
    
    salaryModal.classList.add('active');
});

closeSalaryModal.addEventListener('click', () => {
    salaryModal.classList.remove('active');
});

salaryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const selectedMonth = salaryMonthInput.value; // "YYYY-MM"
    const newSalary = parseFloat(salaryInput.value);
    if (!selectedMonth) {
        alert("Please select a month.");
        return;
    }
    try {
        await set(ref(db, `users/${currentUser.uid}/salaries/${selectedMonth}`), newSalary);
        salaryModal.classList.remove('active');
    } catch (error) {
        alert("Error updating salary: " + error.message);
    }
});

// --- Data Fetching & Processing ---
function loadUserData() {
    if (!currentUser) return;

    // Load per-month salaries
    const salariesRef = ref(db, `users/${currentUser.uid}/salaries`);
    onValue(salariesRef, (snapshot) => {
        monthlySalaries = {};
        if (snapshot.exists()) {
            monthlySalaries = snapshot.val();
        }
        updateDashboard();
    });

    const txRef = query(ref(db, `users/${currentUser.uid}/transactions`), orderByChild('timestamp'));
    onValue(txRef, (snapshot) => {
        transactions = [];
        snapshot.forEach((childSnap) => {
            transactions.push({ id: childSnap.key, ...childSnap.val() });
        });
        // Sort descending by timestamp (latest added on top)
        transactions.sort((a, b) => b.timestamp - a.timestamp);
        updateDashboard();
        updateMonthFilterOptions();
        renderTable();
    });
}

function updateDashboard() {
    const filterVal = filterMonth.value;

    let totalIncomeAllTime = 0;
    let totalExpenseAllTime = 0;
    let totalZakatAllTime = 0;

    let incomeBeforeFilter = 0;
    let expenseBeforeFilter = 0;
    let zakatBeforeFilter = 0;

    let incomeThisMonth = 0;
    let expenseThisMonth = 0;
    let zakatThisMonth = 0;

    let monthlyExpenses = 0;

    transactions.forEach(tx => {
        const txMonthStr = tx.date.substring(0, 7); // "YYYY-MM"

        // All Time totals (for current balance)
        if (tx.type === 'income') totalIncomeAllTime += tx.amount;
        if (tx.type === 'expense') totalExpenseAllTime += tx.amount;
        if (tx.type === 'zakat') totalZakatAllTime += tx.amount;

        // Transactions strictly BEFORE the selected month (for last month ending balance)
        if (filterVal !== 'all' && txMonthStr < filterVal) {
            if (tx.type === 'income') incomeBeforeFilter += tx.amount;
            if (tx.type === 'expense') expenseBeforeFilter += tx.amount;
            if (tx.type === 'zakat') zakatBeforeFilter += tx.amount;
        }

        // Selected month expenses
        if (filterVal !== 'all' && txMonthStr === filterVal) {
            if (tx.type === 'expense') monthlyExpenses += tx.amount;
            if (tx.type === 'income') incomeThisMonth += tx.amount;
            if (tx.type === 'expense') expenseThisMonth += tx.amount;
            if (tx.type === 'zakat') zakatThisMonth += tx.amount;
        }
    });

    const currentBalance = totalIncomeAllTime - totalExpenseAllTime - totalZakatAllTime;
    const lastMonthEndingBalance = incomeBeforeFilter - expenseBeforeFilter - zakatBeforeFilter;
    const thisMonthEndingBalance = lastMonthEndingBalance + incomeThisMonth - expenseThisMonth - zakatThisMonth;

    currentBalanceEl.innerText = `Rs. ${formatAmount(currentBalance)}`;

    // Last Month Ending Balance: only meaningful when a month is selected
    if (filterVal === 'all') {
        lastMonthBalanceEl.innerText = `Rs. 0.00`;
    } else {
        lastMonthBalanceEl.innerText = `Rs. ${formatAmount(lastMonthEndingBalance)}`;
    }

    // Monthly Expenses: only meaningful when a month is selected
    if (filterVal === 'all') {
        monthlyExpensesEl.innerText = `Rs. 0.00`;
    } else {
        monthlyExpensesEl.innerText = `Rs. ${formatAmount(monthlyExpenses)}`;
    }

    // This Month Ending Balance: balance at end of selected month
    if (filterVal === 'all') {
        thisMonthBalanceEl.innerText = `Rs. 0.00`;
    } else {
        thisMonthBalanceEl.innerText = `Rs. ${formatAmount(thisMonthEndingBalance)}`;
    }

    // Monthly Salary: show salary for selected month, or highest ever for "All Time"
    if (filterVal === 'all') {
        const allSalaries = Object.values(monthlySalaries);
        const highest = allSalaries.length > 0 ? Math.max(...allSalaries) : 0;
        monthlySalaryDisplay.innerText = `Rs. ${formatAmount(highest)}`;
    } else {
        const salary = monthlySalaries[filterVal] || 0;
        monthlySalaryDisplay.innerText = `Rs. ${formatAmount(salary)}`;
    }
}


// --- Transaction Modal Logic ---
function openTxModal(tx) {
    // Populate View Mode
    txViewAmount.innerText = `Rs. ${formatAmount(tx.amount)}`;
    txViewDate.innerText = formatDate(tx.date);
    txViewType.innerText = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
    txViewWhere.innerText = tx.where;
    
    // Populate Edit Mode Form
    editTxId.value = tx.id;
    editTxType.value = tx.type;
    editTxAmount.value = tx.amount;
    document.querySelector("#edit-tx-date")._flatpickr.setDate(tx.date);
    editTxWhere.value = tx.where;

    // Show View Mode initially
    txViewMode.style.display = 'block';
    txEditMode.style.display = 'none';
    txModal.classList.add('active');
}

closeTxModal.addEventListener('click', () => {
    txModal.classList.remove('active');
});

btnEditTx.addEventListener('click', () => {
    txViewMode.style.display = 'none';
    txEditMode.style.display = 'block';
});

btnCancelEditTx.addEventListener('click', () => {
    txViewMode.style.display = 'block';
    txEditMode.style.display = 'none';
});

btnDeleteTx.addEventListener('click', async () => {
    if(!confirm("Are you sure you want to delete this transaction?")) return;
    const txId = editTxId.value;
    if(!txId || !currentUser) return;
    try {
        await remove(ref(db, `users/${currentUser.uid}/transactions/${txId}`));
        txModal.classList.remove('active');
    } catch(err) {
        alert("Failed to delete: " + err.message);
    }
});

txEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txId = editTxId.value;
    if(!txId || !currentUser) return;

    const txData = {
        type: editTxType.value,
        amount: parseFloat(editTxAmount.value),
        date: editTxDate.value,
        where: editTxWhere.value.trim()
    };

    try {
        await update(ref(db, `users/${currentUser.uid}/transactions/${txId}`), txData);
        txModal.classList.remove('active');
    } catch(err) {
        alert("Failed to update: " + err.message);
    }
});

// --- Table Rendering ---
function renderTable() {
    transactionsBody.innerHTML = '';
    const filterVal = filterMonth.value; 

    const filtered = transactions.filter(tx => {
        if (filterVal === 'all') return true;
        const txMonthStr = tx.date.substring(0, 7); 
        return txMonthStr === filterVal;
    });

    if (filtered.length === 0) {
        transactionsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No transactions found.</td></tr>`;
        return;
    }

    filtered.forEach(tx => {
        const tr = document.createElement('tr');
        
        let typeBadgeClass = 'type-expense';
        let amountSign = '-';
        if (tx.type === 'income') { typeBadgeClass = 'type-income'; amountSign = '+'; }
        if (tx.type === 'zakat') { typeBadgeClass = 'type-zakat'; amountSign = '-'; }

        tr.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td>${tx.where}</td>
            <td><span class="type-badge ${typeBadgeClass}">${tx.type}</span></td>
            <td style="font-weight: 600; color: ${tx.type === 'income' ? 'var(--success)' : (tx.type === 'zakat' ? 'var(--zakat)' : 'var(--danger)')};">
                ${amountSign}Rs. ${formatAmount(tx.amount)}
            </td>
            <td>
                <button class="btn-icon view-tx-btn" title="View details"><i class="fa-solid fa-circle-info"></i></button>
            </td>
        `;
        
        tr.querySelector('.view-tx-btn').addEventListener('click', () => openTxModal(tx));
        transactionsBody.appendChild(tr);
    });
}

function updateMonthFilterOptions() {
    const currentSelection = filterMonth.value;
    
    // Extract unique YYYY-MM values from existing transactions
    const uniqueMonths = new Set();
    transactions.forEach(tx => {
        if(tx.date) {
            uniqueMonths.add(tx.date.substring(0, 7));
        }
    });

    // Sort descending (newest month first)
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a));

    // Rebuild options
    filterMonth.innerHTML = '<option value="all">All Time</option>';
    
    sortedMonths.forEach(yyyy_mm => {
        const [yyyy, mm] = yyyy_mm.split('-');
        const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = yyyy_mm;
        option.innerText = monthName;
        filterMonth.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (sortedMonths.includes(currentSelection) || currentSelection === 'all') {
        filterMonth.value = currentSelection;
    } else {
        filterMonth.value = 'all';
    }
}

filterMonth.addEventListener('change', () => {
    updateDashboard();
    renderTable();
});

init();
