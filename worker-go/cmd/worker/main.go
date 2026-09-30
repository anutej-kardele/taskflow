package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/anutej-kardele/taskflow/worker-go/internal/client"
	"github.com/anutej-kardele/taskflow/worker-go/internal/executor"
	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
	"github.com/segmentio/kafka-go"
)

func main() {
	const workerCount = 3

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var wg sync.WaitGroup

	log.Printf("TaskFlow starting with %d workers", workerCount)

	for workerID := 1; workerID <= workerCount; workerID++ {
		wg.Add(1)
		go runWorker(ctx, workerID, &wg)
	}

	wg.Wait()

	log.Println("TaskFlow worker process stopped")
}

func runWorker(ctx context.Context, workerID int, wg *sync.WaitGroup) {

	defer wg.Done()

	workerInstanceID := fmt.Sprintf("taskflow-%d-worker-%d", os.Getpid(), workerID)

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{"localhost:9092"},
		Topic:       "taskflow.jobs",
		GroupID:     "taskflow-workers",
		StartOffset: kafka.FirstOffset,
	})

	defer reader.Close()

	log.Printf("worker %s started", workerInstanceID)

	for {
		message, err := reader.FetchMessage(ctx)

		if err != nil {
			if ctx.Err() != nil {
				log.Printf("worker %s shutting down", workerInstanceID)
				return
			}

			log.Printf("worker %s failed to fetch message: %v", workerInstanceID, err)
			continue
		}

		success := processMessage(ctx, reader, message, workerInstanceID)
		if !success {
			log.Printf("worker %s stopping because message processing was unresolved", workerInstanceID)
			return
		}
	}
}

