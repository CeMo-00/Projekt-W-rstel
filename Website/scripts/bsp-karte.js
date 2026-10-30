require("dotenv").config();

const { MongoClient } = require("mongodb");

async function speisenEinfuegen() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();
        const speisen = [
            {
                name: "Hotdog",
                beschreibung: "Mit Frankfurter",
                preis: 0.00,
                kategorie: "Speise"
            },
            {
                name: "Käsekrainer",
                beschreibung: "Mit Semmel oder Pommes",
                preis: 0.00,
                kategorie: "Speise"
            },
            {
                name: "Toast",
                beschreibung: "Mit Schinken und Käse",
                preis: 0.00,
                kategorie: "Speise"
            },
            {
                name: "Mineralwasser",
                beschreibung: "0,5 Liter",
                preis: 0.00,
                kategorie: "Getränk"
            },
            {
                name: "Spritzer",
                beschreibung: "0,25 Liter",
                preis: 0.00,
                kategorie: "Getränk"
            },
            {
                name: "Bier",
                beschreibung: "0,25 Liter",
                preis: 0.00,
                kategorie: "Getränk"
            }
        ];

        await db.collection("speisen").insertMany(speisen);

        console.log("Sechs Einträge wurden gespeichert!");

    } catch (error) {
        console.error("Fehler:", error.message);

    } finally {
        await client.close();
    }
}

speisenEinfuegen();