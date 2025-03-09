const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { parse, isWithinInterval } = require('date-fns');
const { Bonjour } = require('bonjour-service');
const { protocol } = require('electron');
const app = express();
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Database connection
const db = new sqlite3.Database('./restaurant2.db', (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the database.');
    }
});

// Create tables
// Create tables
db.serialize(() => {

    db.run('CREATE TABLE IF NOT EXISTS chefs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)');
    // Create tables
    db.run('CREATE TABLE IF NOT EXISTS guests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)');
    
    db.run(`CREATE TABLE IF NOT EXISTS waiters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        subcategory_id INTEGER,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories (id),
        FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS live_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        waiter_id INTEGER,
        chef_id INTEGER,
        total REAL,
        timestamp TEXT,
        FOREIGN KEY (waiter_id) REFERENCES waiters (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS live_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        meal_id INTEGER,
        name TEXT,
        price REAL,
        quantity INTEGER,
        FOREIGN KEY (order_id) REFERENCES live_orders (id),
        FOREIGN KEY (meal_id) REFERENCES meals (id)
    )`);

    app.get('/live-orders/:waiterId', (req, res) => {
        const waiterId = req.params.waiterId;
        db.all('SELECT * FROM live_orders WHERE waiter_id = ?', [waiterId], (err, orders) => {
            if (err) {
                console.error('Error fetching live orders:', err);
                return res.status(500).json({ success: false, message: 'Failed to fetch live orders' });
            }

            const orderPromises = orders.map(order => {
                return new Promise((resolve, reject) => {
                    db.all('SELECT * FROM live_order_items WHERE order_id = ?', [order.id], (err, items) => {
                        if (err) {
                            reject(err);
                        } else {
                            order.items = items;
                            order.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                            resolve(order);
                        }
                    });
                });
            });

            Promise.all(orderPromises)
                .then(ordersWithItems => {
                    res.json({ success: true, orders: ordersWithItems });
                })
                .catch(error => {
                    console.error('Error fetching live order items:', error);
                    res.status(500).json({ success: false, message: 'Failed to fetch live order items' });
                });
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS completed_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        waiter_id INTEGER,
        chef_id INTEGER,
        guest_id INTEGER,
        total REAL,
        order_timestamp TEXT,
        completion_timestamp TEXT,
        time_taken INTEGER,
        FOREIGN KEY (waiter_id) REFERENCES waiters (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS completed_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        meal_id INTEGER,
        name TEXT,
        price REAL,
        quantity INTEGER,
        FOREIGN KEY (order_id) REFERENCES completed_orders (id),
        FOREIGN KEY (meal_id) REFERENCES meals (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`);

    // Insert default admin user
    db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', 'password123', 'admin'], function(err) {
        if (err) {
            console.error('Error inserting default admin user:', err);
        } else {
            console.log('Default admin user inserted successfully');
        }
    });

    // Insert default users

    console.log("Database tables recreated successfully");

    // Check if guest_id column exists in live_orders table
    db.all('PRAGMA table_info(live_orders)', (err, columns) => {
        if (err) {
            console.error('Error fetching table info:', err);
        } else {
            const guestIdColumnExists = columns.some(column => column.name === 'guest_id');
            if (!guestIdColumnExists) {
                db.run('ALTER TABLE live_orders ADD COLUMN guest_id INTEGER', function(err) {
                    if (err) {
                        console.error('Error adding guest_id column:', err);
                    } else {
                        console.log('guest_id column added to live_orders table');
                    }
                  
                });
          
            }  
            else{
                console.log('guest_id column already exists in live_orders table');
            }
        }
    });
    db.all('PRAGMA table_info(completed_orders)', (err, columns) => {
        if (err) {
            console.error('Error fetching table info:', err);
        } else {
            const guestIdColumnExists = columns.some(column => column.name === 'guest_id');
            if (!guestIdColumnExists) {
                db.run('ALTER TABLE completed_orders ADD COLUMN guest_id INTEGER', function(err) {
                    if (err) {
                        console.error('Error adding guest_id column:', err);
                    } else {
                        console.log('guest_id column added to completed_orders table');
                    }
                  
                });
          
            }  
            else{
                console.log('guest_id column already exists in completed_orders table');
            }
        }
    });
});

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (user) {
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    });
});

// Add captain route
app.post('/add-captain', (req, res) => {
    const { username, password } = req.body;
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, 'captain'], function(err) {
        if (err) {
            console.error('Error adding captain:', err);
            return res.status(500).json({ success: false, message: 'Failed to add captain' });
        }
        res.json({ success: true, message: 'Captain added successfully' });
    });
});

// Change admin password route
app.post('/change-admin-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', ['admin', currentPassword], (err, user) => {
        if (err) {
            console.error('Error fetching admin:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (user) {
            db.run('UPDATE users SET password = ? WHERE username = ?', [newPassword, 'admin'], function(err) {
                if (err) {
                    console.error('Error updating password:', err);
                    return res.status(500).json({ success: false, message: 'Failed to update password' });
                }
                res.json({ success: true, message: 'Password updated successfully' });
            });
        } else {
            res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
    });
});

// Add waiter route
app.post('/add-waiter', (req, res) => {
    const { name, password } = req.body;
    db.run('INSERT INTO waiters (name, password) VALUES (?, ?)', [name, password], function(err) {
        if (err) {
            console.error('Error adding waiter:', err);
            return res.status(500).json({ success: false, message: 'Failed to add waiter' });
        }
        res.json({ success: true, message: 'Waiter added successfully' });
    });
});

// Add category route
app.post('/add-category', (req, res) => {
    const { name } = req.body;
    db.run('INSERT INTO categories (name) VALUES (?)', [name], function(err) {
        if (err) {
            console.error('Error adding category:', err);
            return res.status(500).json({ success: false, message: 'Failed to add category' });
        }
        res.json({ success: true, message: 'Category added successfully' });
    });
});

// Add subcategory route
app.post('/add-subcategory', (req, res) => {
    const { name, categoryId } = req.body;
    db.run('INSERT INTO subcategories (name, category_id) VALUES (?, ?)', [name, categoryId], function(err) {
        if (err) {
            console.error('Error adding subcategory:', err);
            return res.status(500).json({ success: false, message: 'Failed to add subcategory' });
        }
        res.json({ success: true, message: 'Subcategory added successfully' });
    });
});

// Add meal route
app.post('/add-meal', (req, res) => {
    const { name, price, categoryId, subcategoryId } = req.body;
    db.run('INSERT INTO meals (name, price, category_id, subcategory_id) VALUES (?, ?, ?, ?)', [name, price, categoryId, subcategoryId], function(err) {
        if (err) {
            console.error('Error adding meal:', err);
            return res.status(500).json({ success: false, message: 'Failed to add meal' });
        }
        res.json({ success: true, message: 'Meal added successfully' });
    });
});

// Fetch waiters
app.get('/waiters', (req, res) => {
    db.all('SELECT * FROM waiters', (err, rows) => {
        if (err) {
            console.error('Error fetching waiters:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch waiters' });
        }
        res.json({ success: true, waiters: rows });
    });
});

// Fetch categories
app.get('/categories', (req, res) => {
    db.all('SELECT * FROM categories', (err, rows) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch categories' });
        }
        res.json({ success: true, categories: rows });
    });
});

// Fetch subcategories
app.get('/subcategories/:categoryId', (req, res) => {
    const categoryId = req.params.categoryId;
    db.all('SELECT * FROM subcategories WHERE category_id = ?', [categoryId], (err, rows) => {
        if (err) {
            console.error('Error fetching subcategories:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch subcategories' });
        }
        res.json({ success: true, subcategories: rows });
    });
});

// Fetch meals
app.get('/meals/:categoryId/:subcategoryId?', (req, res) => {
    const { categoryId, subcategoryId } = req.params;
    let query = 'SELECT * FROM meals WHERE category_id = ?';
    const params = [categoryId];

    if (subcategoryId) {
        query += ' AND subcategory_id = ?';
        params.push(subcategoryId);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching meals:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch meals' });
        }
        res.json({ success: true, meals: rows });
    });
});

// Add order route
app.post('/add-order', (req, res) => {
    const { waiter_id, chef_id, guest_id, items, total } = req.body; // Include chef_id
    const timestamp = new Date().toISOString();

    db.run('INSERT INTO live_orders (waiter_id, chef_id, guest_id, total, timestamp) VALUES (?, ?, ?, ?, ?)', 
        [waiter_id, chef_id, guest_id, total, timestamp], function(err) { // Include chef_id
        if (err) {
            console.error('Error adding order:', err);
            return res.status(500).json({ success: false, message: 'Failed to add order' });
        }

        const order_id = this.lastID;

        const stmt = db.prepare('INSERT INTO live_order_items (order_id, meal_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)');
        items.forEach(item => {
            stmt.run(order_id, item.meal_id, item.name, item.price, item.quantity); // Ensure quantity is inserted
        });
        stmt.finalize();

        res.json({ success: true, message: 'Order added successfully', id: order_id });
    });
});

// Fetch live orders with chef information
app.get('/live-orders', (req, res) => {
    const mealId = req.query.mealId; // Get the mealId from query parameters
    let query = `SELECT DISTINCT lo.*, w.name as waiter_name, c.name as chef_name, g.name as guest_name
                 FROM live_orders lo
                 LEFT JOIN waiters w ON lo.waiter_id = w.id
                 LEFT JOIN chefs c ON lo.chef_id = c.id
                 LEFT JOIN guests g ON lo.guest_id = g.id
                 LEFT JOIN live_order_items loi ON lo.id = loi.order_id`;
    let params = [];
    
    if (mealId) {
        query += ` WHERE loi.meal_id = ?`;
        params.push(mealId);
    }

    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('Error fetching live orders:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch live orders' });
        }

        const orderPromises = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT loi.*, mcs.is_completed 
                        FROM live_order_items loi
                        LEFT JOIN meal_completion_status mcs 
                        ON loi.order_id = mcs.order_id AND loi.meal_id = mcs.meal_id
                        WHERE loi.order_id = ?`, 
                    [order.id], 
                    (err, items) => {
                        if (err) {
                            reject(err);
                        } else {
                            order.items = items.map(item => ({
                                ...item,
                                is_completed: item.is_completed === 1
                            }));
                            order.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                            resolve(order);
                        }
                    }
                );
            });
        });

        Promise.all(orderPromises)
            .then(ordersWithItems => {
                res.json({ success: true, orders: ordersWithItems });
            })
            .catch(error => {
                console.error('Error fetching order items:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch order items' });
            });
    });
});
// Verify if an order has a guest
app.post('/verifyer', (req, res) => {
    const orderId = req.body.orderId;

    db.get('SELECT guest_id FROM live_orders WHERE id = ?', [orderId], (err, row) => {
        if (err) {
            console.error('Error verifying order:', err);
            return res.status(500).json({ success: false, message: 'Failed to verify order' });
        }

        if (!row || !row.guest_id) {
            return res.json({ success: true, hasGuest: false });
        }

        res.json({ success: true, hasGuest: true });
    });
});
// Fetch completed orders with chef information (only from today)
app.get('/completed-guest-orders', (req, res) => {
    const query = `
        SELECT gp.guest_id, gp.waiter_id, gp.chef_id, gp.total, gp.order_timestamp, gp.completion_timestamp, gp.time_taken, 
        w.name as waiter_name, c.name as chef_name, g.name as guest_name,
        json_group_array(json_object('name', gpi.name, 'price', gpi.price, 'quantity', gpi.quantity)) as items
        FROM guest_pending gp
        LEFT JOIN waiters w ON gp.waiter_id = w.id
        LEFT JOIN chefs c ON gp.chef_id = c.id
        LEFT JOIN guests g ON gp.guest_id = g.id
        LEFT JOIN guest_pending_items gpi ON gp.id = gpi.order_id
        GROUP BY gp.id, g.name
        ORDER BY g.name, gp.completion_timestamp DESC`;

    db.all(query, [], (err, orders) => {
        if (err) {
            console.error('Error fetching completed guest orders:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch completed guest orders' });
        }

        const guestOrders = {};
        orders.forEach(order => {
            if (!guestOrders[order.guest_name]) {
                guestOrders[order.guest_name] = { guest_id: order.guest_id, total: 0, orders: [] };
            }

            order.items = JSON.parse(order.items);
            guestOrders[order.guest_name].orders.push(order);
            guestOrders[order.guest_name].total += order.total;
        });

        const guestOrdersArray = Object.keys(guestOrders).map(guestName => ({
            guest_id: guestOrders[guestName].guest_id,
            guestName,
            total: guestOrders[guestName].total,
            orders: guestOrders[guestName].orders
        }));

        res.json({ success: true, orders: guestOrdersArray });
    });
});
app.post('/delete-guest-pending', (req, res) => {
    const guestId = req.body.guestId;

    if (!guestId) {
        return res.status(400).json({ success: false, message: 'No guest ID provided' });
    }

    db.serialize(() => {
        db.run('DELETE FROM guest_pending_items WHERE order_id IN (SELECT id FROM guest_pending WHERE guest_id = ?)', [guestId], function(err) {
            if (err) {
                console.error('Error deleting from guest_pending_items:', err);
                return res.status(500).json({ success: false, message: 'Failed to delete from guest_pending_items' });
            }

            db.run('DELETE FROM guest_pending WHERE guest_id = ?', [guestId], function(err) {
                if (err) {
                    console.error('Error deleting from guest_pending:', err);
                    return res.status(500).json({ success: false, message: 'Failed to delete from guest_pending' });
                }

                db.run('DELETE FROM guests WHERE id = ?', [guestId], function(err) {
                    if (err) {
                        console.error('Error deleting from guests:', err);
                        return res.status(500).json({ success: false, message: 'Failed to delete from guests' });
                    }

                    res.json({ success: true, message: 'Successfully deleted selected rows from guests, guest pending and guest pending items' });
                });
            });
        });
    });
});
app.get('/all-completed-orders', (req, res) => {
    // Modify the query to remove date filtering
    const query = `
        SELECT co.*, w.name as waiter_name, c.name as chef_name, g.name as guest_name
        FROM completed_orders co
        LEFT JOIN waiters w ON co.waiter_id = w.id
        LEFT JOIN chefs c ON co.chef_id = c.id
        LEFT JOIN guests g on co.guest_id = g.id
        ORDER BY co.completion_timestamp DESC`; // Sort by most recent first

    db.all(query, [], (err, orders) => {
        if (err) {
            console.error('Error fetching completed orders:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch completed orders' });
        }

        const orderPromises = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM completed_order_items WHERE order_id = ?',
                    [order.id],
                    (err, items) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`Fetched items for order ${order.id}:`, items); // Log the fetched items
                            order.items = items;
                            order.total = items.reduce((sum, item) =>
                                sum + (item.price * item.quantity), 0);
                            resolve(order);
                        }
                    });
            });
        });

        Promise.all(orderPromises)
            .then(ordersWithItems => {
                console.log('All orders with items:', ordersWithItems); // Log all orders with items
                res.json({ success: true, orders: ordersWithItems });
            })
            .catch(error => {
                console.error('Error fetching completed order items:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch completed order items'
                });
            });
    });
});


