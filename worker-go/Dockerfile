FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -o /taskflow-worker \
    ./cmd/worker


FROM alpine:3.22

WORKDIR /app

COPY --from=builder /taskflow-worker /app/taskflow-worker

ENTRYPOINT ["/app/taskflow-worker"]