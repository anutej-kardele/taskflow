package com.anutej.taskflow.controlplane.messaging;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import com.anutej.taskflow.controlplane.model.Job;

@Component
public class JobPublisher {

    private static final String TOPIC = "taskflow.jobs";

    private static final long SEND_TIMEOUT_SECONDS = 10;

    private final KafkaTemplate<String, JobMessage> kafkaTemplate;

    public JobPublisher(
            KafkaTemplate<String, JobMessage> kafkaTemplate) {

        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(Job job) {

        JobMessage message = new JobMessage(
                job.getId(),
                job.getWorkloadId(),
                job.getType(),
                job.getPayload());

        try {

            kafkaTemplate
                    .send(
                            TOPIC,
                            job.getId(),
                            message)
                    .get(
                            SEND_TIMEOUT_SECONDS,
                            TimeUnit.SECONDS);

        } catch (InterruptedException exception) {

            Thread.currentThread().interrupt();

            throw new IllegalStateException(
                    "Interrupted while publishing job "
                            + job.getId(),
                    exception);

        } catch (ExecutionException
                | TimeoutException exception) {

            throw new IllegalStateException(
                    "Failed to publish job "
                            + job.getId()
                            + " to Kafka",
                    exception);
        }
    }
}