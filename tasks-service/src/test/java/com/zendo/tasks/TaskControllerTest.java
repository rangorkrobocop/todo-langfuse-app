package com.zendo.tasks;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zendo.tasks.model.Task;
import com.zendo.tasks.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
class TaskControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired TaskRepository taskRepository;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
    }

    // ── GET /tasks ─────────────────────────────────────────────────────────

    @Test
    void getTasks_returnsEmptyListWhenNoneExist() throws Exception {
        mockMvc.perform(get("/tasks"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void getTasks_returnsOnlyIncompleteTasks() throws Exception {
        Task incomplete = taskRepository.save(new Task("Incomplete task", null));
        Task complete = new Task("Complete task", null);
        complete.setCompleted(true);
        taskRepository.save(complete);

        mockMvc.perform(get("/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title", is("Incomplete task")))
                .andExpect(jsonPath("$[0].completed", is(false)));
    }

    @Test
    void getTasks_completedTrue_returnsOnlyCompletedTasks() throws Exception {
        Task complete = new Task("Complete task", null);
        complete.setCompleted(true);
        taskRepository.save(complete);
        taskRepository.save(new Task("Incomplete task", null));

        mockMvc.perform(get("/tasks?completed=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title", is("Complete task")));
    }

    // ── GET /tasks/:id ─────────────────────────────────────────────────────

    @Test
    void getTask_returnsTaskById() throws Exception {
        Task task = taskRepository.save(new Task("My task", "A description"));

        mockMvc.perform(get("/tasks/{id}", task.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("My task")))
                .andExpect(jsonPath("$.description", is("A description")))
                .andExpect(jsonPath("$.completed", is(false)));
    }

    @Test
    void getTask_returns404WhenNotFound() throws Exception {
        mockMvc.perform(get("/tasks/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", is("Task not found")));
    }

    // ── POST /tasks ────────────────────────────────────────────────────────

    @Test
    void createTask_succeeds() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("title", "New task", "description", "Details"));

        mockMvc.perform(post("/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message", containsString("created")));
    }

    @Test
    void createTask_returns400WhenTitleMissing() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("description", "No title"));

        mockMvc.perform(post("/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Title is required")));
    }

    @Test
    void createTask_returns409OnDuplicateTitle() throws Exception {
        taskRepository.save(new Task("Duplicate", null));
        String body = objectMapper.writeValueAsString(Map.of("title", "Duplicate"));

        mockMvc.perform(post("/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    // ── PUT /tasks/:id ─────────────────────────────────────────────────────

    @Test
    void updateTask_updatesFields() throws Exception {
        Task task = taskRepository.save(new Task("Old title", "Old desc"));
        String body = objectMapper.writeValueAsString(Map.of("title", "New title", "description", "New desc"));

        mockMvc.perform(put("/tasks/{id}", task.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("updated")));

        Task updated = taskRepository.findById(task.getId()).orElseThrow();
        assert updated.getTitle().equals("New title");
    }

    @Test
    void updateTask_marksTaskCompleted() throws Exception {
        Task task = taskRepository.save(new Task("Task to complete", null));
        String body = objectMapper.writeValueAsString(Map.of("completed", true));

        mockMvc.perform(put("/tasks/{id}", task.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        Task updated = taskRepository.findById(task.getId()).orElseThrow();
        assert updated.isCompleted();
    }

    // ── DELETE /tasks/:id ──────────────────────────────────────────────────

    @Test
    void deleteTask_removesTask() throws Exception {
        Task task = taskRepository.save(new Task("To delete", null));

        mockMvc.perform(delete("/tasks/{id}", task.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("deleted")));

        assert taskRepository.findById(task.getId()).isEmpty();
    }
}
