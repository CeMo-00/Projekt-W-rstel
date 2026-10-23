require("dotenv").config();

const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/bilder", express.static(path.join(__dirname, "bilder")));

async function startServer() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ client }),
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 3600000
        }
    }));

    app.get("/admin-login", (req, res) => {
        if (req.session.admin) return res.redirect("/veranstaltungen");
        res.sendFile(path.join(__dirname, "admin-login.html"));
    });

    app.get("/", (req, res) =>
        res.sendFile(path.join(__dirname, "startseite.html"))
    );

    for (const datei of [
        "startseite.html", "speisekarte.html",
        "veranstaltungen.html", "impressum.html",
        "style.css", "script.js"
    ]) {
        app.get("/" + datei, (req, res) =>
            res.sendFile(path.join(__dirname, datei))
        );
    }

    app.get("/speisekarte", (req, res) =>
        res.sendFile(path.join(__dirname, "speisekarte.html"))
    );

    app.get("/veranstaltungen", (req, res) =>
        res.sendFile(path.join(__dirname, "veranstaltungen.html"))
    );

    app.get("/impressum", (req, res) =>
        res.sendFile(path.join(__dirname, "impressum.html"))
    );

    app.post("/api/login", async (req, res) => {
        const { username, password } = req.body;
        const admin = await db.collection("admins").findOne({
            username: username?.trim()
        });

        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
            return res.status(401).json({
                message: "Benutzername oder Passwort falsch."
            });
        }

        req.session.regenerate(err => {
            if (err) return res.sendStatus(500);
            req.session.admin = admin.username;
            req.session.save(err => {
                if (err) return res.sendStatus(500);
                res.json({ success: true });
            });
        });
    });

    app.get("/api/login-status", (req, res) => {
        res.json({ loggedIn: Boolean(req.session.admin) });
    });

    app.post("/api/logout", (req, res) => {
        req.session.destroy(err => {
            if (err) return res.sendStatus(500);
            res.clearCookie("connect.sid");
            res.json({ success: true });
        });
    });

    app.listen(PORT, () =>
        console.log(`Website läuft auf http://localhost:${PORT}`)
    );
}

startServer().catch(console.error);