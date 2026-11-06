document.querySelectorAll(".varianten-formular").forEach(formular => {
    const liste = formular.querySelector(".varianten-liste");
    const hiddenFeld = formular.querySelector(".preise-hidden");
    const hinzufuegenButton = formular.querySelector(".variante-hinzufuegen");

    if (!liste || !hiddenFeld || !hinzufuegenButton) return;

    function varianteHinzufuegen(bezeichnung = "", preis = "") {
        const zeile = document.createElement("div");
        zeile.className = "row g-2 mb-2 variante-zeile";

        const bezeichnungSpalte = document.createElement("div");
        bezeichnungSpalte.className = "col-7";

        const bezeichnungFeld = document.createElement("input");
        bezeichnungFeld.type = "text";
        bezeichnungFeld.className = "form-control variante-bezeichnung";
        bezeichnungFeld.placeholder = "z. B. 0,25 l oder Pommes";
        bezeichnungFeld.value = bezeichnung;

        bezeichnungSpalte.appendChild(bezeichnungFeld);

        const preisSpalte = document.createElement("div");
        preisSpalte.className = "col-3";

        const preisFeld = document.createElement("input");
        preisFeld.type = "text";
        preisFeld.className = "form-control variante-preis";
        preisFeld.placeholder = "Preis";
        preisFeld.value = preis;
        preisFeld.required = true;

        preisSpalte.appendChild(preisFeld);

        const buttonSpalte = document.createElement("div");
        buttonSpalte.className = "col-2";

        const entfernenButton = document.createElement("button");
        entfernenButton.type = "button";
        entfernenButton.className = "btn btn-outline-danger w-100";
        entfernenButton.textContent = "×";
        entfernenButton.title = "Variante entfernen";

        entfernenButton.addEventListener("click", () => {
            if (liste.querySelectorAll(".variante-zeile").length > 1) {
                zeile.remove();
            } else {
                bezeichnungFeld.value = "";
                preisFeld.value = "";
            }
        });

        buttonSpalte.appendChild(entfernenButton);

        zeile.append(bezeichnungSpalte, preisSpalte, buttonSpalte);
        liste.appendChild(zeile);
    }

    const bisherigePreise = hiddenFeld.value;
    if (bisherigePreise) {
        bisherigePreise.split(";").forEach(eintrag => {
            const teile = eintrag.split("=");
            if (teile.length === 2) {
                varianteHinzufuegen(
                    teile[0].trim(),
                    teile[1].trim()
                );
            }
        });
    }

    if (liste.children.length === 0) {
        varianteHinzufuegen();
    }

    hinzufuegenButton.addEventListener("click", () => {
        varianteHinzufuegen();
    });

    formular.addEventListener("submit", event => {
        const zeilen = liste.querySelectorAll(".variante-zeile");
        const ergebnis = [];

        zeilen.forEach(zeile => {
            const bezeichnung = zeile.querySelector(".variante-bezeichnung").value.trim();
            const preis = zeile.querySelector(".variante-preis").value.trim();
            if (preis) {
                ergebnis.push(bezeichnung + "=" + preis);
            }
        });

        if (ergebnis.length === 0) {
            event.preventDefault();
            alert("Bitte gib mindestens einen Preis ein.");
            return;
        }

        hiddenFeld.value = ergebnis.join("; ");
    });
});

const bildPopup = document.getElementById("bild-popup");
const popupBild = document.getElementById("popup-bild");
const popupSchliessen = document.getElementById("popup-schließen");

function bildPopupOeffnen(name) {
    if (!bildPopup || !popupBild) return;

    const bildAdresse = name.dataset.bild;
    if (!bildAdresse) return;

    popupBild.src = bildAdresse;
    popupBild.alt = name.dataset.name || name.textContent.trim();

    bildPopup.hidden = false;
}

function bildPopupSchliessen() {
    if (!bildPopup || !popupBild) return;

    bildPopup.hidden = true;
    popupBild.src = "";
}