app.get('/completed-orders', (req, res) => {
    // Get today's date at midnight (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Modify the query to include date filtering
    const query = `
        SELECT co.*, w.name as waiter_name, c.name as chef_name, g.name as guest_name
        FROM completed_orders co
        LEFT JOIN waiters w ON co.waiter_id = w.id
        LEFT JOIN chefs c ON co.chef_id = c.id
        LEFT JOIN guests g on co.guest_id = g.id
        WHERE DATE(co.completion_timestamp) = DATE('now')
        ORDER BY co.completion_timestamp DESC`; // Sort by most recent first

    db.all(query, [], (err, orders) => {
        if (err) {
            console.error('Error fetching completed orders:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch completed orders' });
        }

        const orderPromises = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM completed_order_items WHERE order_id = ?', 
                    [order.id], 
                    (err, items) => {
                        if (err) {
                            reject(err);
                        } else {
                            order.items = items;
                            order.total = items.reduce((sum, item) => 
                                sum + (item.price * item.quantity), 0);
                            resolve(order);
                        }
                    });
            });
        });

        Promise.all(orderPromises)
            .then(ordersWithItems => {
                res.json({ success: true, orders: ordersWithItems });
            })
            .catch(error => {
                console.error('Error fetching completed order items:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Failed to fetch completed order items' 
                });
            });
    });
});
// Fetch orders by waiter
app.get('/orders-by-waiter/:waiterId', (req, res) => {
    const waiterId = req.params.waiterId;
    db.all(`SELECT lo.*, w.name as waiter_name FROM live_orders lo
            LEFT JOIN waiters w ON lo.waiter_id = w.id
            WHERE lo.waiter_id = ?`, [waiterId], (err, orders) => {
        if (err) {
            console.error('Error fetching orders by waiter:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch orders by waiter' });
        }

        const orderPromises = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM live_order_items WHERE order_id = ?', [order.id], (err, items) => {
                    if (err) {
                        reject(err);
                    } else {
                        order.items = items;
                        order.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        resolve(order);
                    }
                });
            });
        });

        Promise.all(orderPromises)
            .then(ordersWithItems => {
                res.json({ success: true, orders: ordersWithItems });
            })
            .catch(error => {
                console.error('Error fetching order items:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch order items' });
            });
    });
});
app.post('/check-waiter', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT id, name FROM waiters WHERE name = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            console.error('Error checking waiter credentials:', err);
            res.status(500).send({ success: false, message: 'Internal Server Error' });
        } else if (row) {
            res.send({ success: true, message: 'Valid credentials', waiterId: row.id, waiterName: row.name });
        } else {
            res.send({ success: false, message: 'Invalid credentials' });
        }
    });
});

