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
	Status   string `json:"status"`
	WorkerID string `json:"workerId"`
}

type JobResponse struct {
	ID          string  `json:"id"`
	Status      string  `json:"status"`
	Attempt     int     `json:"attempt"`
	MaxAttempts int     `json:"maxAttempts"`
	LastError   *string `json:"lastError"`
	NextRetryAt *string `json:"nextRetryAt"`
	WorkerID    *string `json:"workerId"`
	StartedAt   *string `json:"startedAt"`
	LeaseUntil  *string `json:"leaseUntil"`
}

type ControlPlaneError struct {
	StatusCode int
	Status     string
}

func (e *ControlPlaneError) Error() string {
	return fmt.Sprintf(
		"control plane returned %s",
		e.Status,
	)
}

type ClaimJobRequest struct {
	WorkerID string `json:"workerId"`
}

type RenewLeaseRequest struct {
	WorkerID string `json:"workerId"`
}

type ReportJobFailureRequest struct {
	WorkerID string `json:"workerId"`
	Error    string `json:"error"`
}

func UpdateJobStatus(ctx context.Context, jobID string, status string, workerID string) error {

	payload := UpdateStatusRequest{Status: status, WorkerID: workerID}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal status request: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/api/jobs/%s/status", controlPlaneBaseURL, jobID)

	req, err := http.NewRequestWithContext(requestCtx, http.MethodPatch, url, bytes.NewReader(jsonData))
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
		return &ControlPlaneError{
			StatusCode: resp.StatusCode,
			Status:     resp.Status,
		}
	}

	return nil
}

func GetJob(ctx context.Context, jobID string) (*JobResponse, error) {

	requestCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/api/jobs/%s", controlPlaneBaseURL, jobID)

	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create get job request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get job request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &ControlPlaneError{
			StatusCode: resp.StatusCode,
			Status:     resp.Status,
		}
	}

	var job JobResponse

	if err := json.NewDecoder(resp.Body).Decode(&job); err != nil {
		return nil, fmt.Errorf("failed to decode job response: %w", err)
	}

	return &job, nil
}

func ClaimJob(ctx context.Context, jobID string, workerID string) (*JobResponse, error) {

	payload := ClaimJobRequest{
		WorkerID: workerID,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to marshal claim request: %w",
			err,
		)
	}

	requestCtx, cancel := context.WithTimeout(
		ctx,
		5*time.Second,
	)
	defer cancel()

	url := fmt.Sprintf("%s/api/jobs/%s/claim", controlPlaneBaseURL, jobID)

	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf(
			"failed to create claim request: %w",
			err,
		)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"claim job request failed: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &ControlPlaneError{
			StatusCode: resp.StatusCode,
			Status:     resp.Status,
		}
	}

	var job JobResponse

	if err := json.NewDecoder(resp.Body).Decode(&job); err != nil {
		return nil, fmt.Errorf(
			"failed to decode claim response: %w",
			err,
		)
	}

	return &job, nil
}

func RenewLease(
	ctx context.Context,
	jobID string,
	workerID string,
) error {

	payload := RenewLeaseRequest{
		WorkerID: workerID,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf(
			"failed to marshal lease renewal request: %w",
			err,
		)
	}

	requestCtx, cancel := context.WithTimeout(
		ctx,
		5*time.Second,
	)
	defer cancel()

	url := fmt.Sprintf(
		"%s/api/jobs/%s/lease",
		controlPlaneBaseURL,
		jobID,
	)

	req, err := http.NewRequestWithContext(
		requestCtx,
		http.MethodPatch,
		url,
		bytes.NewReader(jsonData),
	)
	if err != nil {
		return fmt.Errorf(
			"failed to create lease renewal request: %w",
			err,
		)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf(
			"lease renewal request failed: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &ControlPlaneError{
			StatusCode: resp.StatusCode,
			Status:     resp.Status,
		}
	}

	return nil
}

func ReportJobFailure(
	ctx context.Context,
	jobID string,
	workerID string,
	errorMessage string,
) (*JobResponse, error) {

	payload := ReportJobFailureRequest{
		WorkerID: workerID,
		Error:    errorMessage,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to marshal failure request: %w",
			err,
		)
	}

	requestCtx, cancel := context.WithTimeout(
		ctx,
		5*time.Second,
	)
	defer cancel()

	url := fmt.Sprintf(
		"%s/api/jobs/%s/failure",
		controlPlaneBaseURL,
		jobID,
	)

	req, err := http.NewRequestWithContext(
		requestCtx,
		http.MethodPatch,
		url,
		bytes.NewReader(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to create failure request: %w",
			err,
		)
	}

	req.Header.Set(
		"Content-Type",
		"application/json",
	)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(
			"failure report request failed: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 ||
		resp.StatusCode >= 300 {

		return nil, &ControlPlaneError{
			StatusCode: resp.StatusCode,
			Status:     resp.Status,
		}
	}

	var job JobResponse

	if err := json.NewDecoder(
		resp.Body,
	).Decode(&job); err != nil {

		return nil, fmt.Errorf(
			"failed to decode failure response: %w",
			err,
		)
	}

	return &job, nil
}
