package com.anutej.taskflow.controlplane.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.anutej.taskflow.controlplane.service.SseEventService;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final SseEventService sseEventService;

    public EventController(
            SseEventService sseEventService) {

        this.sseEventService = sseEventService;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter connect() {

        return sseEventService.connect();
    }

}