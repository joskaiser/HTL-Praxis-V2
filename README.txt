HTL Praxis App v6.0.0
=====================

Zweck
-----
Installierbare PWA fuer Praxisunterricht auf Windows und Handy.
Daten koennen lokal/offline verwendet und ueber den geschuetzten OneDrive-App-Ordner synchronisiert werden.

Enthalten
---------
- Schuljahre, Klassen, Gruppen und Schueler flexibel anlegen
- Klassen-/Gruppenlisten per CSV importieren
- Gruppen-, Klassen-, Einheiten- und Schueleransicht
- Profilfoto je Schueler
- Werkstueckfotos je Schueler und Unterrichtseinheit
- Schulwoche automatisch aus Schulbeginn
- Gesamtstoff laden (TXT/CSV/JSON), automatisch oder manuell auf Ausbildungsbloecke verteilen
- globaler Stoff je Einheit, individuelle Abweichung je Schueler
- Fehlstunden aus kommt/geht und Unterrichtszeitmodell automatisch berechnen
- Lehrer-Anwesenheit je Einheit
- Bewertungen 0-4: Eigen, Lehrer, Arbeitsbericht, Unterlagen, Allgemein, Sonstiges
- Foerderbedarf, Foerderziel, Staerken und Notizen
- IndexedDB statt localStorage fuer groessere lokale Datenbestaende
- OneDrive-Synchronisierung mit Files.ReadWrite.AppFolder
- automatisches Cloud-Backup vor Ueberschreiben
- Konflikterkennung zwischen Geraeten
- optionaler Auto-Sync
- PWA Offline-Cache
- Updatepruefung und Update-Hinweis
- lokale JSON-Backups importieren/exportieren

Lokaler Windows-Test
--------------------
1. start_local.ps1 starten.
2. http://localhost:8080 oeffnet sich.
3. In Edge/Chrome kann die App ueber das Browser-Menue installiert werden.

Produktiver Einsatz PC + Handy
------------------------------
Dazu braucht die App:
1. eine feste HTTPS-Adresse (z.B. GitHub Pages / Azure Static Web Apps),
2. eine Microsoft-Entra-Appregistrierung als Single Page Application,
3. delegierte Graph-Berechtigungen:
   - User.Read
   - Files.ReadWrite.AppFolder
4. die HTTPS-Adresse als SPA Redirect URI.
5. die Client-ID unter Einstellungen in HTL Praxis eintragen.

Die App speichert ihre Cloud-Daten im OneDrive-App-Ordner:
Apps/<Name der Entra-App>/

Wichtig
-------
- Schuelerdaten, Fotos und Bewertungen sind personenbezogene Daten.
- Fuer den regulaeren Schulbetrieb nach Moeglichkeit das schulische Microsoft-365-Konto verwenden.
- Vor groesseren Aenderungen ist zusaetzlich ein JSON-Backup sinnvoll.

Updates
-------
Bei HTTPS-Betrieb prueft die PWA version.json. Nach einer neuen Bereitstellung erscheint in der App
"Neue Version verfuegbar". "Jetzt aktualisieren" aktiviert den neuen Service Worker und laedt die App neu.
Die OneDrive-/Unterrichtsdaten werden dabei nicht geloescht.
