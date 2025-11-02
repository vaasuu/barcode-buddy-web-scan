# AGENTS.md - Development Guidelines for barcode-buddy-web-scan

## Commands

- Build: `go build` (Go binary with embedded web assets)
- Test all: `go test ./...`
- Test single: `go test -run TestName`
- Lint: `go vet ./...`
- Format check: `gofmt -d .`
- Format: `gofmt -w .`

## Code Style Guidelines

### Go Backend

- `gofmt` formatting, explicit error handling (`if err != nil`)
- `context.Context` for requests
- Env vars: `BBUDDY_HOST`, `BBUDDY_API_KEY`
- PascalCase exported, camelCase unexported

### Web Frontend

- Simple HTML/JS/CSS, no frameworks
- Modern APIs: MediaDevices, Barcode Detection
- Handle unsupported browser features
- POST to `/api/scan`, 3s cooldown for duplicate scans

### General

- Minimal frontend embedded in Go binary using embed package
- Standard Go project layout
