package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
)

func ExecuteSleep(ctx context.Context, rawPayload json.RawMessage) error {
	var payload model.SleepPayload

	if err := json.Unmarshal(rawPayload, &payload); 
	err != nil {
		return fmt.Errorf("invalid sleep payload: %w", err)
	}

	if payload.DurationMs <= 0 {
		return fmt.Errorf("durationMs must be greater than 0")
	}

	timer := time.NewTimer(
		time.Duration(payload.DurationMs) * time.Millisecond,
	)
	defer timer.Stop()

	select {
	case <-timer.C:
		return nil

	case <-ctx.Done():
		return ctx.Err()
	}
}