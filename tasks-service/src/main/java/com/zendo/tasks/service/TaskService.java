package com.zendo.tasks.service;

import com.zendo.tasks.exception.TaskNotFoundException;
import com.zendo.tasks.model.Task;
import com.zendo.tasks.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    /** Returns completed tasks when completed=true, incomplete tasks otherwise (matches original behaviour). */
    @Transactional(readOnly = true)
    public List<Task> getTasks(Boolean completed) {
        return taskRepository.findByCompleted(Boolean.TRUE.equals(completed));
    }

    @Transactional(readOnly = true)
    public Task getTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException(id));
    }

    public void createTask(String title, String description) {
        taskRepository.save(new Task(title, description));
    }

    public void updateTask(Long id, String title, String description, Boolean completed) {
        Task task = getTask(id);
        if (title != null) task.setTitle(title);
        if (description != null) task.setDescription(description);
        if (completed != null) task.setCompleted(completed);
        taskRepository.save(task);
    }

    public void deleteTask(Long id) {
        taskRepository.deleteById(id);
    }
}