if (bildPopup && popupBild) {
    document.querySelectorAll(".speise-name-mit-bild").forEach(name => {
        name.tabIndex = 0;

        name.addEventListener("click", () => {
            bildPopupOeffnen(name);
        });

        name.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                bildPopupOeffnen(name);
            }
        });
    });

    popupSchliessen?.addEventListener("click", bildPopupSchliessen);

    bildPopup.addEventListener("click", event => {
        if (event.target === bildPopup) {
            bildPopupSchliessen();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            bildPopupSchliessen();
        }
    });
}

const loginForm = document.getElementById("login-formular");
const loginMeldung = document.getElementById("login-meldung");
const adminBereich = document.getElementById("admin-bereich");
const logoutButton = document.getElementById("logout-button");

function loginStatusAnzeigen(eingeloggt) {
    if (adminBereich) adminBereich.hidden = !eingeloggt;

    document.querySelectorAll(".veranstaltung-admin-aktionen").forEach(element => {
        element.hidden = !eingeloggt;
    });

    document.querySelectorAll(".speise-admin-aktionen").forEach(element => {
        element.hidden = !eingeloggt;
    });
}

async function loginStatusCheck() {
    try {
        const antwort = await fetch("/api/login-status");
        const daten = await antwort.json();

        loginStatusAnzeigen(daten.loggedIn);
    } catch (fehler) {
        console.error("Login-Status konnte nicht geladen werden:", fehler);
    }
}

if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const username = document.getElementById("admin-username").value;
        const password = document.getElementById("admin-password").value;

        try {
            const antwort = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const daten = await antwort.json();
            if (antwort.ok && daten.success) {
                window.location.href = "/veranstaltungen";
            } else if (loginMeldung) {
                loginMeldung.textContent = daten.message || "Login fehlgeschlagen.";
            }
        } catch {
            if (loginMeldung) {
                loginMeldung.textContent = "Server nicht erreichbar. Bitte erneut versuchen.";
            }
        }
    });
}

if (adminBereich) loginStatusCheck();

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            const antwort = await fetch("/api/logout", { method: "POST" });

            if (!antwort.ok) throw new Error("Logout fehlgeschlagen");

            window.location.href = "/veranstaltungen";
        } catch (fehler) {
            console.error("Abmelden fehlgeschlagen:", fehler);
        }
    });
}

document.querySelectorAll(".emoji-feld").forEach(feldBereich => {
    const button = feldBereich.querySelector(".emoji-button");
    const pickerPopup = feldBereich.querySelector(".emoji-picker-popup");
    const picker = feldBereich.querySelector("emoji-picker");
    const eingabe = feldBereich.querySelector("input, textarea");

    if (!button || !pickerPopup || !eingabe || !picker) return;

    let cursorStart = 0;
    let cursorEnde = 0;

    function cursorSpeichern() {
        cursorStart = eingabe.selectionStart;
        cursorEnde = eingabe.selectionEnd;
    }

    ["focus", "click", "keyup", "input", "select"].forEach(ereignis => {
        eingabe.addEventListener(ereignis, cursorSpeichern);
    });

    button.addEventListener("click", () => {
        const warGeoeffnet = !pickerPopup.hidden;

        document.querySelectorAll(".emoji-picker-popup").forEach(popup => {
            popup.hidden = true;
        });

        if (!warGeoeffnet) pickerPopup.hidden = false;
    });

    picker.addEventListener("emoji-click", event => {
        const emoji = event.detail.unicode;

        eingabe.focus();
        eingabe.setRangeText(emoji, cursorStart, cursorEnde, "end");

        cursorStart += emoji.length;
        cursorEnde = cursorStart;

        pickerPopup.hidden = true;
        eingabe.dispatchEvent(new Event("input", { bubbles: true }));
    });
});

document.addEventListener("click", event => {
    if (!event.target.closest(".emoji-feld")) {
        document.querySelectorAll(".emoji-picker-popup").forEach(popup => {
            popup.hidden = true;
        });
    }

    const veranstaltungButton = event.target.closest(".bearbeiten-button");

    if (veranstaltungButton) {
        const aktionen = veranstaltungButton.closest(".veranstaltung-admin-aktionen");
        const bearbeitenBereich = aktionen?.querySelector(".veranstaltung-bearbeiten");

        if (bearbeitenBereich) {
            bearbeitenBereich.hidden = !bearbeitenBereich.hidden;
        }
    }

    const speiseButton = event.target.closest(".speise-bearbeiten-button");

    if (speiseButton) {
        const aktionen = speiseButton.closest(".speise-admin-aktionen");
        const bearbeitenBereich = aktionen?.querySelector(".speise-bearbeiten");

        if (bearbeitenBereich) {
            bearbeitenBereich.hidden = !bearbeitenBereich.hidden;
        }
    }
});

