package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type WorkerMetrics struct {
	jobsProcessed     *prometheus.CounterVec
	activeJobs        *prometheus.GaugeVec
	executionDuration *prometheus.HistogramVec
	executionFailures *prometheus.CounterVec
}

func New(nodeID string) *WorkerMetrics {

	registerer := prometheus.WrapRegistererWith(prometheus.Labels{"node": nodeID}, prometheus.DefaultRegisterer)

	workerMetrics := &WorkerMetrics{
		jobsProcessed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "taskflow_worker_jobs_processed_total",
				Help: "Number of job execution results successfully processed by this worker",
			},
			[]string{
				"type",
				"outcome",
			},
		),

		activeJobs: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "taskflow_worker_active_jobs",
				Help: "Number of jobs currently executing on this worker",
			},
			[]string{
				"type",
			},
		),

		executionDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "taskflow_worker_job_execution_seconds",
				Help: "Execution duration of job attempts on this worker",
				Buckets: []float64{
					0.01,
					0.05,
					0.1,
					0.25,
					0.5,
					1,
					2,
					2.5,
					5,
					10,
					20,
					30,
					60,
				},
			},
			[]string{
				"type",
			},
		),

		executionFailures: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "taskflow_worker_execution_failures_total",
				Help: "Number of genuine executor failures on this worker",
			},
			[]string{
				"type",
			},
		),
	}

	registerer.MustRegister(workerMetrics.jobsProcessed, workerMetrics.activeJobs, workerMetrics.executionDuration, workerMetrics.executionFailures)

	return workerMetrics
}

func (m *WorkerMetrics) ExecutionStarted(jobType string) {

	m.activeJobs.WithLabelValues(jobType).Inc()
}

func (m *WorkerMetrics) ExecutionFinished(jobType string, duration time.Duration) {

	m.activeJobs.WithLabelValues(jobType).Dec()
	m.executionDuration.WithLabelValues(jobType).Observe(duration.Seconds())
}

func (m *WorkerMetrics) ExecutionFailed(jobType string) {

	m.executionFailures.WithLabelValues(jobType).Inc()
}

func (m *WorkerMetrics) JobProcessed(jobType string, outcome string) {

	m.jobsProcessed.WithLabelValues(jobType, outcome).Inc()
}
