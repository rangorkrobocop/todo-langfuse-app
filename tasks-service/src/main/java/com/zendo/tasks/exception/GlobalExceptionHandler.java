package com.zendo.tasks.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(TaskNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleTaskNotFound(TaskNotFoundException e) {
        return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
    }

    /** Unique constraint violation — duplicate title. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException e) {
        return ResponseEntity.status(409).body(Map.of(
                "message", "A task with this title already exists",
                "code", "CONSTRAINT_VIOLATION"
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception e) {
        System.err.println("[TASKS-SERVICE] Unhandled error: " + e.getMessage());
        return ResponseEntity.status(500).body(Map.of(
                "message", e.getMessage() != null ? e.getMessage() : "Unknown error",
                "code", "INTERNAL_SERVER_ERROR"
        ));
    }
}
