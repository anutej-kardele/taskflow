package executor

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"

	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
)

// CPUExecutor handles CPU-intensive jobs.
type CPUExecutor struct{}

var _ Executor = CPUExecutor{}

// Execute repeatedly calculates SHA-256 hashes.
// The number of iterations controls how much CPU work is performed.
func (CPUExecutor) Execute(
	ctx context.Context,
	rawPayload json.RawMessage,
) error {

	var payload model.CPUPayload

	if err := json.Unmarshal(
		rawPayload,
		&payload,
	); err != nil {
		return fmt.Errorf(
			"invalid CPU payload: %w",
			err,
		)
	}

	if payload.Iterations <= 0 {
		return fmt.Errorf(
			"iterations must be greater than 0",
		)
	}

	data := []byte("taskflow")

	for i := 0; i < payload.Iterations; i++ {

		/*
			Check cancellation periodically rather than
			on every single iteration.

			This keeps the CPU loop efficient while still
			allowing worker shutdown or lease loss to stop
			the job.
		*/
		if i%1000 == 0 {
			select {

			case <-ctx.Done():
				return ctx.Err()

			default:
			}
		}

		hash := sha256.Sum256(data)
		data = hash[:]
	}

	return nil
}