// Fetch orders by meal
app.get('/orders-by-meal/:mealId', (req, res) => {
    const mealId = req.params.mealId;
    db.all(`SELECT lo.*, w.name as waiter_name FROM live_orders lo
            LEFT JOIN waiters w ON lo.waiter_id = w.id
            JOIN live_order_items loi ON lo.id = loi.order_id
            WHERE loi.meal_id = ?`, [mealId], (err, orders) => {
        if (err) {
            console.error('Error fetching orders by meal:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch orders by meal' });
        }

        const orderPromises = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM live_order_items WHERE order_id = ?', [order.id], (err, items) => {
                    if (err) {
                        reject(err);
                    } else {
                        order.items = items;
                        order.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        resolve(order);
                    }
                });
            });
        });

        Promise.all(orderPromises)
            .then(ordersWithItems => {
                res.json({ success: true, orders: ordersWithItems });
            })
            .catch(error => {
                console.error('Error fetching order items:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch order items' });
            });
    });
});
// Complete order route
app.post('/complete-order/:id', (req, res) => {
    const orderId = req.params.id;
    const completionTimestamp = new Date().toISOString();

    db.get('SELECT * FROM live_orders WHERE id = ?', [orderId], (err, order) => {
        if (err) {
            console.error('Error fetching order:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch order' });
        }

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderTimestamp = new Date(order.timestamp);
        const timeTaken = Math.floor((new Date(completionTimestamp) - orderTimestamp) / 1000); // Time taken in seconds

        db.run(`INSERT INTO completed_orders (waiter_id, chef_id, guest_id, total, order_timestamp, completion_timestamp, time_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [order.waiter_id, order.chef_id, order.guest_id, order.total, order.timestamp, completionTimestamp, timeTaken], function(err) {
            if (err) {
                console.error('Error completing order:', err);
                return res.status(500).json({ success: false, message: 'Failed to complete order' });
            }

            const completedOrderId = this.lastID;

            db.all('SELECT * FROM live_order_items WHERE order_id = ?', [orderId], (err, items) => {
                if (err) {
                    console.error('Error fetching order items:', err);
                    return res.status(500).json({ success: false, message: 'Failed to fetch order items' });
                }

                const stmt = db.prepare('INSERT INTO completed_order_items (order_id, meal_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)');
                items.forEach(item => {
                    stmt.run(completedOrderId, item.meal_id, item.name, item.price, item.quantity);
                });
                stmt.finalize();

                db.run('DELETE FROM live_orders WHERE id = ?', [orderId], (err) => {
                    if (err) {
                        console.error('Error deleting live order:', err);
                        return res.status(500).json({ success: false, message: 'Failed to delete live order' });
                    }

                    db.run('DELETE FROM live_order_items WHERE order_id = ?', [orderId], (err) => {
                        if (err) {
                            console.error('Error deleting live order items:', err);
                            return res.status(500).json({ success: false, message: 'Failed to delete live order items' });
                        }

                        res.json({ success: true, message: 'Order completed successfully' });
                    });
                });
            });
        });
    });
});
// Complete order route
app.post('/complete-order-for-guest/:id', (req, res) => {
    const orderId = req.params.id;
    const completionTimestamp = new Date().toISOString();

    db.get('SELECT * FROM live_orders WHERE id = ?', [orderId], (err, order) => {
        if (err) {
            console.error('Error fetching order:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch order' });
        }

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderTimestamp = new Date(order.timestamp);
        const timeTaken = Math.floor((new Date(completionTimestamp) - orderTimestamp) / 1000); // Time taken in seconds

        db.run(`INSERT INTO guest_pending (waiter_id, chef_id, guest_id, total, order_timestamp, completion_timestamp, time_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [order.waiter_id, order.chef_id, order.guest_id, order.total, order.timestamp, completionTimestamp, timeTaken], function(err) {
            if (err) {
                console.error('Error completing order for guest:', err);
                return res.status(500).json({ success: false, message: 'Failed to complete order for guest' });
            }

            const completedOrderId = this.lastID;

            db.all('SELECT * FROM live_order_items WHERE order_id = ?', [orderId], (err, items) => {
                if (err) {
                    console.error('Error fetching order items:', err);
                    return res.status(500).json({ success: false, message: 'Failed to fetch order items' });
                }

                const stmt = db.prepare('INSERT INTO guest_pending_items (order_id, meal_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)');
                items.forEach(item => {
                    stmt.run(completedOrderId, item.meal_id, item.name, item.price, item.quantity);
                });
                stmt.finalize();

                db.run('DELETE FROM live_orders WHERE id = ?', [orderId], (err) => {
                    if (err) {
                        console.error('Error deleting live order:', err);
                        return res.status(500).json({ success: false, message: 'Failed to delete live order' });
                    }

                    db.run('DELETE FROM live_order_items WHERE order_id = ?', [orderId], (err) => {
                        if (err) {
                            console.error('Error deleting live order items:', err);
                            return res.status(500).json({ success: false, message: 'Failed to delete live order items' });
                        }

                        res.json({ success: true, message: 'Order completed successfully for guest' });
                    });
                });
            });
        });
    });
});

