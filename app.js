const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Set up session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// MySQL connection
const db = mysql.createConnection({
    host: '9wz5oz.h.filess.io',
    user: 'c237ca2database_spiritcow',
    port: 61002,
    password: '4d538490cf48da9084d4caceccbbf7121a587270',
    database: 'c237ca2database_spiritcow',
    ssl: false
});
db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL');
});

// Utility: Password hashing
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Middleware for role check
function isAdmin(req, res, next) {
    if (req.session.currentUser && req.session.currentUser.role === 'admin') {
        next();
    } else {
        res.status(403).send('Admins only');
    }
}
function isUser(req, res, next) {
    if (req.session.currentUser) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Multer storage setup for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // This keeps the extension
    }
});
const upload = multer({ storage: storage });

// ----------- ROUTES -----------

// Home page
app.get('/', (req, res) => {
    if (req.session.currentUser && req.session.currentUser.role === 'admin') {
        db.query('SELECT * FROM users', (err, users) => {
            if (err) return res.status(500).send(err);
            res.render('index', { currentUser: req.session.currentUser, users });
        });
    } else {
        res.render('index', { currentUser: req.session.currentUser });
    }
});

// Register
app.get('/register', (req, res) => {
    res.render('register', { messages: [], errors: [], formData: {} });
});
app.post('/register', (req, res) => {
    const { username, email, contact, password, confirm_password, role } = req.body;
    if (!password || password.length < 6) {
        return res.render('register', { messages: [], errors: ['Password must be 6 or more characters.'], formData: req.body }); // Password length check
    }
    if (password !== confirm_password) {
        return res.render('register', { messages: [], errors: ['Passwords do not match.'], formData: req.body });
    }
    // Check for duplicate email or username
    db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], (err, results) => { // Check for existing users
        if (err) return res.render('register', { messages: [], errors: ['Database error: ' + err.sqlMessage], formData: req.body }); // Handle database errors
        if (results.length > 0) {
            const errors = [];
            if (results.some(u => u.email === email)) errors.push('Email already exists.');
            if (results.some(u => u.username === username)) errors.push('Username already exists.');
            return res.render('register', { messages: [], errors, formData: req.body });
        }
        const hashedPassword = hashPassword(password);
        db.query(
            'INSERT INTO users (username, email, contact, password, confirm_password, role) VALUES (?, ?, ?, ?, ?, ?)', // Insert new user
            [username, email, contact, hashedPassword, hashedPassword, role || 'user'], // Default role to 'user' if not specified
            (err, result) => {
                if (err) return res.render('register', { messages: [], errors: ['Registration failed: ' + err.sqlMessage], formData: req.body });// Handle insertion errors
                res.redirect('/login');
            }
        );
    });
});

// Login/Logout
app.get('/login', (req, res) => {
    res.render('login', { errors: [], messages: [] });
});
app.post('/login', (req, res) => {
    const { identifier, password } = req.body; // Use identifier for both username and email
    db.query(
        'SELECT * FROM users WHERE username = ? OR email = ?', // Check for user by username or email
        [identifier, identifier],
        (err, results) => {
            if (err) return res.status(500).send(err); // Handle database errors
            if (results.length === 0) return res.render('login', { errors: ['Invalid credentials'], messages: [] });// No user found
            const user = results[0]; // Use the first result
            const hashedPassword = hashPassword(password); // Hash the input password
            if (hashedPassword !== user.password) return res.render('login', { errors: ['Invalid credentials'], messages: [] });
            req.session.currentUser = user;
            res.redirect('/');
        }
    );
});
app.get('/logout', (req, res) => { // Logout route
    req.session.currentUser = null; 
    res.redirect('/');
});

// GET profile page (view profile form)
app.get('/profile', isUser, (req, res) => {
    const userId = req.session.currentUser.id;

    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0) return res.status(404).send('User not found');

        const profile = results[0];
        // If no image uploaded, use default
        if (!profile.profile_image) profile.profile_image = '/images/default.jpg';

        res.render('profile', {
            profile,
            error: null,
            success: null
        });
    });
});

