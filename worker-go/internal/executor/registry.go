package executor

import "fmt"

func ForType(jobType string) (Executor, error) {

	switch jobType {

	case "SLEEP":
		return SleepExecutor{}, nil

	case "CPU":
		return CPUExecutor{}, nil

	case "HTTP":
		return HTTPExecutor{}, nil

	case "UNRELIABLE":
		return UnreliableExecutor{}, nil

	default:
		return nil, fmt.Errorf(
			"unsupported job type: %s",
			jobType,
		)
	}
}
