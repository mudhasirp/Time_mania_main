const express = require("express");
const app = express();
const env = require("dotenv").config();
const session = require("express-session")
const passport = require("./config/passport");
const db = require("./config/db");
const path = require("path");
const nocache = require('nocache');
app.use(nocache())
const userRouter = require("./routes/userRoutes")
const adminRouter = require("./routes/adminRouter")
db();
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static(path.join(__dirname, 'public')));

app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(process.env.PORT, () => {
    console.log("Server running", process.env.PORT)
});
module.exports = app;