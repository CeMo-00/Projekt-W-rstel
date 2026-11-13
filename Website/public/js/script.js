const loginFormular = document.getElementById("login-formular");

if (loginFormular) {
    loginFormular.addEventListener("submit", async event => {
        event.preventDefault();

        const username = document.getElementById("admin-username").value;
        const password = document.getElementById("admin-password").value;
        const meldung = document.getElementById("login-meldung");

        try {
            const antwort = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const daten = await antwort.json();

            if (!antwort.ok) {
                meldung.textContent = daten.message || "Login fehlgeschlagen.";
                return;
            }

            window.location.href = "/veranstaltungen";

        } catch (fehler) {
            meldung.textContent = "Verbindung zum Server fehlgeschlagen.";
            console.error(fehler);
        }
    });
}

const logoutButton = document.getElementById("logout-button");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            const antwort = await fetch("/api/logout", { method: "POST" });

            if (!antwort.ok) {
                throw new Error("Abmelden fehlgeschlagen.");
            }

            window.location.href = "/";

        } catch (fehler) {
            alert(fehler.message);
            logoutButton.disabled = false;
        }
    });
}

function beschreibungHoeheAnpassen(eingabe) {
    if (!eingabe) return;

    const maximaleHoehe = 180;

    eingabe.style.setProperty("box-sizing", "border-box", "important");
    eingabe.style.setProperty("min-height", "90px", "important");
    eingabe.style.setProperty("max-height", maximaleHoehe + "px", "important");
    eingabe.style.setProperty("height", "auto", "important");
    eingabe.style.setProperty("padding-bottom", "65px", "important");

    const benoetigteHoehe = eingabe.scrollHeight;
    const neueHoehe = Math.max(90, Math.min(benoetigteHoehe, maximaleHoehe));

    eingabe.style.setProperty("height", neueHoehe + "px", "important");
    eingabe.style.setProperty(
        "overflow-y",
        benoetigteHoehe > maximaleHoehe ? "auto" : "hidden",
        "important"
    );
}

document.addEventListener("click", event => {
    const bearbeitenButton = event.target.closest(
        ".bearbeiten-button, .speise-bearbeiten-button"
    );

    if (bearbeitenButton) {
        const bereich = bearbeitenButton.closest(
            ".veranstaltung-admin-aktionen, .speise-admin-aktionen"
        );

        const formular = bereich?.querySelector(
            ".veranstaltung-bearbeiten, .speise-bearbeiten"
        );

        if (!formular) return;

        formular.hidden = !formular.hidden;
        bearbeitenButton.textContent = formular.hidden ? "Bearbeiten" : "Schließen";

        if (!formular.hidden) {
            requestAnimationFrame(() => {
                formular.querySelectorAll(".emoji-beschreibung textarea")
                    .forEach(beschreibungHoeheAnpassen);
            });
        }

        return;
    }

    const schliessenButton = event.target.closest(
        ".veranstaltung-schliessen-button, .speise-schliessen-button"
    );

    if (schliessenButton) {
        const formular = schliessenButton.closest(
            ".veranstaltung-bearbeiten, .speise-bearbeiten"
        );

        if (!formular) return;

        formular.hidden = true;

        const bereich = formular.closest(
            ".veranstaltung-admin-aktionen, .speise-admin-aktionen"
        );

        const bearbeitenButton = bereich?.querySelector(
            ".bearbeiten-button, .speise-bearbeiten-button"
        );

        if (bearbeitenButton) {
            bearbeitenButton.textContent = "Bearbeiten";
        }
    }
});

function emojiPopupsSchliessen() {
    document.querySelectorAll(".emoji-picker-popup").forEach(popup => {
        popup.hidden = true;
    });
}

