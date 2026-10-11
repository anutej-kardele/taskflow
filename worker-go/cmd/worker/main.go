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
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/anutej-kardele/taskflow/worker-go/internal/client"
	"github.com/anutej-kardele/taskflow/worker-go/internal/executor"
	"github.com/anutej-kardele/taskflow/worker-go/internal/health"
	workermetrics "github.com/anutej-kardele/taskflow/worker-go/internal/metrics"
	"github.com/anutej-kardele/taskflow/worker-go/internal/model"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/segmentio/kafka-go"

	"github.com/anutej-kardele/taskflow/worker-go/internal/telemetry"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

func main() {
	workerCount := getWorkerCount()
	nodeID := getNodeID()
	kafkaBrokers := getKafkaBrokers()
	kafkaTopic := getKafkaTopic()
	kafkaGroupID := getKafkaGroupID()

	redisAddr := getRedisAddr()
	startedAt := time.Now().UTC()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	otelEndpoint := getOTLPEndpoint()

	shutdownTracing, err := telemetry.SetupTracing(ctx, nodeID, otelEndpoint)

	if err != nil {
		log.Printf("OpenTelemetry tracing disabled: %v", err)
	} else {
		log.Printf("OpenTelemetry tracing enabled endpoint=%s", otelEndpoint)

		defer func() {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			if err := shutdownTracing(shutdownCtx); err != nil {
				log.Printf("OpenTelemetry shutdown error: %v", err)
			}
		}()
	}

	workerMetrics := workermetrics.New(nodeID)
	metricsDone := make(chan struct{})
	go runMetricsServer(ctx, ":2112", metricsDone)

	var wg sync.WaitGroup

	healthDone := make(chan struct{})
	go health.RunHeartbeat(ctx, redisAddr, nodeID, workerCount, startedAt, healthDone)

	log.Printf("TaskFlow node=%s starting with %d worker slots", nodeID, workerCount)

	log.Printf("Kafka brokers=%v topic=%s group=%s", kafkaBrokers, kafkaTopic, kafkaGroupID)

	log.Printf("Redis health=%s", redisAddr)

	for slotID := 1; slotID <= workerCount; slotID++ {
		wg.Add(1)
		go runWorker(ctx, nodeID, slotID, kafkaBrokers, kafkaTopic, kafkaGroupID, workerMetrics, &wg)
	}

	wg.Wait()
	<-healthDone
	<-metricsDone

	log.Printf("TaskFlow node=%s stopped", nodeID)
}

func getRedisAddr() string {

	value := os.Getenv(
		"TASKFLOW_REDIS_ADDR",
	)

	if value == "" {
		return "localhost:6379"
	}

	return value
}

func getWorkerCount() int {

	const defaultWorkerCount = 3

	value := os.Getenv(
		"TASKFLOW_WORKER_CONCURRENCY",
	)

	if value == "" {
		return defaultWorkerCount
	}

	workerCount, err := strconv.Atoi(value)

	if err != nil || workerCount <= 0 {
		log.Printf(
			"invalid TASKFLOW_WORKER_CONCURRENCY=%q; using default=%d",
			value,
			defaultWorkerCount,
		)

		return defaultWorkerCount
	}

	return workerCount
}

func getNodeID() string {
	value := os.Getenv(
		"TASKFLOW_NODE_ID",
	)

	if value != "" {
		return value
	}

	/*
		Local fallback.

		PIDs make multiple worker processes on the
		same machine distinguishable even when no
		explicit node ID was configured.
	*/
	return fmt.Sprintf(
		"local-%d",
		os.Getpid(),
	)
}

func getKafkaBrokers() []string {
	value := os.Getenv(
		"TASKFLOW_KAFKA_BROKERS",
	)

	if value == "" {
		return []string{
			"localhost:9092",
		}
	}

	parts := strings.Split(
		value,
		",",
	)

	brokers := make(
		[]string,
		0,
		len(parts),
	)

	for _, part := range parts {
		broker :=
			strings.TrimSpace(
				part,
			)

		if broker != "" {
			brokers =
				append(
					brokers,
					broker,
				)
		}
	}

	if len(brokers) == 0 {
		return []string{
			"localhost:9092",
		}
	}

	return brokers
}

func getKafkaTopic() string {
	value := os.Getenv(
		"TASKFLOW_KAFKA_TOPIC",
	)

	if value == "" {
		return "taskflow.jobs"
	}

	return value
}

func getKafkaGroupID() string {
	value := os.Getenv(
		"TASKFLOW_KAFKA_GROUP_ID",
	)

	if value == "" {
		return "taskflow-workers"
	}

	return value
}

