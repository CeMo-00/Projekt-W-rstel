
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
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

const MAX_LOGIN_VERSUCHE = 3;
const LOGIN_SPERRE_MINUTEN = 10;
const loginVersuche = new Map();

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
        eq: (a, b) => a === b,
        preisFormatieren: preis => {
            const zahl = Number(preis);
            return Number.isFinite(zahl) ? zahl.toFixed(2).replace(".", ",") + " €" : "0,00 €";
        },
        preiseText: preise => preise
            ? preise.map(p => `${p.menge}=${String(p.preis).replace(".", ",")}`).join("; ")
            : "",
        allergeneText: allergene => allergene ? allergene.join(", ") : ""
    }
}));

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

function adminAuth(req, res, next) {
    if (!req.session.admin) return res.redirect("/admin-login");
    next();
}

function adminApiAuth(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({ message: "Du musst als Admin eingeloggt sein." });
    }
    next();
}

function datumFormatieren(datum) {
    if (!datum) return "";

    const teile = String(datum).trim().split("-");

    if (teile.length === 3) {
        return `${teile[2].padStart(2, "0")}.${teile[1].padStart(2, "0")}.${teile[0]}`;
    }

    return String(datum).trim();
}

function preiseAuslesen(text) {
    const ergebnis = [];

    String(text || "").split(";").forEach(eintrag => {
        const teile = eintrag.split("=");

        if (teile.length !== 2) return;

        const menge = teile[0].trim();
        const preis = Number(teile[1].trim().replace(",", "."));

        if (Number.isFinite(preis) && preis >= 0) {
            ergebnis.push({ menge, preis });
        }
    });

    return ergebnis;
}

function allergeneAuslesen(text) {
    return String(text || "")
        .split(",")
        .map(a => a.trim().toUpperCase())
        .filter(a => a);
}

