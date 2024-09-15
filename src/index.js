const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { AdminCollection, ManagerCollection, EmployeeCollection, Counter } = require('./mongo');
const TimeOffRequestCollection = require('./timeOffRequestMongo');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

// Multer setup for memory storage (for image upload)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session management setup
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: "mongodb+srv://asuradkar:prasenjeet1@codryl.oogie.mongodb.net/LoginFormPractice",
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native'
    }),
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 14 * 24 * 60 * 60 * 1000 // Session expiration set to 14 days
    }
}));

const templatePath = path.join(__dirname, '../templates');
const publicPath = path.join(__dirname, '../public');
const uploadsPath = path.join(__dirname, 'uploads'); // Define the path for uploads

// Set view engine and static directories
app.set('view engine', 'hbs');
app.set('views', templatePath);
app.use(express.static(publicPath));
app.use('/uploads', express.static(uploadsPath));

// Function to create an admin user if not already exists
async function createAdminUser() {
    const username = "adarsh";
    const password = "123";
    const role = "admin";
    const firstName = "Adarsh";
    const lastName = "Suradkar";
    const email = "adarsh@admin.com";

    try {
        const existingAdmin = await AdminCollection.findOne({ username });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const adminData = new AdminCollection({
                firstName,
                lastName,
                username,
                password: hashedPassword,
                email,
                employeeId: await getNextEmployeeId(),
                role,
                profilePic: '/uploads/default-admin.jpg' // Placeholder profile picture
            });
            await adminData.save();
            console.log("Admin user created successfully.");
        }
    } catch (error) {
        console.error("Error creating admin user:", error);
    }
}

// Ensure admin is created at server start
createAdminUser();

// Middleware to check if user is logged in
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.isLoggedIn) {
        return next();
    } else {
        res.redirect('/');
    }
}

// Middleware to ensure role-based access
function ensureRole(...roles) {
    return function (req, res, next) {
        if (req.session && req.session.user && roles.includes(req.session.user.role)) {
            return next();
        }
        res.status(403).send("You don't have permission to access this resource.");
    };
}

// Middleware to ensure admin-only access
function ensureAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        res.status(403).send("Access denied: Admins only.");
    }
}

// Middleware to ensure manager-only access
function ensureManager(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'manager') {
        return next();
    } else {
        res.status(403).send("Access denied: Managers only.");
    }
}

// Middleware to check if the current user can edit another user
function ensureEditPermissions(req, res, next) {
    const currentUserRole = req.session.user.role;
    const targetUserId = req.params.userId;

    if (currentUserRole === 'admin') {
        return next(); // Admins have full permissions
    } else if (currentUserRole === 'manager') {
        // Managers can only edit their assigned employees
        EmployeeCollection.findById(targetUserId, (err, targetUser) => {
            if (err || !targetUser || targetUser.manager !== req.session.user._id) {
                return res.status(403).send("You don't have permission to edit this user.");
            }
            return next();
        });
    } else {
        res.status(403).send("You don't have permission to edit this user.");
    }
}

// Home page
app.get('/', (req, res) => {
    res.render('home');
});

// Admin login page
app.get('/admin-login', (req, res) => {
    res.render('adminLogin');
});

app.get('/time-off-leave', (req, res) => {
    res.render('timeOffRequests');
});

app.get('/admin/view-requests', (req, res) => {
    res.render('viewRequests');
});

app.get('/request-time-off', (req, res) => {
    res.render('requestTimeOff');
});

app.get('/job-details', (req, res) => {
    res.render('jobDetails');
});

// Admin login logic
app.post('/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).send("Username and password are required.");
        }
        const user = await AdminCollection.findOne({ username });
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                req.session.user = { username: user.username, _id: user._id, role: user.role };
                req.session.isLoggedIn = true;
                req.session.save((err) => {
                    if (err) console.error("Session save error:", err);
                    res.redirect('/admin-dashboard');
                });
            } else {
                res.status(401).send("Incorrect admin credentials.");
            }
        } else {
            res.status(403).send("Only admins can access the admin login.");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Login failed due to an error.");
    }
});

