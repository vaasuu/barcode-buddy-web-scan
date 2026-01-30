package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strconv"

	_ "github.com/joho/godotenv/autoload"
)

//go:embed index.html script.js style.css
var staticFS embed.FS

func main() {
	http.Handle("/", http.FileServer(http.FS(staticFS)))
	http.HandleFunc("/api/scan", scanHandler)
	http.HandleFunc("/api/state/getmode", getModeHandler)
	http.HandleFunc("/api/state/setmode", setModeHandler)

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

func getModeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		log.Printf("Invalid method: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	host := os.Getenv("BBUDDY_HOST")
	apiKey := os.Getenv("BBUDDY_API_KEY")
	if host == "" || apiKey == "" {
		log.Printf("Missing env vars: BBUDDY_HOST or BBUDDY_API_KEY")
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	url := fmt.Sprintf("https://%s/api/state/getmode", host)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func setModeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("Invalid method: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stateStr := r.FormValue("state")
	if stateStr == "" {
		log.Printf("Missing state in request")
		http.Error(w, "Missing state", http.StatusBadRequest)
		return
	}

	state, err := strconv.Atoi(stateStr)
	if err != nil {
		log.Printf("Invalid state value: %s", stateStr)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{
				"data": nil,
				"result": map[string]interface{}{
					"result":    "Invalid state provided",
					"http_code": 400,
				},
			},
		})
		return
	}

	host := os.Getenv("BBUDDY_HOST")
	apiKey := os.Getenv("BBUDDY_API_KEY")
	if host == "" || apiKey == "" {
		log.Printf("Missing env vars: BBUDDY_HOST or BBUDDY_API_KEY")
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	apiURL := fmt.Sprintf("https://%s/api/state/setmode", host)

	formData := url.Values{}
	formData.Set("state", strconv.Itoa(state))

	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewBufferString(formData.Encode()))
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
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
	log.Printf("Forwarded request to %s, status: %d, body: %s", apiURL, resp.StatusCode, string(body))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