document.addEventListener("submit", event => {
    if (event.target.classList.contains("loeschen-formular")) {
        if (!confirm("Möchtest du diesen Eintrag wirklich löschen?")) {
            event.preventDefault();
        }
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        document.querySelectorAll(".emoji-picker-popup").forEach(popup => {
            popup.hidden = true;
        });
    }
});

const veranstaltungsliste = document.getElementById("veranstaltungsliste");
const mehrVeranstaltungenButton = document.getElementById("mehr-veranstaltungen");

let veranstaltungenGeladen = veranstaltungsliste
    ? veranstaltungsliste.querySelectorAll(".veranstaltung-eintrag").length
    : 0;

let veranstaltungenWerdenGeladen = false;

function veranstaltungAnzeigen(veranstaltung) {
    const eintrag = document.createElement("div");
    eintrag.className = "col-12 mb-4 veranstaltung-eintrag";
    eintrag.dataset.id = veranstaltung._id;

    const karte = document.createElement("div");
    karte.className = "card h-100";

    const inhalt = document.createElement("div");
    inhalt.className = "card-body";

    const titel = document.createElement("h3");
    titel.textContent = veranstaltung.titel;

    const datum = document.createElement("p");
    const datumLabel = document.createElement("strong");
    datumLabel.textContent = "Datum: ";
    datum.append(datumLabel, document.createTextNode(veranstaltung.datumAnzeige));

    inhalt.append(titel, datum);

    if (veranstaltung.uhrzeit) {
        const uhrzeit = document.createElement("p");
        const uhrzeitLabel = document.createElement("strong");
        uhrzeitLabel.textContent = "Beginn: ";
        uhrzeit.append(uhrzeitLabel, document.createTextNode(veranstaltung.uhrzeit));
        inhalt.appendChild(uhrzeit);
    }

    const beschreibung = document.createElement("p");
    beschreibung.textContent = veranstaltung.beschreibung;
    inhalt.appendChild(beschreibung);

    if (veranstaltungsliste.dataset.admin === "true") {
        const aktionen = document.createElement("div");
        aktionen.className = "veranstaltung-admin-aktionen mt-3";

        const bearbeitenButton = document.createElement("button");
        bearbeitenButton.type = "button";
        bearbeitenButton.className = "btn btn-outline-light bearbeiten-button";
        bearbeitenButton.textContent = "✏️ Bearbeiten";

        const loeschenForm = document.createElement("form");
        loeschenForm.action = `/veranstaltungen/${veranstaltung._id}/loeschen`;
        loeschenForm.method = "POST";
        loeschenForm.className = "d-inline loeschen-formular";

        const loeschenButton = document.createElement("button");
        loeschenButton.type = "submit";
        loeschenButton.className = "btn btn-danger";
        loeschenButton.textContent = "🗑️ Veranstaltung löschen";

        loeschenForm.appendChild(loeschenButton);

        const bearbeitenBereich = document.createElement("div");
        bearbeitenBereich.className = "veranstaltung-bearbeiten mt-3";
        bearbeitenBereich.hidden = true;

        const trennlinie = document.createElement("hr");
        const bearbeitenTitel = document.createElement("h4");
        bearbeitenTitel.textContent = "Veranstaltung bearbeiten";

        const bearbeitenForm = document.createElement("form");
        bearbeitenForm.action = `/veranstaltungen/${veranstaltung._id}/bearbeiten`;
        bearbeitenForm.method = "POST";
        bearbeitenForm.enctype = "multipart/form-data";

        const felder = [
            { label: "Titel", name: "titel", value: veranstaltung.titel, type: "text", required: true },
            { label: "Datum", name: "datum", value: veranstaltung.datum, type: "date", required: true },
            { label: "Beginn (optional)", name: "uhrzeit", value: veranstaltung.uhrzeit, type: "time", required: false }
        ];

        felder.forEach(feld => {
            const gruppe = document.createElement("div");
            gruppe.className = "mb-3";

            const label = document.createElement("label");
            label.className = "form-label";
            label.textContent = feld.label;

            const input = document.createElement("input");
            input.type = feld.type;
            input.name = feld.name;
            input.className = "form-control";
            input.value = feld.value || "";
            input.required = feld.required;

            gruppe.append(label, input);
            bearbeitenForm.appendChild(gruppe);
        });

        const beschreibungGruppe = document.createElement("div");
        beschreibungGruppe.className = "mb-3";

        const beschreibungLabel = document.createElement("label");
        beschreibungLabel.className = "form-label";
        beschreibungLabel.textContent = "Beschreibung";

        const beschreibungEingabe = document.createElement("textarea");
        beschreibungEingabe.name = "beschreibung";
        beschreibungEingabe.className = "form-control";
        beschreibungEingabe.rows = 3;
        beschreibungEingabe.required = true;
        beschreibungEingabe.value = veranstaltung.beschreibung || "";

        beschreibungGruppe.append(beschreibungLabel, beschreibungEingabe);

        const bildGruppe = document.createElement("div");
        bildGruppe.className = "mb-3";

        const bildLabel = document.createElement("label");
        bildLabel.className = "form-label";
        bildLabel.textContent = "Neues Bild (optional)";

        const bildEingabe = document.createElement("input");
        bildEingabe.type = "file";
        bildEingabe.name = "bild";
        bildEingabe.className = "form-control";
        bildEingabe.accept = "image/*";

        bildGruppe.append(bildLabel, bildEingabe);

        const speichernButton = document.createElement("button");
        speichernButton.type = "submit";
        speichernButton.className = "btn btn-success";
        speichernButton.textContent = "💾 Änderung speichern";

        bearbeitenForm.append(beschreibungGruppe, bildGruppe, speichernButton);
        bearbeitenBereich.append(trennlinie, bearbeitenTitel, bearbeitenForm);

        aktionen.append(bearbeitenButton, loeschenForm, bearbeitenBereich);
        inhalt.appendChild(aktionen);
    }

    karte.appendChild(inhalt);

    if (veranstaltung.bild) {
        const bild = document.createElement("img");
        bild.src = `/bilder/${encodeURIComponent(veranstaltung.bild)}`;
        bild.className = "card-img-bottom";
        bild.alt = veranstaltung.titel;
        karte.appendChild(bild);
    }

    eintrag.appendChild(karte);
    veranstaltungsliste.appendChild(eintrag);
}

