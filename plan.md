# Webapp to scan barcodes

## Idea

Webapp to act as a barcode scanner for "Forceu/barcodebuddy: Barcode system for Grocy".
Golang serving the API and the webpage.

## Frontend

Use MediaDevices: getUserMedia() method to get video stream

https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

It should have a dropdown to choose which camera to use.

Use `ImageCapture: takePhoto() method`

Use `fillLightMode` "flash" to enable flash light.

https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture

https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture/takePhoto#filllightmode

Flash should be on by default, but there should be a button to turn off flash.

Use the Barcode Detection API to detect barcodes from the video stream

https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API

Give error if Barcode Detector is not supported by the browser.

Scanned data should be posted to API endpoint `/api/scan`

Have some kind of cooldown period between scans of the same code, so scanned code is only posted once.
If the duration between scans of same barcode is more than 3 seconds, then allow repost to the API.

The UI should show the video feed.

The frontend should be super simple. HTML, JS, CSS. Turned into dist and embedded inside Golang static binary using the Go embed package (https://pkg.go.dev/embed). Going to `/` should serve the static files.

## API

The API should be a super simple Golang `net/http` server with the `POST /api/scan` endpoint.
It should resend the received barcode to `https://${BBUDDY_HOST}/api/action/scan`
as `POST` request `multipart/form-data`, with `barcode` as form field and it should use authentication with header `BBUDDY-API-KEY=${BBUDDY_API_KEY}`.

BBUDDY_HOST and BBUDDY_API_KEY are provided as environment variables.

## Publishing

Write a simple Dockerfile that builds the GOlang static binary and puts it into `FROM scratch` image.
