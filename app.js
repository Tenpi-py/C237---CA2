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
    host: 's09mjq.h.filess.io',
    user: 'c237cadb_hourmejust',
    port: 3307,
    password: '130e4657717e6ffce08ef6c11e9ba689cc77bec0',
    database: 'c237cadb_hourmejust',
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
        return res.render('register', { messages: [], errors: ['Password must be 6 or more characters.'], formData: req.body });
    }
    if (password !== confirm_password) {
        return res.render('register', { messages: [], errors: ['Passwords do not match.'], formData: req.body });
    }
    const hashedPassword = hashPassword(password);
    db.query(
        'INSERT INTO users (username, email, contact, password, confirm_password, role) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email, contact, hashedPassword, hashedPassword, role || 'user'],
        (err, result) => {
            if (err) return res.render('register', { messages: [], errors: ['Registration failed: ' + err.sqlMessage], formData: req.body });
            res.redirect('/login');
        }
    );
});

// Login/Logout
app.get('/login', (req, res) => {
    res.render('login', { errors: [], messages: [] });
});
app.post('/login', (req, res) => {
    const { identifier, password } = req.body;
    db.query(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [identifier, identifier],
        (err, results) => {
            if (err) return res.status(500).send(err);
            if (results.length === 0) return res.render('login', { errors: ['Invalid credentials'], messages: [] });
            const user = results[0];
            const hashedPassword = hashPassword(password);
            if (hashedPassword !== user.password) return res.render('login', { errors: ['Invalid credentials'], messages: [] });
            req.session.currentUser = user;
            res.redirect('/');
        }
    );
});
app.get('/logout', (req, res) => {
    req.session.currentUser = null;
    res.redirect('/');
});

// Profile
app.get('/profile', isUser, (req, res) => {
    const userId = req.session.currentUser.id;
    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) return res.status(500).send(err);
        const profile = results[0];
        res.render('profile', { profile });
    });
});
app.post('/profile', isUser, (req, res) => {
    const userId = req.session.currentUser.id;
    // Use confirm_password from the form, but confirm_password for DB
    const { username, email, contact, password, confirmPassword } = req.body;

    // Password match check
    if (password !== confirmPassword) {
        // Re-render profile page with error
        return db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
            if (err) return res.status(500).send(err);
            const profile = results[0];
            res.render('profile', { profile, error: 'Passwords do not match.' });
        });
    }

    const hashedPassword = hashPassword(password);

    db.query(
        'UPDATE users SET username=?, email=?, contact=?, password=?, confirm_password=? WHERE id=?',
        [username, email, contact, hashedPassword, hashedPassword, userId],
        (err) => {
            if (err) return res.status(500).send(err);
            // Update session info so changes reflect immediately
            req.session.currentUser.username = username;
            req.session.currentUser.email = email;
            req.session.currentUser.contact = contact;
            req.session.currentUser.password = hashedPassword;
            req.session.currentUser.confirm_password = hashedPassword;
            res.redirect('/'); // Redirect to home page after update
        }
    );
});

// Food Entries (User)
app.get('/food', isUser, (req, res) => {
    db.query('SELECT * FROM food_entries WHERE username = ?', [req.session.currentUser.username], (err, results) => {
        if (err) return res.status(500).send(err);
        res.render('viewFood', { foods: results });
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
    db.query('SELECT * FROM users', (err, users) => {
        if (err) return res.status(500).send(err);
        db.query('SELECT * FROM food_entries', (err2, foods) => {
            if (err2) return res.status(500).send(err2);
            res.render('adminDashboard', { users, foods, currentUser: req.session.currentUser });
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

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});