func processMessage(
	ctx context.Context,
	reader *kafka.Reader,
	message kafka.Message,
	workerID string,
) bool {

	var job model.JobMessage

	if err := json.Unmarshal(message.Value, &job); err != nil {
		log.Printf("invalid job message: %v", err)
		return false
	}

	log.Printf(
		"worker=%s received job id=%s type=%s workload=%s",
		workerID,
		job.JobID,
		job.Type,
		job.WorkloadID,
	)

	switch job.Type {

	case "SLEEP":

		var claimedJob *client.JobResponse

		for {

			jobResponse, claimErr := client.ClaimJob(
				ctx,
				job.JobID,
				workerID,
			)

			if claimErr == nil {
				claimedJob = jobResponse
				break
			}

			var controlPlaneErr *client.ControlPlaneError

			if !errors.As(claimErr, &controlPlaneErr) {
				log.Printf(
					"failed to contact control plane for job %s: %v",
					job.JobID,
					claimErr,
				)
				return false
			}

			switch controlPlaneErr.StatusCode {

			case http.StatusConflict:

				currentJob, getErr := client.GetJob(
					ctx,
					job.JobID,
				)

				if getErr != nil {
					log.Printf(
						"failed to get current state for job %s: %v",
						job.JobID,
						getErr,
					)
					return false
				}

				log.Printf(
					"job %s conflict: current status=%s attempt=%d",
					job.JobID,
					currentJob.Status,
					currentJob.Attempt,
				)

				if currentJob.Status == "COMPLETED" ||
					currentJob.Status == "FAILED" {

					log.Printf(
						"job %s already terminal with status=%s; committing duplicate Kafka message",
						job.JobID,
						currentJob.Status,
					)

					if err := reader.CommitMessages(
						ctx,
						message,
					); err != nil {

						log.Printf(
							"failed to commit duplicate job %s: %v",
							job.JobID,
							err,
						)

						return false
					}

					return true
				}

				if currentJob.Status == "RUNNING" &&
					currentJob.LeaseUntil != nil {

					leaseUntil, parseErr := time.Parse(
						time.RFC3339Nano,
						*currentJob.LeaseUntil,
					)

					if parseErr != nil {
						log.Printf(
							"failed to parse leaseUntil for job %s: %v",
							job.JobID,
							parseErr,
						)

						return false
					}

					waitDuration := time.Until(leaseUntil)

					if waitDuration <= 0 {

						log.Printf(
							"job %s lease has expired; retrying claim",
							job.JobID,
						)

						continue
					}

					waitDuration += 500 * time.Millisecond

					log.Printf(
						"job %s currently leased until %s; waiting %s before retry",
						job.JobID,
						leaseUntil.Format(time.RFC3339Nano),
						waitDuration.Round(time.Millisecond),
					)

					timer := time.NewTimer(waitDuration)

					select {

					case <-timer.C:

						log.Printf(
							"job %s lease wait finished; retrying claim",
							job.JobID,
						)

						continue

					case <-ctx.Done():

						timer.Stop()

						log.Printf(
							"worker %s stopped while waiting to retry job %s",
							workerID,
							job.JobID,
						)

						return false
					}
				}

				log.Printf(
					"job %s cannot currently be claimed: status=%s",
					job.JobID,
					currentJob.Status,
				)

				return false

			case http.StatusNotFound:

				log.Printf(
					"job %s does not exist",
					job.JobID,
				)

				return false

			default:

				log.Printf(
					"control plane error for job %s: %v",
					job.JobID,
					claimErr,
				)

				return false
			}
		}

		log.Printf(
			"job %s CLAIMED worker=%s attempt=%d",
			job.JobID,
			workerID,
			claimedJob.Attempt,
		)

		executionCtx, cancelExecution := context.WithCancel(ctx)
		defer cancelExecution()

		heartbeatCtx, stopHeartbeat := context.WithCancel(ctx)

		heartbeatDone := make(chan struct{})

		go runLeaseHeartbeat(
			heartbeatCtx,
			job.JobID,
			workerID,
			cancelExecution,
			heartbeatDone,
		)

		log.Printf(
			"job %s RUNNING",
			job.JobID,
		)

		execErr := executor.ExecuteSleep(
			executionCtx,
			job.Payload,
		)

		stopHeartbeat()
		<-heartbeatDone

		if execErr != nil {

			if errors.Is(execErr, context.Canceled) {

				if ctx.Err() != nil {

					log.Printf(
						"job %s interrupted because worker is shutting down",
						job.JobID,
					)

				} else {

					log.Printf(
						"job %s interrupted because lease renewal failed",
						job.JobID,
					)
				}

				return false
			}

			log.Printf(
				"job %s FAILED: %v",
				job.JobID,
				execErr,
			)

			if statusErr := client.UpdateJobStatus(
				ctx,
				job.JobID,
				"FAILED",
				workerID,
			); statusErr != nil {

				log.Printf(
					"failed to mark job %s FAILED: %v",
					job.JobID,
					statusErr,
				)

				return false
			}

			log.Printf(
				"job %s marked FAILED by worker %s",
				job.JobID,
				workerID,
			)

			break
		}

		if err := client.UpdateJobStatus(
			ctx,
			job.JobID,
			"COMPLETED",
			workerID,
		); err != nil {

			log.Printf(
				"failed to mark job %s COMPLETED, by worker %s: %v",
				job.JobID,
				workerID,
				err,
			)

			return false
		}

		log.Printf(
			"job %s COMPLETED, by worker %s",
			job.JobID,
			workerID,
		)

	default:

		log.Printf(
			"unsupported job type: %s",
			job.Type,
		)

		return false
	}

	if err := reader.CommitMessages(
		ctx,
		message,
	); err != nil {

		log.Printf(
			"failed to commit job %s: %v",
			job.JobID,
			err,
		)

		return false
	}

	return true
}

func runLeaseHeartbeat(
	ctx context.Context,
	jobID string,
	workerID string,
	cancelExecution context.CancelFunc,
	done chan<- struct{},
) {
	defer close(done)

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {

		case <-ctx.Done():
			return

		case <-ticker.C:

			if err := client.RenewLease(
				ctx,
				jobID,
				workerID,
			); err != nil {

				// Heartbeat was intentionally stopped.
				if ctx.Err() != nil {
					return
				}

				log.Printf(
					"job %s lease renewal failed: %v",
					jobID,
					err,
				)

				// We no longer know whether we own the job.
				cancelExecution()
				return
			}

			log.Printf(
				"job %s lease renewed by worker %s",
				jobID,
				workerID,
			)
		}
	}
}