async function veranstaltungenLaden() {
    if (!veranstaltungsliste || veranstaltungenWerdenGeladen) return;

    veranstaltungenWerdenGeladen = true;

    if (mehrVeranstaltungenButton) mehrVeranstaltungenButton.disabled = true;

    try {
        const antwort = await fetch(`/api/veranstaltungen?skip=${veranstaltungenGeladen}`);
        const daten = await antwort.json();

        if (!antwort.ok) {
            throw new Error(daten.message || "Veranstaltungen konnten nicht geladen werden.");
        }

        daten.veranstaltungen.forEach(veranstaltungAnzeigen);
        veranstaltungenGeladen += daten.veranstaltungen.length;

        const keineVeranstaltungen = document.getElementById("keine-veranstaltungen");

        if (keineVeranstaltungen && veranstaltungenGeladen > 0) {
            keineVeranstaltungen.remove();
        }

        if (mehrVeranstaltungenButton) {
            mehrVeranstaltungenButton.hidden = !daten.weitereVorhanden;
        }
    } catch (fehler) {
        console.error(fehler);
        alert("Weitere Veranstaltungen konnten nicht geladen werden.");
    } finally {
        veranstaltungenWerdenGeladen = false;

        if (mehrVeranstaltungenButton) mehrVeranstaltungenButton.disabled = false;
    }
}

if (veranstaltungsliste && mehrVeranstaltungenButton) {
    mehrVeranstaltungenButton.addEventListener("click", veranstaltungenLaden);
}