function emojiFeldVorbereiten(feld) {
    const button = feld.querySelector(".emoji-button");
    const popup = feld.querySelector(".emoji-picker-popup");
    const picker = feld.querySelector("emoji-picker");
    const eingabe = feld.querySelector(".emoji-eingabe, textarea");

    if (!button || !popup || !picker || !eingabe || feld.dataset.emojiBereit) return;

    feld.dataset.emojiBereit = "true";

    if (feld.classList.contains("emoji-beschreibung")) {
        beschreibungHoeheAnpassen(eingabe);
        eingabe.addEventListener("input", () => beschreibungHoeheAnpassen(eingabe));
    }

    button.addEventListener("click", event => {
        event.preventDefault();

        document.querySelectorAll(".emoji-picker-popup").forEach(anderePopup => {
            if (anderePopup !== popup) anderePopup.hidden = true;
        });

        popup.hidden = !popup.hidden;

        if (!popup.hidden) {
            const position = button.getBoundingClientRect();
            const popupBreite = Math.min(popup.offsetWidth || 320, window.innerWidth - 20);
            const popupHoehe = popup.offsetHeight || 350;

            const links = Math.max(
                10,
                Math.min(position.left, window.innerWidth - popupBreite - 10)
            );

            let oben = feld.classList.contains("emoji-beschreibung")
                ? position.top - popupHoehe - 8
                : position.bottom + 8;

            oben = Math.max(10, Math.min(oben, window.innerHeight - popupHoehe - 10));

            popup.style.left = links + "px";
            popup.style.top = oben + "px";
        }
    });

    picker.addEventListener("emoji-click", event => {
        const emoji = event.detail.unicode;
        const start = eingabe.selectionStart ?? eingabe.value.length;
        const ende = eingabe.selectionEnd ?? eingabe.value.length;

        eingabe.value =
            eingabe.value.slice(0, start) +
            emoji +
            eingabe.value.slice(ende);

        const neuePosition = start + emoji.length;

        eingabe.focus();
        eingabe.setSelectionRange(neuePosition, neuePosition);
        eingabe.dispatchEvent(new Event("input", { bubbles: true }));

        popup.hidden = true;
    });
}

document.querySelectorAll(".emoji-feld").forEach(emojiFeldVorbereiten);

