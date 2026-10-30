
require("dotenv").config();

const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const multer = require("multer");
const { engine } = require("express-handlebars");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;

const storage = multer.diskStorage({
    destination: path.join(__dirname, "public", "bilder"),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
    }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.engine("handlebars", engine({
    defaultLayout: "main",
    helpers: {
        eq: (a, b) => a === b
    }
}));

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

function adminAuth(req, res, next) {
    if (!req.session.admin) {
        return res.redirect("/admin-login");
    }

    next();
}

function adminApiAuth(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({
            message: "Du musst als Admin eingeloggt sein."
        });
    }

    next();
}

function datumFormatieren(datum) {
    if (!datum) return "";
    if (datum instanceof Date) {
        if (Number.isNaN(datum.getTime())) return "";
        const tag = String(datum.getUTCDate()).padStart(2, "0");
        const monat = String(datum.getUTCMonth() + 1).padStart(2, "0");
        const jahr = datum.getUTCFullYear();
        return `${tag}.${monat}.${jahr}`;
    }

    const datumText = String(datum).trim();
    const isoDatum = datumText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoDatum) {
        const [, jahr, monat, tag] = isoDatum;
        return `${tag.padStart(2, "0")}.${monat.padStart(2, "0")}.${jahr}`;
    }

    const deutschesDatum = datumText.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (deutschesDatum) {
        const [, tag, monat, jahr] = deutschesDatum;
        return `${tag.padStart(2, "0")}.${monat.padStart(2, "0")}.${jahr}`;
    }
    return datumText;
}