const sterneAuswahl = document.querySelector(".sterne-auswahl");
const bewertungsformular = document.getElementById("bewertungsformular");
const bewertungsliste = document.getElementById("bewertungsliste");
const mehrBewertungenButton = document.getElementById("mehr-bewertungen");
const bewertungMeldung = document.getElementById("bewertung-meldung");
const bewertungAbsenden = document.getElementById("bewertung-absenden");

let bewertungenGeladen = 0;
let bewertungenWerdenGeladen = false;

const adminEingeloggt = bewertungsliste?.dataset.admin === "true";

function sterneAktualisieren() {
    if (!sterneAuswahl) return;

    const sterne = sterneAuswahl.querySelectorAll("input[type='radio']");
    const ausgewaehlt = Number(
        sterneAuswahl.querySelector("input[type='radio']:checked")?.value || 0
    );

    sterne.forEach(input => {
        const label = sterneAuswahl.querySelector(`label[for="${input.id}"]`);

        if (label) {
            label.classList.toggle("ausgewaehlt", Number(input.value) <= ausgewaehlt);
        }
    });
}

if (sterneAuswahl) {
    sterneAuswahl.querySelectorAll("input[type='radio']").forEach(input => {
        input.addEventListener("change", sterneAktualisieren);
    });

    sterneAktualisieren();
}

function bewertungAnzeigen(bewertung) {
    const eintrag = document.createElement("div");
    eintrag.className = "bewertung-eintrag mb-3";
    eintrag.dataset.id = bewertung._id;

    const kopf = document.createElement("div");
    kopf.className = "bewertung-kopf";

    const name = document.createElement("strong");
    name.textContent = bewertung.name;

    const sterne = document.createElement("span");
    sterne.className = "bewertung-sterne";
    sterne.textContent = "★".repeat(bewertung.sterne) + "☆".repeat(5 - bewertung.sterne);

    kopf.append(name, sterne);

    const kommentar = document.createElement("p");
    kommentar.textContent = bewertung.kommentar;

    const datum = document.createElement("small");
    datum.className = "bewertung-datum";
    datum.textContent = new Date(bewertung.erstelltAm).toLocaleDateString("de-AT");

    eintrag.append(kopf, kommentar, datum);

    if (adminEingeloggt) {
        const loeschenButton = document.createElement("button");
        loeschenButton.type = "button";
        loeschenButton.className = "btn btn-danger btn-sm mt-2";
        loeschenButton.textContent = "Löschen";

        loeschenButton.addEventListener("click", async () => {
            if (!confirm("Möchtest du diese Bewertung wirklich löschen?")) return;

            loeschenButton.disabled = true;

            try {
                const antwort = await fetch(`/api/bewertungen/${bewertung._id}`, {
                    method: "DELETE"
                });

                const daten = await antwort.json();

                if (!antwort.ok) {
                    throw new Error(daten.message || "Bewertung konnte nicht gelöscht werden.");
                }

                eintrag.remove();
                bewertungenGeladen = Math.max(0, bewertungenGeladen - 1);

                if (bewertungenGeladen === 0) {
                    bewertungsliste.textContent = "Noch keine Bewertungen vorhanden.";
                }
            } catch (fehler) {
                alert(fehler.message);
                loeschenButton.disabled = false;
            }
        });

        eintrag.appendChild(loeschenButton);
    }

    bewertungsliste.appendChild(eintrag);
}

async function bewertungenLaden(neuLaden = false) {
    if (!bewertungsliste || bewertungenWerdenGeladen) return;

    bewertungenWerdenGeladen = true;

    if (mehrBewertungenButton) mehrBewertungenButton.disabled = true;

    if (neuLaden) {
        bewertungenGeladen = 0;
        bewertungsliste.innerHTML = "";
    }

    try {
        const antwort = await fetch(`/api/bewertungen?skip=${bewertungenGeladen}`);
        const daten = await antwort.json();

        if (!antwort.ok) {
            throw new Error(daten.message || "Bewertungen konnten nicht geladen werden.");
        }

        if (daten.bewertungen.length === 0 && bewertungenGeladen === 0) {
            bewertungsliste.textContent = "Noch keine Bewertungen vorhanden.";
        } else {
            daten.bewertungen.forEach(bewertungAnzeigen);
        }

        bewertungenGeladen += daten.bewertungen.length;

        if (mehrBewertungenButton) {
            mehrBewertungenButton.hidden = !daten.weitereVorhanden;
        }
    } catch (fehler) {
        if (bewertungenGeladen === 0) {
            bewertungsliste.textContent = "Bewertungen konnten gerade nicht geladen werden.";
        }

        console.error(fehler);
    } finally {
        bewertungenWerdenGeladen = false;

        if (mehrBewertungenButton) mehrBewertungenButton.disabled = false;
    }
}

