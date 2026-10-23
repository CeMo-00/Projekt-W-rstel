const bildPopup = document.getElementById("bild-popup");
const popupBild = document.getElementById("popup-bild");
const popupSchliessen = document.getElementById("popup-schließen");

if (bildPopup && popupBild) {
    document.querySelectorAll(".gericht").forEach(gericht => {
        const name = gericht.querySelector(".gericht-name");
        const bild = gericht.querySelector(".gericht-bild");

        if (!name || !bild) return;
        name.addEventListener("click", () => {
            popupBild.src = bild.src;
            popupBild.alt = bild.alt;
            bildPopup.hidden = false;
        });
    });

    function popupSchliessenFunktion() {
        bildPopup.hidden = true;
        popupBild.src = "";
    }

    popupSchliessen?.addEventListener("click", popupSchliessenFunktion);
    bildPopup.addEventListener("click", event => {
        if (event.target === bildPopup) popupSchliessenFunktion();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") popupSchliessenFunktion();
    });
}

const loginForm = document.getElementById("login-formular");
const loginMeldung = document.getElementById("login-meldung");
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
            if (antwort.ok) {
                window.location.href = "/veranstaltungen";
            } else {
                loginMeldung.textContent = daten.message || "Login fehlgeschlagen.";
            }
        } catch {
            loginMeldung.textContent = "Server nicht erreichbar. Bitte erneut versuchen.";
        }
    });
}

const adminBereich = document.getElementById("admin-bereich");
const logoutButton = document.getElementById("logout-button");

function loginStatusAnzeigen(eingeloggt) {
    if (adminBereich) adminBereich.hidden = !eingeloggt;

    document.querySelectorAll(".veranstaltung-admin-aktionen")
        .forEach(element => element.hidden = !eingeloggt);
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

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            const antwort = await fetch("/api/logout", { method: "POST" });
            if (!antwort.ok) throw new Error("Logout fehlgeschlagen");

            loginStatusAnzeigen(false);
            window.location.href = "/veranstaltungen";
        } catch (fehler) {
            console.error("Abmelden fehlgeschlagen:", fehler);
        }
    });
}

if (adminBereich) loginStatusCheck();