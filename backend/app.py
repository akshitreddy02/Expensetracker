from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import uuid
from datetime import datetime, timedelta
import json
from functools import wraps
import csv
import io
from flask import Response

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'
CORS(app, supports_credentials=True)

# Database initialization
def init_db():
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Expenses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Budgets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, category, month, year)
        )
    ''')
    
    conn.commit()
    conn.close()

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# User registration
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({'error': 'All fields are required'}), 400
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    try:
        user_id = str(uuid.uuid4())
        password_hash = generate_password_hash(password)
        
        cursor.execute('''
            INSERT INTO users (id, username, email, password_hash)
            VALUES (?, ?, ?, ?)
        ''', (user_id, username, email, password_hash))
        
        conn.commit()
        session['user_id'] = user_id
        session['username'] = username
        
        return jsonify({
            'message': 'User registered successfully',
            'user': {'id': user_id, 'username': username, 'email': email}
        }), 201
        
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    finally:
        conn.close()

@app.route('/export/csv' ,methods=['GET'])
@login_required
def export_csv():
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()

    # Example: fetch all expenses for the logged-in user
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Login required'}), 401

    cursor.execute('''
        SELECT date, category, amount, description FROM expenses
        WHERE user_id = ?
    ''', (user_id,))
    
    rows = cursor.fetchall()
    conn.close()

    # Use StringIO to build CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write CSV header
    writer.writerow(['Date', 'Category', 'Amount', 'Description'])

    # Write data rows
    writer.writerows(rows)

    # Prepare response
    output.seek(0)
    return Response(output,
                    mimetype='text/csv',
                    headers={"Content-Disposition": "attachment;filename=expenses.csv"})

# User login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not all([username, password]):
        return jsonify({'error': 'Username and password are required'}), 400
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, username, email, password_hash FROM users
        WHERE username = ? OR email = ?
    ''', (username, username))
    
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user[3], password):
        session['user_id'] = user[0]
        session['username'] = user[1]
        
        return jsonify({
            'message': 'Login successful',
            'user': {'id': user[0], 'username': user[1], 'email': user[2]}
        }), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

# User logout
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

# Add expense
@app.route('/api/expenses', methods=['POST'])
@login_required
def add_expense():
    data = request.get_json()
    amount = data.get('amount')
    category = data.get('category')
    description = data.get('description', '')
    date = data.get('date')
    
    if not all([amount, category, date]):
        return jsonify({'error': 'Amount, category, and date are required'}), 400
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    expense_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO expenses (id, user_id, amount, category, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (expense_id, session['user_id'], amount, category, description, date))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'message': 'Expense added successfully',
        'expense': {
            'id': expense_id,
            'amount': amount,
            'category': category,
            'description': description,
            'date': date
        }
    }), 201

# Get expenses
@app.route('/api/expenses', methods=['GET'])
@login_required
def get_expenses():
    category_filter = request.args.get('category')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    query = 'SELECT * FROM expenses WHERE user_id = ?'
    params = [session['user_id']]
    
    if category_filter:
        query += ' AND category = ?'
        params.append(category_filter)
    
    if start_date:
        query += ' AND date >= ?'
        params.append(start_date)
    
    if end_date:
        query += ' AND date <= ?'
        params.append(end_date)
    
    query += ' ORDER BY date DESC'
    
    cursor.execute(query, params)
    expenses = cursor.fetchall()
    conn.close()
    
    expense_list = []
    for expense in expenses:
        expense_list.append({
            'id': expense[0],
            'user_id': expense[1],
            'amount': expense[2],
            'category': expense[3],
            'description': expense[4],
            'date': expense[5],
            'created_at': expense[6]
        })
    
    return jsonify({'expenses': expense_list}), 200

# Update expense
@app.route('/api/expenses/<expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    data = request.get_json()
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    # Check if expense belongs to user
    cursor.execute('SELECT user_id FROM expenses WHERE id = ?', (expense_id,))
    expense = cursor.fetchone()
    
    if not expense or expense[0] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Expense not found'}), 404
    
    # Update expense
    cursor.execute('''
        UPDATE expenses 
        SET amount = ?, category = ?, description = ?, date = ?
        WHERE id = ? AND user_id = ?
    ''', (data.get('amount'), data.get('category'), data.get('description'),
          data.get('date'), expense_id, session['user_id']))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Expense updated successfully'}), 200

# Delete expense
@app.route('/api/expenses/<expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM expenses WHERE id = ? AND user_id = ?',
                  (expense_id, session['user_id']))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Expense not found'}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Expense deleted successfully'}), 200

# Get analytics
@app.route('/api/analytics', methods=['GET'])
@login_required
def get_analytics():
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    # Category-wise spending
    cursor.execute('''
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE user_id = ?
        GROUP BY category
        ORDER BY total DESC
    ''', (session['user_id'],))
    
    category_data = [{'category': row[0], 'amount': row[1]} for row in cursor.fetchall()]
    
    # Monthly spending trend
    cursor.execute('''
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
        FROM expenses
        WHERE user_id = ? AND date >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month
    ''', (session['user_id'],))
    
    monthly_data = [{'month': row[0], 'amount': row[1]} for row in cursor.fetchall()]
    
    # Total spending
    cursor.execute('SELECT SUM(amount) FROM expenses WHERE user_id = ?', 
                  (session['user_id'],))
    total_spending = cursor.fetchone()[0] or 0
    
    # This month's spending
    cursor.execute('''
        SELECT SUM(amount) FROM expenses 
        WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    ''', (session['user_id'],))
    this_month_spending = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return jsonify({
        'category_breakdown': category_data,
        'monthly_trend': monthly_data,
        'total_spending': total_spending,
        'this_month_spending': this_month_spending
    }), 200

# Budget endpoints
@app.route('/api/budgets', methods=['POST'])
@login_required
def set_budget():
    data = request.get_json()
    category = data.get('category')
    amount = data.get('amount')
    month = data.get('month', datetime.now().month)
    year = data.get('year', datetime.now().year)
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    budget_id = str(uuid.uuid4())
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO budgets (id, user_id, category, amount, month, year)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (budget_id, session['user_id'], category, amount, month, year))
        
        conn.commit()
        return jsonify({'message': 'Budget set successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    finally:
        conn.close()

@app.route('/api/budgets', methods=['GET'])
@login_required
def get_budgets():
    month = request.args.get('month', datetime.now().month)
    year = request.args.get('year', datetime.now().year)
    
    conn = sqlite3.connect('expense_tracker.db')
    cursor = conn.cursor()
    
    # Get budgets
    cursor.execute('''
        SELECT category, amount FROM budgets
        WHERE user_id = ? AND month = ? AND year = ?
    ''', (session['user_id'], month, year))
    
    budgets = {row[0]: row[1] for row in cursor.fetchall()}
    
    # Get actual spending for the month
    cursor.execute('''
        SELECT category, SUM(amount) as spent FROM expenses
        WHERE user_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
        GROUP BY category
    ''', (session['user_id'], f"{int(month):02d}", str(year)))
    
    spending = {row[0]: row[1] for row in cursor.fetchall()}
    
    conn.close()
    
    budget_comparison = []
    all_categories = set(budgets.keys()) | set(spending.keys())
    
    for category in all_categories:
        budget_amount = budgets.get(category, 0)
        spent_amount = spending.get(category, 0)
        budget_comparison.append({
            'category': category,
            'budget': budget_amount,
            'spent': spent_amount,
            'remaining': budget_amount - spent_amount,
            'percentage': (spent_amount / budget_amount * 100) if budget_amount > 0 else 0
        })
    
    return jsonify({'budget_comparison': budget_comparison}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)