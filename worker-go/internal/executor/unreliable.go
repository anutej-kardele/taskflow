package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
)

// UnreliableExecutor intentionally fails some executions.
// It is useful for testing failure handling and, later, retries.
type UnreliableExecutor struct{}

var _ Executor = UnreliableExecutor{}

func (UnreliableExecutor) Execute(
	ctx context.Context,
	rawPayload json.RawMessage,
) error {

	var payload model.UnreliablePayload

	if err := json.Unmarshal(
		rawPayload,
		&payload,
	); err != nil {
		return fmt.Errorf(
			"invalid unreliable payload: %w",
			err,
		)
	}

	if payload.DurationMs <= 0 {
		return fmt.Errorf(
			"durationMs must be greater than 0",
		)
	}

	if payload.FailureRate < 0 ||
		payload.FailureRate > 1 {

		return fmt.Errorf(
			"failureRate must be between 0 and 1",
		)
	}

	timer := time.NewTimer(
		time.Duration(payload.DurationMs) *
			time.Millisecond,
	)
	defer timer.Stop()

	select {

	case <-timer.C:

	case <-ctx.Done():
		return ctx.Err()
	}

	/*
		rand.Float64() produces a value in [0.0, 1.0).

		Example:
		    failureRate = 0.30

		random = 0.12 -> fail
		random = 0.71 -> succeed
	*/
	if rand.Float64() < payload.FailureRate {
		return fmt.Errorf(
			"simulated unreliable job failure",
		)
	}

	return nil
}
