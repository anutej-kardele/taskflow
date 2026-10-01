package model

import "encoding/json"

type JobMessage struct {
	JobID      string          `json:"jobId"`
	WorkloadID string          `json:"workloadId"`
	Type       string          `json:"type"`
	Payload    json.RawMessage `json:"payload"`
}

type SleepPayload struct {
	DurationMs int `json:"durationMs"`
}

type CPUPayload struct {
	Iterations int `json:"iterations"`
}

type HTTPPayload struct {
	URL       string `json:"url"`
	TimeoutMs int    `json:"timeoutMs"`
}

type UnreliablePayload struct {
	FailureRate float64 `json:"failureRate"`
	DurationMs  int     `json:"durationMs"`
}