document.addEventListener("click", event => {
    if (!event.target.closest(".emoji-feld")) {
        emojiPopupsSchliessen();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") emojiPopupsSchliessen();
});

const veranstaltungsliste = document.getElementById("veranstaltungsliste");
const mehrVeranstaltungenButton = document.getElementById("mehr-veranstaltungen");

let veranstaltungenGeladen = veranstaltungsliste
    ? veranstaltungsliste.querySelectorAll(".veranstaltung-eintrag").length
    : 0;

let veranstaltungenWerdenGeladen = false;

function elementErstellen(tag, klasse, text) {
    const element = document.createElement(tag);

    if (klasse) element.className = klasse;
    if (text !== undefined) element.textContent = text;

    return element;
}

function veranstaltungAnzeigen(veranstaltung) {
    const eintrag = elementErstellen("div", "col-12 veranstaltung-eintrag");
    eintrag.dataset.id = veranstaltung._id;

    const karte = elementErstellen("div", "card h-100");
    const inhalt = elementErstellen("div", "card-body veranstaltung-inhalt");

    inhalt.appendChild(elementErstellen("h3", "", veranstaltung.titel));

    const datum = elementErstellen("p");
    datum.append(
        elementErstellen("strong", "", "Datum: "),
        document.createTextNode(veranstaltung.datumAnzeige || "")
    );
    inhalt.appendChild(datum);

    if (veranstaltung.uhrzeit) {
        const uhrzeit = elementErstellen("p");
        uhrzeit.append(
            elementErstellen("strong", "", "Beginn: "),
            document.createTextNode(veranstaltung.uhrzeit)
        );
        inhalt.appendChild(uhrzeit);
    }

    inhalt.appendChild(elementErstellen("p", "", veranstaltung.beschreibung));
    karte.appendChild(inhalt);

    if (veranstaltung.bild) {
        const bild = elementErstellen("img", "card-img-bottom");
        bild.src = "/bilder/" + veranstaltung.bild;
        bild.alt = veranstaltung.titel;
        karte.appendChild(bild);
    }

    if (veranstaltungsliste.dataset.admin === "true") {
        const adminBereich = elementErstellen(
            "div",
            "card-body veranstaltung-admin-aktionen"
        );

        const bearbeitenButton = elementErstellen(
            "button",
            "btn btn-outline-primary bearbeiten-button",
            "Bearbeiten"
        );
        bearbeitenButton.type = "button";

        const loeschenFormular = document.createElement("form");
        loeschenFormular.action = `/veranstaltungen/${veranstaltung._id}/loeschen`;
        loeschenFormular.method = "POST";
        loeschenFormular.className = "d-inline loeschen-formular";

        const loeschenButton = elementErstellen("button", "btn btn-danger", "Löschen");
        loeschenButton.type = "submit";
        loeschenFormular.appendChild(loeschenButton);

        const bearbeitenBereich = elementErstellen(
            "div",
            "veranstaltung-bearbeiten mt-3"
        );
        bearbeitenBereich.hidden = true;
        bearbeitenBereich.append(
            document.createElement("hr"),
            elementErstellen("h4", "", "Veranstaltung bearbeiten")
        );

        const bearbeitenFormular = document.createElement("form");
        bearbeitenFormular.action = `/veranstaltungen/${veranstaltung._id}/bearbeiten`;
        bearbeitenFormular.method = "POST";
        bearbeitenFormular.enctype = "multipart/form-data";

        const titelGruppe = elementErstellen("div", "mb-3");
        titelGruppe.appendChild(elementErstellen("label", "form-label", "Titel"));

        const titelEmojiFeld = elementErstellen("div", "emoji-feld emoji-titel");
        const titelEmojiButton = elementErstellen("button", "emoji-button", "😀");
        titelEmojiButton.type = "button";
        titelEmojiButton.setAttribute("aria-label", "Emoji auswählen");

        const titelEingabe = elementErstellen("input", "form-control emoji-eingabe");
        titelEingabe.type = "text";
        titelEingabe.name = "titel";
        titelEingabe.value = veranstaltung.titel;
        titelEingabe.required = true;

        const titelPopup = elementErstellen("div", "emoji-picker-popup");
        titelPopup.hidden = true;
        const titelPicker = document.createElement("emoji-picker");
        titelPicker.setAttribute("locale", "de");
        titelPopup.appendChild(titelPicker);

        titelEmojiFeld.append(titelEmojiButton, titelEingabe, titelPopup);
        titelGruppe.appendChild(titelEmojiFeld);

        const datumGruppe = elementErstellen("div", "mb-3");
        datumGruppe.appendChild(elementErstellen("label", "form-label", "Datum"));

        const datumEingabe = elementErstellen("input", "form-control");
        datumEingabe.type = "date";
        datumEingabe.name = "datum";
        datumEingabe.value = veranstaltung.datum;
        datumEingabe.required = true;
        datumGruppe.appendChild(datumEingabe);

        const uhrzeitGruppe = elementErstellen("div", "mb-3");
        uhrzeitGruppe.appendChild(
            elementErstellen("label", "form-label", "Beginn (optional)")
        );

        const uhrzeitEingabe = elementErstellen("input", "form-control");
        uhrzeitEingabe.type = "time";
        uhrzeitEingabe.name = "uhrzeit";
        uhrzeitEingabe.value = veranstaltung.uhrzeit || "";
        uhrzeitGruppe.appendChild(uhrzeitEingabe);

        const beschreibungGruppe = elementErstellen("div", "mb-3");
        beschreibungGruppe.appendChild(
            elementErstellen("label", "form-label", "Beschreibung")
        );

        const beschreibungEmojiFeld = elementErstellen(
            "div",
            "emoji-feld emoji-beschreibung"
        );

        const beschreibungEmojiButton = elementErstellen(
            "button",
            "emoji-button",
            "😀"
        );
        beschreibungEmojiButton.type = "button";
        beschreibungEmojiButton.setAttribute("aria-label", "Emoji auswählen");

        const beschreibungEingabe = elementErstellen("textarea", "form-control");
        beschreibungEingabe.name = "beschreibung";
        beschreibungEingabe.rows = 3;
        beschreibungEingabe.required = true;
        beschreibungEingabe.value = veranstaltung.beschreibung;

        const beschreibungPopup = elementErstellen("div", "emoji-picker-popup");
        beschreibungPopup.hidden = true;
        const beschreibungPicker = document.createElement("emoji-picker");
        beschreibungPicker.setAttribute("locale", "de");
        beschreibungPopup.appendChild(beschreibungPicker);

        beschreibungEmojiFeld.append(
            beschreibungEmojiButton,
            beschreibungEingabe,
            beschreibungPopup
        );
        beschreibungGruppe.appendChild(beschreibungEmojiFeld);

        const bildGruppe = elementErstellen("div", "mb-3");
        bildGruppe.appendChild(
            elementErstellen("label", "form-label", "Neues Bild (optional)")
        );

        const bildEingabe = elementErstellen("input", "form-control");
        bildEingabe.type = "file";
        bildEingabe.name = "bild";
        bildEingabe.accept = "image/*";
        bildGruppe.appendChild(bildEingabe);

        if (veranstaltung.bild) {
            const checkboxGruppe = elementErstellen("div", "form-check mb-3");
            const checkbox = elementErstellen("input", "form-check-input");

            checkbox.type = "checkbox";
            checkbox.name = "bildEntfernen";
            checkbox.value = "true";
            checkbox.id = "bild-entfernen-" + veranstaltung._id;

            const checkboxLabel = elementErstellen(
                "label",
                "form-check-label",
                "Vorhandenes Bild entfernen"
            );
            checkboxLabel.htmlFor = checkbox.id;

            checkboxGruppe.append(checkbox, checkboxLabel);
            bearbeitenFormular.appendChild(checkboxGruppe);
        }

        const aktionen = elementErstellen("div", "admin-formular-aktionen");
        const speichernButton = elementErstellen(
            "button",
            "btn btn-success",
            "Änderungen speichern"
        );
        speichernButton.type = "submit";
        aktionen.appendChild(speichernButton);

        bearbeitenFormular.append(
            titelGruppe,
            datumGruppe,
            uhrzeitGruppe,
            beschreibungGruppe,
            bildGruppe,
            aktionen
        );

        bearbeitenBereich.appendChild(bearbeitenFormular);
        adminBereich.append(bearbeitenButton, loeschenFormular, bearbeitenBereich);
        karte.appendChild(adminBereich);

        emojiFeldVorbereiten(titelEmojiFeld);
        emojiFeldVorbereiten(beschreibungEmojiFeld);
    }

    eintrag.appendChild(karte);
    veranstaltungsliste.appendChild(eintrag);
}

async function veranstaltungenLaden() {
    if (!veranstaltungsliste || veranstaltungenWerdenGeladen) return;

    veranstaltungenWerdenGeladen = true;

    if (mehrVeranstaltungenButton) {
        mehrVeranstaltungenButton.disabled = true;
        mehrVeranstaltungenButton.textContent = "Wird geladen ...";
    }

    try {
        const antwort = await fetch(
            `/api/veranstaltungen?skip=${veranstaltungenGeladen}`
        );
        const daten = await antwort.json();

        if (!antwort.ok) {
            throw new Error(
                daten.message || "Veranstaltungen konnten nicht geladen werden."
            );
        }

        daten.veranstaltungen.forEach(veranstaltungAnzeigen);
        veranstaltungenGeladen += daten.veranstaltungen.length;

        if (mehrVeranstaltungenButton) {
            mehrVeranstaltungenButton.hidden = !daten.weitereVorhanden;
        }

    } catch (fehler) {
        console.error("Veranstaltungen konnten nicht geladen werden:", fehler);
        alert("Weitere Veranstaltungen konnten leider nicht geladen werden.");

    } finally {
        veranstaltungenWerdenGeladen = false;

        if (mehrVeranstaltungenButton) {
            mehrVeranstaltungenButton.disabled = false;
            mehrVeranstaltungenButton.textContent = "Mehr laden";
        }
    }
}

if (mehrVeranstaltungenButton) {
    mehrVeranstaltungenButton.addEventListener("click", veranstaltungenLaden);
}

document.addEventListener("submit", event => {
    if (
        event.target.classList.contains("loeschen-formular") &&
        !confirm("Möchtest du diesen Eintrag wirklich löschen?")
    ) {
        event.preventDefault();
    }
});

function varianteHinzufuegen(liste, menge = "", preis = "") {
    const zeile = elementErstellen("div", "d-flex gap-2 mb-2 variante-zeile");

    const mengenFeld = elementErstellen("input", "form-control");
    mengenFeld.type = "text";
    mengenFeld.placeholder = "Größe oder Bezeichnung";
    mengenFeld.value = menge;

    const preisFeld = elementErstellen("input", "form-control");
    preisFeld.type = "number";
    preisFeld.placeholder = "Preis in €";
    preisFeld.min = "0";
    preisFeld.step = "0.01";
    preisFeld.required = true;
    preisFeld.value = preis;

    const entfernenButton = elementErstellen("button", "btn btn-danger", "×");
    entfernenButton.type = "button";
    entfernenButton.title = "Variante entfernen";

    entfernenButton.addEventListener("click", () => {
        if (liste.querySelectorAll(".variante-zeile").length > 1) {
            zeile.remove();
        }
    });

    zeile.append(mengenFeld, preisFeld, entfernenButton);
    liste.appendChild(zeile);
}

document.querySelectorAll(".varianten-formular").forEach(formular => {
    const liste = formular.querySelector(".varianten-liste");
    const hiddenFeld = formular.querySelector(".preise-hidden");
    const hinzufuegenButton = formular.querySelector(".variante-hinzufuegen");

    if (!liste || !hiddenFeld || !hinzufuegenButton) return;

    const vorhandenePreise = hiddenFeld.value.trim();

    if (vorhandenePreise) {
        vorhandenePreise.split(";").forEach(eintrag => {
            const teile = eintrag.split("=");

            if (teile.length === 2) {
                varianteHinzufuegen(
                    liste,
                    teile[0].trim(),
                    teile[1].trim().replace(",", ".")
                );
            }
        });
    }

    if (liste.children.length === 0) varianteHinzufuegen(liste);

    hinzufuegenButton.addEventListener("click", () => varianteHinzufuegen(liste));

    formular.addEventListener("submit", event => {
        const varianten = [];

        liste.querySelectorAll(".variante-zeile").forEach(zeile => {
            const felder = zeile.querySelectorAll("input");
            const menge = felder[0].value.trim();
            const preis = felder[1].value.trim();

            if (preis !== "") {
                varianten.push(`${menge}=${preis.replace(",", ".")}`);
            }
        });

        if (varianten.length === 0) {
            event.preventDefault();
            alert("Bitte gib mindestens einen Preis ein.");
            return;
        }

        hiddenFeld.value = varianten.join("; ");
    });
});

const bildPopup = document.getElementById("bild-popup");
const popupBild = document.getElementById("popup-bild");
const popupSchliessen = document.getElementById("popup-schließen");

function bildPopupOeffnen(element) {
    if (!bildPopup || !popupBild) return;

    const bildAdresse = element.dataset.bild;
    if (!bildAdresse) return;

    popupBild.src = bildAdresse;
    popupBild.alt = element.dataset.name || "";
    bildPopup.hidden = false;
}

document.querySelectorAll(".speise-name-mit-bild").forEach(element => {
    element.addEventListener("click", () => bildPopupOeffnen(element));

    element.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            bildPopupOeffnen(element);
        }
    });
});

