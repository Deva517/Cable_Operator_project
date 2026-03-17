const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database("./database.db");


// ✅ MIDNIGHT RESET LOGIC
function resetOperators() {
    db.run(`
        UPDATE operators
        SET jobs_today = 0,
            status = 'Available'
    `);

    console.log("Operators reset at midnight");
}

function scheduleMidnightReset() {

    const now = new Date();

    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // next 12 AM

    const timeUntilMidnight = midnight - now;

    console.log("Next reset in ms:", timeUntilMidnight);

    setTimeout(() => {
        resetOperators();

        // repeat every 24 hours
        setInterval(resetOperators, 24 * 60 * 60 * 1000);

    }, timeUntilMidnight);
}

// start scheduler
scheduleMidnightReset();


// USERS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT,
    login_time TEXT
)
`);


// OPERATORS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    status TEXT,
    jobs_today INTEGER,
    distance TEXT
)
`);


// Default operators
db.run(`
INSERT OR IGNORE INTO operators (id, name, phone, status, jobs_today, distance)
VALUES
(1,'Ramesh','9876543210','Available',2,'2km'),
(2,'Suresh','9123456780','Available',1,'5km'),
(3,'Mahesh','9012345678','Available',0,'3km')
`);


// JOBS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS jobs (
    job_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT,
    operator TEXT,
    problem TEXT,
    status TEXT,
    time TEXT
)
`);


// ROOT PAGE → LOGIN PAGE
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "loginpage.html"));
});


// LOGIN API
app.post("/login", (req, res) => {

    const phone = req.body.phone_number;
    const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
});
    db.run(
        "INSERT INTO users (phone_number, login_time) VALUES (?, ?)",
        [phone, time],
        function(err){

            if(err){
                console.log(err);
                res.send("Error storing user");
            }
            else{
                res.send("Login stored successfully");
            }

        }
    );

});


// GET OPERATORS
app.get("/operators", (req, res) => {

    db.all("SELECT * FROM operators", [], (err, rows) => {

        if(err){
            console.log(err);
            res.send("Error fetching operators");
        }
        else{
            res.json(rows);
        }

    });

});


// CREATE JOB
app.post("/create-job", (req, res) => {

    const user_phone = req.body.user_phone;
    const operator = req.body.operator;
    const problem = req.body.problem;

    const status = "Pending";
    const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
});

    db.run(
        "INSERT INTO jobs (user_phone, operator, problem, status, time) VALUES (?, ?, ?, ?, ?)",
        [user_phone, operator, problem, status, time],
        function(err){

            if(err){
                console.log(err);
                res.send("Error creating job");
            }
            else{

                const newJobId = this.lastID;

                db.run(
                    "UPDATE operators SET jobs_today = jobs_today + 1 WHERE name = ?",
                    [operator]
                );

                db.run(
                    "UPDATE operators SET status = 'Busy' WHERE name = ? AND jobs_today >= 5",
                    [operator]
                );

                res.json({
                    message:"Job created",
                    job_id:newJobId
                });

            }

        }
    );

});


// UPDATE JOB STATUS
app.post("/update-job-status", (req, res) => {

    const job_id = req.body.job_id;
    const status = req.body.status;

    db.run(
        "UPDATE jobs SET status = ? WHERE job_id = ?",
        [status, job_id],
        function(err){

            if(err){
                console.log(err);
                res.send("Error updating job status");
            }
            else{
                res.send("Job status updated successfully");
            }

        }
    );

});


// RESET SYSTEM (manual)
app.get("/reset-data", (req, res) => {

    db.run("DELETE FROM jobs", function(err) {

        if (err) {
            console.log(err);
            res.send("Error deleting jobs");
        } 
        else {

            db.run(
                "UPDATE operators SET jobs_today = 0, status = 'Available'",
                function(err){

                    if(err){
                        res.send("Error resetting operators");
                    }else{
                        res.send("System reset successfully");
                    }

                }
            );

        }

    });

});


// GET ALL JOBS
app.get("/jobs", (req, res) => {

    db.all("SELECT * FROM jobs ORDER BY job_id DESC", [], (err, rows) => {

        if(err){
            console.log(err);
            res.send("Error fetching jobs");
        }
        else{
            res.json(rows);
        }

    });

});


// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