// Profile Update with Avatar Upload
app.post('/profile', isUser, upload.single('profile_image'), (req, res) => {
    const userId = req.session.currentUser.id;

    // Extract form fields safely
    const { username, email, contact, password, confirmPassword } = req.body || {};

    // Validate required fields
    if (!username || !email || !contact || !password || !confirmPassword) {
        return res.status(400).send('Form submission error. Missing fields.');
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        // Re-render with error message
        return db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) return res.status(500).send(err);
            const profile = results[0];
            res.render('profile', { profile, error: 'Passwords do not match.', success: null });
        });
    }

    // Hash the password
    const hashedPassword = hashPassword(password);

    // Get uploaded image or fallback to existing session image
    const profileImage = req.file ? '/images/' + req.file.filename : req.session.currentUser.profile_image;

    // Update user in database
    db.query(
        'UPDATE users SET username=?, email=?, contact=?, password=?, confirm_password=?, profile_image=? WHERE id=?',
        [username, email, contact, hashedPassword, hashedPassword, profileImage, userId],
        (err) => {
            if (err) return res.status(500).send(err);

            // Update session user data
            req.session.currentUser.username = username;
            req.session.currentUser.email = email;
            req.session.currentUser.contact = contact;
            req.session.currentUser.password = hashedPassword;
            req.session.currentUser.confirm_password = hashedPassword;
            req.session.currentUser.profile_image = profileImage;

            // Reload profile from DB for latest info
            db.query('SELECT * FROM users WHERE id = ?', [userId], (err2, results) => {
                if (err2) return res.status(500).send(err2);
                const profile = results[0];
                res.render('profile', {
                    profile,
                    error: null,
                    success: 'Profile updated successfully!'
                });
            });
        }
    );
});

// Food Entries (User)
app.get('/food', isUser, (req, res) => {
    const { search, sort } = req.query;
    let sql = 'SELECT * FROM food_entries WHERE username = ?';
    let params = [req.session.currentUser.username];

    if (search) {
        sql += ' AND food_name LIKE ?';
        params.push('%' + search + '%');
    }

    if (sort === 'calories_in') {
        sql += ' ORDER BY calories_in DESC';
    } else if (sort === 'calories_out') {
        sql += ' ORDER BY calories_out DESC';
    } else {
        sql += ' ORDER BY id DESC';
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.render('viewFood', { foods: results, search, sort });
    });
});
app.post('/food', isUser, upload.single('image'), (req, res) => {
    const { food_name, calories_in, calories_out } = req.body;
    const image = req.file ? '/images/' + req.file.filename : null;
    db.query(
        'INSERT INTO food_entries (username, food_name, image, calories_in, calories_out) VALUES (?, ?, ?, ?, ?)',
        [req.session.currentUser.username, food_name, image, calories_in, calories_out],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.redirect('/food');
        }
    );
});
app.get('/addFood', isUser, (req, res) => {
    res.render('addFood', { currentUser: req.session.currentUser });
});
app.get('/food/:id/edit', isUser, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM food_entries WHERE id=? AND username=?', [id, req.session.currentUser.username], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0) return res.status(404).send('Food entry not found');
        res.render('editFood', { food: results[0], currentUser: req.session.currentUser });
    });
});
app.post('/food/:id/edit', isUser, upload.single('image'), (req, res) => {
    const id = req.params.id;
    const { food_name, calories_in, calories_out } = req.body;
    if (req.file) {
        const image = '/images/' + req.file.filename;
        db.query(
            'UPDATE food_entries SET food_name=?, image=?, calories_in=?, calories_out=? WHERE id=? AND username=?',
            [food_name, image, calories_in, calories_out, id, req.session.currentUser.username],
            (err, result) => {
                if (err) return res.status(500).send(err);
                res.redirect('/food');
            }
        );
    } else {
        db.query(
            'UPDATE food_entries SET food_name=?, calories_in=?, calories_out=? WHERE id=? AND username=?',
            [food_name, calories_in, calories_out, id, req.session.currentUser.username],
            (err, result) => {
                if (err) return res.status(500).send(err);
                res.redirect('/food');
            }
        );
    }
});
app.get('/food/:id/delete', isUser, (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM food_entries WHERE id=? AND username=?', [id, req.session.currentUser.username], (err, result) => {
        if (err) return res.status(500).send(err);
        res.redirect('/food');
    });
});