if (popupSchliessen && bildPopup) {
    popupSchliessen.addEventListener("click", () => {
        bildPopup.hidden = true;
        popupBild.src = "";
    });
}

if (bildPopup) {
    bildPopup.addEventListener("click", event => {
        if (event.target === bildPopup) {
            bildPopup.hidden = true;
            popupBild.src = "";
        }
    });
}

const bewertungsformular = document.getElementById("bewertungsformular");
const bewertungsliste = document.getElementById("bewertungsliste");
const bewertungMeldung = document.getElementById("bewertung-meldung");
const bewertungAbsenden = document.getElementById("bewertung-absenden");
const mehrBewertungenButton = document.getElementById("mehr-bewertungen");

let bewertungenGeladen = 0;
let bewertungenWerdenGeladen = false;

function datumFormatieren(datum) {
    if (!datum) return "";

    const richtigesDatum = new Date(datum);

    if (isNaN(richtigesDatum.getTime())) return "";

    return richtigesDatum.toLocaleDateString("de-AT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function sterneAktualisieren(vorschauWert = 0) {
    const ausgewaehlterWert = Number(
        document.querySelector(".sterne-auswahl input:checked")?.value || 0
    );

    document.querySelectorAll(".sterne-auswahl .stern-label").forEach(label => {
        const sternWert = Number(label.htmlFor.replace("sterne-", ""));

        label.classList.toggle("ausgewaehlt", sternWert <= ausgewaehlterWert);
        label.classList.toggle(
            "vorschau",
            vorschauWert > 0 && sternWert <= vorschauWert
        );
    });
}

const sterneBereich = document.querySelector(".sterne-auswahl");

if (sterneBereich) {
    sterneBereich.querySelectorAll(".stern-label").forEach(label => {
        const sternWert = Number(label.htmlFor.replace("sterne-", ""));

        label.addEventListener("pointerenter", () => sterneAktualisieren(sternWert));

        label.addEventListener("click", () => {
            const radio = document.getElementById("sterne-" + sternWert);

            if (radio) {
                radio.checked = true;
                sterneAktualisieren();
            }
        });
    });

    sterneBereich.addEventListener("pointerleave", () => sterneAktualisieren());

    sterneBereich.querySelectorAll("input").forEach(stern => {
        stern.addEventListener("change", () => sterneAktualisieren());
    });

    sterneAktualisieren();
}

function bewertungAnzeigen(bewertung) {
    const eintrag = elementErstellen("div", "bewertung-eintrag");
    const kopf = elementErstellen("div", "bewertung-kopf");
    const name = elementErstellen("h5", "", bewertung.name);
    const adminEingeloggt = bewertungsliste.dataset.admin === "true";

    const kopfRechts = elementErstellen(
        "div",
        "d-flex align-items-center flex-wrap gap-2"
    );

    const datum = elementErstellen(
        "small",
        "bewertung-datum",
        datumFormatieren(bewertung.erstelltAm || bewertung.datum)
    );

    kopfRechts.appendChild(datum);

    if (adminEingeloggt) {
        const bewertungLoeschenButton = elementErstellen(
            "button",
            "btn btn-danger btn-sm",
            "Bewertung löschen"
        );
        bewertungLoeschenButton.type = "button";

        bewertungLoeschenButton.addEventListener("click", async () => {
            if (!confirm("Möchtest du diese Bewertung wirklich löschen?")) return;

            bewertungLoeschenButton.disabled = true;

            try {
                const antwort = await fetch(`/api/bewertungen/${bewertung._id}`, {
                    method: "DELETE"
                });
                const daten = await antwort.json();

                if (!antwort.ok) {
                    throw new Error(
                        daten.message || "Bewertung konnte nicht gelöscht werden."
                    );
                }

                eintrag.remove();
                bewertungenGeladen = Math.max(0, bewertungenGeladen - 1);

                if (bewertungenGeladen === 0) {
                    bewertungsliste.textContent = "Noch keine Bewertungen vorhanden.";
                }

            } catch (fehler) {
                alert(fehler.message);
                bewertungLoeschenButton.disabled = false;
            }
        });

        kopfRechts.appendChild(bewertungLoeschenButton);
    }

    kopf.append(name, kopfRechts);

    const sterne = elementErstellen(
        "div",
        "bewertung-sterne",
        "★".repeat(bewertung.sterne) + "☆".repeat(5 - bewertung.sterne)
    );

    const kommentar = elementErstellen("p", "", bewertung.kommentar);
    eintrag.append(kopf, sterne, kommentar);

    if (bewertung.adminAntwort) {
        const antwortBereich = elementErstellen(
            "div",
            "admin-antwort mt-3 p-3"
        );

        const antwortTitel = elementErstellen(
            "strong",
            "",
            "Antwort vom Würstelbaron"
        );

        const antwortText = elementErstellen("p", "mb-0 mt-2", bewertung.adminAntwort);

        antwortBereich.append(antwortTitel, antwortText);
        eintrag.appendChild(antwortBereich);
    }

    if (adminEingeloggt) {
        const antwortAktionen = elementErstellen(
            "div",
            "bewertung-aktionen d-flex flex-wrap gap-2 mt-3"
        );

        const antwortFormular = document.createElement("form");
        antwortFormular.className = "antwort-formular mt-3";
        antwortFormular.hidden = true;

        const antwortFeld = elementErstellen("textarea", "form-control mb-2");
        antwortFeld.rows = 2;
        antwortFeld.maxLength = 1000;
        antwortFeld.placeholder = "Antwort auf diese Bewertung schreiben ...";
        antwortFeld.value = bewertung.adminAntwort || "";

        const speichernButton = elementErstellen(
            "button",
            "btn btn-success btn-sm",
            bewertung.adminAntwort ? "Änderungen speichern" : "Antworten"
        );
        speichernButton.type = "submit";

        antwortFormular.append(antwortFeld, speichernButton);

        if (bewertung.adminAntwort) {
            const bearbeitenButton = elementErstellen(
                "button",
                "btn btn-outline-primary btn-sm",
                "Bearbeiten"
            );
            bearbeitenButton.type = "button";

            const antwortLoeschenButton = elementErstellen(
                "button",
                "btn btn-outline-danger btn-sm",
                "Antwort löschen"
            );
            antwortLoeschenButton.type = "button";

            const schliessenButton = elementErstellen(
                "button",
                "btn btn-secondary btn-sm",
                "Schließen"
            );
            schliessenButton.type = "button";

            schliessenButton.addEventListener("click", () => {
                antwortFormular.hidden = true;
                antwortFeld.value = bewertung.adminAntwort;
                bearbeitenButton.hidden = false;
                antwortLoeschenButton.hidden = false;
            });

            bearbeitenButton.addEventListener("click", () => {
                antwortFormular.hidden = false;
                bearbeitenButton.hidden = true;
                antwortLoeschenButton.hidden = true;
                antwortFeld.focus();
            });

            antwortLoeschenButton.addEventListener("click", async () => {
                if (!confirm("Möchtest du deine Antwort wirklich löschen?")) return;

                antwortLoeschenButton.disabled = true;

                try {
                    const antwort = await fetch(
                        `/api/bewertungen/${bewertung._id}/antwort`,
                        { method: "DELETE" }
                    );
                    const daten = await antwort.json();

                    if (!antwort.ok) {
                        throw new Error(
                            daten.message || "Antwort konnte nicht gelöscht werden."
                        );
                    }

                    await bewertungenLaden(true);

                } catch (fehler) {
                    alert(fehler.message);
                    antwortLoeschenButton.disabled = false;
                }
            });

            antwortFormular.appendChild(schliessenButton);
            antwortAktionen.append(bearbeitenButton, antwortLoeschenButton);

        } else {
            const antwortButton = elementErstellen(
                "button",
                "btn btn-outline-primary btn-sm",
                "Antworten"
            );
            antwortButton.type = "button";

            antwortButton.addEventListener("click", () => {
                antwortFormular.hidden = false;
                antwortButton.hidden = true;
                antwortFeld.focus();
            });

            antwortAktionen.appendChild(antwortButton);
        }

        antwortFormular.addEventListener("submit", async event => {
            event.preventDefault();

            const text = antwortFeld.value.trim();

            if (!text) {
                alert("Bitte gib eine Antwort ein.");
                return;
            }

            speichernButton.disabled = true;

            try {
                const antwort = await fetch(
                    `/api/bewertungen/${bewertung._id}/antwort`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ antwort: text })
                    }
                );
                const daten = await antwort.json();

                if (!antwort.ok) {
                    throw new Error(
                        daten.message || "Antwort konnte nicht gespeichert werden."
                    );
                }

                await bewertungenLaden(true);

            } catch (fehler) {
                alert(fehler.message);
                speichernButton.disabled = false;
            }
        });

        eintrag.append(antwortAktionen, antwortFormular);
    }

    bewertungsliste.appendChild(eintrag);
}