// Fetch meals by category and optional subcategory
app.get('/meals/:categoryId/:subcategoryId?', (req, res) => {
    const { categoryId, subcategoryId } = req.params;
    let query = 'SELECT * FROM meals WHERE category_id = ?';
    const params = [categoryId];

    if (subcategoryId) {
        query += ' AND subcategory_id = ?';
        params.push(subcategoryId);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching meals:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch meals' });
        }
        res.json({ success: true, meals: rows });
    });
});

// Add chef route
app.post('/add-chef', (req, res) => {
    const { name } = req.body;
    db.run('INSERT INTO chefs (name) VALUES (?)', [name], function(err) {
        if (err) {
            console.error('Error adding chef:', err);
            return res.status(500).json({ success: false, message: 'Failed to add chef' });
        }
        res.json({ success: true, message: 'Chef added successfully' });
    });
});

// Fetch chefs
app.get('/chefs', (req, res) => {
    db.all('SELECT * FROM chefs', (err, rows) => {
        if (err) {
            console.error('Error fetching chefs:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch chefs' });
        }
        res.json({ success: true, chefs: rows });
    });
});

// Delete waiter route
app.delete('/delete-waiter/:id', (req, res) => {
    const waiterId = req.params.id;
    db.run('DELETE FROM waiters WHERE id = ?', [waiterId], function(err) {
        if (err) {
            console.error('Error deleting waiter:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete waiter' });
        }
        res.json({ success: true, message: 'Waiter deleted successfully' });
    });
});

