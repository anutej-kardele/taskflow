package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/anutej-kardele/taskflow/worker-go/internal/client"
	"github.com/anutej-kardele/taskflow/worker-go/internal/executor"
	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
	"github.com/segmentio/kafka-go"
)

func main() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{"localhost:9092"},
		Topic:       "taskflow.jobs",
		GroupID:     "taskflow-workers",
		StartOffset: kafka.FirstOffset,
	})

	defer reader.Close()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	log.Println("TaskFlow worker started")
	log.Println("Waiting for jobs...")

	for {
		message, err := reader.FetchMessage(ctx)

		if err != nil {
			if ctx.Err() != nil {
				log.Println("Worker shutting down")
				return
			}

			log.Printf("failed to read message: %v", err)
			continue
		}

		var job model.JobMessage

		if err := json.Unmarshal(message.Value, &job); err != nil {
			log.Printf("invalid job message: %v", err)
			continue
		}

		log.Printf(
			"received job id=%s type=%s workload=%s",
			job.JobID,
			job.Type,
			job.WorkloadID,
		)

		switch job.Type {

		case "SLEEP":

			if err := client.UpdateJobStatus(ctx, job.JobID, "RUNNING"); err != nil {
				log.Printf("failed to mark job %s RUNNING: %v", job.JobID, err)
				continue
			}

			log.Printf("job %s RUNNING", job.JobID)

			if err := executor.ExecuteSleep(ctx, job.Payload); err != nil {

				log.Printf("job %s FAILED: %v", job.JobID, err)

				if statusErr := client.UpdateJobStatus(ctx, job.JobID, "FAILED"); statusErr != nil {
					log.Printf("failed to mark job %s FAILED: %v", job.JobID, statusErr)
				}

				continue
			}

			if err := client.UpdateJobStatus(ctx, job.JobID, "COMPLETED"); err != nil {
				log.Printf("failed to mark job %s COMPLETED: %v", job.JobID, err)
				continue
			}

			log.Printf("job %s COMPLETED", job.JobID)

		default:
			log.Printf(
				"unsupported job type: %s",
				job.Type,
			)

			continue
		}

		if err := reader.CommitMessages(ctx, message); err != nil {
			log.Printf(
				"failed to commit job %s: %v",
				job.JobID,
				err,
			)
		}
	}
}
