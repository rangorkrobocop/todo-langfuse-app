package com.zendo.tasks.controller;

import com.zendo.tasks.model.Task;
import com.zendo.tasks.service.TaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** GET /tasks?completed=true|false — defaults to incomplete tasks when param is absent. */
    @GetMapping
    public ResponseEntity<List<Task>> getTasks(
            @RequestParam(required = false) Boolean completed) {
        return ResponseEntity.ok(taskService.getTasks(completed));
    }

    /** GET /tasks/:id */
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTask(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTask(id));
    }

    /** POST /tasks */
    @PostMapping
    public ResponseEntity<Map<String, String>> createTask(@RequestBody Map<String, String> body) {
        String title = body.get("title");
        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Title is required"));
        }
        taskService.createTask(title, body.get("description"));
        return ResponseEntity.status(201).body(Map.of("message", "Task created successfully!"));
    }

    /** PUT /tasks/:id — partial update; only provided fields are changed. */
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, String>> updateTask(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String description = (String) body.get("description");
        Boolean completed = body.containsKey("completed")
                ? Boolean.parseBoolean(String.valueOf(body.get("completed")))
                : null;
        taskService.updateTask(id, title, description, completed);
        return ResponseEntity.ok(Map.of("message", "Task updated successfully"));
    }

    /** DELETE /tasks/:id */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.ok(Map.of("message", "Task deleted successfully"));
    }
}
