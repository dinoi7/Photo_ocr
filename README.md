# Foto OCR

Eine einfache Nextcloud-App zur Texterkennung (OCR) aus Bildern.

- Bild vom PC hochladen (Drag & Drop oder Dateiauswahl)
- Foto direkt mit dem Smartphone aufnehmen
- Optional **Live-Kamera** im Browser (`getUserMedia`) – das Foto landet dabei
  nicht in der Galerie (benötigt HTTPS)
- OCR startet automatisch nach dem Hochladen (Deutsch + Englisch)
- Bild vor der Erkennung drehen (90° links/rechts, 180°, Drehung zurücksetzen);
  nach dem Drehen wird automatisch neu erkannt
- Automatische Auswertung bekannter Maschinen-Screens:
  - **LightBurn** (Laser): liest die „Laser on time" (HH:MM:SS) aus
  - **Bambu Lab** (3D-Druck): liest Gewicht und Filament-Material (z. B. PLA) aus
  - Fehlt der Dezimalpunkt im Gewicht (z. B. `445g` statt `4.45g`), wird
    zusätzlich ein Vorschlag angezeigt
- OCR läuft **vollständig im Browser** (Tesseract.js / WebAssembly)
- Sprachen: Deutsch und Englisch
- Erkannter Text wird angezeigt, kann kopiert und geleert werden

## Datenschutz / Speicherung

- Es werden **keine Bilder hochgeladen und keine Bilder gespeichert**. Der
  Server hat nur eine GET-Route zum Rendern der Seite, keinen Upload-Endpunkt.
- Das Bild liegt nur im Arbeitsspeicher des Browsers (Preview-Objekt-URL bzw.
  Canvas-Blob) und wird danach wieder freigegeben.
- Tesseract legt lediglich die **Sprachdaten** (`deu/eng.traineddata`) im
  IndexedDB des Browsers ab (Cache, keine Bilder).
- Beim Aufnehmen über die Kamera-App des Systems kann das Betriebssystem das
  Foto in der Galerie ablegen; die Live-Kamera-Funktion tut das nicht.

## Funktionsweise

Das Frontend ist eine Vue-3-Anwendung, die mit Vite gebaut wird. Die
Texterkennung nutzt [Tesseract.js](https://github.com/naptha/tesseract.js).
Damit keine externen CDNs benötigt werden (und die Nextcloud-CSP eingehalten
wird), werden Worker, WebAssembly-Core und die Sprachdaten lokal mitgeliefert.

Der Server-Teil besteht nur aus einem Controller, der das Template rendert und
für diese Seite WebAssembly (`wasm-unsafe-eval`) in der CSP erlaubt.

### Auflösung und Tempo

Für die Anzeige wird das Bild auf 1200 px lange Kante verkleinert. Für die OCR
werden große Bilder (z. B. Handyfotos) auf **1800 px** herunterskaliert
(verhindert unnötig hohe Auflösung und beschleunigt die Erkennung), kleine
Screenshots dagegen bis zu 2× vergrößert (gedeckelt bei 2400 px), damit kleine
Ziffern und Satzzeichen sichtbar bleiben.

### OCR-Tuning für Zahlen

Damit Nachkommastellen zuverlässig erkannt werden, wird das Bild vor der OCR
in Graustufen umgewandelt und der Kontrast erhöht; Tesseract wird mit fester DPI
(300), erhaltenen Wortabständen und automatischer Seitensegmentierung
aufgerufen.

In der Auswertung werden typische OCR-Fehler korrigiert: ein als `9` verlesenes
Einheitenzeichen `g` sowie ein fehlender Dezimalpunkt (z. B. `11379` → Vorschlag
`11.37 g`). Bei fehlendem Punkt zeigt die App Rohwert und Vorschlag getrennt an.

## Voraussetzungen

- Nextcloud 30 – 34
- PHP 8.1+
- Node.js 18+ und npm (nur zum Bauen)

## Bauen

```bash
npm install
npm run build
```

Der Build erzeugt bzw. aktualisiert:

- `js/photo_ocr-main.js` – das Anwendungs-Bundle
- `css/photo_ocr-main.css` – die Styles
- `js/tesseract/worker.min.js`, `js/tesseract/core/*` – Tesseract
- `js/tesseract/lang/{deu,eng}.traineddata.gz` – Sprachdaten
  (werden beim ersten Build heruntergeladen)

## Installieren

Den App-Ordner nach `nextcloud/apps/photo_ocr` kopieren, Dateirechte setzen und
die App aktivieren:

```bash
rsync -a --delete ./ nextcloud/apps/photo_ocr/
chown -R www-data:www-data nextcloud/apps/photo_ocr
sudo -u www-data php nextcloud/occ app:enable photo_ocr
```

Anschließend ist die App über den Menüeintrag **Foto OCR** erreichbar
(Route `/apps/photo_ocr/`).

## Entwicklung

```bash
npm run dev      # Vite im Watch-Modus
npm run build    # Produktions-Build inkl. Assets
```

## Lizenz

AGPL-3.0-or-later, siehe [LICENSE](LICENSE).
