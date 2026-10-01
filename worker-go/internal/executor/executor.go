package executor

import (
	"context"
	"encoding/json"
)

type Executor interface {
	Execute(
		ctx context.Context,
		payload json.RawMessage,
	) error
}
