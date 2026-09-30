package client 

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const controlPlaneBaseURL = "http://localhost:8080"

var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}


func UpdateJobStatus(ctx context.Context, jobID string, status string,) error {

	payload := UpdateStatusRequest{Status: status,}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal status request: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/api/jobs/%s/status", controlPlaneBaseURL, jobID,)

	req, err := http.NewRequestWithContext(requestCtx, http.MethodPatch, url, bytes.NewReader(jsonData),)
	if err != nil {
		return fmt.Errorf("failed to create status request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("status update request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf(
			"control plane returned status %s",
			resp.Status,
		)
	}

	return nil
}