if (bewertungsliste && mehrBewertungenButton) {
    bewertungenLaden();
    mehrBewertungenButton.addEventListener("click", () => bewertungenLaden());
}

if (bewertungsformular) {
    bewertungsformular.addEventListener("submit", async event => {
        event.preventDefault();

        if (!bewertungAbsenden || !bewertungMeldung) return;

        bewertungAbsenden.disabled = true;
        bewertungMeldung.textContent = "Bewertung wird veröffentlicht ...";

        const formularDaten = new FormData(bewertungsformular);

        const bewertung = {
            name: formularDaten.get("name"),
            sterne: Number(formularDaten.get("sterne")),
            kommentar: formularDaten.get("kommentar")
        };

        try {
            const antwort = await fetch("/api/bewertungen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bewertung)
            });

            const daten = await antwort.json();

            if (!antwort.ok) {
                throw new Error(daten.message || "Bewertung konnte nicht veröffentlicht werden.");
            }

            bewertungsformular.reset();
            bewertungMeldung.textContent = daten.message;
            sterneAktualisieren();

            await bewertungenLaden(true);
        } catch (fehler) {
            bewertungMeldung.textContent = fehler.message;
        } finally {
            bewertungAbsenden.disabled = false;
        }
    });
}

const newsletterFormular = document.getElementById("newsletter-formular");
const newsletterMeldung = document.getElementById("newsletter-meldung");
const newsletterAnmelden = document.getElementById("newsletter-anmelden");

if (newsletterFormular) {
    newsletterFormular.addEventListener("submit", async event => {
        event.preventDefault();

        const emailFeld = document.getElementById("newsletter-email");
        const einwilligungFeld = document.getElementById("newsletter-einwilligung");

        const email = emailFeld.value.trim();
        const einwilligung = einwilligungFeld.checked;

        if (!emailFeld.checkValidity()) {
            newsletterMeldung.textContent = "Bitte gib eine gültige E-Mail-Adresse ein.";
            return;
        }

        if (!einwilligung) {
            newsletterMeldung.textContent = "Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu.";
            return;
        }

        newsletterAnmelden.disabled = true;
        newsletterMeldung.textContent = "Deine Anmeldung wird verarbeitet ...";

        try {
            const antwort = await fetch("/api/newsletter/anmelden", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, einwilligung })
            });

            const daten = await antwort.json();

            if (!antwort.ok) {
                throw new Error(daten.message || "Die Anmeldung ist fehlgeschlagen.");
            }

            newsletterMeldung.textContent = daten.message;
            newsletterFormular.reset();
        } catch (fehler) {
            newsletterMeldung.textContent = fehler.message;
        } finally {
            newsletterAnmelden.disabled = false;
        }
    });
}

const kartenElement = document.getElementById("map");

if (kartenElement) {
    const map = L.map("map");

    map.setView([47.67721, 15.94569], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>'
    }).addTo(map);

    L.marker([47.67721, 15.94569])
        .addTo(map)
        .bindPopup("Würstelbaron – Bahnhofstraße 22")
        .openPopup();
}

const kategorie = document.getElementById("artikel-kategorie");
const bildFeld = document.getElementById("bild-feld");

if (kategorie && bildFeld) {
    function bildFeldAnzeigen() {
        bildFeld.hidden = kategorie.value !== "Speise";
    }

    kategorie.addEventListener("change", bildFeldAnzeigen);
    bildFeldAnzeigen();
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/service-worker.js")
            .then(() => {
                console.log("Service Worker wurde registriert");
            })
            .catch(fehler => {
                console.log("Service Worker Error: ", fehler);
            });
    });
}
