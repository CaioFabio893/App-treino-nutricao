# syntax=docker/dockerfile:1

# 1) Build da API
FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /server .

# 2) Imagem final mínima (sem shell, sem pacotes extras)
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /server /server
ENV PORT=8080
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/server"]