async function startServer() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    const db = client.db();
    const smtpKonfiguriert = Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
    );

    const mailTransporter = smtpKonfiguriert
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === "true",
            requireTLS: Number(process.env.SMTP_PORT) === 587,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        })
        : null;

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

    app.get("/", (req, res) => {
        res.render("startseite", { title: "Würstelbaron" });
    });

    app.get("/speisekarte", async (req, res) => {
        const speisen = await db.collection("speisen").find().toArray();
        res.render("speisekarte", {
            title: "Speisekarte",
            speisen,
            adminEingeloggt: !!req.session.admin
        });
    });

    app.get("/impressum", (req, res) => {
        res.render("impressum", { title: "Impressum" });
    });

    app.get("/admin-login", (req, res) => {
        res.render("admin-login", { title: "Admin-Login" });
    });

    app.get("/veranstaltungen", async (req, res) => {
        const limit = 5;
        const veranstaltungen = await db.collection("veranstaltungen")
            .find()
            .sort({ datum: -1, _id: -1 })
            .limit(limit + 1)
            .toArray();

        const weitereVorhanden = veranstaltungen.length > limit;
        veranstaltungen.length = Math.min(veranstaltungen.length, limit);
        const veranstaltungenMitFormatiertemDatum = veranstaltungen.map(v => ({
            ...v,
            datumAnzeige: datumFormatieren(v.datum)
        }));

        res.render("veranstaltungen", {
            title: "Veranstaltungen",
            veranstaltungen: veranstaltungenMitFormatiertemDatum,
            adminEingeloggt: !!req.session.admin,
            weitereVeranstaltungenVorhanden: weitereVorhanden,
            erfolg: req.query.erfolg,
            fehler: req.query.fehler
        });
    });

    app.get("/api/veranstaltungen", async (req, res) => {
        try {
            const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
            const limit = 5;

            const veranstaltungen = await db.collection("veranstaltungen")
                .find()
                .sort({ datum: -1, _id: -1 })
                .skip(skip)
                .limit(limit + 1)
                .toArray();

            const weitereVorhanden = veranstaltungen.length > limit;
            veranstaltungen.length = Math.min(veranstaltungen.length, limit);
            const veranstaltungenMitFormatiertemDatum = veranstaltungen.map(v => ({
                ...v,
                datumAnzeige: datumFormatieren(v.datum)
            }));

            res.json({
                veranstaltungen: veranstaltungenMitFormatiertemDatum,
                weitereVorhanden
            });
        } catch (fehler) {
            console.error("Veranstaltungen konnten nicht geladen werden:", fehler);
            res.status(500).json({
                message: "Veranstaltungen konnten nicht geladen werden."
            });
        }
    });

    app.post("/veranstaltungen/erstellen", adminAuth, upload.single("bild"), async (req, res) => {
        const { titel, datum, beschreibung } = req.body;
        const uhrzeit = String(req.body.uhrzeit || "").trim();
        if (!titel?.trim() || !datum || !beschreibung?.trim()) {
            return res.redirect("/veranstaltungen?fehler=Bitte+alle+Pflichtfelder+ausfüllen");
        }

        await db.collection("veranstaltungen").insertOne({
            titel: titel.trim(),
            datum,
            uhrzeit,
            beschreibung: beschreibung.trim(),
            bild: req.file?.filename || ""
        });

        res.redirect("/veranstaltungen?erfolg=Veranstaltung+erstellt");
    });

    app.post("/veranstaltungen/:id/bearbeiten", adminAuth, upload.single("bild"), async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) {
            return res.sendStatus(400);
        }

        const { titel, datum, beschreibung } = req.body;
        const uhrzeit = String(req.body.uhrzeit || "").trim();
        if (!titel?.trim() || !datum || !beschreibung?.trim()) {
            return res.redirect("/veranstaltungen?fehler=Bitte+alle+Pflichtfelder+ausfüllen");
        }

        const aenderungen = {
            titel: titel.trim(),
            datum,
            uhrzeit,
            beschreibung: beschreibung.trim()
        };

        if (req.file) {
            aenderungen.bild = req.file.filename;
        }

        await db.collection("veranstaltungen").updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: aenderungen }
        );

        res.redirect("/veranstaltungen?erfolg=Änderungen+gespeichert");
    });

    app.post("/veranstaltungen/:id/loeschen", adminAuth, async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) {
            return res.sendStatus(400);
        }

        await db.collection("veranstaltungen").deleteOne({
            _id: new ObjectId(req.params.id)
        });

        res.redirect("/veranstaltungen?erfolg=Veranstaltung+gelöscht");
    });

    app.get("/api/bewertungen", async (req, res) => {
        try {
            const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
            const limit = 5;

            const bewertungen = await db.collection("bewertungen")
                .find()
                .sort({ erstelltAm: -1, _id: -1 })
                .skip(skip)
                .limit(limit + 1)
                .toArray();

            const weitereVorhanden = bewertungen.length > limit;
            bewertungen.length = Math.min(bewertungen.length, limit);
            res.json({
                bewertungen,
                weitereVorhanden
            });
        } catch (fehler) {
            console.error("Bewertungen konnten nicht geladen werden:", fehler);
            res.status(500).json({
                message: "Bewertungen konnten nicht geladen werden."
            });
        }
    });

    app.post("/api/bewertungen", async (req, res) => {
        try {
            const name = String(req.body.name || "").trim();
            const kommentar = String(req.body.kommentar || "").trim();
            const sterne = Number(req.body.sterne);
            if (!name || name.length > 50) {
                return res.status(400).json({
                    message: "Bitte gib einen Namen mit maximal 50 Zeichen ein."
                });
            }
            if (!kommentar || kommentar.length > 1000) {
                return res.status(400).json({
                    message: "Bitte gib einen Kommentar mit maximal 1000 Zeichen ein."
                });
            }
            if (!Number.isInteger(sterne) || sterne < 1 || sterne > 5) {
                return res.status(400).json({
                    message: "Bitte wähle eine Bewertung zwischen 1 und 5 Sternen."
                });
            }

            await db.collection("bewertungen").insertOne({
                name,
                kommentar,
                sterne,
                erstelltAm: new Date()
            });

            res.status(201).json({
                success: true,
                message: "Vielen Dank! Deine Bewertung wurde veröffentlicht."
            });
        } catch (fehler) {
            console.error("Bewertung konnte nicht gespeichert werden:", fehler);
            res.status(500).json({
                message: "Deine Bewertung konnte leider nicht gespeichert werden."
            });
        }
    });

    app.delete("/api/bewertungen/:id", adminApiAuth, async (req, res) => {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({
                    message: "Ungültige Bewertungs-ID."
                });
            }

            const ergebnis = await db.collection("bewertungen").deleteOne({
                _id: new ObjectId(req.params.id)
            });

            if (ergebnis.deletedCount === 0) {
                return res.status(404).json({
                    message: "Bewertung wurde nicht gefunden."
                });
            }

            res.json({
                success: true,
                message: "Bewertung wurde gelöscht."
            });
        } catch (fehler) {
            console.error("Bewertung konnte nicht gelöscht werden:", fehler);
            res.status(500).json({
                message: "Bewertung konnte nicht gelöscht werden."
            });
        }
    });

    app.post("/api/newsletter/anmelden", async (req, res) => {
        try {
            const email = String(req.body.email || "").trim().toLowerCase();
            const einwilligung = req.body.einwilligung === true;

            const emailMuster = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            if (!email || email.length > 254 || !emailMuster.test(email)) {
                return res.status(400).json({
                    message: "Bitte gib eine gültige E-Mail-Adresse ein."
                });
            }
            if (!einwilligung) {
                return res.status(400).json({
                    message: "Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu."
                });
            }
            if (!mailTransporter) {
                return res.status(503).json({
                    message: "Der Newsletter ist momentan nicht verfügbar. Bitte versuche es später erneut."
                });
            }

            const newsletter = db.collection("newsletter");
            const bereitsAngemeldet = await newsletter.findOne({ email });
            if (bereitsAngemeldet) {
                return res.status(409).json({
                    message: "Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet."
                });
            }

            await newsletter.insertOne({
                email,
                einwilligung: true,
                angemeldetAm: new Date()
            });

            try {
                const info = await mailTransporter.sendMail({
                    from: process.env.SMTP_FROM,
                    to: email,
                    subject: "Deine Anmeldung zum Würstelbaron-Newsletter",
                    text: `Hallo!
                    
Vielen Dank für deine Anmeldung zum Würstelbaron-Newsletter.
Du erhältst künftig Informationen zu unseren Veranstaltungen und Neuigkeiten.

Dein Würstelbaron-Team`,
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                            <h2>Willkommen beim Würstelbaron-Newsletter!</h2>
                            <p>Vielen Dank für deine Anmeldung.</p>
                            <p>Du erhältst künftig Informationen zu unseren Veranstaltungen und Neuigkeiten.</p>
                            <p>Dein Würstelbaron-Team</p>
                        </div>
                    `
                });

                console.log("GMX-Versandprotokoll:", {
                    accepted: info.accepted,
                    rejected: info.rejected,
                    response: info.response,
                    messageId: info.messageId
                });
            } catch (mailFehler) {
                console.error("Newsletter-Bestätigung konnte nicht versendet werden:", mailFehler);

                return res.status(201).json({
                    success: true,
                    mailFehler: true,
                    message: "Deine Anmeldung wurde gespeichert. Die Bestätigungsmail konnte momentan leider nicht versendet werden."
                });
            }

            res.status(201).json({
                success: true,
                message: "Vielen Dank! Du bist jetzt für unseren Newsletter angemeldet. Eine Bestätigungsmail ist unterwegs."
            });
        } catch (fehler) {
            if (fehler.code === 11000) {
                return res.status(409).json({
                    message: "Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet."
                });
            }

            console.error("Newsletter-Anmeldung fehlgeschlagen:", fehler);

            res.status(500).json({
                message: "Die Anmeldung ist leider fehlgeschlagen. Bitte versuche es später erneut."
            });
        }
    });

    try {
        await db.collection("newsletter").createIndex(
            { email: 1 },
            { unique: true }
        );
    } catch (fehler) {
        console.error("Newsletter-Index konnte nicht erstellt werden:", fehler);
    }

    app.post("/api/login", async (req, res) => {
        const admin = await db.collection("admins").findOne({
            username: req.body.username?.trim()
        });

        if (!admin || !(await bcrypt.compare(req.body.password || "", admin.passwordHash))) {
            return res.status(401).json({
                message: "Benutzername oder Passwort falsch."
            });
        }

        req.session.regenerate(err => {
            if (err) {
                return res.sendStatus(500);
            }

            req.session.admin = admin.username;

            req.session.save(err => {
                if (err) {
                    return res.sendStatus(500);
                }

                res.json({ success: true });
            });
        });
    });

    app.get("/api/login-status", (req, res) => {
        res.json({ loggedIn: !!req.session.admin });
    });

    app.post("/api/logout", (req, res) => {
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.sendStatus(200);
        });
    });

    app.listen(PORT, () => {
        console.log(`Website läuft auf http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);