func runWorker(
	ctx context.Context,
	nodeID string,
	slotID int,
	kafkaBrokers []string,
	kafkaTopic string,
	kafkaGroupID string,
	workerMetrics *workermetrics.WorkerMetrics,
	wg *sync.WaitGroup,
) {

	defer wg.Done()
	workerInstanceID := fmt.Sprintf("%s-slot-%d", nodeID, slotID)
	const restartBackoff = 2 * time.Second

	/*
		Each worker slot acts as a supervisor.

		If message processing becomes unresolved because
		of a temporary infrastructure problem, the slot
		recycles its Kafka reader and rejoins the consumer
		group instead of permanently exiting.
	*/
	for {

		if ctx.Err() != nil {
			log.Printf("worker %s shutting down", workerInstanceID)
			return
		}

		reader := kafka.NewReader(
			kafka.ReaderConfig{
				Brokers:                kafkaBrokers,
				Topic:                  kafkaTopic,
				GroupID:                kafkaGroupID,
				StartOffset:            kafka.FirstOffset,
				WatchPartitionChanges:  true,
				PartitionWatchInterval: 5 * time.Second,
			},
		)

		log.Printf("worker %s consumer session started", workerInstanceID)
		restartSession := false

		for {

			message, err := reader.FetchMessage(ctx)

			if err != nil {

				if ctx.Err() != nil {
					_ = reader.Close()
					log.Printf("worker %s shutting down", workerInstanceID)
					return
				}

				log.Printf("worker %s failed to fetch message: %v", workerInstanceID, err)
				continue
			}

			success := processMessage(ctx, reader, message, workerInstanceID, workerMetrics)
			if success {
				continue
			}

			/*
				The message was intentionally left
				uncommitted.

				Recycle the reader so Kafka can rebalance
				and redeliver the unresolved message.
			*/
			log.Printf("worker %s message processing unresolved; recycling consumer session", workerInstanceID)
			restartSession = true
			break
		}

		if err := reader.Close(); err != nil {
			log.Printf("worker %s failed to close Kafka reader: %v", workerInstanceID, err)
		}

		if ctx.Err() != nil {
			log.Printf("worker %s shutting down", workerInstanceID)
			return
		}

		if !restartSession {
			continue
		}

		log.Printf("worker %s restarting consumer session in %s", workerInstanceID, restartBackoff)

		timer := time.NewTimer(restartBackoff)

		select {

		case <-timer.C:
			log.Printf("worker %s restarting consumer session", workerInstanceID)

		case <-ctx.Done():

			timer.Stop()
			log.Printf("worker %s shutting down during restart backoff", workerInstanceID)
			return
		}
	}
}