// Food Entries (Admin)
app.get('/adminDashboard', isAdmin, (req, res) => {
    const { foodSearch, foodSort, userSearch, userSort } = req.query;

    // Users
    let userSql = 'SELECT * FROM users WHERE 1=1';
    let userParams = [];
    if (userSearch) {
        userSql += ' AND (username LIKE ? OR email LIKE ?)';
        userParams.push('%' + userSearch + '%', '%' + userSearch + '%');
    }
    if (userSort === 'username') {
        userSql += ' ORDER BY username ASC';
    } else if (userSort === 'role') {
        userSql += ' ORDER BY role ASC';
    } else {
        userSql += ' ORDER BY id ASC';
    }

    // Food Entries
    let foodSql = 'SELECT * FROM food_entries WHERE 1=1';
    let foodParams = [];
    if (foodSearch) {
        foodSql += ' AND food_name LIKE ?';
        foodParams.push('%' + foodSearch + '%');
    }
    if (foodSort === 'calories_in') {
        foodSql += ' ORDER BY calories_in DESC';
    } else if (foodSort === 'calories_out') {
        foodSql += ' ORDER BY calories_out DESC';
    } else {
        foodSql += ' ORDER BY id DESC';
    }

    db.query(userSql, userParams, (err, users) => {
        if (err) return res.status(500).send(err);
        db.query(foodSql, foodParams, (err2, foods) => {
            if (err2) return res.status(500).send(err2);
            res.render('adminDashboard', { users, foods, currentUser: req.session.currentUser, foodSearch, foodSort, userSearch, userSort });
        });
    });
});
app.get('/admin/food/:id/edit', isAdmin, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM food_entries WHERE id=?', [id], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0) return res.status(404).send('Food entry not found');
        res.render('editFood', { food: results[0], currentUser: req.session.currentUser });
    });
});
app.post('/admin/food/:id/edit', isAdmin, upload.single('image'), (req, res) => {
    const id = req.params.id;
    const { food_name, calories_in, calories_out } = req.body;
    let image = req.file ? '/images/' + req.file.filename : req.body.currentImage;

    db.query(
        'UPDATE food_entries SET food_name=?, image=?, calories_in=?, calories_out=? WHERE id=?',
        [food_name, image, calories_in, calories_out, id],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.redirect('/adminDashboard');
        }
    );
});
app.get('/admin/food/:id/delete', isAdmin, (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM food_entries WHERE id=?', [id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.redirect('/adminDashboard');
    });
});

// Admin: Delete user account
app.get('/deleteUser/:id', isAdmin, (req, res) => {
    const userId = parseInt(req.params.id, 10);
    // Prevent admin from deleting their own account
    if (userId === req.session.currentUser.id) {
        return res.status(403).send('You cannot delete your own admin account.');
    }
    db.query('DELETE FROM users WHERE id=?', [userId], (err, result) => {
        if (err) return res.status(500).send(err);
        res.redirect('/adminDashboard');
    });
});

// Admin: Edit any user (GET form)
app.get('/editAdmin/:id', isAdmin, (req, res) => {
    const userId = req.params.id;
    db.query('SELECT * FROM users WHERE id=?', [userId], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0) return res.status(404).send('User not found');
        res.render('editAdmin', { user: results[0] });
    });
});

// Admin: Edit any user (POST)
app.post('/editAdmin/:id', isAdmin, (req, res) => {
    const userId = req.params.id;
    const { username, email, role } = req.body;
    db.query(
        'UPDATE users SET username=?, email=?, role=? WHERE id=?',
        [username, email, role, userId],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.redirect('/adminDashboard');
        }
    );
});

// TEMP ROUTE: Add profile_image column if missing
app.get('/add-profile-image-column', (req, res) => {
    db.query(`ALTER TABLE users ADD COLUMN profile_image VARCHAR(255)`, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                return res.send('✅ Column already exists.');
            }
            return res.status(500).send('❌ Error: ' + err.sqlMessage);
        }
        res.send('✅ Column "profile_image" added successfully.');
    });
});

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
