HTL PRAXIS v5 - INSTALLATION

WINDOWS - sofort lokal nutzbar
1. ZIP entpacken, ideal nach OneDrive\Dokumente\HTL\HTL Praxis App.
2. install_windows.ps1 mit Rechtsklick -> Mit PowerShell ausfuehren.
3. Danach gibt es am Desktop die Verknuepfung "HTL Praxis".
4. Die App startet lokal unter http://localhost:8080.
5. In Edge/Chrome kann zusaetzlich "App installieren" gewaehlt werden.

HANDY / TABLET
Eine PWA kann auf dem Handy nicht direkt aus einem OneDrive-Dateiordner installiert werden.
Die App-Dateien muessen einmalig unter einer HTTPS-Adresse bereitgestellt werden.
Die Schuelerdaten koennen trotzdem in OneDrive bleiben.
Nach Bereitstellung:
- Android/Chrome: App oeffnen -> App installieren / Zum Startbildschirm hinzufuegen.
- iPhone/iPad/Safari: Teilen -> Zum Home-Bildschirm.

ONEDRIVE-SYNCHRONISIERUNG
In Einstellungen wird die Microsoft-Entra Client-ID eingetragen.
Die App verwendet Microsoft Graph und speichert den zentralen Datenbestand im eingestellten OneDrive-Ordner.
Fuer die produktive Handy-Version muss die HTTPS-Adresse als Redirect-URI in der Entra-Appregistrierung eingetragen sein.

WICHTIG
Die HTTPS-Bereitstellung und Entra-Appregistrierung sind einmalige Einrichtungsschritte. Ohne feste HTTPS-Adresse kann die Handyinstallation und Microsoft-Anmeldung nicht produktiv fertig eingerichtet werden.