// Delete chef route
app.delete('/delete-chef/:id', (req, res) => {
    const chefId = req.params.id;
    db.run('DELETE FROM chefs WHERE id = ?', [chefId], function(err) {
        if (err) {
            console.error('Error deleting chef:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete chef' });
        }
        res.json({ success: true, message: 'Chef deleted successfully' });
    });
});

// Delete category route
app.delete('/delete-category/:id', (req, res) => {
    const categoryId = req.params.id;
    db.run('DELETE FROM categories WHERE id = ?', [categoryId], function(err) {
        if (err) {
            console.error('Error deleting category:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete category' });
        }
        res.json({ success: true, message: 'Category deleted successfully' });
    });
});

// Delete subcategory route
app.delete('/delete-subcategory/:id', (req, res) => {
    const subcategoryId = req.params.id;
    db.run('DELETE FROM subcategories WHERE id = ?', [subcategoryId], function(err) {
        if (err) {
            console.error('Error deleting subcategory:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete subcategory' });
        }
        res.json({ success: true, message: 'Subcategory deleted successfully' });
    });
});

// Delete meal route
app.delete('/delete-meal/:id', (req, res) => {
    const mealId = req.params.id;
    db.run('DELETE FROM meals WHERE id = ?', [mealId], function(err) {
        if (err) {
            console.error('Error deleting meal:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete meal' });
        }
        res.json({ success: true, message: 'Meal deleted successfully' });
    });
});

