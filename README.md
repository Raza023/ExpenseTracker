# 💸 ExpensePro - Intelligent Finance Tracker

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge&logo=github)](https://raza023.github.io/ExpenseTracker/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

**ExpensePro** is a modern, responsive, and completely client-side single-page application built to help you track your personal finances, manage your monthly salary, and keep an eye on your ongoing balances—all securely hashed on the front end.

---

## ✨ Features

- **🔒 Secure Isolated Authentication**: Uses custom client-side `SHA-256` hashing of email+password to generate unguessable database paths, ensuring complete data isolation without complex external auth backends.
- **📱 Responsive Glassmorphism UI**: Beautiful dark-themed aesthetic with vibrant gradient cards that adapt flawlessly from desktop monitors to mobile screens.
- **📅 Smart Date & Currency Localization**: Fully integrated with **Flatpickr** for robust date selection, and utilizes the South Asian (`en-IN`) numbering system for currency (e.g., `1,00,000.00`).
- **📊 Dynamic Dashboards**: Provides real-time calculations for:
  - Current Balance (All Time)
  - Last Month Ending Balance
  - This Month Ending Balance
  - Monthly Expenses & Per-Month Salary Tracking
- **🏷️ Zakat/Obligatory Tracking**: Custom categorization distinct from standard expenses and incomes.

---

## 🚀 Live Demo

You can try out the live application hosted on GitHub Pages right here:

👉 **[Launch ExpensePro](https://raza023.github.io/ExpenseTracker/)**

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3 (CSS Variables, Flexbox, Grid), JavaScript (ES6+ Modules).
- **Date Picker**: [Flatpickr](https://flatpickr.js.org/) + `monthSelect` Plugin.
- **Database**: Firebase Realtime Database (Modular SDK v10.7.1).
- **Icons & Typography**: FontAwesome 6 & Google Fonts (Inter).

---

## 💻 Local Installation

If you want to run this project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Raza023/ExpenseTracker.git
   ```
2. **Navigate to the directory:**
   ```bash
   cd ExpenseTracker
   ```
3. **Serve the app:**
   Since this app uses ES6 Modules (`type="module"`), you must serve it over an HTTP server. You can use tools like Live Server in VS Code, or Python:
   ```bash
   npx serve .
   # OR
   python -m http.server 8000
   ```
4. **Open in browser:**
   Navigate to `http://localhost:8000` or the port provided by your server.

---

## 💡 How It Works (Security Model)

To keep the application entirely frontend-based while maintaining user isolation:
1. When you "Sign Up", your email and password are combined and hashed using the browser's native `Crypto` API.
2. This creates a highly secure, one-way `SHA-256` key.
3. This key becomes the direct path to your unique data inside the Firebase Realtime Database.
4. Without knowing the exact email and password combination, it is statistically impossible for anyone to find or read your database node.
