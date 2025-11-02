# Build stage
FROM golang:1.25.3-alpine AS builder
WORKDIR /app
RUN apk update && apk upgrade && apk add --no-cache ca-certificates
RUN update-ca-certificates
COPY . .
RUN go build -o barcode-buddy-web-scan .

# Final stage
FROM scratch
COPY --from=builder /app/barcode-buddy-web-scan /barcode-buddy-web-scan
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
CMD ["/barcode-buddy-web-scan"]