// Admin dashboard
app.get('/admin-dashboard', ensureAdmin, async (req, res) => {
    try {
        const admin = await AdminCollection.findOne({ _id: req.session.user._id });
        const employees = await EmployeeCollection.find().populate('manager');
        res.render('adminDashboard', {
            admin, // Display admin details, including profile picture and name
            employees
        });
    } catch (error) {
        console.error("Failed to load admin dashboard.", error);
        res.status(500).send("Failed to load admin dashboard.");
    }
});

// Manager login page
app.get('/manager-login', (req, res) => {
    res.render('managerLogin');
});

// Manager login logic
app.post('/manager-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).send("Username and password are required.");
        }
        const user = await ManagerCollection.findOne({ username }) || await AdminCollection.findOne({ username });
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                req.session.user = { username: user.username, _id: user._id, role: user.role };
                req.session.isLoggedIn = true;
                req.session.save((err) => {
                    if (err) console.error("Session save error:", err);
                    res.redirect(user.role === 'admin' ? '/admin-dashboard' : '/manager-dashboard');
                });
            } else {
                res.status(401).send("Incorrect manager credentials.");
            }
        } else {
            res.status(403).send("Only managers can access the manager login.");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Login failed due to an error.");
    }
});

// Manager dashboard
app.get('/manager-dashboard', ensureManager, async (req, res) => {
    try {
        const managerId = req.session.user._id;
        const employees = await EmployeeCollection.find({ manager: managerId });
        res.render('managerDashboard', { employees });
    } catch (error) {
        console.error("Failed to load manager dashboard.", error);
        res.status(500).send("Failed to load manager dashboard.");
    }
});

// Employee login page
app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/admin/create-user', (req, res) => {
    res.render('adminCreateUser');
});

// Employee login logic
app.post('/login', async (req, res) => {
    try {
        const { employeeId, password } = req.body;
        if (!employeeId || !password) {
            return res.status(400).send("Employee ID and password are required.");
        }
        let user = await EmployeeCollection.findOne({ employeeId }) || await ManagerCollection.findOne({ employeeId }) || await AdminCollection.findOne({ employeeId });
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                req.session.user = { username: user.username || user.email, _id: user._id, role: user.role };
                req.session.isLoggedIn = true;
                req.session.save((err) => {
                    if (err) console.error("Session save error:", err);
                    res.redirect(user.role === 'admin' ? '/admin-dashboard' : user.role === 'manager' ? '/manager-dashboard' : '/employee-dashboard');
                });
            } else {
                res.status(401).send("Incorrect credentials.");
            }
        } else {
            res.status(401).send("Incorrect Employee ID or password");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Login failed due to an error.");
    }
});

// Employee dashboard
app.get('/employee-dashboard', ensureAuthenticated, async (req, res) => {
    try {
        // Fetch the employee's details using their session user ID
        const employee = await EmployeeCollection.findOne({ _id: req.session.user._id }).populate('manager');

        if (!employee) {
            return res.status(404).send('Employee not found');
        }

        // Load the manager's details from the populated 'manager' field
        const manager = employee.manager ? {
            firstName: employee.manager.firstName,
            lastName: employee.manager.lastName,
            profilePic: employee.manager.profilePic || '/uploads/default.jpg',
            designation: employee.manager.designation
        } : null;

        // Render the employee dashboard with employee and manager details
        res.render('employeeDashboard', {
            firstName: employee.firstName,
            lastName: employee.lastName,
            profilePic: employee.profilePic || '/uploads/default.jpg',
            designation: employee.designation,
            employeeId: employee.employeeId,
            username: employee.username,
            manager: manager, // Pass the manager data to the view
            upcomingRequests: employee.upcomingRequests || [] // Pass upcoming requests if any
        });
    } catch (error) {
        console.error('Error fetching employee data:', error);
        res.status(500).send('Server error');
    }
});


// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).send("Error during logout");
        }
        res.redirect('/'); // Redirect to home page after logging out
    });
});



// Function to generate a random username from firstName and lastName
function generateUsername(firstName, lastName) {
    // Take the first letter of the firstName and some random part of firstName and lastName
    const randomLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a random letter
    const firstPart = firstName.slice(0, Math.min(3, firstName.length)).toLowerCase(); // first 3 letters of firstName
    const lastPart = lastName.slice(0, Math.min(4, lastName.length)).toLowerCase(); // first 4 letters of lastName
    return `${randomLetter}${firstPart}${lastPart}`;
}

// Admin creates a new user (Admin, Manager, Employee)
app.post('/admin/create-user', ensureAdmin, upload.single('profilePic'), async (req, res) => {
    try {
        const { firstName, lastName, dob, doj, phone, email, aadhar, pan, nationality, password, designation, role } = req.body;

        if (!password) {
            return res.status(400).send("Password is required.");
        }

        // Check if the user with the same email already exists in Admin, Manager, or Employee collections
        let existingUser = await AdminCollection.findOne({ email }) || await ManagerCollection.findOne({ email }) || await EmployeeCollection.findOne({ email });

        if (existingUser) {
            return res.status(400).send("User already exists.");
        }

        // Generate a unique username
        const username = generateUsername(firstName, lastName);
        
        // Generate the next employee ID
        const employeeId = await getNextEmployeeId();
        const profilePicFilename = `${employeeId}_${firstName.toUpperCase()}_${lastName.toUpperCase()}.jpg`;
        const profilePicPath = path.join(uploadsPath, profilePicFilename);

        // Upload and compress the profile picture
        if (req.file) {
            if (!fs.existsSync(uploadsPath)) {
                fs.mkdirSync(uploadsPath, { recursive: true });
            }

            await sharp(req.file.buffer)
                .resize(200, 200)
                .jpeg({ quality: 80 }) // Compress the image
                .toFile(profilePicPath); // Save the file to the specified path
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Initialize newUser based on the role
        let newUser;
        if (role === 'admin') {
            newUser = new AdminCollection({
                firstName,
                lastName,
                username, // Include the generated username
                dob,
                doj,
                phone,
                email,
                aadhar,
                pan,
                nationality,
                password: hashedPassword,
                designation,
                role,
                profilePic: req.file ? `/uploads/${profilePicFilename}` : '/uploads/default.jpg',
                employeeId
            });
        } else if (role === 'manager') {
            newUser = new ManagerCollection({
                firstName,
                lastName,
                username, // Include the generated username
                dob,
                doj,
                phone,
                email,
                aadhar,
                pan,
                nationality,
                password: hashedPassword,
                designation,
                role,
                profilePic: req.file ? `/uploads/${profilePicFilename}` : '/uploads/default.jpg',
                employeeId
            });
        } else {
            newUser = new EmployeeCollection({
                firstName,
                lastName,
                username, // Include the generated username
                dob,
                doj,
                phone,
                email,
                aadhar,
                pan,
                nationality,
                password: hashedPassword,
                designation,
                role,
                manager: req.session.user._id, // Manager's ID
                profilePic: req.file ? `/uploads/${profilePicFilename}` : '/uploads/default.jpg',
                employeeId
            });
        }

        // Save the new user to the database
        await newUser.save();

        // Render the user creation success page
        res.render('userCreatedSuccess', { employeeId: newUser.employeeId });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).send("Error creating user.");
    }
});


// Generate next employee ID
async function getNextEmployeeId() {
    const counter = await Counter.findByIdAndUpdate(
        { _id: 'employeeId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return '2' + String(counter.seq).padStart(7, '0');
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
