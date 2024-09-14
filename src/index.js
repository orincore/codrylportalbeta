const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const LogInCollection = require("./mongo"); // Employee collection
const AdminCollection = require("./adminMongo"); // Admin collection
const TimeOffRequestCollection = require('./timeOffRequestMongo'); // Time Off Request collection

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session management setup
app.use(session({
    secret: 'your-secret-key', // Replace with your actual secret key
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: "mongodb+srv://asuradkar:prasenjeet1@codryl.oogie.mongodb.net/LoginFormPractice", // Replace with your MongoDB connection string
        ttl: 14 * 24 * 60 * 60, // 14 days. This is the time-to-live for the session.
        autoRemove: 'native' // Automatically remove expired sessions.
    }),
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 14 * 24 * 60 * 60 * 1000 // Session cookie expiration time set to 14 days
    }
}));

const templatePath = path.join(__dirname, '../tempelates');
const publicPath = path.join(__dirname, '../public');
console.log(publicPath);

app.set('view engine', 'hbs');
app.set('views', templatePath);
app.use(express.static(publicPath));

// Function to create an admin user if not already exists
async function createAdminUser() {
    const username = "adarsh";
    const password = "123";

    try {
        const existingAdmin = await AdminCollection.findOne({ username });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const adminData = new AdminCollection({ username, password: hashedPassword });

            await adminData.save();
            console.log("Admin user created successfully");
        } else {
            console.log("Admin user already exists");
        }
    } catch (error) {
        console.log("Error creating admin user:", error);
    }
}

// Call the function to ensure admin user exists
createAdminUser();

// Middleware to check if user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        return next();
    } else {
        res.redirect('/');
    }
}

// Render home page for all users
app.get('/', (req, res) => {
    res.render('home');
});

// Render login page for employees
app.get('/login', (req, res) => {
    res.render('login');
});

// Handle employee login and create session
app.post('/login', async (req, res) => {
    try {
        const { employeeId, password } = req.body;

        const employee = await LogInCollection.findOne({ employeeId });

        if (employee) {
            const passwordMatch = await bcrypt.compare(password, employee.password);

            if (passwordMatch) {
                req.session.employeeId = employeeId; // Save employeeId in session
                req.session.isLoggedIn = true; // Indicate that the user is logged in
                res.redirect('/employee-dashboard'); // Redirect to employee dashboard
            } else {
                res.send("Incorrect Employee ID or password");
            }
        } else {
            res.send("Incorrect Employee ID or password");
        }
    } catch (e) {
        res.send("Login failed due to an error. Please try again.");
    }
});

// Handle employee logout and destroy session
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Render admin login page
app.get('/admin-login', (req, res) => {
    res.render('adminLogin');
});

// Handle admin login
app.post('/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await AdminCollection.findOne({ username });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);

            if (passwordMatch) {
                req.session.admin = true; // Save admin session
                req.session.isLoggedIn = true; // Indicate that the admin is logged in
                res.redirect('/admin-dashboard');
            } else {
                res.send("Incorrect Admin credentials");
            }
        } else {
            res.send("Incorrect Admin credentials");
        }
    } catch (e) {
        res.send("Login failed due to an error. Please try again.");
    }
});

// Render admin dashboard and display pending time-off requests
app.get('/admin-dashboard', ensureAuthenticated, async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin-login');
    }
    try {
        const requests = await TimeOffRequestCollection.find({ status: 'Pending' });
        res.render('adminDashboard', { requests });
    } catch (e) {
        res.status(500).send("Failed to load Time Off Requests. Please try again.");
    }
});

// Render employee dashboard
app.get('/employee-dashboard', ensureAuthenticated, async (req, res) => {
    if (!req.session.employeeId) {
        return res.redirect('/');
    }

    try {
        const employeeId = req.session.employeeId;

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to midnight for accurate date comparison

        const upcomingRequests = await TimeOffRequestCollection.find({
            employeeId: employeeId,
            startDate: { $gte: today } // Fetch requests that start from today onwards
        }).sort({ startDate: 1 });

        res.render('employeeDashboard', {
            naming: `ID: ${employeeId}`,
            upcomingRequests: upcomingRequests // Pass the fetched requests to the view
        });
    } catch (e) {
        console.error("Failed to load the dashboard.", e);
        res.status(500).send("Failed to load the dashboard. Please try again.");
    }
});