func processMessage(
	ctx context.Context,
	reader *kafka.Reader,
	message kafka.Message,
	workerID string,
	workerMetrics *workermetrics.WorkerMetrics,
) bool {

	var job model.JobMessage

	if err := json.Unmarshal(message.Value, &job); err != nil {
		log.Printf("invalid job message: %v", err)
		return false
	}

	log.Printf("worker=%s received job id=%s type=%s workload=%s", workerID, job.JobID, job.Type, job.WorkloadID)

	ctx = telemetry.ExtractKafkaContext(ctx, message.Headers)
	tracer := otel.Tracer("taskflow-worker")

	processCtx, processSpan :=
		tracer.Start(ctx, "job.process")

	processSpan.SetAttributes(
		attribute.String("taskflow.job.id", job.JobID),
		attribute.String("taskflow.workload.id", job.WorkloadID),
		attribute.String("taskflow.job.type", job.Type),
		attribute.String("taskflow.worker.id", workerID),
	)

	defer processSpan.End()
	ctx = processCtx

	jobExecutor, err := executor.ForType(job.Type)

	if err != nil {
		log.Printf("job %s rejected: %v", job.JobID, err)
		return false
	}

	var claimedJob *client.JobResponse

	/*
		Keep attempting to claim this same Kafka message.

		If another worker still owns an active lease,
		we wait until that lease expires rather than
		killing this worker.
	*/
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

		if !errors.As(
			claimErr,
			&controlPlaneErr,
		) {

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

			/*
				COMPLETED and FAILED are currently
				terminal states.

				If Kafka redelivers the message,
				there is nothing left to execute.
			*/
			if currentJob.Status == "COMPLETED" ||
				currentJob.Status == "FAILED" ||
				currentJob.Status == "RETRYING" {

				log.Printf(
					"job %s already handled with status=%s; committing stale Kafka message",
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

			/*
				A RUNNING job may belong to another
				worker whose lease has not expired yet.
			*/
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

				waitDuration := time.Until(
					leaseUntil,
				)

				/*
					If our local clock says the lease
					has already expired, retry immediately.

					Spring/Mongo still makes the real
					ownership decision.
				*/
				if waitDuration <= 0 {

					log.Printf(
						"job %s lease has expired; retrying claim",
						job.JobID,
					)

					continue
				}

				/*
					Small buffer prevents retrying exactly
					on the expiration boundary.
				*/
				waitDuration += 500 * time.Millisecond

				log.Printf(
					"job %s currently leased until %s; waiting %s before retry",
					job.JobID,
					leaseUntil.Format(
						time.RFC3339Nano,
					),
					waitDuration.Round(
						time.Millisecond,
					),
				)

				timer := time.NewTimer(
					waitDuration,
				)

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

	log.Printf("job %s CLAIMED worker=%s attempt=%d", job.JobID, workerID, claimedJob.Attempt)

	processSpan.SetAttributes(attribute.Int("taskflow.job.attempt", claimedJob.Attempt))

	/*
		executionCtx controls the actual executor.

		If heartbeat renewal fails, the heartbeat
		can cancel this context.
	*/
	executionCtx, cancelExecution :=
		context.WithCancel(ctx)

	defer cancelExecution()

	/*
		heartbeatCtx controls only the heartbeat.

		When execution ends normally, we cancel
		this context to stop lease renewal.
	*/
	heartbeatCtx, stopHeartbeat :=
		context.WithCancel(ctx)

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

	workerMetrics.ExecutionStarted(job.Type)
	executionStartedAt := time.Now()

	executionCtx, executionSpan := tracer.Start(executionCtx, "job.execute")

	executionSpan.SetAttributes(
		attribute.String("taskflow.job.id", job.JobID),
		attribute.String("taskflow.job.type", job.Type),
		attribute.String("taskflow.worker.id", workerID))

	execErr := jobExecutor.Execute(executionCtx, job.Payload)

	executionDuration := time.Since(executionStartedAt)

	executionSpan.SetAttributes(attribute.Int64("taskflow.job.execution_ms", executionDuration.Milliseconds()))

	if execErr != nil && !errors.Is(execErr, context.Canceled) {

		executionSpan.RecordError(execErr)
		executionSpan.SetStatus(codes.Error, execErr.Error())
		processSpan.RecordError(execErr)
		processSpan.SetStatus(codes.Error, execErr.Error())
	}

	executionSpan.End()

	workerMetrics.ExecutionFinished(job.Type, executionDuration)

	if execErr != nil && !errors.Is(execErr, context.Canceled) {
		workerMetrics.ExecutionFailed(job.Type)
	}

	stopHeartbeat()
	<-heartbeatDone

	if execErr != nil {

		if errors.Is(execErr, context.Canceled) {

			if ctx.Err() != nil {
				log.Printf("job %s interrupted because worker is shutting down", job.JobID)
			} else {
				log.Printf("job %s interrupted because lease renewal failed", job.JobID)
			}

			return false
		}

		log.Printf("job %s FAILED: %v", job.JobID, execErr)

		failureResult, failureErr := client.ReportJobFailure(ctx, job.JobID, workerID, execErr.Error())

		if failureErr != nil {
			log.Printf("failed to report execution failure for job %s: %v", job.JobID, failureErr)
			return false
		}

		switch failureResult.Status {

		case "RETRYING":
			log.Printf("job %s scheduled for retry after attempt %d/%d", job.JobID, failureResult.Attempt, failureResult.MaxAttempts)
			if failureResult.NextRetryAt != nil {
				log.Printf("job %s next retry at %s", job.JobID, *failureResult.NextRetryAt)
			}
			workerMetrics.JobProcessed(job.Type, "RETRYING")

		case "FAILED":
			log.Printf("job %s permanently FAILED after attempt %d/%d", job.JobID, failureResult.Attempt, failureResult.MaxAttempts)
			workerMetrics.JobProcessed(job.Type, "FAILED")

		default:
			log.Printf("job %s returned unexpected failure state=%s", job.JobID, failureResult.Status)
			return false
		}

	} else {

		// Executor completed successfully

		if err := client.UpdateJobStatus(ctx, job.JobID, "COMPLETED", workerID); err != nil {
			log.Printf("failed to mark job %s COMPLETED, by worker %s: %v", job.JobID, workerID, err)
			return false
		}

		workerMetrics.JobProcessed(job.Type, "COMPLETED")
		log.Printf("job %s COMPLETED, by worker %s", job.JobID, workerID)
	}

	if err := reader.CommitMessages(ctx, message); err != nil {
		log.Printf("failed to commit job %s: %v", job.JobID, err)
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

	ticker := time.NewTicker(
		10 * time.Second,
	)
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

				/*
					If heartbeat was intentionally stopped
					after execution finished, just exit.
				*/
				if ctx.Err() != nil {
					return
				}

				log.Printf(
					"job %s lease renewal failed: %v",
					jobID,
					err,
				)

				/*
					We can no longer guarantee ownership
					of this job, so stop execution.
				*/
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

func runMetricsServer(
	ctx context.Context,
	addr string,
	done chan<- struct{},
) {

	defer close(done)

	server := &http.Server{Addr: addr, Handler: promhttp.Handler()}

	errCh := make(chan error, 1)

	go func() {
		log.Printf("Prometheus metrics listening on %s/metrics", addr)
		errCh <- server.ListenAndServe()
	}()

	select {

	case <-ctx.Done():

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("metrics server shutdown failed: %v", err)
		}

		err := <-errCh

		if err != nil && !errors.Is(err, http.ErrServerClosed) {

			log.Printf("metrics server stopped with error: %v", err)
		}

	case err := <-errCh:

		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("metrics server failed: %v", err)
		}
	}
}

func getOTLPEndpoint() string {

	value := os.Getenv(
		"TASKFLOW_OTEL_ENDPOINT",
	)

	if value == "" {
		return "localhost:4317"
	}

	return value
}
