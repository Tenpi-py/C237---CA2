Diet Tracker App - Project Status
=================================

What's Completed
---------------
- User registration (with role selection: user/admin)
- User login/logout
- User profile update (username, email, contact, password)
- Password hashing (SHA-256)
- Password match validation on register
- Add, edit, delete food entries (with image upload)
- View food entries (user and admin)
- Admin dashboard: view all users and food entries
- Admin can edit/delete any user (except self) and any food entry
- Bootstrap styling for all pages
- Session management
- Search/Sort filtering

What's Still In Progress
------------------------
- No password match validation for profile update
- No search/filter for food entries yet
- No password reset/forgot password feature
- No pagination for food entries or users
- No user profile image/avatar

Any Blockers
------------
- No major blockers at the moment.
- All core CRUD and authentication features are working.
- If any issues arise (e.g., login not working, profile update errors), please check the server logs and ensure the database connection is active.

How to Run
----------
1. Install dependencies: `npm install`
2. Start the server: `node app.js`
3. Visit `http://localhost:3000` in your browser.

Notes
-----
- Make sure the MySQL database is running and accessible.
- Images are stored in `/public/images/`.
- Admins can only be created via registration or by editing a user in the admin dashboard.