// Render the View All Time Off Requests page for employees
app.get('/view-requests', ensureAuthenticated, async (req, res) => {
    if (!req.session.employeeId) {
        return res.redirect('/');
    }

    try {
        const employeeId = req.session.employeeId;

        const requests = await TimeOffRequestCollection.find({ employeeId }).sort({ startDate: -1 }); // Sort by start date descending
        res.render('viewEmployeeRequests', { requests });
    } catch (e) {
        res.status(500).send("Failed to load Time Off Requests. Please try again.");
    }
});

// Admin route to create employee accounts
app.get('/admin/create-user', ensureAuthenticated, (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin-login');
    }
    res.render('adminCreateUser');
});

app.post('/admin/create-user', ensureAuthenticated, async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin-login');
    }
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const data = {
            firstName: req.body.firstName,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            dob: req.body.dob,
            doj: req.body.doj,
            employeeId: req.body.employeeId,
            password: hashedPassword,
            phone: req.body.phone,
            email: req.body.email,
            aadhar: req.body.aadhar,
            pan: req.body.pan,
            nationality: req.body.nationality,
            profilePic: req.body.profilePic // Assuming you have a way to handle file uploads
        };

        const checking = await LogInCollection.findOne({ employeeId: req.body.employeeId });

        if (checking) {
            res.send("User with this Employee ID already exists");
        } else {
            await LogInCollection.insertMany([data]);
            res.status(201).send("User created successfully");
        }
    } catch (e) {
        res.status(500).send("Failed to create user. Please try again.");
    }
});

// Handle Time Off Request submission by employees
app.post('/request-time-off', ensureAuthenticated, async (req, res) => {
    if (!req.session.employeeId) {
        return res.redirect('/');
    }
    try {
        const { startDate, endDate, reason } = req.body;
        const employeeId = req.session.employeeId;

        const timeOffRequest = new TimeOffRequestCollection({
            employeeId,
            startDate: new Date(startDate), // Ensure startDate is a Date object
            endDate: new Date(endDate), // Ensure endDate is a Date object
            reason,
            status: 'Pending' // Set the initial status to 'Pending'
        });

        await timeOffRequest.save();
        res.status(201).send("Time Off Request submitted successfully!");
    } catch (e) {
        res.status(500).send("Failed to submit Time Off Request. Please try again.");
    }
});

// Approve a Time Off Request by admin
app.post('/admin/approve-request', ensureAuthenticated, async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin-login');
    }
    try {
        const { requestId } = req.body;

        await TimeOffRequestCollection.findByIdAndUpdate(requestId, { status: 'Approved' });
        res.redirect('/admin-dashboard'); // Refresh the admin dashboard to show updated requests
    } catch (e) {
        res.status(500).send("Failed to approve request. Please try again.");
    }
});

// Deny a Time Off Request by admin
app.post('/admin/deny-request', ensureAuthenticated, async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin-login');
    }
    try {
        const { requestId } = req.body;

        await TimeOffRequestCollection.findByIdAndUpdate(requestId, { status: 'Denied' });
        res.redirect('/admin-dashboard'); // Refresh the admin dashboard to show updated requests
    } catch (e) {
        res.status(500).send("Failed to deny request. Please try again.");
    }
});

// Render the Request Time Off page
app.get('/request-time-off', ensureAuthenticated, (req, res) => {
    if (!req.session.employeeId) {
        return res.redirect('/');
    }
    res.render('requestTimeOff');
});

// Render and handle other pages
app.get('/time-off-leave', ensureAuthenticated, (req, res) => {
    res.render('timeOffLeave');
});

app.get('/pay', ensureAuthenticated, (req, res) => {
    res.render('pay');
});

app.get('/schedule', ensureAuthenticated, (req, res) => {
    res.render('schedule');
});

app.get('/learn', ensureAuthenticated, (req, res) => {
    res.render('learn');
});

app.get('/leadership-team', ensureAuthenticated, (req, res) => {
    res.render('leadershipTeam');
});

app.get('/job-details', ensureAuthenticated, (req, res) => {
    res.render('jobDetails');
});

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.render('dashboard');
});

// Handle updating user info
app.get('/manage-info', ensureAuthenticated, (req, res) => {
    res.render('manageInfo');
});

app.post('/manage-info', ensureAuthenticated, async (req, res) => {
    try {
        // Logic to update the user information in the database
        res.send("Profile updated successfully!");
    } catch (error) {
        res.send("Error updating profile.");
    }
});

app.listen(port, () => {
    console.log('Port connected');
});
