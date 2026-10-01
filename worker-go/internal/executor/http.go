package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
)

// HTTPExecutor handles HTTP jobs.
type HTTPExecutor struct{}

var _ Executor = HTTPExecutor{}

// Execute sends an HTTP GET request to the configured URL.
func (HTTPExecutor) Execute(
	ctx context.Context,
	rawPayload json.RawMessage,
) error {

	var payload model.HTTPPayload

	if err := json.Unmarshal(
		rawPayload,
		&payload,
	); err != nil {
		return fmt.Errorf(
			"invalid HTTP payload: %w",
			err,
		)
	}

	if payload.URL == "" {
		return fmt.Errorf(
			"url must not be empty",
		)
	}

	if payload.TimeoutMs <= 0 {
		return fmt.Errorf(
			"timeoutMs must be greater than 0",
		)
	}

	/*
		Create a timeout specifically for this HTTP request.

		It is also a child of the worker execution context,
		so worker shutdown or lease loss still cancels it.
	*/
	requestCtx, cancel := context.WithTimeout(
		ctx,
		time.Duration(payload.TimeoutMs)*time.Millisecond,
	)
	defer cancel()

	req, err := http.NewRequestWithContext(
		requestCtx,
		http.MethodGet,
		payload.URL,
		nil,
	)
	if err != nil {
		return fmt.Errorf(
			"failed to create HTTP request: %w",
			err,
		)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf(
			"HTTP request failed: %w",
			err,
		)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 ||
		resp.StatusCode >= 300 {

		return fmt.Errorf(
			"HTTP request returned status %s",
			resp.Status,
		)
	}

	return nil
}
