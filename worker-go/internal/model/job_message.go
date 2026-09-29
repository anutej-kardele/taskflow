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