const speisekarteStartdaten = [
    { name: "Frankfurter Hotdog", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 6.50 }], allergene: ["A", "G", "L", "M"] },
    { name: "Debreziner Hotdog", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 7.00 }], allergene: ["A", "G", "M"] },
    { name: "Käsekrainer Hotdog", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 7.50 }], allergene: ["A", "G", "M"] },
    { name: "Frankfurter mit Gebäck / mit Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "Gebäck", preis: 5.00 }, { menge: "Pommes", preis: 6.50 }], allergene: ["A", "G", "L", "M"] },
    { name: "Debreziner mit Gebäck / mit Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "Gebäck", preis: 6.00 }, { menge: "Pommes", preis: 7.50 }], allergene: ["A", "G", "M"] },
    { name: "Käsekrainer mit Gebäck / mit Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "Gebäck", preis: 7.00 }, { menge: "Pommes", preis: 8.50 }], allergene: ["A", "G", "M"] },
    { name: "Grillwurst mit Gebäck / mit Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "Gebäck", preis: 6.50 }, { menge: "Pommes", preis: 8.00 }], allergene: ["A", "G", "M"] },
    { name: "Currywurst mit Gebäck / mit Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "Gebäck", preis: 7.50 }, { menge: "Pommes", preis: 9.00 }], allergene: ["A", "L", "M", "G", "O"] },
    { name: "Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 3.80 }], allergene: ["A", "O"] },
    { name: "Schinken-Käse Toast", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 3.80 }], allergene: ["A", "G", "F", "L", "M"] },
    { name: "Käse Toast", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 3.30 }], allergene: ["A", "G"] },
    { name: "Leberkässemmel", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 3.00 }], allergene: ["A", "G", "L", "M"] },
    { name: "Käsleberkässemmel", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 3.00 }], allergene: ["A", "G", "L", "M"] },
    { name: "Bosna", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "", preis: 9.50 }], allergene: ["A", "G", "L", "M"] },
    { name: "Burenwurst mit Gebäck / mit Pommes", kategorie: "Speise", unterkategorie: "Speisen", mengenUndPreise: [{ menge: "Gebäck", preis: 6.00 }, { menge: "Pommes", preis: 7.50 }], allergene: ["A", "G", "L", "M"] },

    { name: "Coca Cola", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.10 }, { menge: "0,5 l", preis: 3.50 }] },
    { name: "Cola Zero", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.10 }, { menge: "0,5 l", preis: 3.50 }] },
    { name: "Frucade", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.10 }, { menge: "0,5 l", preis: 3.50 }] },
    { name: "Almdudler", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.10 }, { menge: "0,5 l", preis: 3.50 }] },
    { name: "Red Bull", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 3.40 }] },
    { name: "Fanta", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,33 l", preis: 3.20 }] },
    { name: "Cola", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,33 l", preis: 3.20 }] },
    { name: "Eistee Zitrone/Pfirsich", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,33 l", preis: 3.20 }] },
    { name: "Cappy", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.10 }, { menge: "0,5 l", preis: 3.50 }] },
    { name: "Alkoholfrei gespritzt", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 1.90 }, { menge: "0,5 l", preis: 3.20 }] },
    { name: "Soda Zitrone", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.10 }, { menge: "0,5 l", preis: 3.50 }] },
    { name: "Cola Zitrone", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 2.20 }, { menge: "0,5 l", preis: 3.70 }] },
    { name: "Mineral", kategorie: "Getränk", unterkategorie: "Alkoholfrei", mengenUndPreise: [{ menge: "0,25 l", preis: 1.50 }, { menge: "0,5 l", preis: 2.50 }] },

    { name: "Puntigamer Bier", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,5 l", preis: 3.80 }] },
    { name: "Puntigamer Dose (To Go)", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,5 l", preis: 3.80 }] },
    { name: "Gösser Alkoholfrei", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,5 l", preis: 3.80 }] },
    { name: "Gösser Radler", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,5 l", preis: 3.80 }] },
    { name: "Spritzer Weiß / Spritzer Rot", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,25 l", preis: 3.10 }, { menge: "0,5 l", preis: 5.10 }] },
    { name: "Teichwasser", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,25 l", preis: 2.60 }, { menge: "0,5 l", preis: 3.60 }] },
    { name: "Tiroler", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,25 l", preis: 3.20 }, { menge: "0,5 l", preis: 5.20 }] },
    { name: "Weißwein / Rotwein", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "1/8 l", preis: 2.80 }] },
    { name: "Croyff", kategorie: "Getränk", unterkategorie: "Alkoholisch", mengenUndPreise: [{ menge: "0,25 l", preis: 3.10 }, { menge: "0,5 l", preis: 5.20 }] },

    { name: "Vodka Bull", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.50 }] },
    { name: "Flying Hirsch", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 4.00 }] },
    { name: "Bacardi Cola", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.80 }] },
    { name: "Cola Rum", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.30 }] },
    { name: "Bacardi Frucade", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.80 }] },
    { name: "Klopfer", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "1 Stk.", preis: 2.50 }] },
    { name: "Marille", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "2 cl", preis: 2.50 }] },
    { name: "Vodka Soda", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.30 }] },
    { name: "Malibu Orange", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.50 }] },
    { name: "Malibu Milch", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "0,25 l", preis: 3.50 }] },
    { name: "Jägermeister", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "1 Stk.", preis: 3.00 }] },
    { name: "Berliner Luft", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "1 Stk.", preis: 3.00 }] },
    { name: "Zwetschke", kategorie: "Getränk", unterkategorie: "Spirituosen", mengenUndPreise: [{ menge: "2 cl", preis: 2.50 }] },

    { name: "Verlängerter", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 3.00 }] },
    { name: "Espresso", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 2.80 }] },
    { name: "Heiße Schokolade", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 3.80 }] },
    { name: "Tee (Früchtetee/Schwarztee)", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 2.50 }] },
    { name: "Cappuccino", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 3.50 }] },
    { name: "Cafe Latte", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 3.90 }] },
    { name: "Tee mit Rum", kategorie: "Getränk", unterkategorie: "Kaffee & Tee", mengenUndPreise: [{ menge: "", preis: 3.20 }] }
];