// Fetch all meals
app.get('/meals', (req, res) => {
    db.all('SELECT * FROM meals', (err, rows) => {
        if (err) {
            console.error('Error fetching all meals:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch meals' });
        }
        res.json({ success: true, meals: rows });
    });
});

// Fetch captains
app.get('/captains', (req, res) => {
    db.all('SELECT id, username, password FROM users WHERE role = ?', ['captain'], (err, rows) => {
        if (err) {
            console.error('Error fetching captains:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch captains' });
        }
        res.json({ success: true, captains: rows });
    });
});

// Delete captain route
app.delete('/delete-captain/:id', (req, res) => {
    const captainId = req.params.id;
    db.run('DELETE FROM users WHERE id = ? AND role = ?', [captainId, 'captain'], function(err) {
        if (err) {
            console.error('Error deleting captain:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete captain' });
        }
        res.json({ success: true, message: 'Captain deleted successfully' });
    });
});
app.listen(port,() => {
    const bonjour = new Bonjour();
    const service = bonjour.publish({
        name: 'dym',
        type: 'http',
        port: port
    });

    service.on('up', () => {
        console.log('Bonjour service is up and running');
    });

    console.log(`Server running at http://localhost:${port}`);
});


app.get('/analysis-data', (req, res) => {
    const selectedDate = req.query.date;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let startOfDay, endOfDay;

    if (selectedDate) {
        startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
    } else if (startDate && endDate) {
        startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
    } else {
        return res.status(400).json({ success: false, message: 'Invalid date parameters' });
    }

    db.all(`
        SELECT c.name as category_name, sc.name as subcategory_name, m.name as meal_name, 
               SUM(coi.quantity) as quantity, SUM(coi.price * coi.quantity) as total_price
        FROM completed_orders co
        JOIN completed_order_items coi ON co.id = coi.order_id
        JOIN meals m ON coi.meal_id = m.id
        LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
        JOIN categories c ON m.category_id = c.id
        WHERE co.order_timestamp BETWEEN ? AND ?
        GROUP BY c.name, sc.name, m.name
    `, [startOfDay.toISOString(), endOfDay.toISOString()], (err, rows) => {
        if (err) {
            console.error('Error fetching analysis data:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch analysis data' });
        }

        const categories = {};
        rows.forEach(row => {
            if (!categories[row.category_name]) {
                categories[row.category_name] = { name: row.category_name, subcategories: {} };
            }
            const category = categories[row.category_name];

            if (!category.subcategories[row.subcategory_name]) {
                category.subcategories[row.subcategory_name] = { 
                    name: row.subcategory_name, 
                    meals: [],
                    totalQuantity: 0,
                    totalPrice: 0
                };
            }
            const subcategory = category.subcategories[row.subcategory_name];

            const meal = {
                name: row.meal_name,
                quantity: row.quantity,
                totalPrice: row.total_price,
                unitPrice: row.total_price / row.quantity
            };

            subcategory.meals.push(meal);
            subcategory.totalQuantity += row.quantity;
            subcategory.totalPrice += row.total_price;
        });

        // Add total row for each subcategory
        Object.values(categories).forEach(category => {
            Object.values(category.subcategories).forEach(subcategory => {
                subcategory.meals.push({
                    name: 'Total',
                    quantity: subcategory.totalQuantity,
                    totalPrice: subcategory.totalPrice,
                    unitPrice: subcategory.totalPrice / subcategory.totalQuantity
                });
            });
        });

        res.json({ success: true, categories: categories });
    });
});

function parseCustomDate(dateString) {
    // Check if the dateString is in ISO 8601 format
    if (dateString.includes('T')) {
        return new Date(dateString); // Directly parse ISO 8601 format
    }

    // Existing parsing logic for custom format
    const [datePart, timePart] = dateString.split(', ');

    if (!timePart) {
        console.error('Invalid date string format:', dateString);
        return null; // or handle the error as needed
    }

    const [time, period] = timePart.split(' ');
    let [hours, minutes, seconds] = time.split(':').map(Number);

    if (period === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }

    const [month, day, year] = datePart.split('/').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
}

// Update the daily summary route in server.js
app.get('/daily-summary', (req, res) => {
    const requestedDate = req.query.date ? new Date(req.query.date) : new Date();
    requestedDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(requestedDate);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log('Requested date:', requestedDate.toISOString());
    console.log('Next day:', nextDay.toISOString());

    const query = `
        SELECT co.id, co.time_taken, c.name as chef_name, w.name as waiter_name,
               SUM(coi.price * coi.quantity) as calculated_total,
               json_group_array(json_object('name', m.name, 'quantity', coi.quantity, 'price', coi.price)) as meals
        FROM completed_orders co
        JOIN chefs c ON co.chef_id = c.id
        JOIN waiters w ON co.waiter_id = w.id
        JOIN completed_order_items coi ON co.id = coi.order_id
        JOIN meals m ON coi.meal_id = m.id
        WHERE co.completion_timestamp >= ? AND co.completion_timestamp < ?
        GROUP BY co.id
        ORDER BY co.completion_timestamp DESC
    `;

    db.all(query, [requestedDate.toISOString(), nextDay.toISOString()], (err, rows) => {
        if (err) {
            console.error('Error fetching daily summary:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch daily summary' });
        }

        console.log('Raw database results:', rows);

        const orders = rows.map(row => ({
            ...row,
            meals: JSON.parse(row.meals),
            calculated_total: parseFloat(row.calculated_total) || 0
        }));

        console.log('Processed orders:', orders);

        res.json({ success: true, orders: orders });
    });
});

