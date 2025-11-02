# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o barcode-buddy-web-scan .

# Final stage
FROM scratch
COPY --from=builder /app/barcode-buddy-web-scan /barcode-buddy-web-scan
EXPOSE 8080
CMD ["/barcode-buddy-web-scan"]