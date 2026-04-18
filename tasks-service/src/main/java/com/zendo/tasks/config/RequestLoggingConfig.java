package com.zendo.tasks.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Matches the [TASKS-SERVICE] request log format from the original Node.js service. */
@Component
public class RequestLoggingConfig implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpReq = (HttpServletRequest) req;
        String query = httpReq.getQueryString();
        String url = httpReq.getRequestURI() + (query != null ? "?" + query : "");
        System.out.printf("[TASKS-SERVICE] %s %s%n", httpReq.getMethod(), url);
        chain.doFilter(req, res);
    }
}