// Add this new table to your database schema
db.run(`CREATE TABLE IF NOT EXISTS meal_completion_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    meal_id INTEGER,
    is_completed BOOLEAN,
    FOREIGN KEY (order_id) REFERENCES live_orders (id),
    FOREIGN KEY (meal_id) REFERENCES meals (id)
)`);

// Add a new route to update meal completion status
app.post('/update-meal-status', (req, res) => {
    const { orderId, mealId, isCompleted } = req.body;
    if (isCompleted) {
        // If checked, insert or update the status
        db.run('INSERT OR REPLACE INTO meal_completion_status (order_id, meal_id, is_completed) VALUES (?, ?, 1)',
            [orderId, mealId],
            function(err) {
                if (err) {
                    console.error('Error updating meal status:', err);
                    return res.status(500).json({ success: false, message: 'Failed to update meal status' });
                }
                res.json({ success: true, message: 'Meal status updated successfully' });
            }
        );
    } else {
        // If unchecked, remove the status entry
        db.run('DELETE FROM meal_completion_status WHERE order_id = ? AND meal_id = ?',
            [orderId, mealId],
            function(err) {
                if (err) {
                    console.error('Error removing meal status:', err);
                    return res.status(500).json({ success: false, message: 'Failed to remove meal status' });
                }
                res.json({ success: true, message: 'Meal status removed successfully' });
            }
        );
    }
});

// Modify the existing route to fetch live orders to include meal completion status and meal filter
app.get('/live-orders', (req, res) => {
    const mealId = req.query.mealId; // Get the mealId from query parameters
    let query = `SELECT DISTINCT lo.*, w.name as waiter_name, c.name as chef_name 
                 FROM live_orders lo
                 LEFT JOIN waiters w ON lo.waiter_id = w.id
                 LEFT JOIN chefs c ON lo.chef_id = c.id
                 LEFT JOIN live_order_items loi ON lo.id = loi.order_id`;
    
    let params = [];
    
    if (mealId) {
        query += ` WHERE loi.meal_id = ?`;
        params.push(mealId);
    }

    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('Error fetching live orders:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch live orders' });
        }

        const orderPromises = orders.map(order => {
            return new Promise((resolve, reject) => {
                db.all(`SELECT loi.*, mcs.is_completed 
                        FROM live_order_items loi
                        LEFT JOIN meal_completion_status mcs 
                        ON loi.order_id = mcs.order_id AND loi.meal_id = mcs.meal_id
                        WHERE loi.order_id = ?`, 
                    [order.id], 
                    (err, items) => {
                        if (err) {
                            reject(err);
                        } else {
                            order.items = items.map(item => ({
                                ...item,
                                is_completed: item.is_completed === 1
                            }));
                            order.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                            resolve(order);
                        }
                    }
                );
            });
        });

        Promise.all(orderPromises)
            .then(ordersWithItems => {
                res.json({ success: true, orders: ordersWithItems });
            })
            .catch(error => {
                console.error('Error fetching order items:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch order items' });
            });
    });
});

