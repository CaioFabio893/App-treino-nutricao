# syntax=docker/dockerfile:1

# 1) Build da API
FROM golang:1.23-alpine AS build
WORKDIR /app
# go.mod/go.sum primeiro: aproveita o cache de camada do `go mod download`.
COPY go.mod go.sum ./
RUN go mod download
# Código-fonte completo (main.go na raiz + camadas handlers/, middleware/,
# models/, repository/, service/). O .dockerignore exclui o que não entra
# na imagem (backend.exe, *.md, o próprio Dockerfile, etc.).
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /server .

# 2) Imagem final mínima (sem shell, sem pacotes extras)
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /server /server
ENV PORT=8080
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/server"]