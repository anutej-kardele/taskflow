package health

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	heartbeatInterval = 5 * time.Second
	heartbeatTTL      = 15 * time.Second
)

type WorkerHealth struct {
	NodeID        string    `json:"nodeId"`
	Slots         int       `json:"slots"`
	StartedAt     time.Time `json:"startedAt"`
	LastHeartbeat time.Time `json:"lastHeartbeat"`
}

func RunHeartbeat(
	ctx context.Context,
	redisAddr string,
	nodeID string,
	slots int,
	startedAt time.Time,
	done chan<- struct{},
) {

	defer close(done)

	client := redis.NewClient(
		&redis.Options{
			Addr:         redisAddr,
			DialTimeout:  2 * time.Second,
			ReadTimeout:  2 * time.Second,
			WriteTimeout: 2 * time.Second,
		},
	)

	defer client.Close()

	key := "taskflow:workers:" + nodeID

	sendHeartbeat := func() {

		health := WorkerHealth{
			NodeID:        nodeID,
			Slots:         slots,
			StartedAt:     startedAt,
			LastHeartbeat: time.Now().UTC(),
		}

		payload, err := json.Marshal(
			health,
		)

		if err != nil {
			log.Printf(
				"worker health marshal failed node=%s: %v",
				nodeID,
				err,
			)

			return
		}

		err = client.Set(
			ctx,
			key,
			payload,
			heartbeatTTL,
		).Err()

		if err != nil {

			if ctx.Err() != nil {
				return
			}

			log.Printf(
				"worker heartbeat failed node=%s redis=%s: %v",
				nodeID,
				redisAddr,
				err,
			)

			return
		}

		log.Printf(
			"worker heartbeat node=%s slots=%d ttl=%s",
			nodeID,
			slots,
			heartbeatTTL,
		)
	}

	/*
		Send one heartbeat immediately instead of
		waiting for the first ticker interval.
	*/
	sendHeartbeat()

	ticker := time.NewTicker(
		heartbeatInterval,
	)

	defer ticker.Stop()

	for {

		select {

		case <-ticker.C:

			sendHeartbeat()

		case <-ctx.Done():

			/*
				This is a graceful shutdown.

				Remove the worker immediately instead
				of waiting for the TTL.

				For a crash / SIGKILL this code cannot run,
				so Redis TTL becomes the failure detector.
			*/
			unregisterCtx, cancel :=
				context.WithTimeout(
					context.Background(),
					2*time.Second,
				)

			err := client.Del(
				unregisterCtx,
				key,
			).Err()

			cancel()

			if err != nil {
				log.Printf(
					"worker health unregister failed node=%s: %v",
					nodeID,
					err,
				)
			} else {
				log.Printf(
					"worker health unregistered node=%s",
					nodeID,
				)
			}

			return
		}
	}
}
