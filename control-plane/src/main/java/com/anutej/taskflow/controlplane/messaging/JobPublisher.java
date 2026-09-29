package com.anutej.taskflow.controlplane.messaging;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import com.anutej.taskflow.controlplane.model.Job;

@Component
public class JobPublisher {

    private static final String TOPIC = "taskflow.jobs";

    private final KafkaTemplate<String, JobMessage> kafkaTemplate;

    public JobPublisher(KafkaTemplate<String, JobMessage> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(Job job) {

        JobMessage message = new JobMessage(
                job.getId(),
                job.getWorkloadId(),
                job.getType(),
                job.getPayload());

        kafkaTemplate.send(TOPIC, job.getId(), message);
    }
}