async function bewertungenLaden(neuLaden = false) {
    if (!bewertungsliste || bewertungenWerdenGeladen) return;

    bewertungenWerdenGeladen = true;

    if (mehrBewertungenButton) {
        mehrBewertungenButton.disabled = true;
    }

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

        if (bewertungenGeladen === 0) bewertungsliste.innerHTML = "";

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
            bewertungsliste.textContent =
                "Bewertungen konnten gerade nicht geladen werden.";
        }

        console.error(fehler);

    } finally {
        bewertungenWerdenGeladen = false;

        if (mehrBewertungenButton) {
            mehrBewertungenButton.disabled = false;
        }
    }
}

if (bewertungsliste) {
    bewertungenLaden();

    if (mehrBewertungenButton) {
        mehrBewertungenButton.addEventListener("click", () => bewertungenLaden());
    }
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
                throw new Error(
                    daten.message || "Bewertung konnte nicht veröffentlicht werden."
                );
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
            newsletterMeldung.textContent =
                "Bitte gib eine gültige E-Mail-Adresse ein.";
            return;
        }

        if (!einwilligung) {
            newsletterMeldung.textContent =
                "Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu.";
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

if (kartenElement && typeof L !== "undefined") {
    const map = L.map("map");
    map.setView([47.67721, 15.94569], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>'
    }).addTo(map);

    const roterMarker = L.divIcon({
        className: "roter-kartenmarker",
        html: '<div class="marker-punkt"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    L.marker([47.67721, 15.94569], { icon: roterMarker })
        .addTo(map)
        .bindPopup("Würstelbaron – Bahnhofstraße 22")
        .openPopup();

    setTimeout(() => map.invalidateSize(), 200);
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
            .then(() => console.log("Service Worker wurde registriert"))
            .catch(fehler => console.log("Service Worker Error: ", fehler));
    });
}
