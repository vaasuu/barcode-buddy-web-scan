package main

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"

	_ "github.com/joho/godotenv/autoload"
)

//go:embed index.html script.js style.css
var staticFS embed.FS

func main() {
	http.Handle("/", http.FileServer(http.FS(staticFS)))
	http.HandleFunc("/api/scan", scanHandler)

	port := "8080"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	fmt.Printf("Starting server on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}

func scanHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("Invalid method: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	barcode := r.FormValue("barcode")
	if barcode == "" {
		log.Printf("Missing barcode in request")
		http.Error(w, "Missing barcode", http.StatusBadRequest)
		return
	}
	log.Printf("Received barcode: %s", barcode)

	host := os.Getenv("BBUDDY_HOST")
	apiKey := os.Getenv("BBUDDY_API_KEY")
	if host == "" || apiKey == "" {
		log.Printf("Missing env vars: BBUDDY_HOST or BBUDDY_API_KEY")
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	url := fmt.Sprintf("https://%s/api/action/scan", host)

	var b bytes.Buffer
	writer := multipart.NewWriter(&b)
	writer.WriteField("barcode", barcode)
	writer.Close()

	req, err := http.NewRequest(http.MethodPost, url, &b)
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("BBUDDY-API-KEY", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to forward request: %v", err)
		http.Error(w, "Failed to forward request", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("Forwarded request to %s, status: %d, body: %s", url, resp.StatusCode, string(body))
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