async function startServer() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    const db = client.db();
    const speisenSammlung = db.collection("speisen");
    const veranstaltungenSammlung = db.collection("veranstaltungen");
    const bewertungenSammlung = db.collection("bewertungen");
    const newsletterSammlung = db.collection("newsletter");

    for (const artikel of speisekarteStartdaten) {
        const vorhanden = await speisenSammlung.findOne({ name: artikel.name });

        if (!vorhanden) {
            await speisenSammlung.insertOne({
                ...artikel,
                beschreibung: "",
                bild: "",
                preis: artikel.mengenUndPreise[0].preis
            });
        }
    }

    await speisenSammlung.updateMany(
        { name: "Mineral", kategorie: "Getränk" },
        { $set: { unterkategorie: "Alkoholfrei" } }
    );

    await speisenSammlung.updateMany(
        { name: "Spritzer Weiß / Spritzer Rot", kategorie: "Getränk" },
        { $set: { unterkategorie: "Alkoholisch" } }
    );

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

    app.use((req, res, next) => {
        res.locals.adminEingeloggt = !!req.session.admin;
        next();
    });

    app.get("/", (req, res) => {
        res.render("startseite", { title: "Würstelbaron" });
    });

    app.get("/speisekarte", async (req, res) => {
        const speisen = await speisenSammlung
            .find()
            .sort({ kategorie: 1, unterkategorie: 1, name: 1 })
            .toArray();

        speisen.forEach(artikel => {
            if (!artikel.mengenUndPreise) {
                artikel.mengenUndPreise = [{
                    menge: "",
                    preis: artikel.preis || 0
                }];
            }
        });

        const kategorien = ["Alkoholfrei", "Alkoholisch", "Spirituosen", "Kaffee & Tee"];
        const getraenke = speisen.filter(artikel => artikel.kategorie === "Getränk");

        const getraenkeGruppen = kategorien.map(name => ({
            name,
            artikel: getraenke.filter(artikel =>
                String(artikel.unterkategorie || "").trim() === name
            )
        }));

        res.render("speisekarte", {
            title: "Speisekarte",
            speisen,
            getraenkeGruppen,
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
        const veranstaltungen = await veranstaltungenSammlung
            .find()
            .sort({ datum: -1, _id: -1 })
            .limit(limit + 1)
            .toArray();

        const weitereVorhanden = veranstaltungen.length > limit;
        veranstaltungen.length = Math.min(veranstaltungen.length, limit);

        res.render("veranstaltungen", {
            title: "Veranstaltungen",
            veranstaltungen: veranstaltungen.map(v => ({
                ...v,
                datumAnzeige: datumFormatieren(v.datum)
            })),
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
            const veranstaltungen = await veranstaltungenSammlung
                .find()
                .sort({ datum: -1, _id: -1 })
                .skip(skip)
                .limit(limit + 1)
                .toArray();

            const weitereVorhanden = veranstaltungen.length > limit;
            veranstaltungen.length = Math.min(veranstaltungen.length, limit);

            res.json({
                veranstaltungen: veranstaltungen.map(v => ({
                    ...v,
                    datumAnzeige: datumFormatieren(v.datum)
                })),
                weitereVorhanden
            });
        } catch (fehler) {
            console.error("Veranstaltungen konnten nicht geladen werden:", fehler);
            res.status(500).json({ message: "Veranstaltungen konnten nicht geladen werden." });
        }
    });

    app.post("/veranstaltungen/erstellen", adminAuth, upload.single("bild"), async (req, res) => {
        const { titel, datum, beschreibung } = req.body;
        const uhrzeit = String(req.body.uhrzeit || "").trim();

        if (!titel?.trim() || !datum || !beschreibung?.trim()) {
            return res.redirect("/veranstaltungen?fehler=Bitte+alle+Pflichtfelder+ausfüllen");
        }

        await veranstaltungenSammlung.insertOne({
            titel: titel.trim(),
            datum,
            uhrzeit,
            beschreibung: beschreibung.trim(),
            bild: req.file?.filename || ""
        });

        res.redirect("/veranstaltungen?erfolg=Veranstaltung+erstellt");
    });

    app.post("/veranstaltungen/:id/bearbeiten", adminAuth, upload.single("bild"), async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) return res.sendStatus(400);

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
        } else if (req.body.bildEntfernen === "true") {
            aenderungen.bild = "";
        }

        await veranstaltungenSammlung.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: aenderungen }
        );

        res.redirect("/veranstaltungen?erfolg=Änderungen+gespeichert");
    });

    app.post("/veranstaltungen/:id/loeschen", adminAuth, async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) return res.sendStatus(400);

        await veranstaltungenSammlung.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        res.redirect("/veranstaltungen?erfolg=Veranstaltung+gelöscht");
    });

    app.post("/speisekarte/erstellen", adminAuth, upload.single("bild"), async (req, res) => {
        const name = String(req.body.name || "").trim();
        const kategorie = req.body.kategorie;
        const unterkategorie = String(req.body.unterkategorie || "").trim();
        const beschreibung = String(req.body.beschreibung || "").trim();
        const mengenUndPreise = preiseAuslesen(req.body.preise);
        const allergene = allergeneAuslesen(req.body.allergene);

        if (!name || !["Speise", "Getränk"].includes(kategorie) || !mengenUndPreise.length) {
            return res.redirect("/speisekarte");
        }

        await speisenSammlung.insertOne({
            name,
            kategorie,
            unterkategorie,
            beschreibung,
            mengenUndPreise,
            allergene,
            preis: mengenUndPreise[0].preis,
            bild: kategorie === "Speise" ? req.file?.filename || "" : ""
        });

        res.redirect("/speisekarte");
    });

    app.post("/speisekarte/:id/bearbeiten", adminAuth, upload.single("bild"), async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) return res.sendStatus(400);

        const name = String(req.body.name || "").trim();
        const kategorie = req.body.kategorie;
        const unterkategorie = String(req.body.unterkategorie || "").trim();
        const beschreibung = String(req.body.beschreibung || "").trim();
        const mengenUndPreise = preiseAuslesen(req.body.preise);
        const allergene = allergeneAuslesen(req.body.allergene);

        if (!name || !["Speise", "Getränk"].includes(kategorie) || !mengenUndPreise.length) {
            return res.redirect("/speisekarte");
        }

        const aenderungen = {
            name,
            kategorie,
            unterkategorie,
            beschreibung,
            mengenUndPreise,
            allergene,
            preis: mengenUndPreise[0].preis
        };

        if (kategorie === "Speise" && req.file) {
            aenderungen.bild = req.file.filename;
        }

        if (kategorie === "Getränk") {
            aenderungen.bild = "";
        }

        await speisenSammlung.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: aenderungen }
        );

        res.redirect("/speisekarte");
    });

    app.post("/speisekarte/:id/loeschen", adminAuth, async (req, res) => {
        if (!ObjectId.isValid(req.params.id)) return res.sendStatus(400);

        await speisenSammlung.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        res.redirect("/speisekarte");
    });

    app.get("/api/bewertungen", async (req, res) => {
        try {
            const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
            const limit = 5;
            const bewertungen = await bewertungenSammlung
                .find()
                .sort({ erstelltAm: -1, _id: -1 })
                .skip(skip)
                .limit(limit + 1)
                .toArray();

            const weitereVorhanden = bewertungen.length > limit;
            bewertungen.length = Math.min(bewertungen.length, limit);

            res.json({ bewertungen, weitereVorhanden });
        } catch (fehler) {
            console.error("Bewertungen konnten nicht geladen werden:", fehler);
            res.status(500).json({ message: "Bewertungen konnten nicht geladen werden." });
        }
    });

    app.post("/api/bewertungen", async (req, res) => {
        try {
            const name = String(req.body.name || "").trim();
            const kommentar = String(req.body.kommentar || "").trim();
            const sterne = Number(req.body.sterne);

            if (!name || name.length > 50) {
                return res.status(400).json({ message: "Bitte gib einen Namen mit maximal 50 Zeichen ein." });
            }

            if (!kommentar || kommentar.length > 1000) {
                return res.status(400).json({ message: "Bitte gib einen Kommentar mit maximal 1000 Zeichen ein." });
            }

            if (!Number.isInteger(sterne) || sterne < 1 || sterne > 5) {
                return res.status(400).json({ message: "Bitte wähle eine Bewertung zwischen 1 und 5 Sternen." });
            }

            await bewertungenSammlung.insertOne({
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
            res.status(500).json({ message: "Deine Bewertung konnte leider nicht gespeichert werden." });
        }
    });

    app.delete("/api/bewertungen/:id", adminApiAuth, async (req, res) => {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ message: "Ungültige Bewertungs-ID." });
            }

            const ergebnis = await bewertungenSammlung.deleteOne({
                _id: new ObjectId(req.params.id)
            });

            if (!ergebnis.deletedCount) {
                return res.status(404).json({ message: "Bewertung wurde nicht gefunden." });
            }

            res.json({ success: true, message: "Bewertung wurde gelöscht." });
        } catch (fehler) {
            console.error("Bewertung konnte nicht gelöscht werden:", fehler);
            res.status(500).json({ message: "Bewertung konnte nicht gelöscht werden." });
        }
    });

    app.post("/api/bewertungen/:id/antwort", adminApiAuth, async (req, res) => {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ message: "Ungültige Bewertungs-ID." });
            }

            const antwort = String(req.body.antwort || "").trim();

            if (!antwort || antwort.length > 1000) {
                return res.status(400).json({ message: "Bitte gib eine Antwort mit maximal 1000 Zeichen ein." });
            }

            const ergebnis = await bewertungenSammlung.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { adminAntwort: antwort, adminAntwortAm: new Date() } }
            );

            if (!ergebnis.matchedCount) {
                return res.status(404).json({ message: "Bewertung wurde nicht gefunden." });
            }

            res.json({ success: true, message: "Antwort wurde gespeichert." });
        } catch (fehler) {
            console.error("Antwort konnte nicht gespeichert werden:", fehler);
            res.status(500).json({ message: "Antwort konnte nicht gespeichert werden." });
        }
    });

    app.delete("/api/bewertungen/:id/antwort", adminApiAuth, async (req, res) => {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ message: "Ungültige Bewertungs-ID." });
            }

            const ergebnis = await bewertungenSammlung.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $unset: { adminAntwort: "", adminAntwortAm: "" } }
            );

            if (!ergebnis.matchedCount) {
                return res.status(404).json({ message: "Bewertung wurde nicht gefunden." });
            }

            res.json({ success: true, message: "Antwort wurde gelöscht." });
        } catch (fehler) {
            console.error("Antwort konnte nicht gelöscht werden:", fehler);
            res.status(500).json({ message: "Antwort konnte nicht gelöscht werden." });
        }
    });

    app.post("/api/newsletter/anmelden", async (req, res) => {
        try {
            const email = String(req.body.email || "").trim().toLowerCase();
            const einwilligung = req.body.einwilligung === true;
            const emailTeile = email.split("@");
            const domain = emailTeile[1] || "";

            if (
                !email ||
                email.length > 254 ||
                emailTeile.length !== 2 ||
                !emailTeile[0] ||
                !domain.includes(".") ||
                domain.startsWith(".") ||
                domain.endsWith(".") ||
                email.includes(" ")
            ) {
                return res.status(400).json({ message: "Bitte gib eine gültige E-Mail-Adresse ein." });
            }

            if (!einwilligung) {
                return res.status(400).json({ message: "Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu." });
            }

            if (!mailTransporter) {
                return res.status(503).json({
                    message: "Der Newsletter ist momentan nicht verfügbar. Bitte versuche es später erneut."
                });
            }

            const bereitsAngemeldet = await newsletterSammlung.findOne({ email });

            if (bereitsAngemeldet) {
                return res.status(409).json({
                    message: "Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet."
                });
            }

            await newsletterSammlung.insertOne({
                email,
                einwilligung: true,
                angemeldetAm: new Date()
            });

            try {
                await mailTransporter.sendMail({
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
        await newsletterSammlung.createIndex({ email: 1 }, { unique: true });
    } catch (fehler) {
        console.error("Newsletter-Index konnte nicht erstellt werden:", fehler);
    }

    app.post("/api/login", async (req, res) => {
        const username = String(req.body.username || "").trim();
        const password = req.body.password || "";
        const jetzt = Date.now();

        let loginDaten = loginVersuche.get(username) || {
            versuche: 0,
            gesperrtBis: 0
        };

        if (loginDaten.gesperrtBis > jetzt) {
            const verbleibendeZeit = Math.ceil((loginDaten.gesperrtBis - jetzt) / 60000);

            return res.status(429).json({
                message: `Zu viele falsche Versuche. Bitte warte noch ${verbleibendeZeit} Minuten.`
            });
        }

        if (loginDaten.gesperrtBis && loginDaten.gesperrtBis <= jetzt) {
            loginDaten = { versuche: 0, gesperrtBis: 0 };
        }

        const admin = await db.collection("admins").findOne({ username });

        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
            loginDaten.versuche++;

            if (loginDaten.versuche >= MAX_LOGIN_VERSUCHE) {
                loginDaten.gesperrtBis = jetzt + LOGIN_SPERRE_MINUTEN * 60 * 1000;
                loginVersuche.set(username, loginDaten);

                return res.status(429).json({
                    message: `Du hast das Passwort ${MAX_LOGIN_VERSUCHE} Mal falsch eingegeben. Der Login ist für ${LOGIN_SPERRE_MINUTEN} Minuten gesperrt.`
                });
            }

            loginVersuche.set(username, loginDaten);

            return res.status(401).json({
                message: `Benutzername oder Passwort falsch. Versuch ${loginDaten.versuche} von ${MAX_LOGIN_VERSUCHE}.`
            });
        }

        loginVersuche.delete(username);

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
        res.json({ loggedIn: !!req.session.admin });
    });

    app.post("/api/logout", (req, res) => {
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.sendStatus(200);
        });
    });

    app.listen(PORT, () => {
        console.log(`Website läuft auf Port ${PORT}`);
    });
}

startServer().catch(console.error);