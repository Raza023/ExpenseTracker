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
const btnDownloadCsv = document.getElementById('btn-download-csv');
const btnDownloadPdf = document.getElementById('btn-download-pdf');
const btnExportData = document.getElementById('btn-export-data');
const btnImportData = document.getElementById('btn-import-data');
const importFileInput = document.getElementById('import-file-input');

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
        } else if(type === 'credit') {
            txWhereInput.placeholder = "Credit source (e.g. Refund, Cashback)";
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
        //Sort by date descending, then by timestamp descending
        transactions.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateB - dateA !== 0) {
                return dateB - dateA;
            }
            return b.timestamp - a.timestamp;
        });
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
        if (tx.type === 'credit') totalIncomeAllTime += tx.amount;
        if (tx.type === 'expense') totalExpenseAllTime += tx.amount;
        if (tx.type === 'zakat') totalZakatAllTime += tx.amount;

        // Transactions strictly BEFORE the selected month (for last month ending balance)
        if (filterVal !== 'all' && txMonthStr < filterVal) {
            if (tx.type === 'income') incomeBeforeFilter += tx.amount;
            if (tx.type === 'credit') incomeBeforeFilter += tx.amount;
            if (tx.type === 'expense') expenseBeforeFilter += tx.amount;
            if (tx.type === 'zakat') zakatBeforeFilter += tx.amount;
        }

        // Selected month expenses
        if (filterVal !== 'all' && txMonthStr === filterVal) {
            if (tx.type === 'expense') monthlyExpenses += tx.amount;
            if (tx.type === 'credit') monthlyExpenses -= tx.amount;
            if (tx.type === 'income') incomeThisMonth += tx.amount;
            if (tx.type === 'credit') incomeThisMonth += tx.amount;
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
        if (tx.type === 'credit') { typeBadgeClass = 'type-credit'; amountSign = '+'; }

        tr.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td style="font-weight: 600; color: ${(tx.type === 'income' || tx.type === 'credit') ? 'var(--success)' : (tx.type === 'zakat' ? 'var(--zakat)' : 'var(--danger)')}">
                ${amountSign}Rs. ${formatAmount(tx.amount)}
            </td>
            <td><span class="type-badge ${typeBadgeClass}">${tx.type}</span></td>
            <td>${tx.where}</td>
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

if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', () => {
        const filterVal = filterMonth.value; 

        const filtered = transactions.filter(tx => {
            if (filterVal === 'all') return true;
            const txMonthStr = tx.date.substring(0, 7); 
            return txMonthStr === filterVal;
        });

        if (filtered.length === 0) {
            alert("No transactions to download.");
            return;
        }

        const currentBalance = document.getElementById('current-balance').innerText;
        const lastMonthBalance = document.getElementById('last-month-balance').innerText;
        const thisMonthBalance = document.getElementById('this-month-balance').innerText;
        const monthlyExpenses = document.getElementById('monthly-expenses').innerText;
        const monthlySalary = document.getElementById('monthly-salary-display').innerText;

        let csvContent = `====================================================\n`;
        csvContent += `               EXPENSEPRO REPORT - ${filterVal === 'all' ? 'ALL TIME' : filterVal.toUpperCase()}               \n`;
        csvContent += `====================================================\n\n`;
        csvContent += `[ SUMMARY STATISTICS ]\n`;
        csvContent += `Current Balance,,"${currentBalance}"\n`;
        csvContent += `Last Month Balance,,"${lastMonthBalance}"\n`;
        csvContent += `This Month Balance,,"${thisMonthBalance}"\n`;
        csvContent += `Monthly Expenses,,"${monthlyExpenses}"\n`;
        csvContent += `Monthly Salary,,"${monthlySalary}"\n\n`;
        csvContent += `----------------------------------------------------\n`;
        csvContent += `[ TRANSACTIONS LOG ]\n`;
        csvContent += "Date,Description,Type,Amount\n";
        
        filtered.forEach(tx => {
            let desc = tx.where.replace(/"/g, '""');
            if (desc.includes(',') || desc.includes('\\n') || desc.includes('"')) {
                desc = `"${desc}"`;
            }
            csvContent += `${formatDate(tx.date)},${desc},${tx.type},${tx.amount}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `transactions_${filterVal}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
        const filterVal = filterMonth.value; 

        const filtered = transactions.filter(tx => {
            if (filterVal === 'all') return true;
            const txMonthStr = tx.date.substring(0, 7); 
            return txMonthStr === filterVal;
        });

        const currentBalance = document.getElementById('current-balance').innerText;
        const lastMonthBalance = document.getElementById('last-month-balance').innerText;
        const thisMonthBalance = document.getElementById('this-month-balance').innerText;
        const monthlyExpenses = document.getElementById('monthly-expenses').innerText;
        const monthlySalary = document.getElementById('monthly-salary-display').innerText;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header Banner
        doc.setFillColor(41, 128, 185); // Professional Blue
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("ExpensePro", 14, 25);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const reportDate = new Date().toLocaleDateString();
        doc.text(`Report Period: ${filterVal === 'all' ? 'All Time' : filterVal}   |   Generated: ${reportDate}`, 14, 33);

        // Summary Title
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Financial Summary", 14, 52);
        
        // Summary Cards
        const drawCard = (x, y, title, value, color) => {
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(248, 249, 250);
            doc.roundedRect(x, y, 85, 22, 3, 3, 'FD');
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "normal");
            doc.text(title, x + 5, y + 8);
            doc.setFontSize(12);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.setFont("helvetica", "bold");
            doc.text(value, x + 5, y + 17);
        };

        drawCard(14, 58, "Current Balance", currentBalance, [41, 128, 185]); // Blue
        drawCard(110, 58, "Monthly Salary", monthlySalary, [39, 174, 96]); // Green
        
        drawCard(14, 84, "Monthly Expenses", monthlyExpenses, [192, 57, 43]); // Red
        drawCard(110, 84, "This Month Ending", thisMonthBalance, [142, 68, 173]); // Purple

        drawCard(14, 110, "Last Month Ending", lastMonthBalance, [243, 156, 18]); // Orange

        let startYForTable = 145;

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Transaction Details", 14, startYForTable - 5);

        if (filtered.length > 0) {
            const tableData = filtered.map(tx => {
                let amountSign = '-';
                if (tx.type === 'income') amountSign = '+';
                if (tx.type === 'credit') amountSign = '+';
                if (tx.type === 'zakat') amountSign = '-';
                return [
                    formatDate(tx.date),
                    tx.where,
                    tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
                    `${amountSign}Rs. ${formatAmount(tx.amount)}`
                ];
            });

            doc.autoTable({
                startY: startYForTable,
                head: [['Date', 'Description', 'Type', 'Amount']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 3) {
                        const val = data.cell.raw;
                        if (val.startsWith('+')) {
                            data.cell.styles.textColor = [39, 174, 96]; // Green
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val.startsWith('-')) {
                            // Only red if it's not Zakat (we style Zakat amount same as expense but maybe different?)
                            data.cell.styles.textColor = [192, 57, 43]; // Red
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    if (data.section === 'body' && data.column.index === 2) {
                        const type = data.cell.raw;
                        if (type === 'Income') data.cell.styles.textColor = [39, 174, 96];
                        if (type === 'Credit') data.cell.styles.textColor = [39, 174, 96];
                        if (type === 'Expense') data.cell.styles.textColor = [192, 57, 43];
                        if (type === 'Zakat') data.cell.styles.textColor = [142, 68, 173];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });
        } else {
            doc.setFontSize(11);
            doc.setFont("helvetica", "italic");
            doc.text("No transactions found for this period.", 14, startYForTable + 10);
        }

        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }

        doc.save(`transactions_${filterVal}.pdf`);
    });
}

if (btnExportData) {
    btnExportData.addEventListener('click', () => {
        const dataToExport = {
            transactions: transactions,
            salaries: monthlySalaries
        };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const now = new Date();
        const datePart = now.toISOString().split('T')[0];
        const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        link.setAttribute("download", `expensepro_backup_${datePart}_${timePart}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

if (btnImportData && importFileInput) {
    btnImportData.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                const updates = {};
                
                if (importedData.transactions && Array.isArray(importedData.transactions)) {
                    importedData.transactions.forEach(tx => {
                        const { id, ...txData } = tx;
                        // Use existing ID to merge/overwrite, or generate a new key if it doesn't have one
                        const key = id || push(child(ref(db), `users/${currentUser.uid}/transactions`)).key;
                        updates[`users/${currentUser.uid}/transactions/${key}`] = txData;
                    });
                }
                
                if (importedData.salaries && typeof importedData.salaries === 'object') {
                    Object.keys(importedData.salaries).forEach(month => {
                        updates[`users/${currentUser.uid}/salaries/${month}`] = importedData.salaries[month];
                    });
                }

                if (Object.keys(updates).length > 0) {
                    await update(ref(db), updates);
                    alert("Data imported successfully!");
                } else {
                    alert("No valid data found in the file.");
                }
                
            } catch (err) {
                alert("Error parsing or importing file: " + err.message);
            }
            importFileInput.value = '';
        };
        reader.readAsText(file);
    });
}

// --- Toggle Balances Visibility ---
const toggleBalancesBtn = document.getElementById('toggle-balances-btn');
const toggleBalancesIcon = document.getElementById('toggle-balances-icon');
const statsGrid = document.querySelector('.stats-grid');
let balancesVisible = false;

if (toggleBalancesBtn) {
    toggleBalancesBtn.addEventListener('click', () => {
        balancesVisible = !balancesVisible;

        // Blur/unblur via class on the stats grid
        if (balancesVisible) {
            statsGrid.classList.remove('balances-hidden');
            toggleBalancesIcon.classList.replace('fa-eye-slash', 'fa-eye');
            toggleBalancesBtn.classList.remove('hidden-mode');
        } else {
            statsGrid.classList.add('balances-hidden');
            toggleBalancesIcon.classList.replace('fa-eye', 'fa-eye-slash');
            toggleBalancesBtn.classList.add('hidden-mode');
        }

        // Pulse ring animation
        toggleBalancesBtn.classList.remove('pulsed');
        void toggleBalancesBtn.offsetWidth; // reflow to restart animation
        toggleBalancesBtn.classList.add('pulsed');
        setTimeout(() => toggleBalancesBtn.classList.remove('pulsed'), 450);
    });
}

init();
