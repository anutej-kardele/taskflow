package com.anutej.taskflow.controlplane.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.anutej.taskflow.controlplane.model.Job;
import com.anutej.taskflow.controlplane.repository.JobRepository;

@Service
public class JobService {

    private final JobRepository jobRepository;

    public JobService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    public Optional<Job> getJobById(String id) {
        return jobRepository.findById(id);
    }
}