// Add this new route to verify admin credentials and cancel the order
app.post('/verify-admin-and-cancel-order', (req, res) => {
    const { orderId, username, password } = req.body;

    // First, verify the admin credentials
    db.get('SELECT * FROM users WHERE username = ? AND password = ? AND role = ?', [username, password, 'admin'], (err, user) => {
        if (err) {
            console.error('Error verifying admin:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        // If admin credentials are valid, proceed with cancelling the order
        cancelOrder(orderId, res);
    });
});

// Function to cancel the order
function cancelOrder(orderId, res) {
    db.run('DELETE FROM live_orders WHERE id = ?', [orderId], function(err) {
        if (err) {
            console.error('Error cancelling order:', err);
            return res.status(500).json({ success: false, message: 'Failed to cancel order' });
        }

        db.run('DELETE FROM live_order_items WHERE order_id = ?', [orderId], function(err) {
            if (err) {
                console.error('Error deleting order items:', err);
                return res.status(500).json({ success: false, message: 'Failed to delete order items' });
            }

            res.json({ success: true, message: 'Order cancelled successfully' });
        });
    });
}

// Add new meal to existing order
app.post('/add-meal-to-order', (req, res) => {
    const { orderId, mealId, name, price, quantity } = req.body;

    db.run('INSERT INTO live_order_items (order_id, meal_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderId, mealId, name, price, quantity],
        function(err) {
            if (err) {
                console.error('Error adding meal to order:', err);
                return res.status(500).json({ success: false, message: 'Failed to add meal to order' });
            }

            // Update the order total
            db.run('UPDATE live_orders SET total = (SELECT SUM(price * quantity) FROM live_order_items WHERE order_id = ?) WHERE id = ?',
                [orderId, orderId],
                function(err) {
                    if (err) {
                        console.error('Error updating order total:', err);
                        return res.status(500).json({ success: false, message: 'Failed to update order total' });
                    }

                    res.json({ success: true, message: 'Meal added successfully' });
                }
            );
        }
    );
});

// Add new route for updating orders
app.post('/update-order/:id', (req, res) => {
    const orderId = req.params.id;
    const { waiter_id, chef_id, items, total } = req.body;

    // Update main order details
    db.run('UPDATE live_orders SET waiter_id = ?, chef_id = ?, total = ? WHERE id = ?',
        [waiter_id, chef_id, total, orderId],
        function(err) {
            if (err) {
                console.error('Error updating order:', err);
                return res.status(500).json({ success: false, message: 'Failed to update order' });
            }

            // Delete existing items
            db.run('DELETE FROM live_order_items WHERE order_id = ?', [orderId], function(err) {
                if (err) {
                    console.error('Error deleting existing items:', err);
                    return res.status(500).json({ success: false, message: 'Failed to update order items' });
                }

                // Insert new items
                const stmt = db.prepare('INSERT INTO live_order_items (order_id, meal_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)');
                items.forEach(item => {
                    stmt.run(orderId, item.meal_id, item.name, item.price, item.quantity);
                });
                stmt.finalize();

                res.json({ success: true, message: 'Order updated successfully' });
            });
        }
    );
});

// Add a new route to delete all completed orders
app.delete('/delete-completed-orders', (req, res) => {
    // First, delete all records from completed_order_items
    db.run('DELETE FROM completed_order_items', function(err) {
        if (err) {
            console.error('Error deleting completed order items:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete completed order items' });
        }

        // Then, delete all records from completed_orders
        db.run('DELETE FROM completed_orders', function(err) {
            if (err) {
                console.error('Error deleting completed orders:', err);
                return res.status(500).json({ success: false, message: 'Failed to delete completed orders' });
            }

            res.json({ success: true, message: 'All completed orders and their items deleted successfully' });
        });
    });
});

app.post('/add-guest', (req, res) => {
    const guestName = req.body.name;
    db.run('INSERT INTO guests (name) VALUES (?)', [guestName], function(err) {
      if (err) {
        console.error('Error adding guest:', err);
        res.status(500).json({ message: 'Error adding guest' });
      } else {
        res.json({ message: 'Guest added successfully' });
      }
    });
  });
app.get('/guests', (req, res) => {
    db.all('SELECT * FROM guests', (err, rows) => {
      if (err) {
        console.error('Error fetching guests:', err);
        res.status(500).json({ message: 'Error fetching guests' });
      } else {
        res.json(rows);
      }
    });
  });
// server.js
// server.js
app.post('/update-meal-price/:mealId', (req, res) => {
    const mealId = req.params.mealId;
    const newPrice = req.body.newPrice;
    // Update the meal price in the database
    db.run('UPDATE meals SET price = ? WHERE id = ?', [newPrice, mealId], (err) => {
        if (err) {
            console.error('Error updating meal price:', err);
            return res.status(500).json({ success: false, message: 'Failed to update meal price' });
        }
        res.json({ success: true, message: 'Meal price updated successfully' });
    });
});
app.post('/verify-admin-and-delete-guest', (req, res) => {
    const { guestId, username, password } = req.body;

    // First, verify the admin credentials
    db.get('SELECT * FROM users WHERE username = ? AND password = ? AND role = ?', [username, password, 'admin'], (err, user) => {
        if (err) {
            console.error('Error verifying admin:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        // If admin credentials are valid, proceed with deleting the guest and updating orders
        deleteGuestAndUpdateOrders(guestId, res);
    });
});
function deleteGuestAndUpdateOrders(guestId, res) {
    db.serialize(() => {
        // Update completed_orders to set guest_id to NULL for the specified guest
        db.run('UPDATE completed_orders SET guest_id = NULL WHERE guest_id = ?', [guestId], function(err) {
            if (err) {
                console.error('Error updating orders:', err);
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            // Delete the guest from the guests table
            db.run('DELETE FROM guests WHERE id = ?', [guestId], function(err) {
                if (err) {
                    console.error('Error deleting guest:', err);
                    return res.status(500).json({ success: false, message: 'Internal server error' });
                }

                res.json({ success: true, message: 'Guest and associated guest_id in orders deleted successfully' });
            });
        });
    });
}
app.post('/verify-admin-and-delete-meal', (req, res) => {
    const { mealId, username, password } = req.body;

    // First, verify the admin credentials
    db.get('SELECT * FROM users WHERE username = ? AND password = ? AND role = ?', [username, password, 'admin'], (err, user) => {
        if (err) {
            console.error('Error verifying admin:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }

        // If admin credentials are valid, proceed with deleting the meal
        deleteMeal(mealId, res);
    });
});

function deleteMeal(mealId, res) {
    console.log(mealId)
    db.run('DELETE FROM completed_order_items WHERE id = ?', [mealId], function(err) {
        if (err) {
            console.error('Error deleting meal:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        res.json({ success: true, message: 'Meal deleted successfully' });
    });
}

