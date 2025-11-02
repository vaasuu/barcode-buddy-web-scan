package main

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
)

//go:embed static/*
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
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	barcode := r.FormValue("barcode")
	if barcode == "" {
		http.Error(w, "Missing barcode", http.StatusBadRequest)
		return
	}

	host := os.Getenv("BBUDDY_HOST")
	apiKey := os.Getenv("BBUDDY_API_KEY")
	if host == "" || apiKey == "" {
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
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("BBUDDY-API-KEY", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Failed to forward request", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
