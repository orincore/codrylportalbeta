const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const LogInCollection = require("./mongo"); // Employee collection
const AdminCollection = require("./adminMongo"); // Admin collection
const OtpCollection = require("./otpMongo"); // OTP collection

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session management setup with unique and complex session IDs
app.use(session({
    genid: () => {
        return crypto.randomBytes(16).toString('hex'); // Generate a unique session ID
    },
    secret: 'your-strong-secret-key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: "mongodb+srv://asuradkar:prasenjeet1@codryl.oogie.mongodb.net/LoginFormPractice",
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native'
    }),
    cookie: {
        secure: false,
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
    }
}));

const templatePath = path.join(__dirname, '../tempelates');
const publicPath = path.join(__dirname, '../public');
console.log(publicPath);

app.set('view engine', 'hbs');
app.set('views', templatePath);
app.use(express.static(publicPath));

// Ensure admin user exists
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

createAdminUser();

// Middleware to check if user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        return next();
    } else {
        res.redirect('/');
    }
}

// Render home page
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

        if (employee && await bcrypt.compare(password, employee.password)) {
            req.session.employeeId = employeeId;
            req.session.isLoggedIn = true;
            res.redirect('/employee-dashboard');
        } else {
            res.send("Incorrect Employee ID or password");
        }
    } catch (e) {
        res.send("Login failed due to an error. Please try again.");
    }
});

// Handle employee logout
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

        if (admin && await bcrypt.compare(password, admin.password)) {
            req.session.admin = true;
            req.session.isLoggedIn = true;
            res.redirect('/admin-dashboard');
        } else {
            res.send("Incorrect Admin credentials");
        }
    } catch (e) {
        res.send("Login failed due to an error. Please try again.");
    }
});

// Render admin dashboard
app.get('/admin-dashboard', ensureAuthenticated, async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin-login');
    }
    try {
        res.render('adminDashboard');
    } catch (e) {
        res.status(500).send("Failed to load the dashboard. Please try again.");
    }
});

// Render create user form and handle OTP generation
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
        const { firstName, middleName, lastName, dob, doj, employeeId, password, email, phone, aadhar, pan, nationality } = req.body;

        // Validate that email is present
        if (!email) {
            throw new Error("Email is required for OTP verification.");
        }

        // Save the data temporarily in the session and generate an OTP
        req.session.newUser = {
            firstName, middleName, lastName, dob, doj, employeeId, password, email, phone, aadhar, pan, nationality
        };

        const otp = crypto.randomBytes(3).toString('hex').toUpperCase(); // Generate a 6-digit OTP

        // Save OTP in database
        await OtpCollection.create({ email, otp });

        // Send OTP to email
        await sendOtpEmail(email, otp);

        res.redirect('/admin/verify-otp');
    } catch (e) {
        console.error("Error during user creation:", e.message);
        res.send("Failed to initiate user creation. Please try again.");
    }
});

// Render OTP verification page
app.get('/admin/verify-otp', ensureAuthenticated, (req, res) => {
    res.render('verifyOtp');
});

// Handle OTP verification and final user creation
app.post('/admin/verify-otp', ensureAuthenticated, async (req, res) => {
    try {
        const { otp } = req.body;
        const { email } = req.session.newUser;

        if (!email) {
            throw new Error("No email found in session. Cannot verify OTP.");
        }

        // Retrieve the OTP from the database
        const storedOtp = await OtpCollection.findOne({ email });

        if (storedOtp && storedOtp.otp === otp) {
            const { firstName, middleName, lastName, dob, doj, employeeId, password, phone, aadhar, pan, nationality } = req.session.newUser;

            const hashedPassword = await bcrypt.hash(password, 10);

            const data = {
                firstName, middleName, lastName, dob, doj, employeeId,
                password: hashedPassword, email, phone, aadhar, pan, nationality
            };

            const checking = await LogInCollection.findOne({ employeeId });

            if (checking) {
                res.send("User with this Employee ID already exists");
            } else {
                await LogInCollection.insertMany([data]);
                res.render('userCreatedSuccess');
            }
        } else {
            res.send("Failed to verify OTP. Please try again.");
        }
    } catch (e) {
        console.error("Error during OTP verification:", e.message);
        res.send("Failed to verify OTP. Please try again.");
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
